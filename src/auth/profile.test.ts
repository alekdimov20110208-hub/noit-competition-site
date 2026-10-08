import assert from "node:assert/strict";
import test from "node:test";
import { AuthController } from "./state.ts";
import {
  avatarInitials,
  validDisplayName,
  ProfileController,
  profileCommand,
} from "./profile.ts";
import { safeReturnTo, loginHref } from "./routing.ts";
import { APP_ROUTES, parseAppLocation, eventHref } from "../routes.ts";

test("names trim and validate bounded Unicode without markup/controls", () => {
  for (const name of [
    " Иван Петров ",
    "李 小龍",
    "Élodie O’Connor",
    "A".repeat(100),
  ])
    assert.ok(validDisplayName(name));
  for (const name of [
    " ",
    "A".repeat(101),
    "<script>",
    "a\nname",
    "a\u202ename",
    "🤖",
    "\ud800a",
  ])
    assert.equal(validDisplayName(name), false);
});
test("initials choose first/last words safely, Unicode graphemes and empty fallback", () => {
  for (const [name, initials] of [
    ["Иван Георги Петров", "ИП"],
    ["李 小龍", "李小"],
    ["Élodie", "É"],
    ["e\u0301mil Stone", "ÉS"],
    ["😀 A B", "AB"],
    [" \u202e ", "?"],
    ["O’Connor", "OC"],
  ])
    assert.equal(avatarInitials(name!), initials);
});
test("profile is global, has safe login continuation and no primary navigation entry", () => {
  assert.deepEqual(parseAppLocation("/account", "?userId=forged"), {
    path: "/account",
    taskId: null,
    eventId: null,
    eventMode: "workspace",
  });
  assert.equal(safeReturnTo("/account"), "/account");
  assert.equal(safeReturnTo("/account?returnTo=https://evil.invalid"), "/");
  assert.equal(
    loginHref("/account", true),
    "/login?returnTo=%2Faccount&reason=expired",
  );
  assert.equal(
    APP_ROUTES.some((route) => route.path === "/account"),
    false,
  );
  assert.equal(eventHref("fixture", "/account"), "/account");
});
async function fixture() {
  let user = {
    id: "synthetic",
    name: "Before",
    email: "synthetic@example.invalid",
  };
  const auth = new AuthController({
    currentUser: async () => user,
    signIn: async () => {},
    signOut: async () => {},
  });
  await auth.refresh();
  return {
    auth,
    rename: () => {
      user = { ...user, name: "After" };
    },
  };
}
test("confirmed name write reloads server identity and failed writes keep identity", async () => {
  const f = await fixture();
  const controller = new ProfileController(f.auth, async (path, fields) => {
    assert.equal(path, "update-user");
    assert.deepEqual(fields, { name: "After" });
    f.rename();
    return null;
  });
  assert.equal(await controller.run("update-user", { name: "After" }), null);
  assert.equal(f.auth.getSnapshot().user?.name, "After");
  const failed = new ProfileController(f.auth, async () => "failed");
  assert.equal(
    await failed.run("update-user", { name: "Not saved" }),
    "failed",
  );
  assert.equal(f.auth.getSnapshot().user?.name, "After");
});
test("account commands gate duplicate submits and expire authoritative 401", async () => {
  const f = await fixture();
  let finish!: (error: "expired") => void;
  const controller = new ProfileController(
    f.auth,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = controller.run("change-password", {});
  await f.auth.refresh();
  assert.equal(await f.auth.signOut(), "unexpected");
  assert.equal(f.auth.getSnapshot().status, "authenticated");
  assert.equal(await controller.run("update-user", {}), "busy");
  let remountedWrites = 0;
  const remounted = new ProfileController(f.auth, async () => {
    remountedWrites++;
    return "failed";
  });
  assert.equal(await remounted.run("update-user", {}), "busy");
  assert.equal(remountedWrites, 0);
  assert.equal(await f.auth.signOut(), "unexpected");
  finish("expired");
  assert.equal(await first, "expired");
  assert.equal(f.auth.getSnapshot().user, null);
});
test("identity refresh supersedes stale reads and cannot restore a logged-out account", async () => {
  let mode = "initial";
  const before = {
    id: "synthetic",
    name: "Before",
    email: "synthetic@example.invalid",
  };
  let stale!: (value: typeof before) => void;
  let current!: (value: typeof before) => void;
  const auth = new AuthController({
    currentUser: () =>
      mode === "initial"
        ? Promise.resolve(before)
        : new Promise((resolve) => {
            if (mode === "stale") stale = resolve;
            else current = resolve;
          }),
    signIn: async () => {},
    signOut: async () => {},
  });
  await auth.refresh();
  mode = "stale";
  const oldRead = auth.refresh();
  mode = "current";
  const newRead = auth.refreshIdentity(before.id);
  current({ ...before, name: "After" });
  assert.equal(await newRead, null);
  stale(before);
  await oldRead;
  assert.equal(auth.getSnapshot().user?.name, "After");
  const lateRead = auth.refreshIdentity(before.id);
  await auth.signOut();
  current(before);
  assert.equal(await lateRead, "expired");
  assert.equal(auth.getSnapshot().user, null);
});
test("failed identity reload reports partial confirmation and keeps canonical prior identity", async () => {
  let fail = false;
  const auth = new AuthController({
    currentUser: async () => {
      if (fail) throw new Error("private diagnostic");
      return {
        id: "synthetic",
        name: "Before",
        email: "synthetic@example.invalid",
      };
    },
    signIn: async () => {},
    signOut: async () => {},
  });
  await auth.refresh();
  fail = true;
  const controller = new ProfileController(auth, async () => null);
  assert.equal(
    await controller.run("update-user", { name: "After" }),
    "refresh",
  );
  assert.equal(auth.getSnapshot().user?.name, "Before");
});
test("password command handles safe success/errors and never accepts malformed success", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const [status, body, expected] of [
    [200, { status: true }, null],
    [200, {}, "failed"],
    [400, { code: "INVALID_PASSWORD" }, "wrongPassword"],
    [403, { code: "SESSION_EXPIRED" }, "reauthenticate"],
    [401, {}, "expired"],
    [429, {}, "limited"],
    [503, {}, "unavailable"],
  ] as const) {
    globalThis.fetch = async (_input, options) => {
      assert.equal(options?.credentials, "same-origin");
      return new Response(JSON.stringify(body), { status });
    };
    assert.equal(
      await profileCommand("change-password", {
        currentPassword: "synthetic",
        newPassword: "synthetic-new",
      }),
      expected,
    );
  }
  globalThis.fetch = async () => {
    throw new Error("private diagnostic");
  };
  assert.equal(
    await profileCommand("update-user", { name: "Synthetic" }),
    "unavailable",
  );
});
