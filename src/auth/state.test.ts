import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthController,
  AuthFailure,
  readCurrentUser,
  type AuthTransport,
} from "./state.ts";
import { isLoginPath, loginHref, safeReturnTo } from "./routing.ts";

const user = Object.freeze({
  id: "synthetic-user",
  name: "Synthetic person",
  email: "person@example.invalid",
});
function setup() {
  let current: typeof user | null = null;
  let signIns = 0;
  let signOuts = 0;
  const transport: AuthTransport = {
    currentUser: async () => current,
    signIn: async () => {
      signIns++;
      current = user;
    },
    signOut: async () => {
      signOuts++;
      current = null;
    },
  };
  return {
    transport,
    controller: new AuthController(transport),
    expire: () => {
      current = null;
    },
    counts: () => ({ signIns, signOuts }),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("protected read 401 clears identity immediately and invalidates an outstanding session response", async () => {
  const { transport, controller } = setup();
  await controller.signIn(user.email, "synthetic");
  const pending = deferred<typeof user | null>();
  transport.currentUser = () => pending.promise;
  const refresh = controller.refresh();
  controller.expireSession();
  assert.equal(controller.getSnapshot().status, "unauthenticated");
  pending.resolve(user);
  await refresh;
  assert.equal(controller.getSnapshot().user, null);
});

test("unauthenticated app load resolves authoritative absence after loading", async () => {
  const { controller } = setup();
  assert.equal(controller.getSnapshot().status, "loading");
  await controller.refresh();
  assert.deepEqual(controller.getSnapshot(), {
    status: "unauthenticated",
    user: null,
    error: null,
  });
});

test("bootstrap loading persists while the session check is pending; checks coalesce", async () => {
  const { transport, controller } = setup();
  const pending = deferred<typeof user | null>();
  let calls = 0;
  transport.currentUser = () => {
    calls++;
    return pending.promise;
  };
  const one = controller.refresh();
  const two = controller.refresh();
  assert.equal(one, two);
  assert.equal(controller.getSnapshot().status, "loading");
  pending.resolve(user);
  await one;
  assert.equal(calls, 1);
  assert.equal(controller.getSnapshot().status, "authenticated");
});

test("successful login retrieves safe current user rather than trusting sign-in data", async () => {
  const { controller, transport } = setup();
  let submittedEmail = "";
  transport.signIn = async (email) => {
    submittedEmail = email;
  };
  transport.currentUser = async () => user;
  assert.equal(
    await controller.signIn(" person@example.invalid ", "synthetic-test-input"),
    null,
  );
  assert.equal(submittedEmail, user.email);
  assert.deepEqual(controller.getSnapshot().user, user);
  assert.equal(Object.isFrozen(controller.getSnapshot().user), true);
});

test("invalid credentials never establish identity; raw errors are not retained", async () => {
  const { controller, transport } = setup();
  transport.signIn = async () => {
    throw new AuthFailure("invalid");
  };
  assert.equal(
    await controller.signIn("person@example.invalid", "synthetic-test-input"),
    "invalid",
  );
  assert.deepEqual(controller.getSnapshot(), {
    status: "unauthenticated",
    user: null,
    error: null,
  });
  transport.signIn = async () => {
    throw new Error("DO_NOT_EXPOSE_BACKEND_DETAILS");
  };
  assert.equal(
    await controller.signIn("person@example.invalid", "synthetic-test-input"),
    "unexpected",
  );
  assert.equal(
    JSON.stringify(controller.getSnapshot()).includes("DO_NOT_EXPOSE"),
    false,
  );
});

test("duplicate login and logout submissions issue one command each", async () => {
  const { controller, transport } = setup();
  const login = deferred<void>();
  let calls = 0;
  transport.signIn = async () => {
    calls++;
    await login.promise;
  };
  transport.currentUser = async () => user;
  const first = controller.signIn(
    "person@example.invalid",
    "synthetic-test-input",
  );
  await controller.signIn("person@example.invalid", "synthetic-test-input");
  assert.equal(calls, 1);
  login.resolve();
  await first;
  const logout = deferred<void>();
  calls = 0;
  transport.signOut = async () => {
    calls++;
    await logout.promise;
  };
  const out = controller.signOut();
  await controller.signOut();
  assert.equal(calls, 1);
  logout.resolve();
  await out;
});

test("logout waits for server invalidation and subsequent protected checks remain unauthenticated", async () => {
  const { controller, transport, counts } = setup();
  await controller.signIn("person@example.invalid", "synthetic-test-input");
  const pending = deferred<void>();
  const original = transport.signOut;
  transport.signOut = async () => {
    await pending.promise;
    await original();
  };
  const out = controller.signOut();
  assert.equal(controller.getSnapshot().status, "authenticated");
  pending.resolve();
  assert.equal(await out, null);
  await controller.refresh();
  assert.equal(controller.getSnapshot().status, "unauthenticated");
  assert.equal(controller.getSnapshot().user, null);
  assert.equal(counts().signOuts, 1);
});

test("logout failure preserves identity and returns a safe retryable error", async () => {
  const { controller, transport } = setup();
  await controller.signIn("person@example.invalid", "synthetic-test-input");
  transport.signOut = async () => {
    throw new AuthFailure("unavailable");
  };
  assert.equal(await controller.signOut(), "unavailable");
  assert.equal(controller.getSnapshot().status, "authenticated");
});

test("session expiry and unavailable revalidation clear all stale identity", async () => {
  const { controller, transport, expire } = setup();
  await controller.signIn("person@example.invalid", "synthetic-test-input");
  expire();
  await controller.refresh();
  assert.equal(controller.getSnapshot().user, null);
  await controller.signIn("person@example.invalid", "synthetic-test-input");
  transport.currentUser = async () => {
    throw new AuthFailure("unavailable");
  };
  await controller.refresh();
  assert.deepEqual(controller.getSnapshot(), {
    status: "unauthenticated",
    user: null,
    error: "unavailable",
  });
});

test("a pre-logout session response cannot resurrect a signed-out user", async () => {
  const { controller, transport } = setup();
  await controller.signIn("person@example.invalid", "synthetic-test-input");
  const stale = deferred<typeof user | null>();
  transport.currentUser = () => stale.promise;
  const check = controller.refresh();
  await controller.signOut();
  stale.resolve(user);
  await check;
  assert.equal(controller.getSnapshot().status, "unauthenticated");
});

test("current-user projection rejects malformed identity and excludes credential/session fields", () => {
  assert.deepEqual(
    readCurrentUser({
      user: {
        ...user,
        session: "synthetic-extra",
        password: "synthetic-extra",
        role: "ORGANIZER",
      },
    }),
    user,
  );
  for (const value of [
    null,
    {},
    { user: null },
    { user: { id: 1, name: "x", email: "x" } },
    { user: { ...user, email: "" } },
  ]) {
    assert.throws(() => readCurrentUser(value), AuthFailure);
  }
});

test("protected redirect preserves canonical task destination; authenticated Login returns safely", () => {
  assert.equal(
    loginHref("/tasks?task=a%20b"),
    "/login?returnTo=%2Ftasks%3Ftask%3Da%2520b",
  );
  assert.equal(
    safeReturnTo(
      new URL(
        "https://budograph.invalid" + loginHref("/team"),
      ).searchParams.get("returnTo"),
    ),
    "/team",
  );
  assert.equal(loginHref("/", true), "/login?reason=expired");
  assert.equal(isLoginPath("/login/"), true);
  assert.equal(isLoginPath("/tasks"), false);
});

test("redirect allowlist rejects external destinations, Login loops, encoded slashes and foreign query state", () => {
  for (const href of [
    "https://attacker.invalid",
    "//attacker.invalid",
    "/\\attacker.invalid",
    "/login",
    "/%2f%2fattacker.invalid",
    "/team#fragment",
    "javascript:alert(1)",
    "/unknown",
  ]) {
    assert.equal(safeReturnTo(href), "/");
  }
  assert.equal(safeReturnTo("/tasks?task=first&task=second"), "/tasks");
  assert.equal(safeReturnTo("/team?token=synthetic"), "/team");
});
