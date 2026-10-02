import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { createApp } from "../src/app.ts";
import { createAuth, type AuthConfig } from "../src/auth/auth.ts";
import {
  getAuthenticatedUser,
  requireAuthenticatedUser,
  UnauthorizedError,
  type SessionAuth,
} from "../src/auth/session.ts";
import type { AuthIntegration } from "../src/routes/auth.ts";

function testConfig(): AuthConfig {
  return {
    nodeEnv: "test",
    betterAuthSecret: randomBytes(32).toString("hex"),
    betterAuthUrl: "http://127.0.0.1:3001",
  };
}

function lazyTestPool() {
  const pool = new Pool({
    connectionString: "postgresql://database.invalid/SYNTHETIC_DATABASE",
    connectionTimeoutMillis: 100,
  });
  pool.on("error", () => {});
  return pool;
}

test("real Better Auth config uses database sessions and closes public signup", async (t) => {
  const pool = lazyTestPool();
  t.after(() => pool.end());
  const auth = createAuth(pool, testConfig());
  const app = createApp({
    checkDatabase: async () => {},
    authentication: { auth, baseURL: "http://127.0.0.1:3001" },
  });
  t.after(() => app.close());

  assert.equal(auth.options.database, pool);
  assert.equal(auth.options.emailAndPassword.disableSignUp, true);
  assert.equal(auth.options.session.cookieCache.enabled, false);
  assert.equal(auth.options.user.additionalFields.active.input, false);
  assert.equal(auth.options.logger.disabled, true);
  assert.deepEqual(auth.options.trustedOrigins, ["http://127.0.0.1:3001"]);

  for (const url of ["/api/auth/sign-up/email", "/api/auth/sign-up/email/"]) {
    const response = await app.inject({
      method: "POST",
      url,
      payload: {
        name: "Synthetic person",
        email: "person@example.invalid",
        password: randomBytes(24).toString("hex"),
      },
    });
    assert.equal(response.statusCode, 404);
  }
  assert.equal(pool.totalCount, 0);
});

test("real Better Auth session helper rejects absent and malformed cookies", async (t) => {
  const pool = lazyTestPool();
  t.after(() => pool.end());
  const auth = createAuth(pool, testConfig());
  for (const headers of [
    {},
    { cookie: "better-auth.session_token=INVALID_SYNTHETIC_COOKIE" },
  ]) {
    assert.equal(await getAuthenticatedUser(auth, { headers }), null);
    await assert.rejects(
      requireAuthenticatedUser(auth, { headers }),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedError);
        assert.equal(error.statusCode, 401);
        return true;
      },
    );
  }
  assert.equal(pool.totalCount, 0);
});

test("real Better Auth rejects an untrusted auth request origin", async (t) => {
  const pool = lazyTestPool();
  t.after(() => pool.end());
  const auth = createAuth(pool, testConfig());
  const app = createApp({
    checkDatabase: async () => {},
    authentication: { auth, baseURL: "http://127.0.0.1:3001" },
  });
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-out",
    headers: {
      origin: "http://attacker.example.invalid",
      cookie: "better-auth.session_token=INVALID_SYNTHETIC_COOKIE",
    },
    payload: {},
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
  assert.equal(pool.totalCount, 0);
});

test("session creation hook checks active User using only server-derived ID", async (t) => {
  const pool = lazyTestPool();
  t.after(() => pool.end());
  const auth = createAuth(pool, testConfig());
  const hook = auth.options.databaseHooks.session.create.before;
  let active: boolean | undefined = true;
  const queries: unknown[][] = [];
  const originalQuery = pool.query;
  t.after(() => {
    pool.query = originalQuery;
  });
  pool.query = (async (...args: unknown[]) => {
    queries.push(args);
    return { rows: active === undefined ? [] : [{ active }] };
  }) as typeof pool.query;
  const session = {
    userId: "synthetic-user",
    id: "synthetic-session",
    token: "SYNTHETIC_TOKEN",
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  assert.equal(await hook(session), undefined);
  active = false;
  assert.equal(await hook(session), false);
  active = undefined;
  assert.equal(await hook(session), false);
  assert.deepEqual(
    queries,
    Array.from({ length: 3 }, () => [
      'SELECT active FROM public."user" WHERE id = $1',
      ["synthetic-user"],
    ]),
  );
});

test("provisioning is explicit and forbidden outside development", async (t) => {
  const pool = lazyTestPool();
  t.after(() => pool.end());
  for (const nodeEnv of ["test", "production"] as const) {
    assert.throws(
      () =>
        createAuth(
          pool,
          { ...testConfig(), nodeEnv },
          { developmentProvisioning: true },
        ),
      /requires NODE_ENV=development/,
    );
  }
});

test("secure-cookie configuration follows explicit HTTPS and production", async (t) => {
  const pool = lazyTestPool();
  t.after(() => pool.end());
  const auth = createAuth(pool, {
    ...testConfig(),
    betterAuthUrl: "https://auth.example.invalid",
  });
  assert.equal(auth.options.advanced.useSecureCookies, true);
  assert.deepEqual(auth.options.advanced.defaultCookieAttributes, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });
});

test("session boundary exposes only safe identity and denies inactive users", async () => {
  let active = true;
  const sessionAuth: SessionAuth = {
    api: {
      getSession: async ({ headers, query }) => {
        assert.equal(headers.get("cookie"), "synthetic=session");
        assert.equal(query?.disableCookieCache, true);
        return {
          user: {
            id: "user-one",
            name: "Synthetic person",
            email: "person@example.invalid",
            active,
            password: "SYNTHETIC_HIDDEN_PASSWORD",
          },
          session: { token: "SYNTHETIC_HIDDEN_TOKEN" },
        };
      },
    },
  };
  const request = { headers: { cookie: "synthetic=session" } };
  const user = await requireAuthenticatedUser(sessionAuth, request);
  assert.deepEqual(user, {
    id: "user-one",
    name: "Synthetic person",
    email: "person@example.invalid",
  });
  assert.ok(Object.isFrozen(user));
  active = false;
  assert.equal(await getAuthenticatedUser(sessionAuth, request), null);
  await assert.rejects(
    requireAuthenticatedUser(sessionAuth, request),
    UnauthorizedError,
  );
});

function stubIntegration(
  handler: (request: Request) => Promise<Response>,
  getSession: SessionAuth["api"]["getSession"] = async () => null,
): AuthIntegration {
  return {
    auth: { handler, api: { getSession } },
    baseURL: "http://127.0.0.1:3001",
  };
}

test("HTTP adapter forwards status/body/headers and distinct Set-Cookie headers", async (t) => {
  const app = createApp({
    checkDatabase: async () => {},
    authentication: stubIntegration(async (request) => {
      assert.equal(
        request.url,
        "http://127.0.0.1:3001/api/auth/sign-in/email?next=1",
      );
      assert.equal(request.method, "POST");
      assert.equal(request.headers.get("origin"), "http://127.0.0.1:3001");
      assert.equal(request.headers.get("cookie"), "synthetic=old");
      assert.equal(request.headers.get("x-budograph-client-ip"), "127.0.0.1");
      assert.deepEqual(await request.json(), {
        email: "person@example.invalid",
        password: "SYNTHETIC_PASSWORD",
      });
      const headers = new Headers({
        "content-type": "application/json",
        "x-auth-result": "synthetic",
      });
      headers.append(
        "set-cookie",
        "first=SYNTHETIC_ONE; Path=/; HttpOnly; SameSite=Lax",
      );
      headers.append(
        "set-cookie",
        "second=SYNTHETIC_TWO; Path=/; Expires=Wed, 01 Jan 2031 00:00:00 GMT; HttpOnly",
      );
      return new Response('{"success":true}', { status: 201, headers });
    }),
  });
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email?next=1",
    headers: {
      host: "forged.example.invalid",
      origin: "http://127.0.0.1:3001",
      cookie: "synthetic=old",
      "x-budograph-client-ip": "198.51.100.7",
    },
    payload: {
      email: "person@example.invalid",
      password: "SYNTHETIC_PASSWORD",
    },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.headers["x-auth-result"], "synthetic");
  assert.deepEqual(response.json(), { success: true });
  const cookies = response.headers["set-cookie"];
  assert.ok(Array.isArray(cookies));
  assert.equal(cookies.length, 2);
  assert.match(cookies[1]!, /Expires=Wed, 01 Jan/);
});

test("auth failures and /api/me output omit credentials/session values from logs", async (t) => {
  const sensitive = "SYNTHETIC_AUTH_LEAK_SENTINEL";
  const logs: string[] = [];
  let authenticated = false;
  const app = createApp({
    checkDatabase: async () => {},
    logger: { stream: { write: (line) => logs.push(line) } },
    authentication: stubIntegration(
      async () => {
        throw new Error(sensitive);
      },
      async () =>
        authenticated
          ? {
              user: {
                id: "user-one",
                name: "Synthetic person",
                email: "person@example.invalid",
                active: true,
                password: sensitive,
              },
              session: { token: sensitive },
            }
          : null,
    ),
  });
  t.after(() => app.close());
  const unauthorized = await app.inject({
    method: "GET",
    url: "/api/me",
    headers: { cookie: sensitive },
  });
  assert.equal(unauthorized.statusCode, 401);
  authenticated = true;
  const me = await app.inject({ method: "GET", url: "/api/me" });
  assert.equal(me.statusCode, 200);
  assert.deepEqual(me.json(), {
    user: {
      id: "user-one",
      name: "Synthetic person",
      email: "person@example.invalid",
    },
  });
  const failed = await app.inject({
    method: "POST",
    url: `/api/auth/sign-in/email?secret=${sensitive}`,
    headers: { cookie: sensitive, authorization: sensitive },
    payload: { email: "person@example.invalid", password: sensitive },
  });
  assert.equal(failed.statusCode, 500);
  assert.equal(
    `${unauthorized.body}${me.body}${failed.body}${logs.join("")}`.includes(
      sensitive,
    ),
    false,
  );
});
