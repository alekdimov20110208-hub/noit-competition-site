import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createTaskService } from "../src/tasks/service.ts";
import {
  parseTaskCommand,
  TaskCommandError,
  type TaskRow,
} from "../src/tasks/model.ts";
import type { TransactionClient } from "../src/db/transaction.ts";
import { createApp } from "../src/app.ts";
import { readBootstrapConfig } from "../src/development/bootstrap.ts";

const eventId = randomUUID(),
  taskId = randomUUID(),
  memberId = randomUUID(),
  organizerId = randomUUID();
const identity = {
  id: "synthetic-member-user",
  name: "Fixture",
  email: "fixture@example.invalid",
};
const instant = new Date("2026-10-03T08:00:00Z");
function harness(role = "MEMBER", overrides: Partial<TaskRow> = {}) {
  const row: TaskRow = {
    id: taskId,
    title: "Fixture",
    category: "development",
    context: "",
    deadline: "2026-10-04",
    status: "not-started",
    priority: "normal",
    assigned_member_id: memberId,
    accepted_by_member_id: null,
    accepted_at: null,
    version: 1,
    updated_at: instant,
    ...overrides,
  };
  const calls: { sql: string; values?: unknown[] }[] = [];
  const emitter = new EventEmitter();
  const state = {
    actor: true,
    event: true,
    task: true,
    target: true,
    archived: false,
    failure: "",
    destroy: false,
    released: false,
    actorId: role === "ORGANIZER" ? organizerId : memberId,
  };
  const client: TransactionClient = {
    on: (event, listener) => emitter.on(event, listener),
    removeListener: (event, listener) =>
      emitter.removeListener(event, listener),
    release: (destroy) => {
      state.released = true;
      state.destroy = destroy ?? false;
    },
    async query(sql, values) {
      calls.push({ sql, values });
      if (state.failure && sql.includes(state.failure))
        throw new Error("SYNTHETIC_DATABASE_DETAIL");
      if (sql.startsWith("SELECT archived_at"))
        return {
          rows: state.event
            ? [{ archived_at: state.archived ? instant : null }]
            : [],
        };
      if (sql.includes("member.access_role"))
        return {
          rows: state.actor
            ? [
                {
                  id: state.actorId,
                  access_role: role,
                  operational_role: "Organizer",
                },
              ]
            : [],
        };
      if (sql.includes("SELECT member.id"))
        return { rows: state.target ? [{ id: memberId }] : [] };
      if (sql.startsWith("SELECT id, title"))
        return { rows: state.task ? [{ ...row }] : [] };
      if (sql.startsWith("UPDATE public.task")) {
        assert.deepEqual(values?.slice(0, 2), [eventId, taskId]);
        assert.equal(values?.[8], row.version);
        return {
          rows: [
            {
              ...row,
              assigned_member_id: values?.[2],
              accepted_by_member_id: values?.[3],
              accepted_at: values?.[4] ? instant : values?.[5],
              status: values?.[6],
              version: row.version + 1,
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
  const service = createTaskService({ connect: async () => client });
  const mutate = (
    kind: "assignment" | "acceptance" | "status",
    input: unknown,
  ) => service.mutate(identity, eventId, taskId, kind, input);
  return { service, mutate, calls, state, emitter, row };
}
function rejected(status: number) {
  return (error: unknown) => {
    assert.ok(error instanceof TaskCommandError);
    assert.equal(error.statusCode, status);
    return true;
  };
}
function history(calls: ReturnType<typeof harness>["calls"]) {
  const entry = calls.find(({ sql }) =>
    sql.startsWith("INSERT INTO public.activity_entry"),
  );
  assert.ok(entry?.values);
  return entry.values;
}

test("command parser requires exact fields, strict version, real status, UUID/null and boolean", () => {
  for (const [kind, body] of [
    ["assignment", { assignedMemberId: null }],
    ["assignment", { assignedMemberId: "' OR TRUE --", expectedVersion: 1 }],
    ["acceptance", { accepted: "true", expectedVersion: 1 }],
    ["acceptance", { accepted: true, expectedVersion: "1" }],
    ["acceptance", { accepted: true, expectedVersion: 0 }],
    ["acceptance", { accepted: true, expectedVersion: 1.5 }],
    ["acceptance", { accepted: true, expectedVersion: 2147483647 }],
    ["status", { status: "ready", expectedVersion: 1 }],
    [
      "status",
      { status: "completed", expectedVersion: 1, actorMemberId: memberId },
    ],
    [
      "acceptance",
      { accepted: true, expectedVersion: 1, acceptedAt: instant.toISOString() },
    ],
  ] as const)
    assert.throws(() => parseTaskCommand(kind, body), rejected(400));
  assert.deepEqual(
    parseTaskCommand("assignment", {
      assignedMemberId: memberId.toUpperCase(),
      expectedVersion: 1,
    }),
    { kind: "assignment", assignedMemberId: memberId, expectedVersion: 1 },
  );
});

for (const [name, previous, next, action] of [
  ["assignment", null, memberId, "task.assigned"],
  ["reassignment", memberId, organizerId, "task.reassigned"],
  ["unassignment", memberId, null, "task.unassigned"],
] as const)
  test(`${name} increments version, clears current acceptance and writes server history`, async () => {
    const h = harness("ORGANIZER", {
      assigned_member_id: previous,
      accepted_by_member_id: previous,
      accepted_at: previous ? instant : null,
    });
    const dto = await h.mutate("assignment", {
      assignedMemberId: next,
      expectedVersion: 1,
    });
    assert.equal(dto.assignedMemberId, next);
    assert.equal(dto.accepted, false);
    assert.equal(dto.acceptedAt, null);
    assert.equal(dto.version, 2);
    const entry = history(h.calls);
    assert.deepEqual(entry.slice(1, 6), [
      eventId,
      identity.id,
      organizerId,
      action,
      taskId,
    ]);
    assert.equal(JSON.parse(entry[6] as string).taskVersion, 2);
    assert.equal(
      JSON.parse(entry[6] as string).previousAcceptedByMemberId,
      previous,
    );
    assert.equal(h.calls.at(-1)?.sql, "COMMIT");
  });

test("only current assignee accepts with server member/time; organizer cannot impersonate", async () => {
  const h = harness();
  const dto = await h.mutate("acceptance", {
    accepted: true,
    expectedVersion: 1,
  });
  assert.equal(dto.acceptedByMemberId, memberId);
  assert.equal(dto.acceptedAt, instant.toISOString());
  assert.equal(dto.version, 2);
  assert.equal(history(h.calls)[4], "task.accepted");
  await assert.rejects(
    harness("ORGANIZER").mutate("acceptance", {
      accepted: true,
      expectedVersion: 1,
    }),
    rejected(403),
  );
  const own = harness("ORGANIZER", { assigned_member_id: organizerId });
  assert.equal(
    (await own.mutate("acceptance", { accepted: true, expectedVersion: 1 }))
      .acceptedByMemberId,
    organizerId,
  );
});

test("withdrawal clears fields, increments version and records previous acceptance", async () => {
  const h = harness("MEMBER", {
    accepted_by_member_id: memberId,
    accepted_at: instant,
  });
  const dto = await h.mutate("acceptance", {
    accepted: false,
    expectedVersion: 1,
  });
  assert.equal(dto.acceptedByMemberId, null);
  assert.equal(dto.acceptedAt, null);
  assert.equal(dto.version, 2);
  assert.equal(history(h.calls)[4], "task.acceptance_withdrawn");
  await assert.rejects(
    harness("ORGANIZER", {
      accepted_by_member_id: memberId,
      accepted_at: instant,
    }).mutate("acceptance", { accepted: false, expectedVersion: 1 }),
    rejected(403),
  );
});

test("status is independent of acceptance; organizer or current assignee only", async () => {
  for (const role of ["MEMBER", "ORGANIZER"]) {
    const h = harness(role, {
      accepted_by_member_id: memberId,
      accepted_at: instant,
    });
    const dto = await h.mutate("status", {
      status: "completed",
      expectedVersion: 1,
    });
    assert.equal(dto.status, "completed");
    assert.equal(dto.acceptedByMemberId, memberId);
    assert.equal(dto.version, 2);
    assert.equal(history(h.calls)[4], "task.status_changed");
  }
  await assert.rejects(
    harness("MEMBER", { assigned_member_id: organizerId }).mutate("status", {
      status: "blocked",
      expectedVersion: 1,
    }),
    rejected(403),
  );
});

test("MEMBER operationalRole Organizer grants no assignment authority", async () => {
  const h = harness();
  await assert.rejects(
    h.mutate("assignment", {
      assignedMemberId: organizerId,
      expectedVersion: 1,
    }),
    rejected(403),
  );
  assert.ok(!h.calls.some(({ sql }) => sql.startsWith("UPDATE")));
});

test("all command kinds reject stale versions before no-op handling", async () => {
  for (const [kind, body] of [
    ["assignment", { assignedMemberId: memberId, expectedVersion: 1 }],
    ["acceptance", { accepted: true, expectedVersion: 1 }],
    ["status", { status: "not-started", expectedVersion: 1 }],
  ] as const) {
    const h = harness("ORGANIZER", {
      assigned_member_id: organizerId,
      accepted_by_member_id: organizerId,
      accepted_at: instant,
      version: 2,
    });
    await assert.rejects(h.mutate(kind, body), rejected(409));
    assert.equal(h.calls.at(-1)?.sql, "ROLLBACK");
    assert.ok(!h.calls.some(({ sql }) => sql.startsWith("UPDATE")));
  }
});

test("current-version repeats return canonical state without extra version/history", async () => {
  for (const [kind, body] of [
    ["assignment", { assignedMemberId: organizerId, expectedVersion: 1 }],
    ["acceptance", { accepted: true, expectedVersion: 1 }],
    ["status", { status: "not-started", expectedVersion: 1 }],
  ] as const) {
    const h = harness("ORGANIZER", {
      assigned_member_id: organizerId,
      accepted_by_member_id: organizerId,
      accepted_at: instant,
    });
    const dto = await h.mutate(kind, body);
    assert.equal(dto.version, 1);
    assert.equal(dto.accepted, true);
    assert.ok(
      !h.calls.some(
        ({ sql }) => sql.startsWith("UPDATE") || sql.startsWith("INSERT"),
      ),
    );
  }
});

test("missing membership/task and inactive or foreign assignee deny before writes", async () => {
  for (const missing of ["actor", "task", "target"] as const) {
    const h = harness("ORGANIZER");
    h.state[missing] = false;
    await assert.rejects(
      h.mutate("assignment", {
        assignedMemberId: memberId,
        expectedVersion: 1,
      }),
      rejected(404),
    );
    assert.ok(!h.calls.some(({ sql }) => sql.startsWith("UPDATE")));
  }
  const h = harness("ORGANIZER");
  h.state.archived = true;
  await assert.rejects(
    h.mutate("status", { status: "blocked", expectedVersion: 1 }),
    rejected(403),
  );
});

for (const failure of [
  "UPDATE public.task",
  "INSERT INTO public.activity_entry",
])
  test(`transaction rolls back ${failure} failure and releases client`, async () => {
    const h = harness();
    h.state.failure = failure;
    await assert.rejects(
      h.mutate("acceptance", { accepted: true, expectedVersion: 1 }),
    );
    assert.equal(h.calls.at(-1)?.sql, "ROLLBACK");
    assert.equal(h.state.released, true);
    assert.ok(!h.calls.some(({ sql }) => sql === "COMMIT"));
  });

test("rollback failure destroys the client instead of returning an open transaction", async () => {
  const h = harness();
  h.state.failure = "ROLLBACK";
  h.state.actor = false;
  await assert.rejects(
    h.mutate("acceptance", { accepted: true, expectedVersion: 1 }),
    rejected(404),
  );
  assert.equal(h.state.destroy, true);
  assert.equal(h.emitter.listenerCount("error"), 0);
});

test("reads parameterize Event scope, exclude deletion, expose only canonical DTO/date strings", async () => {
  const h = harness();
  const [dto] = await h.service.read(identity, eventId, taskId);
  assert.equal(dto?.deadline, "2026-10-04");
  assert.ok(!("updated_by" in dto!));
  const query = h.calls.find(({ sql }) => sql.startsWith("SELECT id, title"));
  assert.match(query!.sql, /event_id = \$1 AND deleted_at IS NULL/);
  assert.deepEqual(query!.values, [eventId, taskId]);
  const actorQuery = h.calls.find(({ sql }) =>
    sql.includes("member.access_role"),
  )!;
  assert.match(actorQuery.sql, /identity.active = TRUE/);
  assert.match(actorQuery.sql, /FOR SHARE OF member, identity/);
});

test("HTTP requires authentication/trusted origin, rejects forged fields and emits small 409", async (t) => {
  const h = harness();
  const logs: string[] = [];
  let signedIn = false;
  const app = createApp({
    checkDatabase: async () => {},
    tasks: h.service,
    logger: {
      stream: {
        write: (line) => {
          logs.push(line);
        },
      },
    },
    authentication: {
      baseURL: "http://127.0.0.1:3001",
      auth: {
        handler: async () => new Response(),
        api: {
          getSession: async () =>
            signedIn ? { user: { ...identity, active: true } } : null,
        },
      },
    },
  });
  t.after(() => app.close());
  const url = `/api/events/${eventId}/tasks/${taskId}/acceptance`;
  const inject = (payload: unknown, headers: Record<string, string> = {}) =>
    app.inject({ method: "PUT", url, payload: payload as object, headers });
  assert.equal(
    (await inject({ accepted: true, expectedVersion: 1 })).statusCode,
    401,
  );
  signedIn = true;
  assert.equal(
    (await inject({ accepted: true, expectedVersion: 1 })).statusCode,
    403,
  );
  assert.equal(
    (
      await inject(
        { accepted: true, expectedVersion: 1 },
        { origin: "http://foreign.example.invalid" },
      )
    ).statusCode,
    403,
  );
  for (const field of [
    "actorUserId",
    "actorMemberId",
    "acceptedAt",
    "acceptedByMemberId",
    "accessRole",
    "activity",
    "eventId",
  ]) {
    const response = await inject(
      { accepted: true, expectedVersion: 1, [field]: "SYNTHETIC_FORGED" },
      { origin: "http://127.0.0.1:3001" },
    );
    assert.equal(response.statusCode, 400);
  }
  const response = await inject(
    { accepted: true, expectedVersion: 2 },
    { origin: "http://127.0.0.1:3001", cookie: "SYNTHETIC_COOKIE" },
  );
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "error",
    code: "TASK_VERSION_CONFLICT",
  });
  assert.equal(response.headers["cache-control"], "no-store");
  h.state.failure = "UPDATE public.task";
  const failed = await inject(
    { accepted: true, expectedVersion: 1 },
    { origin: "http://127.0.0.1:3001" },
  );
  assert.equal(failed.statusCode, 500);
  assert.doesNotMatch(
    failed.body + logs.join(""),
    /SYNTHETIC_DATABASE_DETAIL|SYNTHETIC_COOKIE|SYNTHETIC_FORGED/,
  );
});

test("development bootstrap configuration uses only emails, rejects production/placeholders", () => {
  const config = {
    BUDOGRAPH_ORGANIZER_EMAIL: " Organizer@example.invalid ",
    BUDOGRAPH_MEMBER_EMAIL: "member@example.invalid",
  };
  assert.equal(
    readBootstrapConfig(config).organizerEmail,
    "organizer@example.invalid",
  );
  for (const invalid of [
    { ...config, NODE_ENV: "production" },
    {},
    { ...config, BUDOGRAPH_MEMBER_EMAIL: "REPLACE_EMAIL" },
    { ...config, BUDOGRAPH_MEMBER_EMAIL: config.BUDOGRAPH_ORGANIZER_EMAIL },
  ])
    assert.throws(() => readBootstrapConfig(invalid));
});
