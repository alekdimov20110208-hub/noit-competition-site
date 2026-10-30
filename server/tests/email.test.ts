import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import {
  createEmailTasks,
  createTransactionalEmailService,
  renderEmail,
  trustedEmailUrl,
  EmailDeliveryError,
  type TransactionalEmailService,
} from "../src/email/service.ts";
import { createEmailThrottle } from "../src/email/throttle.ts";
import { readServerEnv, EnvironmentError } from "../src/config/env.ts";
import { syntheticOperationalEnvironment } from "./helpers/operational-secrets.ts";
import { createApp } from "../src/app.ts";
import type { InvitationService } from "../src/invitations/service.ts";
import { safeEmailReturnTo } from "../src/routes/auth.ts";
const origin = "https://app.example.invalid",
  token = randomBytes(32).toString("base64url");
test("BG/EN templates escape Event content, have plain text and only transactional context", () => {
  for (const locale of ["bg", "en"] as const)
    for (const kind of ["invitation", "verification", "reset"] as const) {
      const message = renderEmail({
        kind,
        locale,
        to: "recipient@example.invalid",
        url: `${origin}/invite/${token}`,
        eventName: '<script>"&',
        expiresAt: "2026-11-01T00:00:00Z",
      });
      assert.match(message.text, /BudoGraph/);
      assert.ok(message.text.includes(token));
      assert.doesNotMatch(message.html, /<script>/);
      assert.match(message.html, new RegExp(`lang="${locale}"`));
      if (kind === "invitation")
        assert.ok(
          message.text.includes(locale === "bg" ? "Участник" : "Member"),
        );
      assert.doesNotMatch(message.text, /Task|Team|Change/);
    }
});
test("Resend HTTP acceptance, rejection, network and malformed responses use only safe errors/logs", async () => {
  const key = `re_${randomBytes(20).toString("hex")}`,
    logs: string[] = [];
  for (const outcome of ["success", "rejected", "network", "malformed"]) {
    const service = createTransactionalEmailService(
      {
        emailMode: "resend",
        emailFrom: "BudoGraph <no-reply@example.invalid>",
        resendApiKey: key,
        publicAppUrl: origin,
      },
      (kind) => logs.push(kind),
      async (url, options) => {
        assert.equal(url, "https://api.resend.com/emails");
        assert.equal(options?.redirect, "error");
        assert.equal(
          new Headers(options?.headers).get("authorization"),
          `Bearer ${key}`,
        );
        const body = JSON.parse(String(options?.body));
        assert.deepEqual(body.to, ["recipient@example.invalid"]);
        assert.ok(body.html && body.text);
        if (outcome === "network") throw new Error(`${key} ${token}`);
        return new Response(
          JSON.stringify(
            outcome === "success"
              ? { id: randomUUID() }
              : { error: `${key} ${token}` },
          ),
          { status: outcome === "rejected" ? 403 : 200 },
        );
      },
    );
    const work = service.send({
      kind: "invitation",
      locale: "en",
      to: "recipient@example.invalid",
      url: `${origin}/invite/${token}`,
    });
    if (outcome === "success") await work;
    else
      await assert.rejects(
        work,
        (error) =>
          error instanceof EmailDeliveryError &&
          !error.message.includes(key) &&
          !error.message.includes(token),
      );
  }
  assert.deepEqual(logs, ["invitation", "invitation", "invitation"]);
});
test("trusted email URLs reject foreign origins, callback poisoning and unknown paths", () => {
  assert.equal(
    trustedEmailUrl(origin, `/invite/${token}`),
    `${origin}/invite/${token}`,
  );
  for (const path of [
    "https://foreign.invalid/invite/" + token,
    "//foreign.invalid/invite/" + token,
    "/tasks",
    "/api/auth/verify-email?callbackURL=https%3A%2F%2Fforeign.invalid",
    "/api/auth/reset-password/abc?callbackURL=%2F%2Fforeign.invalid",
  ])
    assert.throws(() => trustedEmailUrl(origin, path), EmailDeliveryError);
});
test("production fail-fast email validation and deliberate disabled development", () => {
  const env = {
    NODE_ENV: "production",
    ...syntheticOperationalEnvironment(),
    DATABASE_URL: "postgres://database.invalid/synthetic",
    DATABASE_TLS_CA_FILE: "SYNTHETIC_CA_FILE.pem",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: origin,
    PUBLIC_APP_URL: origin,
    EMAIL_FROM: "BudoGraph <no-reply@example.invalid>",
    RESEND_API_KEY: `re_${randomBytes(20).toString("hex")}`,
  };
  assert.equal(readServerEnv(env).emailMode, "resend");
  for (const invalid of [
    { EMAIL_MODE: "disabled" },
    { EMAIL_FROM: undefined },
    { RESEND_API_KEY: undefined },
    { PUBLIC_APP_URL: "http://localhost:5173" },
    { PUBLIC_APP_URL: "https://other.invalid" },
    { EMAIL_FROM: "no-reply@resend.dev" },
    { EMAIL_FROM: "BudoGraph <no-reply@example.invalid" },
  ])
    assert.throws(
      () => readServerEnv({ ...env, ...invalid }),
      EnvironmentError,
    );
  assert.equal(
    readServerEnv({ ...env, NODE_ENV: "development", EMAIL_MODE: "disabled" })
      .emailMode,
    "disabled",
  );
  for (const local of [
    "https://app.localhost",
    "https://127.0.0.1",
    "https://[::ffff:127.0.0.1]",
  ])
    assert.throws(
      () =>
        readServerEnv({
          ...env,
          BETTER_AUTH_URL: local,
          PUBLIC_APP_URL: local,
        }),
      EnvironmentError,
    );
});
test("mail limits count direct IP and identity independently, expire and bound unique requests", () => {
  let now = 0;
  const limit = createEmailThrottle(() => now);
  for (let i = 0; i < 3; i++)
    assert.equal(limit("peer", "same@example.invalid"), true);
  assert.equal(limit("different-peer", " SAME@example.invalid "), false);
  for (let i = 0; i < 7; i++)
    assert.equal(limit("peer", `different${i}@example.invalid`), true);
  assert.equal(limit("peer", "last@example.invalid"), false);
  now = 900_001;
  assert.equal(limit("peer", "same@example.invalid"), true);
  const globalLimit = createEmailThrottle(() => 0);
  for (let i = 0; i < 100; i++)
    assert.equal(
      globalLimit(`peer-${i}`, `recipient-${i}@example.invalid`),
      true,
    );
  assert.equal(globalLimit("another-peer", "another@example.invalid"), false);
});
test("Fastify production invitation responses hide bearer link on success/failure, resend sends same scoped command", async (t) => {
  const invitation = {
    id: randomUUID(),
    email: "recipient@example.invalid",
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    state: "pending",
  };
  let failing = false,
    calls = 0;
  const service = {
    create: async () => ({
      invitation,
      token,
      eventName: "Private event name",
    }),
    resend: async () => {
      calls++;
      return { invitation, token, eventName: "Private event name" };
    },
  } as unknown as InvitationService;
  const email: TransactionalEmailService = {
    enabled: true,
    send: async (message) => {
      assert.equal(message.to, invitation.email);
      assert.equal(new URL(message.url).origin, origin);
      assert.equal(message.locale, "en");
      if (failing) throw new Error(token);
    },
  };
  const logs: string[] = [];
  const app = createApp({
    checkDatabase: async () => {},
    invitations: service,
    email,
    logger: { stream: { write: (line) => logs.push(line) } },
    authentication: {
      baseURL: origin,
      publicAppUrl: origin,
      developmentInviteLinks: false,
      auth: {
        handler: async () => new Response(),
        api: {
          getSession: async () => ({
            user: {
              id: "organizer",
              email: "org@example.invalid",
              name: "Organizer",
              active: true,
            },
          }),
        },
      },
    },
  });
  t.after(() => app.close());
  const headers = {
      origin,
      host: "attacker.invalid",
      "x-budograph-locale": "en",
    },
    path = `/api/events/${randomUUID()}/invitations`;
  for (const failure of [false, true]) {
    failing = failure;
    const response = await app.inject({
      method: "POST",
      url: path,
      headers,
      payload: { email: invitation.email },
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().delivery, failure ? "failed" : "sent");
    assert.equal(response.json().developmentInvitePath, undefined);
    assert.equal(response.body.includes(token), false);
  }
  const resend = await app.inject({
    method: "POST",
    url: path + `/${invitation.id}/resend`,
    headers,
    payload: {},
  });
  assert.equal(resend.json().invitation.id, invitation.id);
  assert.equal(calls, 1);
  assert.equal(resend.body.includes(token), false);
  for (let i = 0; i < 27; i++)
    assert.equal(
      (await app.inject({ method: "POST", url: path, headers, payload: {} }))
        .statusCode,
      201,
    );
  assert.equal(
    (await app.inject({ method: "POST", url: path, headers, payload: {} }))
      .statusCode,
    429,
  );
  assert.equal(logs.join("").includes(token), false);
});
test("auth requests use generic public responses and server-controlled callbacks independent of Host", async (t) => {
  const bodies: Record<string, string>[] = [];
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: origin,
      publicAppUrl: origin,
      emailEnabled: true,
      auth: {
        api: { getSession: async () => null },
        handler: async (request) => {
          bodies.push(await request.json());
          return new Response(
            JSON.stringify({ message: "EMAIL_ALREADY_VERIFIED" }),
            { status: 400 },
          );
        },
      },
    },
  });
  t.after(() => app.close());
  for (const path of ["request-password-reset", "send-verification-email"]) {
    const response = await app.inject({
      method: "POST",
      url: `/api/auth/${path}`,
      headers: { origin, host: "attacker.invalid" },
      payload: {
        email: `${path}@example.invalid`,
        callbackURL: "https://attacker.invalid",
        redirectTo: "https://attacker.invalid",
        returnTo: "//attacker.invalid",
      },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: true });
  }
  assert.equal(bodies[0]?.redirectTo, origin + "/reset-password");
  assert.equal(
    bodies[1]?.callbackURL,
    origin + "/verify-email?status=verified",
  );
});
test("verification continuation preserves known workspace destinations and rejects redirect/encoded/query poisoning", () => {
  const event = randomUUID(),
    task = randomUUID();
  for (const path of [
    "/team",
    "/tasks?task=task-transport",
    `/events/${event}/dashboard`,
    `/events/${event}/tasks?task=${task}`,
    `/events/${event}/changes/${randomUUID()}`,
    `/invite/${token}`,
  ])
    assert.equal(safeEmailReturnTo(path), path);
  for (const path of [
    "//attacker.invalid",
    "https://attacker.invalid",
    "/\\attacker.invalid",
    "/%2fattacker.invalid",
    "/tasks?task=a&next=evil",
    "/login",
    "/team#evil",
    "/events/not-a-uuid/team",
  ])
    assert.equal(safeEmailReturnTo(path), "/");
});
test("auth background work completes on drain and handles failures", async () => {
  const tasks = createEmailTasks();
  let count = 0;
  tasks.submit(async () => {
    await Promise.resolve();
    count++;
  });
  tasks.submit(async () => {
    throw new Error("synthetic");
  });
  await tasks.drain();
  assert.equal(count, 1);
});
