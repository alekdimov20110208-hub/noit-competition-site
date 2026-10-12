import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { parseEventOperation } from "../src/events/operations.ts";
import { EventCommandError } from "../src/events/model.ts";

test("Duplicate HTTP command enforces real session boundary, trusted Origin, bounded body and no-store public errors", async (t) => {
  const source = randomUUID(),
    key = randomUUID();
  const user = {
    id: "synthetic-duplicate",
    name: "Synthetic",
    email: "duplicate@example.invalid",
    active: true,
  };
  const input = {
    name: "Reviewed copy",
    startDate: "2026-11-01",
    endDate: "2026-11-02",
    timezone: "UTC",
    expectedVersion: 1,
  };
  let signedIn = false,
    calls = 0,
    fault = "";
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: "http://127.0.0.1:3001",
      taskMutationOrigins: ["http://127.0.0.1:5173"],
      auth: {
        handler: async () => new Response(),
        api: { getSession: async () => (signedIn ? { user } : null) },
      },
    },
    events: {
      list: async () => [],
      duplicate: async (actor, sourceId, commandId, fields) => {
        calls++;
        assert.equal(actor.id, user.id);
        parseEventOperation(actor, sourceId, commandId, fields);
        if (fault === "private")
          throw new Error("DO_NOT_EXPOSE_PRIVATE_DETAIL");
        if (fault) throw new EventCommandError(409, fault);
        return {
          ...input,
          id: randomUUID(),
          version: 1,
          archived: false,
          createdAt: "2026-10-12T00:00:00Z",
          updatedAt: "2026-10-12T00:00:00Z",
          membership: { id: randomUUID(), accessRole: "ORGANIZER" },
        };
      },
    },
  });
  t.after(() => app.close());
  const request = (
    payload: unknown = input,
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method: "POST",
      url: `/api/events/${source}/duplicate`,
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:5173",
        "idempotency-key": key,
        ...headers,
      },
      payload: JSON.stringify(payload),
    });
  const unauthorized = await request();
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(calls, 0);
  signedIn = true;
  for (const headers of [
    { origin: "https://foreign.invalid" },
    { "sec-fetch-site": "cross-site" },
  ] as Record<string, string>[]) {
    assert.equal((await request(input, headers)).statusCode, 403);
    assert.equal(calls, 0);
  }
  const absentKey = await request(input, { "idempotency-key": "" });
  assert.equal(absentKey.statusCode, 400);
  assert.equal(absentKey.json().code, "INVALID_IDEMPOTENCY_KEY");
  assert.equal(
    (await request({ ...input, ownerUserId: "forged" })).statusCode,
    400,
  );
  assert.equal(
    (await request({ ...input, name: "x".repeat(5000) })).statusCode,
    413,
  );
  const accepted = await request();
  assert.equal(accepted.statusCode, 201);
  assert.equal(accepted.headers["cache-control"], "no-store");
  fault = "IDEMPOTENCY_KEY_REUSED";
  const conflict = await request();
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().code, fault);
  fault = "private";
  const failure = await request();
  assert.equal(failure.statusCode, 500);
  assert.doesNotMatch(failure.body, /PRIVATE_DETAIL/);
  assert.equal(failure.headers["cache-control"], "no-store");
});
