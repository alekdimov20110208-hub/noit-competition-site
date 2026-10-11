import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import { createEventHistoryReadService } from "../src/events/history.ts";
import { UnauthorizedError } from "../src/auth/session.ts";
const eventId = "00000000-0000-4000-8000-000000000001";
const user = {
  id: "fixture",
  name: "Fixture",
  email: "fixture@example.invalid",
};
test("history authenticates before identifiers, bounds reads and returns no invented entries", async () => {
  let queries = 0;
  const read = createEventHistoryReadService({
    query: async (_, values) => {
      queries++;
      assert.deepEqual(values, [eventId, user.id, null, 51]);
      return { rows: [{ viewer_id: "member", cursor_valid: true, id: null }] };
    },
  });
  await assert.rejects(
    read(null as unknown as typeof user, "bad"),
    UnauthorizedError,
  );
  assert.equal(queries, 0);
  assert.deepEqual(await read(user, eventId), {
    eventId,
    entries: [],
    nextCursor: null,
  });
});
test("history HTTP requires sessions, rejects duplicate/unknown cursors, uses no-store and has no write route", async (t) => {
  let active = false,
    reads = 0;
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: "http://127.0.0.1:3001",
      auth: {
        handler: async () => new Response(),
        api: {
          getSession: async () =>
            active ? { user: { ...user, active: true } } : null,
        },
      },
    },
    events: {
      list: async () => [],
      history: async () => {
        reads++;
        return { eventId, entries: [], nextCursor: null };
      },
    },
  });
  t.after(() => app.close());
  const path = `/api/events/${eventId}/history`;
  assert.equal(
    (await app.inject({ method: "GET", url: path })).statusCode,
    401,
  );
  assert.equal(reads, 0);
  active = true;
  const good = await app.inject({ method: "GET", url: path });
  assert.equal(good.statusCode, 200);
  assert.equal(good.headers["cache-control"], "no-store");
  for (const query of ["?limit=9999", `?before=${eventId}&before=${eventId}`])
    assert.equal(
      (await app.inject({ method: "GET", url: path + query })).statusCode,
      400,
    );
  for (const method of ["POST", "PATCH", "DELETE"] as const)
    assert.equal((await app.inject({ method, url: path })).statusCode, 404);
  active = false;
  assert.equal(
    (await app.inject({ method: "GET", url: path })).statusCode,
    401,
  );
  assert.equal(reads, 1);
});
