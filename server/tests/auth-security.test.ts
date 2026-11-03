import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import {
  authMailResponse,
  authMailResponseFloorMs,
  canonicalResetToken,
} from "../src/auth/safety.ts";
import {
  clientNetwork,
  createSharedControls,
  OperationalError,
} from "../src/operations/limits.ts";
import { createApp } from "../src/app.ts";

test("reset token authority accepts one unambiguous source and rejects empty, conflicting and repeated inputs", () => {
  const token = "Synthetic_token-123";
  assert.equal(canonicalResetToken({ token }, new URLSearchParams()), token);
  assert.equal(canonicalResetToken({}, new URLSearchParams({ token })), token);
  assert.equal(
    canonicalResetToken({ token }, new URLSearchParams({ token })),
    token,
  );
  for (const body of [
    { token: "" },
    { token: null },
    { token: [] },
    { token: " " },
    { token: "x".repeat(257) },
  ])
    assert.equal(
      canonicalResetToken(body, new URLSearchParams({ token })),
      undefined,
    );
  assert.equal(
    canonicalResetToken({ token: "other" }, new URLSearchParams({ token })),
    undefined,
  );
  assert.equal(canonicalResetToken({}, new URLSearchParams()), undefined);
  assert.equal(
    canonicalResetToken({}, new URLSearchParams("token=")),
    undefined,
  );
  assert.equal(
    canonicalResetToken(
      {},
      new URLSearchParams(`token=${token}&token=${token}`),
    ),
    undefined,
  );
});

test("auth mail floor covers success and failures, subtracts elapsed work and does not add latency to slow operations", async () => {
  for (const elapsed of [0, 10, 550, 1200]) {
    for (const fail of [false, true]) {
      let now = 0;
      const waits: number[] = [];
      const operation = authMailResponse(
        async () => {
          now += elapsed;
          if (fail) throw new Error("synthetic outage");
          return { status: true };
        },
        {
          now: () => now,
          wait: async (ms) => {
            waits.push(ms);
          },
        },
      );
      if (fail) await assert.rejects(operation, /synthetic outage/);
      else assert.deepEqual(await operation, { status: true });
      assert.deepEqual(
        waits,
        elapsed < authMailResponseFloorMs
          ? [authMailResponseFloorMs - elapsed]
          : [],
      );
    }
  }
});

test("network quotas canonicalize IPv4-mapped addresses and IPv6 rotations, rejecting untrusted IP input", () => {
  assert.equal(clientNetwork("192.0.2.3"), clientNetwork("::ffff:192.0.2.3"));
  assert.equal(
    clientNetwork("2001:db8:1:2::1"),
    clientNetwork("2001:0DB8:0001:0002:ffff::7"),
  );
  assert.notEqual(
    clientNetwork("2001:db8:1:3::1"),
    clientNetwork("2001:db8:1:2::1"),
  );
  for (const ip of ["", "192.0.2.3, 192.0.2.4", "attacker.invalid"])
    assert.throws(() => clientNetwork(ip), OperationalError);
});

test("registration/event rules use shared HMAC budgets; unknown client boundaries and storage failures deny", async () => {
  const batches: { key: string; max: number }[][] = [];
  const database = {
    query: async (_sql: string, values: unknown[]) => {
      batches.push(JSON.parse(String(values[0])));
      return { rows: [{ result: { allowed: true, retryAfter: 0 } }] };
    },
  };
  const secret = randomBytes(32).toString("base64");
  const controls = createSharedControls(database, secret);
  await controls.registration("192.0.2.3", "person@example.invalid");
  await controls.eventCreation("192.0.2.3", "trusted-identity");
  await controls.invitation("192.0.2.3", true, "synthetic-token");
  assert.deepEqual(
    batches.map((b) => b.length),
    [4, 5, 5],
  );
  for (const batch of batches)
    for (const rule of batch) assert.match(rule.key, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(batches).includes("person@"));
  await assert.rejects(
    createSharedControls(database, secret, false).registration(
      "192.0.2.3",
      "p@example.invalid",
    ),
    OperationalError,
  );
  await assert.rejects(
    createSharedControls(
      {
        query: async () => {
          throw Error("private");
        },
      },
      secret,
    ).eventCreation("192.0.2.3", "actor"),
    OperationalError,
  );
});

test("Event admission follows authentication/origin checks and uses resolved peer and session identity, never spoofed fields", async (t) => {
  let authenticated = false,
    calls = 0;
  const batches: string[] = [];
  const controls = createSharedControls(
    {
      query: async (_sql, values) => {
        batches.push(String(values[0]));
        return { rows: [{ result: { allowed: true, retryAfter: 0 } }] };
      },
    },
    randomBytes(32).toString("base64"),
  );
  const observed: string[][] = [];
  const admission = controls.eventCreation;
  controls.eventCreation = async (ip, user) => {
    observed.push([ip, user]);
    await admission(ip, user);
  };
  const origin = "https://baseline.example.invalid";
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: origin,
      controls,
      auth: {
        api: {
          getSession: async () =>
            authenticated
              ? {
                  user: {
                    id: "session-user",
                    name: "Test",
                    email: "test@example.invalid",
                    active: true,
                  },
                }
              : null,
        },
        handler: async () => new Response(),
      },
    },
    events: {
      list: async () => [],
      create: async () => {
        calls++;
        return {
          id: "event",
          name: "Test",
          startDate: "2026-11-01",
          endDate: "2026-11-01",
          timezone: "UTC",
          archived: false,
          version: 1,
          createdAt: "",
          updatedAt: "",
          membership: { id: "member", accessRole: "ORGANIZER" },
        };
      },
    },
  });
  t.after(() => app.close());
  const post = (headers: Record<string, string>) =>
    app.inject({
      method: "POST",
      url: "/api/events",
      remoteAddress: "192.0.2.7",
      headers,
      payload: { userId: "forged", accessRole: "ORGANIZER" },
    });
  assert.equal((await post({ origin })).statusCode, 401);
  authenticated = true;
  assert.equal(
    (await post({ origin: "https://attacker.invalid" })).statusCode,
    403,
  );
  assert.equal(batches.length, 0);
  assert.equal(
    (
      await post({
        origin,
        "x-forwarded-for": "203.0.113.4",
        "x-budograph-client-ip": "203.0.113.5",
      })
    ).statusCode,
    201,
  );
  assert.deepEqual(observed, [["192.0.2.7", "session-user"]]);
  assert.equal(calls, 1);
});
