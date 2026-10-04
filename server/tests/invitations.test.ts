import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createApp } from "../src/app.ts";
import { createAuth } from "../src/auth/auth.ts";
import {
  exactInput,
  generateInvitationToken,
  hashInvitationToken,
  invitationLifetimeSeconds,
  InvitationError,
  normalizeEmail,
  parseInvitedEmail,
} from "../src/invitations/model.ts";
import type { InvitationService } from "../src/invitations/service.ts";

test("tokens contain 256 random bits, are distinct and hash to a fixed digest", () => {
  const tokens = Array.from({ length: 100 }, generateInvitationToken);
  assert.equal(new Set(tokens).size, 100);
  for (const token of tokens) {
    assert.equal(Buffer.from(token, "base64url").length, 32);
    assert.match(hashInvitationToken(token), /^[a-f0-9]{64}$/);
    assert.notEqual(hashInvitationToken(token), token);
  }
  assert.equal(invitationLifetimeSeconds, 604800);
  for (const token of ["", randomUUID(), "../", "a".repeat(44)])
    assert.throws(() => hashInvitationToken(token), InvitationError);
});
test("email normalization preserves tags and rejects incompatible/bounded input", () => {
  assert.equal(
    parseInvitedEmail("  Person+Tag@Example.COM "),
    "person+tag@example.com",
  );
  assert.equal(normalizeEmail(" Mixed@Example.COM "), "mixed@example.com");
  for (const email of [
    null,
    "",
    "a",
    "a..b@example.com",
    ".a@example.com",
    "a@example",
    "a@-example.com",
    "a\u0000@example.com",
    "a".repeat(255) + "@example.com",
    "a@exämple.com",
  ])
    assert.throws(() => parseInvitedEmail(email), InvitationError);
});
test("command inputs reject every authority, identity, timestamp and token override", () => {
  for (const field of [
    "eventId",
    "userId",
    "accessRole",
    "actor",
    "token",
    "acceptedAt",
    "createdAt",
    "expiresAt",
    "email",
  ]) {
    assert.throws(() => exactInput({ [field]: "forged" }, []), InvitationError);
    if (field !== "email")
      assert.throws(
        () =>
          exactInput({ email: "a@example.com", [field]: "forged" }, ["email"]),
        InvitationError,
      );
  }
});
test("private Better Auth registration shares configuration but HTTP signup stays disabled", async (t) => {
  const pool = new Pool({
    connectionString: "postgresql://database.invalid/SYNTHETIC_DATABASE",
  });
  pool.on("error", () => {});
  t.after(() => pool.end());
  const auth = createAuth(
    pool,
    {
      nodeEnv: "test",
      betterAuthSecret: randomBytes(32).toString("hex"),
      betterAuthUrl: "http://127.0.0.1:3001",
    },
    { invitationRegistration: true },
  );
  assert.equal(auth.options.emailAndPassword.disableSignUp, false);
  assert.equal(auth.options.emailAndPassword.autoSignIn, false);
  assert.equal(auth.options.database, pool);
  for (const path of ["/api/auth/sign-up/email", "/api/auth/sign-up/email/"]) {
    const result = await auth.handler(
      new Request("http://127.0.0.1:3001" + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "person@example.invalid",
          name: "Synthetic",
          password: randomBytes(16).toString("hex"),
        }),
      }),
    );
    assert.equal(result.status, 404);
  }
  assert.equal(pool.totalCount, 0);
});
test("HTTP auth/origin/body limits protect invitations; minimal errors and tokens never reach logs", async (t) => {
  let signedIn = true,
    calls = 0;
  const logs: string[] = [],
    token = generateInvitationToken();
  const service = {
    list: async () => {
      calls++;
      return [];
    },
    create: async () => {
      calls++;
      return {
        invitation: {
          id: randomUUID(),
          email: "a@example.com",
          state: "pending",
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
        token,
      };
    },
    revoke: async () => {
      throw new InvitationError(409, "INVITATION_ACCEPTED");
    },
    lookup: async () => {
      throw new InvitationError(404, "NOT_FOUND");
    },
    accept: async () => {
      throw new InvitationError(403, "WRONG_ACCOUNT");
    },
    register: async () => {
      calls++;
      return { status: "sign_in_required" };
    },
  } as InvitationService;
  const app = createApp({
    checkDatabase: async () => {},
    logger: { stream: { write: (line) => logs.push(line) } },
    authentication: {
      baseURL: "http://127.0.0.1:3001",
      auth: {
        api: {
          getSession: async () =>
            signedIn
              ? {
                  user: {
                    id: "synthetic",
                    name: "Synthetic",
                    email: "a@example.com",
                    active: true,
                  },
                }
              : null,
        },
        handler: async () => new Response(),
      },
    },
    invitations: service,
  });
  t.after(() => app.close());
  const path = `/api/events/${randomUUID()}/invitations`;
  signedIn = false;
  assert.equal(
    (await app.inject({ method: "GET", url: path })).statusCode,
    401,
  );
  signedIn = true;
  for (const headers of [
    {},
    { origin: "https://foreign.invalid" },
    { origin: "http://127.0.0.1:3001", "sec-fetch-site": "cross-site" },
  ])
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path,
          headers,
          payload: { email: "a@example.com" },
        })
      ).statusCode,
      403,
    );
  assert.equal(calls, 0);
  const created = await app.inject({
    method: "POST",
    url: path,
    headers: { origin: "http://127.0.0.1:3001" },
    payload: { email: "a@example.com" },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().developmentInvitePath, `/invite/${token}`);
  assert.equal(created.headers["cache-control"], "no-store");
  assert.equal(created.headers["referrer-policy"], "no-referrer");
  const failed = await app.inject({
    method: "GET",
    url: `/api/invitations/${token}`,
  });
  assert.deepEqual(failed.json(), { status: "error", code: "NOT_FOUND" });
  assert.equal(logs.join("").includes(token), false);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: path,
        headers: { origin: "http://127.0.0.1:3001" },
        payload: { email: "a".repeat(2000) },
      })
    ).statusCode,
    413,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/invitations/${token}/register`,
        headers: { origin: "http://127.0.0.1:3001" },
        payload: {
          name: "Synthetic",
          password: randomBytes(16).toString("hex"),
        },
      })
    ).statusCode,
    403,
  );
  signedIn = false;
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/invitations/${token}/register`,
          headers: { origin: "http://127.0.0.1:3001" },
          payload: {},
        })
      ).statusCode,
      i === 4 ? 429 : 200,
    );
});
