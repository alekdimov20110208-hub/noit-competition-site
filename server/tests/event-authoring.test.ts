import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createEventService } from "../src/events/service.ts";
import { EventCommandError, type EventRow } from "../src/events/model.ts";
import { UnauthorizedError } from "../src/auth/session.ts";
import { createApp } from "../src/app.ts";
import type { TransactionClient } from "../src/db/transaction.ts";

const user = {
  id: "synthetic-author",
  name: "Synthetic Author",
  email: "author@example.invalid",
};
const input = {
  name: "Development Event",
  startDate: "2026-10-04",
  endDate: "2026-10-05",
  timezone: "Europe/Sofia",
};
const instant = new Date("2026-10-03T08:00:00Z");
const eventId = randomUUID(),
  memberId = randomUUID();

function harness(role = "ORGANIZER") {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const state = {
    active: true,
    member: true,
    event: true,
    archived: false,
    timezone: true,
    failure: "",
    released: false,
    destroy: false,
    version: 1,
    loseUpdate: false,
    ownedEvents: 0,
  };
  const row = (): EventRow => ({
    id: eventId,
    name: input.name,
    start_date: input.startDate,
    end_date: input.endDate,
    timezone: input.timezone,
    archived_at: state.archived ? instant : null,
    version: state.version,
    created_at: instant,
    updated_at: instant,
  });
  const emitter = new EventEmitter();
  async function query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (state.failure && sql.startsWith(state.failure))
      throw new Error("SYNTHETIC_DATABASE_DETAIL");
    if (sql.startsWith('SELECT id FROM public."user"'))
      return { rows: state.active ? [{ id: user.id }] : [] };
    if (sql.startsWith("SELECT count(*)::int AS total FROM public.event"))
      return { rows: [{ total: state.ownedEvents }] };
    if (sql.startsWith("SELECT public.is_valid_event_timezone"))
      return { rows: [{ valid: state.timezone }] };
    if (sql.startsWith("INSERT INTO public.event ("))
      return {
        rows: [
          {
            ...row(),
            id: values?.[0],
            name: values?.[1],
            start_date: values?.[2],
            end_date: values?.[3],
            timezone: values?.[4],
          },
        ],
      };
    if (sql.startsWith("SELECT id, name"))
      return { rows: state.event ? [row()] : [] };
    if (sql.includes("SELECT member.id, member.access_role"))
      return {
        rows:
          state.member && state.active
            ? [
                {
                  id: memberId,
                  access_role: role,
                  operational_role: "Organizer",
                },
              ]
            : [],
      };
    if (sql.startsWith("UPDATE public.event"))
      return {
        rows: state.loseUpdate
          ? []
          : [
              {
                ...row(),
                name: values?.[1],
                start_date: values?.[2],
                end_date: values?.[3],
                timezone: values?.[4],
                version: state.version + 1,
              },
            ],
      };
    return { rows: [] };
  }
  const client: TransactionClient = {
    query,
    on: (event, listener) => emitter.on(event, listener),
    removeListener: (event, listener) =>
      emitter.removeListener(event, listener),
    release: (destroy) => {
      state.released = true;
      state.destroy = destroy ?? false;
    },
  };
  const service = createEventService({ query, connect: async () => client });
  return { calls, state, service, emitter };
}
const denied = (status: number, code?: string) => (error: unknown) => {
  assert.ok(error instanceof EventCommandError);
  assert.equal(error.statusCode, status);
  if (code) assert.equal(error.code, code);
  return true;
};
const writes = (h: ReturnType<typeof harness>) =>
  h.calls.filter(({ sql }) => /^(INSERT|UPDATE)/.test(sql));
const activity = (h: ReturnType<typeof harness>) =>
  h.calls.find(({ sql }) =>
    sql.startsWith("INSERT INTO public.activity_entry"),
  )!;

test("Event creation atomically creates trusted owner, active Organizer and server activity without tasks", async () => {
  const h = harness("MEMBER"); // Account's role elsewhere has no effect on creation.
  const created = await h.service.create(user, {
    ...input,
    name: "  New Event  ",
  });
  assert.equal(created.name, "New Event");
  assert.equal(created.version, 1);
  assert.equal(created.membership.accessRole, "ORGANIZER");
  const inserts = writes(h);
  assert.equal(inserts.length, 3);
  assert.deepEqual(inserts[0]?.values, [
    created.id,
    "New Event",
    input.startDate,
    input.endDate,
    input.timezone,
    user.id,
  ]);
  assert.deepEqual(inserts[1]?.values, [
    created.membership.id,
    created.id,
    user.id,
  ]);
  assert.match(inserts[1]!.sql, /'ORGANIZER', '', TRUE/);
  assert.deepEqual(activity(h).values?.slice(1, 5), [
    created.id,
    user.id,
    created.membership.id,
    "EVENT_CREATED",
  ]);
  assert.deepEqual(JSON.parse(activity(h).values?.[5] as string), {
    ...input,
    name: "New Event",
    version: 1,
  });
  assert.equal(h.calls.at(-1)?.sql, "COMMIT");
  assert.equal(h.state.released, true);
  assert.ok(h.calls.some(({ sql }) => sql.includes("active = TRUE FOR SHARE")));
  assert.ok(!h.calls.some(({ sql }) => /public\.task|bootstrap/i.test(sql)));
});

test("Event storage cap refuses creation before writes and includes archived owned Events", async () => {
  const h = harness();
  h.state.ownedEvents = 100;
  await assert.rejects(
    h.service.create(user, input),
    denied(409, "EVENT_CAPACITY_REACHED"),
  );
  assert.equal(writes(h).length, 0);
  assert.ok(
    h.calls.some(({ sql }) => sql.startsWith("SELECT pg_advisory_xact_lock")),
  );
  assert.equal(h.calls.at(-1)?.sql, "ROLLBACK");
});

test("Event creation authenticates and validates before touching SQL and rejects inactive identity", async () => {
  const h = harness();
  await assert.rejects(
    h.service.create(null as unknown as typeof user, input),
    UnauthorizedError,
  );
  await assert.rejects(
    h.service.create(user, { ...input, ownerUserId: "forged" }),
    denied(400),
  );
  assert.equal(h.calls.length, 0);
  h.state.active = false;
  await assert.rejects(h.service.create(user, input), UnauthorizedError);
  assert.equal(writes(h).length, 0);
  assert.equal(h.calls.at(-1)?.sql, "ROLLBACK");
});

for (const failure of [
  "INSERT INTO public.event (",
  "INSERT INTO public.event_member",
  "INSERT INTO public.activity_entry",
])
  test(`Event creation rolls back ${failure} failure and releases the pinned client`, async () => {
    const h = harness();
    h.state.failure = failure;
    await assert.rejects(h.service.create(user, input));
    assert.equal(h.calls.at(-1)?.sql, "ROLLBACK");
    assert.ok(!h.calls.some(({ sql }) => sql === "COMMIT"));
    assert.equal(h.state.released, true);
    assert.equal(h.emitter.listenerCount("error"), 0);
  });

test("database tzdata mismatch becomes a safe field validation error before writes", async () => {
  const h = harness();
  h.state.timezone = false;
  await assert.rejects(h.service.create(user, input), (error) => {
    assert.ok(error instanceof EventCommandError);
    assert.deepEqual(error.fields, { timezone: "INVALID_TIMEZONE" });
    return true;
  });
  assert.equal(writes(h).length, 0);
});

test("Organizer Event edit increments version and atomically records only changed fields with trusted actor", async () => {
  const h = harness();
  const after = await h.service.update(user, eventId.toUpperCase(), {
    ...input,
    name: "Changed",
    expectedVersion: 1,
  });
  assert.equal(after.version, 2);
  assert.equal(after.name, "Changed");
  assert.equal(after.createdAt, instant.toISOString());
  assert.equal(after.membership.id, memberId);
  const update = writes(h)[0]!;
  assert.deepEqual(update.values, [
    eventId,
    "Changed",
    input.startDate,
    input.endDate,
    input.timezone,
    1,
  ]);
  assert.match(update.sql, /version = version \+ 1/);
  assert.match(
    update.sql,
    /WHERE id = \$1 AND version = \$6 AND archived_at IS NULL/,
  );
  assert.deepEqual(activity(h).values?.slice(1, 5), [
    eventId,
    user.id,
    memberId,
    "EVENT_UPDATED",
  ]);
  assert.deepEqual(JSON.parse(activity(h).values?.[5] as string), {
    before: { name: input.name, version: 1 },
    after: { name: "Changed", version: 2 },
  });
  assert.ok(h.calls.some(({ sql }) => sql.includes("FOR UPDATE")));
  assert.ok(
    h.calls.some(({ sql }) => sql.includes("FOR SHARE OF member, identity")),
  );
});

test("Event edit denies Member operational Organizer text, inactive membership and foreign/missing Event", async () => {
  for (const kind of [
    "MEMBER",
    "inactive-member",
    "inactive-user",
    "foreign-event",
    "archived",
  ] as const) {
    const h = harness(kind === "MEMBER" ? "MEMBER" : "ORGANIZER");
    if (kind === "inactive-member") h.state.member = false;
    if (kind === "inactive-user") h.state.active = false;
    if (kind === "foreign-event") h.state.event = false;
    if (kind === "archived") h.state.archived = true;
    await assert.rejects(
      h.service.update(user, eventId, {
        ...input,
        name: "Changed",
        expectedVersion: 1,
      }),
      denied(kind === "MEMBER" || kind === "archived" ? 403 : 404),
    );
    assert.equal(writes(h).length, 0);
  }
});

test("stale Event edit and stale no-op both conflict; current no-op preserves version/history/timestamps", async () => {
  for (const name of [input.name, "Changed"]) {
    const h = harness();
    h.state.version = 2;
    await assert.rejects(
      h.service.update(user, eventId, { ...input, name, expectedVersion: 1 }),
      denied(409, "EVENT_VERSION_CONFLICT"),
    );
    assert.equal(writes(h).length, 0);
  }
  const h = harness();
  const after = await h.service.update(user, eventId, {
    ...input,
    expectedVersion: 1,
  });
  assert.equal(after.version, 1);
  assert.equal(after.updatedAt, instant.toISOString());
  assert.equal(writes(h).length, 0);
});

test("version-checked Event update with no returned row yields 409 and no history", async () => {
  const h = harness();
  h.state.loseUpdate = true;
  await assert.rejects(
    h.service.update(user, eventId, {
      ...input,
      name: "Changed",
      expectedVersion: 1,
    }),
    denied(409),
  );
  assert.equal(writes(h).length, 1);
  assert.equal(h.calls.at(-1)?.sql, "ROLLBACK");
});

for (const failure of [
  "UPDATE public.event",
  "INSERT INTO public.activity_entry",
])
  test(`Event edit rolls back ${failure} failure`, async () => {
    const h = harness();
    h.state.failure = failure;
    await assert.rejects(
      h.service.update(user, eventId, {
        ...input,
        name: "Changed",
        expectedVersion: 1,
      }),
    );
    assert.equal(h.calls.at(-1)?.sql, "ROLLBACK");
    assert.equal(h.state.released, true);
  });

test("Event HTTP commands enforce session/origin, field errors, 201 canonical response and safe 409/500 with no-store", async (t) => {
  const h = harness();
  let signedIn = false;
  const app = createApp({
    checkDatabase: async () => {},
    events: h.service,
    authentication: {
      baseURL: "http://127.0.0.1:3001",
      taskMutationOrigins: ["http://127.0.0.1:3001", "http://127.0.0.1:5173"],
      auth: {
        handler: async () => new Response(),
        api: {
          getSession: async () =>
            signedIn ? { user: { ...user, active: true } } : null,
        },
      },
    },
  });
  t.after(() => app.close());
  const request = (
    method: "POST" | "PATCH",
    payload: unknown,
    origin?: string,
    extra: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: method === "POST" ? "/api/events" : `/api/events/${eventId}`,
      payload: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        ...(origin ? { origin } : {}),
        ...extra,
      },
    });
  const unauthenticated = await request("POST", input);
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(unauthenticated.headers["cache-control"], "no-store");
  signedIn = true;
  for (const origin of [
    undefined,
    "http://evil.example",
    "http://127.0.0.1:3001.evil.example",
  ])
    assert.equal((await request("POST", input, origin)).statusCode, 403);
  assert.equal(
    (
      await request("POST", input, "http://127.0.0.1:3001", {
        "sec-fetch-site": "cross-site",
      })
    ).statusCode,
    403,
  );
  const invalid = await request(
    "POST",
    { ...input, name: " " },
    "http://127.0.0.1:5173",
  );
  assert.deepEqual(invalid.json(), {
    status: "error",
    code: "INVALID_EVENT_COMMAND",
    fields: { name: "INVALID_NAME" },
  });
  assert.equal(invalid.statusCode, 400);
  const created = await request("POST", input, "http://127.0.0.1:5173");
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().event.membership.accessRole, "ORGANIZER");
  h.state.version = 2;
  const conflict = await request(
    "PATCH",
    { ...input, expectedVersion: 1 },
    "http://127.0.0.1:3001",
  );
  assert.equal(conflict.statusCode, 409);
  assert.deepEqual(conflict.json(), {
    status: "error",
    code: "EVENT_VERSION_CONFLICT",
  });
  h.state.failure = "INSERT INTO public.event (";
  const failed = await request("POST", input, "http://127.0.0.1:3001");
  assert.equal(failed.statusCode, 500);
  assert.doesNotMatch(failed.body, /SYNTHETIC_DATABASE_DETAIL/);
});
