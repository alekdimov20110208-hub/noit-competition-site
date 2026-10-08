import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import { profileName, profilePassword } from "../src/auth/profile.ts";

test("name allowlist preserves sensitive fields by rejecting extras and malformed payloads", () => {
  assert.equal(profileName({ name: " Иван Петров " }), "Иван Петров");
  for (const body of [
    null,
    [],
    "name",
    {},
    { name: 1 },
    { name: " " },
    { name: "a".repeat(101) },
    { name: "a\u202e" },
    { name: "<name>" },
    { name: "😀" },
  ])
    assert.equal(profileName(body), null);
  for (const field of [
    "id",
    "userId",
    "email",
    "emailVerified",
    "active",
    "image",
    "role",
    "membership",
  ])
    assert.equal(profileName({ name: "Valid", [field]: true }), null);
});
test("password policy bounds credentials, allowlists fields and enforces revocation", () => {
  const body = { currentPassword: "synthetic", newPassword: "synthetic-new" };
  assert.deepEqual(profilePassword(body), {
    ...body,
    revokeOtherSessions: true,
  });
  for (const input of [
    null,
    [],
    {},
    { ...body, currentPassword: "" },
    { ...body, newPassword: "short" },
    { ...body, newPassword: "a".repeat(129) },
    { ...body, id: "foreign" },
    { ...body, revokeOtherSessions: false },
  ])
    assert.equal(profilePassword(input), null);
});
test("account HTTP authenticates active users, requires trusted origin and sanitizes responses", async (t) => {
  const origin = "http://127.0.0.1:3001";
  let active = true,
    authenticated = true,
    calls = 0;
  const user = {
    id: "synthetic",
    name: "Before",
    email: "synthetic@example.invalid",
    active,
  };
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: origin,
      auth: {
        api: {
          getSession: async () =>
            authenticated ? { user: { ...user, active } } : null,
        },
        handler: async (request) => {
          calls++;
          const body = await request.json();
          assert.deepEqual(body, { name: "After" });
          return new Response(
            JSON.stringify({
              token: "SYNTHETIC_BEARER",
              user,
              password: "SYNTHETIC_PRIVATE",
            }),
            {
              headers: {
                "set-cookie": "synthetic=rotated; HttpOnly; SameSite=Lax",
              },
            },
          );
        },
      },
    },
  });
  t.after(() => app.close());
  const post = (
    payload: Record<string, unknown>,
    headers: Record<string, string> = { origin },
  ) =>
    app.inject({
      method: "POST",
      url: "/api/auth/update-user",
      headers,
      payload,
    });
  authenticated = false;
  assert.equal((await post({ name: "After" })).statusCode, 401);
  authenticated = true;
  active = false;
  assert.equal((await post({ name: "After" })).statusCode, 401);
  active = true;
  const deniedHeaders: Record<string, string>[] = [
    {},
    { origin: "http://evil.invalid" },
    { origin, "sec-fetch-site": "cross-site" },
  ];
  for (const headers of deniedHeaders)
    assert.equal((await post({ name: "After" }, headers)).statusCode, 403);
  assert.equal(
    (await post({ name: "After", image: "data:invalid" })).statusCode,
    400,
  );
  assert.equal(calls, 0);
  const success = await post({ name: " After " });
  assert.equal(success.statusCode, 200);
  assert.deepEqual(success.json(), { status: true });
  assert.ok(success.headers["set-cookie"]);
  assert.equal(calls, 1);
});
test("same-account concurrent requests are denied during an in-flight command", async (t) => {
  let finish!: (value: Response) => void;
  const origin = "http://127.0.0.1:3001";
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: origin,
      auth: {
        api: {
          getSession: async () => ({
            user: {
              id: "synthetic",
              name: "Before",
              email: "synthetic@example.invalid",
              active: true,
            },
          }),
        },
        handler: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    },
  });
  t.after(() => app.close());
  const options = {
    method: "POST" as const,
    url: "/api/auth/update-user",
    headers: { origin },
    payload: { name: "After" },
  };
  const first = app.inject(options);
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await app.inject(options)).statusCode, 409);
  finish(new Response('{"status":true}'));
  assert.equal((await first).statusCode, 200);
});
