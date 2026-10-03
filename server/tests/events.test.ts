import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createEventReadService } from "../src/events/service.ts";
import { createApp } from "../src/app.ts";
import { UnauthorizedError } from "../src/auth/session.ts";

const user = {
  id: "synthetic-identity",
  name: "Synthetic",
  email: "synthetic@example.invalid",
};
const row = {
  id: randomUUID(),
  name: "Synthetic event",
  start_date: "2026-10-04",
  end_date: "2026-10-05",
  timezone: "Europe/Sofia",
  archived_at: null,
  member_id: randomUUID(),
  access_role: "MEMBER",
};

test("Event list authenticates first, parameterizes user and projects calendar dates/membership only", async () => {
  const calls: { sql: string; values: unknown[] }[] = [];
  const service = createEventReadService({
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [{ ...row, secret: "SYNTHETIC_INTERNAL" }] };
    },
  });
  await assert.rejects(
    service.list(null as unknown as typeof user),
    UnauthorizedError,
  );
  assert.equal(calls.length, 0);
  const [event] = await service.list(user);
  assert.deepEqual(event, {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    timezone: row.timezone,
    archived: false,
    membership: { id: row.member_id, accessRole: "MEMBER" },
  });
  assert.deepEqual(calls[0]?.values, [user.id]);
  assert.match(calls[0]!.sql, /member\.active = TRUE/);
  assert.match(
    calls[0]!.sql,
    /member\.deactivated_at IS NULL AND identity\.active = TRUE/,
  );
  assert.match(calls[0]!.sql, /ORDER BY event\.start_date, event\.id/);
  assert.match(calls[0]!.sql, /to_char\(event\.start_date, 'YYYY-MM-DD'\)/);
});

test("Event HTTP read has safe unauthenticated, empty and backend-failure responses with no-store", async (t) => {
  let signedIn = false,
    fail = false,
    queries = 0;
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: "http://127.0.0.1:3001",
      auth: {
        handler: async () => new Response(),
        api: {
          getSession: async () =>
            signedIn ? { user: { ...user, active: true } } : null,
        },
      },
    },
    events: createEventReadService({
      query: async () => {
        queries++;
        if (fail) throw new Error("SYNTHETIC_DATABASE_DETAIL");
        return { rows: [] };
      },
    }),
  });
  t.after(() => app.close());
  const absent = await app.inject({ method: "GET", url: "/api/events" });
  assert.equal(absent.statusCode, 401);
  assert.equal(queries, 0);
  assert.equal(absent.headers["cache-control"], "no-store");
  signedIn = true;
  const empty = await app.inject({ method: "GET", url: "/api/events" });
  assert.deepEqual(empty.json(), { events: [] });
  assert.equal(empty.headers["cache-control"], "no-store");
  fail = true;
  const failed = await app.inject({ method: "GET", url: "/api/events" });
  assert.equal(failed.statusCode, 500);
  assert.doesNotMatch(failed.body, /SYNTHETIC_DATABASE_DETAIL/);
});
