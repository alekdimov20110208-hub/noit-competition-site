import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { signupFields, localSignupIdentity } from "../src/auth/signup.ts";
import { createApp } from "../src/app.ts";
import { readServerEnv } from "../src/config/env.ts";
import { validateSignup } from "../../src/auth/signup.ts";
import { syntheticOperationalEnvironment } from "./helpers/operational-secrets.ts";
import {
  OperationalError,
  type SharedControls,
} from "../src/operations/limits.ts";
import type { ServerConfig } from "../src/config/env.ts";

const fields = {
  name: " Synthetic ",
  email: " PERSON@example.invalid ",
  password: "syntheticPassword123",
  confirmPassword: "syntheticPassword123",
};
const origin = "http://127.0.0.1:3001";
test("strict signup whitelist validates canonical name/email/password and rejects authority and mismatch", () => {
  assert.deepEqual(signupFields(fields), {
    name: "Synthetic",
    email: "person@example.invalid",
    password: fields.password,
  });
  for (const extra of [
    "active",
    "emailVerified",
    "role",
    "permissions",
    "userId",
    "callbackURL",
    "image",
    "__proto__",
  ])
    assert.equal(signupFields({ ...fields, [extra]: true }), null);
  for (const patch of [
    { name: " " },
    { name: "<x>" },
    { name: "\u200bX" },
    { name: "X".repeat(101) },
    { email: "bad" },
    { email: "a..b@example.invalid" },
    { password: "short", confirmPassword: "short" },
    { password: "X".repeat(129), confirmPassword: "X".repeat(129) },
    { confirmPassword: "different" },
  ])
    assert.equal(signupFields({ ...fields, ...patch }), null);
});
test("signup gate defaults OFF; only exact local opt-in parses; production cannot activate", () => {
  const env = {
    DATABASE_URL:
      "postgresql://budograph_runtime:synthetic@127.0.0.1:5432/synthetic",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: origin,
  };
  assert.equal(readServerEnv(env).publicSignupEnabled, false);
  assert.equal(
    readServerEnv({ ...env, BUDOGRAPH_PUBLIC_SIGNUP_ENABLED: "true" })
      .publicSignupEnabled,
    true,
  );
  for (const value of ["TRUE", "1", "", "yes"])
    assert.throws(
      () => readServerEnv({ ...env, BUDOGRAPH_PUBLIC_SIGNUP_ENABLED: value }),
      /local-only/,
    );
  assert.throws(
    () =>
      readServerEnv({
        ...env,
        NODE_ENV: "production",
        DATABASE_TLS_MODE: "verify-full",
        DATABASE_TLS_CA_FILE: "synthetic.pem",
        BUDOGRAPH_PUBLIC_SIGNUP_ENABLED: "true",
      }),
    /local-only/,
  );
  for (const databaseUrl of [
    "postgresql://budograph_runtime:synthetic@remote.invalid/test",
    "postgresql://postgres:synthetic@127.0.0.1/test",
  ])
    assert.throws(
      () =>
        localSignupIdentity({
          ...readServerEnv(env),
          publicSignupEnabled: true,
          databaseUrl,
        }),
      OperationalError,
    );
  assert.throws(
    () =>
      localSignupIdentity({
        ...readServerEnv(env),
        nodeEnv: "production",
        publicSignupEnabled: true,
      }),
    OperationalError,
  );
});
test("deployment labels cannot bypass runtime security or accept unknown modes", () => {
  const env = {
    DATABASE_URL:
      "postgresql://budograph_runtime:synthetic@127.0.0.1:5432/synthetic",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: "https://synthetic-review.onrender.com",
    PUBLIC_APP_URL: "https://synthetic-review.onrender.com",
    REMINDER_WORKER_ENABLED: "false",
  };
  for (const NODE_ENV of [undefined, "development", "test"])
    for (const BUDOGRAPH_DEPLOYMENT_ENV of ["staging", "production"])
      for (const BUDOGRAPH_PUBLIC_SIGNUP_ENABLED of [
        undefined,
        "false",
        "true",
      ])
        assert.throws(
          () =>
            readServerEnv({
              ...env,
              NODE_ENV,
              BUDOGRAPH_DEPLOYMENT_ENV,
              BUDOGRAPH_PUBLIC_SIGNUP_ENABLED,
            }),
          /BUDOGRAPH_DEPLOYMENT_ENV.*NODE_ENV=production/,
          `${NODE_ENV ?? "default"}/${BUDOGRAPH_DEPLOYMENT_ENV}/${BUDOGRAPH_PUBLIC_SIGNUP_ENABLED ?? "default"}`,
        );
  for (const NODE_ENV of ["development", "test", "production"])
    for (const BUDOGRAPH_DEPLOYMENT_ENV of [
      "",
      "preview",
      "development",
      "STAGING",
      "staging ",
    ])
      assert.throws(
        () =>
          readServerEnv({
            ...env,
            NODE_ENV,
            DATABASE_TLS_MODE: "verify-full",
            DATABASE_TLS_CA_FILE: "synthetic.pem",
            BUDOGRAPH_DEPLOYMENT_ENV,
          }),
        /BUDOGRAPH_DEPLOYMENT_ENV/,
      );
});
test("consistent local and hosted configurations keep exact opt-in and production veto", () => {
  const env = {
    DATABASE_URL:
      "postgresql://budograph_runtime:synthetic@127.0.0.1:5432/synthetic",
    DATABASE_TLS_MODE: "verify-full",
    DATABASE_TLS_CA_FILE: "synthetic.pem",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: "https://synthetic-review.onrender.com",
    PUBLIC_APP_URL: "https://synthetic-review.onrender.com",
    REMINDER_WORKER_ENABLED: "false",
    EMAIL_MODE: "resend",
    EMAIL_FROM: "review@example.invalid",
    RESEND_API_KEY: "re_" + randomBytes(24).toString("hex"),
    ...syntheticOperationalEnvironment(),
  };
  for (const NODE_ENV of [undefined, "development", "test", "production"])
    for (const BUDOGRAPH_DEPLOYMENT_ENV of NODE_ENV === "production"
      ? [undefined, "staging", "production"]
      : [undefined])
      for (const BUDOGRAPH_PUBLIC_SIGNUP_ENABLED of [
        undefined,
        "false",
        "true",
        "TRUE",
        "1",
        "",
        " true ",
      ])
        if (
          (BUDOGRAPH_PUBLIC_SIGNUP_ENABLED !== undefined &&
            !["true", "false"].includes(BUDOGRAPH_PUBLIC_SIGNUP_ENABLED)) ||
          (NODE_ENV === "production" &&
            BUDOGRAPH_PUBLIC_SIGNUP_ENABLED === "true")
        )
          assert.throws(
            () =>
              readServerEnv({
                ...env,
                NODE_ENV,
                BUDOGRAPH_DEPLOYMENT_ENV,
                BUDOGRAPH_PUBLIC_SIGNUP_ENABLED,
              }),
            /local-only/,
          );
        else
          assert.equal(
            readServerEnv({
              ...env,
              NODE_ENV,
              BUDOGRAPH_DEPLOYMENT_ENV,
              BUDOGRAPH_PUBLIC_SIGNUP_ENABLED,
            }).publicSignupEnabled,
            BUDOGRAPH_PUBLIC_SIGNUP_ENABLED === "true",
          );
  assert.throws(
    () => readServerEnv({ ...env, NODE_ENV: "staging" }),
    /NODE_ENV/,
  );
});
test("client and server agree on email syntax and boundary lengths; server normalizes", () => {
  const longest = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(longest.length, 254);
  for (const [email, valid] of [
    [" PERSON+tag@Example.INVALID ", true],
    ["o'neil_a-b.c@example.invalid", true],
    [`${"a".repeat(64)}@example.invalid`, true],
    [`${"a".repeat(65)}@example.invalid`, false],
    [`a@${"b".repeat(63)}.invalid`, true],
    [`a@${"b".repeat(64)}.invalid`, false],
    [`a@example.${"b".repeat(63)}`, true],
    [`a@example.${"b".repeat(64)}`, false],
    [longest, true],
    [longest + "d", false],
    ["a..b@example.invalid", false],
    [".a@example.invalid", false],
    ["a.@example.invalid", false],
    ["a@-example.invalid", false],
    ["a@example-.invalid", false],
    ["a@example..invalid", false],
    ["a@example.i", false],
    ["a@example.12", false],
    ["a@localhost", false],
    ["a@@example.invalid", false],
    ["a b@example.invalid", false],
    ["a@exämple.invalid", false],
    ["", false],
  ] as const) {
    const input = { ...fields, email, returnTo: "/" };
    assert.equal(validateSignup(input), valid ? null : "invalidEmail", email);
    const accepted = signupFields(input);
    assert.equal(accepted !== null, valid, email);
    if (accepted) assert.equal(accepted.email, email.trim().toLowerCase());
  }
});
test("database identity must match local address, port, database and least-privilege runtime role", async () => {
  const verify = localSignupIdentity({
    nodeEnv: "test",
    publicSignupEnabled: true,
    databaseUrl:
      "postgresql://budograph_runtime:synthetic@127.0.0.1:5433/synthetic",
  } as ServerConfig)!;
  const row = {
    database: "synthetic",
    role: "budograph_runtime",
    address: "127.0.0.1",
    port: 5433,
    safe: true,
  };
  await verify({ query: async () => ({ rows: [row] }) });
  for (const patch of [
    { database: "other" },
    { role: "postgres" },
    { address: "192.0.2.1" },
    { port: 5432 },
    { safe: false },
  ])
    await assert.rejects(
      verify({ query: async () => ({ rows: [{ ...row, ...patch }] }) }),
      OperationalError,
    );
});
test("HTTP gate, CSRF and validation fail before lookup; durable admission uses trusted peer first", async (t) => {
  const order: string[] = [];
  let failure: Error | null = null;
  const controls = {
    registration: async (ip: string, email: string) => {
      assert.equal(ip, "192.0.2.8");
      assert.equal(email, "person@example.invalid");
      order.push("budget");
      if (failure) throw failure;
    },
  } as SharedControls;
  const authentication = {
    baseURL: origin,
    emailEnabled: true,
    controls,
    auth: {
      api: { getSession: async () => null },
      handler: async () => {
        throw Error("General handler must not receive signup");
      },
    },
    publicSignup: async (
      input: { email: string },
      locale: string,
      callback: string,
    ) => {
      order.push("signup");
      assert.equal(input.email, "person@example.invalid");
      assert.equal(locale, "en");
      assert.equal(new URL(callback).searchParams.get("returnTo"), null);
    },
  };
  const app = createApp({ checkDatabase: async () => {}, authentication });
  const closed = createApp({
    checkDatabase: async () => {},
    authentication: { ...authentication, publicSignup: undefined },
  });
  t.after(async () => {
    await app.close();
    await closed.close();
  });
  const post = (target = app, headers = { origin }, body: object = fields) =>
    target.inject({
      method: "POST",
      url: "/api/registration",
      remoteAddress: "192.0.2.8",
      headers,
      payload: body,
    });
  assert.deepEqual((await closed.inject("/api/registration")).json(), {
    enabled: false,
  });
  assert.equal((await post(closed)).statusCode, 404);
  assert.equal(
    (await post(app, { origin: "https://attacker.invalid" })).statusCode,
    403,
  );
  assert.equal((await post(app, {} as { origin: string })).statusCode, 403);
  assert.equal(
    (
      await post(app, { origin, "sec-fetch-site": "cross-site" } as {
        origin: string;
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await post(app, { origin }, { ...fields, role: "ORGANIZER" })).statusCode,
    400,
  );
  assert.deepEqual(order, []);
  const start = performance.now();
  const result = await post(
    app,
    {
      origin,
      "x-budograph-locale": "en",
      "x-forwarded-for": "198.51.100.1",
      "x-budograph-client-ip": "198.51.100.1",
    } as { origin: string },
    { ...fields, returnTo: "https://attacker.invalid" },
  );
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.json(), { status: true });
  assert.ok(performance.now() - start >= 740);
  assert.equal(result.headers["set-cookie"], undefined);
  assert.deepEqual(order, ["budget", "signup"]);
  failure = new OperationalError(429, "RATE_LIMITED", 60);
  const denied = await post();
  assert.equal(denied.statusCode, 429);
  assert.equal(denied.headers["retry-after"], "60");
  assert.deepEqual(order, ["budget", "signup", "budget"]);
  failure = new OperationalError();
  assert.equal((await post()).statusCode, 503);
});
