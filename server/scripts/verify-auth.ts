import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { LightMyRequestResponse } from "fastify";
import { createApp } from "../src/app.ts";
import { createAuth } from "../src/auth/auth.ts";
import { readDevelopmentAccounts } from "../src/auth/development-accounts.ts";
import { EnvironmentError, readServerEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createShutdown } from "../src/shutdown.ts";

// Explicit development verification: persists no business/demo data; signs out
// only the two sessions created here. Credentials and response cookies stay in memory.
let pool: ReturnType<typeof createDatabasePool> | undefined;
let app: ReturnType<typeof createApp> | undefined;
const sessionCookies: string[] = [];
const pendingLogout = new Set<string>();
let authOrigin: string | undefined;
let stage = "configuration";
try {
  const config = readServerEnv();
  authOrigin = config.betterAuthUrl;
  if (config.nodeEnv !== "development")
    throw new EnvironmentError("Auth verification is DEVELOPMENT ONLY.");
  const accounts = readDevelopmentAccounts();
  pool = createDatabasePool(config, () => {});
  const database = pool;
  const auth = createAuth(pool, config);
  stage = "listener and unauthenticated requests";
  const logs: string[] = [];
  app = createApp({
    checkDatabase: async () => {
      await database.query("SELECT 1");
    },
    authentication: { auth, baseURL: config.betterAuthUrl },
    logger: {
      stream: {
        write: (line) => {
          logs.push(line);
        },
      },
    },
  });
  // Start the actual Fastify listener as well as exercising injection handlers.
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address !== "string");
  const live = await fetch(`http://127.0.0.1:${address.port}/api/health/live`);
  assert.equal(live.status, 200);
  assert.equal(
    (await app.inject({ method: "GET", url: "/api/health/ready" })).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ method: "GET", url: "/api/me" })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/api/me",
        headers: {
          cookie: "better-auth.session_token=INVALID_SYNTHETIC_SESSION",
        },
      })
    ).statusCode,
    401,
  );
  const signupEmail = `p1b-denied-${randomBytes(8).toString("hex")}@example.invalid`;
  stage = "public signup denial";
  const denied = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    payload: {
      email: signupEmail,
      password: randomBytes(24).toString("base64url"),
      name: "Denied signup",
    },
  });
  assert.equal(denied.statusCode, 404);
  await assert.rejects(
    auth.api.signUpEmail({
      body: {
        email: signupEmail,
        password: randomBytes(24).toString("base64url"),
        name: "Denied server signup",
      },
    }),
    (error: unknown) => {
      assert.ok(typeof error === "object" && error !== null && "body" in error);
      const body = error.body as { code?: unknown };
      assert.equal(body.code, "EMAIL_PASSWORD_SIGN_UP_DISABLED");
      return true;
    },
  );
  stage = "origin and invalid credentials";
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::integer AS count FROM public."user" WHERE email=$1',
        [signupEmail],
      )
    ).rows[0]?.count,
    0,
  );
  const foreignOrigin = await app.inject({
    method: "POST",
    url: "/api/auth/sign-out",
    headers: {
      origin: "https://foreign.example.invalid",
      cookie: "better-auth.session_token=INVALID_SYNTHETIC_SESSION",
    },
    payload: {},
  });
  assert.equal(foreignOrigin.statusCode, 403);
  assert.equal(foreignOrigin.headers["access-control-allow-origin"], undefined);
  const wrongPassword = randomBytes(24).toString("base64url");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: accounts[0]?.email, password: wrongPassword },
      })
    ).statusCode,
    401,
  );
  const users: { id: string; baseline: number }[] = [];
  for (const account of accounts) {
    stage = `${account.label} sign-in`;
    const user = (
      await pool.query(
        'SELECT id FROM public."user" WHERE email=$1 AND active=true',
        [account.email],
      )
    ).rows[0] as { id: string } | undefined;
    assert.ok(user);
    const baseline = (
      await pool.query(
        'SELECT count(*)::integer AS count FROM public.session WHERE "userId"=$1',
        [user.id],
      )
    ).rows[0]?.count as number;
    users.push({ id: user.id, baseline });
    const signedIn: LightMyRequestResponse = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin: config.betterAuthUrl },
      payload: { email: account.email, password: account.password },
    });
    assert.equal(signedIn.statusCode, 200);
    stage = `${account.label} cookies and identity`;
    const setCookies = signedIn.headers["set-cookie"];
    const cookies =
      typeof setCookies === "string" ? [setCookies] : (setCookies ?? []);
    assert.ok(cookies.length > 0);
    assert.ok(
      cookies.some(
        (cookie) => /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie),
      ),
    );
    const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
    sessionCookies.push(cookie);
    pendingLogout.add(cookie);
    const me: LightMyRequestResponse = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { cookie },
    });
    assert.equal(me.statusCode, 200);
    assert.deepEqual(me.json(), {
      user: { id: user.id, name: account.name, email: account.email },
    });
    assert.doesNotMatch(me.body, /token|password|account|expiresAt|ipAddress/);
    stage = `${account.label} database session`;
    const session: LightMyRequestResponse = await app.inject({
      method: "GET",
      url: "/api/auth/get-session",
      headers: { cookie },
    });
    assert.equal(session.statusCode, 200);
    assert.equal(session.json().user.id, user.id);
    assert.ok(await auth.api.getSession({ headers: new Headers({ cookie }) }));
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::integer AS count FROM public.session WHERE "userId"=$1',
          [user.id],
        )
      ).rows[0]?.count,
      baseline + 1,
    );
  }
  assert.notEqual(sessionCookies[0], sessionCookies[1]);
  for (let index = 0; index < sessionCookies.length; index += 1) {
    stage = `session ${index + 1} logout`;
    const cookie = sessionCookies[index];
    const user = users[index];
    assert.ok(cookie && user);
    const signout: LightMyRequestResponse = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { cookie, origin: config.betterAuthUrl },
      payload: {},
    });
    assert.equal(signout.statusCode, 200);
    pendingLogout.delete(cookie);
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/me", headers: { cookie } }))
        .statusCode,
      401,
    );
    assert.equal(
      await auth.api.getSession({ headers: new Headers({ cookie }) }),
      null,
    );
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::integer AS count FROM public.session WHERE "userId"=$1',
          [user.id],
        )
      ).rows[0]?.count,
      user.baseline,
    );
    if (index === 0)
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: "/api/me",
            headers: { cookie: sessionCookies[1] },
          })
        ).statusCode,
        200,
      );
  }
  for (const secret of [
    config.databaseUrl,
    config.betterAuthSecret,
    wrongPassword,
    ...accounts.map(({ password }) => password),
    ...sessionCookies,
  ]) {
    assert.equal(logs.join("").includes(secret), false);
  }
  for (const cookie of sessionCookies) {
    for (const item of cookie.split("; ")) {
      const value = item.slice(item.indexOf("=") + 1);
      assert.equal(logs.join("").includes(value), false);
      assert.equal(logs.join("").includes(decodeURIComponent(value)), false);
    }
  }
  console.info(
    "Real auth verification: listener/readiness PASS; public signup CLOSED; organizer/member sign-in PASS; database sessions/session lookup PASS; isolated logout PASS; unauthenticated/invalid sessions 401; foreign origin 403; safe identity/logs PASS.",
  );
} catch (error) {
  if (
    typeof error === "object" &&
    error !== null &&
    "actual" in error &&
    "expected" in error &&
    typeof error.actual === "number" &&
    typeof error.expected === "number"
  ) {
    console.error(
      `Verification numeric result: expected ${error.expected}, received ${error.actual}.`,
    );
  }
  console.error(
    error instanceof EnvironmentError
      ? error.message
      : `Real auth verification failed at ${stage}; credentials, sessions and database details omitted.`,
  );
  process.exitCode = 1;
} finally {
  // On failure, revoke only sessions created by this command through Better Auth.
  if (app) {
    for (const cookie of pendingLogout) {
      try {
        const cleanup = await app.inject({
          method: "POST",
          url: "/api/auth/sign-out",
          headers: { cookie, origin: authOrigin },
          payload: {},
        });
        if (cleanup.statusCode !== 200) {
          console.error(
            "Verification session cleanup failed; details omitted.",
          );
          process.exitCode = 1;
        }
      } catch {
        console.error("Verification session cleanup failed; details omitted.");
        process.exitCode = 1;
      }
    }
  }
  const shutdown = createShutdown({
    closeApp: async () => {
      await app?.close();
    },
    closeDatabase: async () => {
      await pool?.end();
    },
    onFailure: (cleanupStage) => {
      console.error(
        `Auth verification ${cleanupStage} cleanup failed; details omitted.`,
      );
    },
  });
  if (!(await shutdown())) process.exitCode = 1;
}
