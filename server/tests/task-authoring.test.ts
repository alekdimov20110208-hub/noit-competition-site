import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createTaskService } from "../src/tasks/service.ts";
import {
  parseTaskAuthoring,
  TaskCommandError,
  type TaskRow,
} from "../src/tasks/model.ts";
import { createApp } from "../src/app.ts";
import type { TransactionClient } from "../src/db/transaction.ts";

const eventId = randomUUID(),
  taskId = randomUUID(),
  memberId = randomUUID();
const user = {
  id: "synthetic-author",
  name: "Author",
  email: "author@example.invalid",
};
const fields = {
  title: "  Setup 🥋  ",
  category: "  Venue  ",
  context: " Details ",
  deadline: "2026-09-01",
  deadlineTime: null,
  priority: "important",
};
const denied = (status: number) => (error: unknown) =>
  error instanceof TaskCommandError && error.statusCode === status;
function harness(role = "ORGANIZER") {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const emitter = new EventEmitter();
  const state = {
    active: true,
    archived: false,
    target: true,
    task: true,
    fail: "",
    loseUpdate: false,
  };
  const row: TaskRow = {
    id: taskId,
    title: "Setup 🥋",
    category: "Venue",
    context: "Details",
    deadline: fields.deadline,
    deadlineTime: null,
    priority: "important",
    status: "in-progress",
    assigned_member_id: memberId,
    accepted_by_member_id: memberId,
    accepted_at: new Date("2026-10-03T01:00:00Z"),
    version: 4,
    updated_at: new Date("2026-10-03T02:00:00Z"),
  };
  const client: TransactionClient = {
    on: (event, listener) => emitter.on(event, listener),
    removeListener: (event, listener) =>
      emitter.removeListener(event, listener),
    release: () => {},
    async query(sql, values) {
      calls.push({ sql, values });
      if (state.fail && sql.startsWith(state.fail))
        throw new Error("PRIVATE_SQL_DETAIL");
      if (sql.startsWith("SELECT archived_at"))
        return { rows: [{ archived_at: state.archived ? new Date() : null }] };
      if (sql.includes("member.access_role"))
        return {
          rows: state.active
            ? [
                {
                  id: memberId,
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
      if (sql.startsWith("INSERT INTO public.task"))
        return {
          rows: [
            {
              ...row,
              id: values![0],
              title: values![2],
              category: values![3],
              context: values![4],
              deadline: values![5],
              deadlineTime: values![9],
              priority: values![6],
              assigned_member_id: values![7],
              accepted_by_member_id: null,
              accepted_at: null,
              status: "not-started",
              version: 1,
            },
          ],
        };
      if (sql.startsWith("UPDATE public.task"))
        return {
          rows: state.loseUpdate
            ? []
            : [
                {
                  ...row,
                  title: values![2],
                  category: values![3],
                  context: values![4],
                  deadline: values![5],
                  deadlineTime: values![9],
                  priority: values![6],
                  version: row.version + 1,
                },
              ],
        };
      return { rows: [] };
    },
  };
  return {
    service: createTaskService({ connect: async () => client }),
    calls,
    state,
    row,
  };
}

test("optional time is exact HH:mm/null and date remains required; PATCH omission preserves time", () => {
  for (const deadlineTime of [
    null,
    "00:00",
    "00:01",
    "08:00",
    "12:30",
    "23:59",
  ])
    assert.equal(
      parseTaskAuthoring({ ...fields, deadlineTime }).deadlineTime,
      deadlineTime,
    );
  assert.equal(
    parseTaskAuthoring({
      title: "Task",
      deadline: fields.deadline,
      priority: "normal",
    }).deadlineTime,
    null,
  );
  assert.equal(
    Object.hasOwn(
      parseTaskAuthoring({ expectedVersion: 4 }, true),
      "deadlineTime",
    ),
    false,
  );
  for (const deadlineTime of [
    "25:00",
    "12:75",
    "abc",
    "9pm",
    "8:00",
    "08:00:00",
    "24:00",
    " 08:00",
    "",
    800,
    {},
    undefined,
  ]) {
    for (const editing of [false, true])
      assert.throws(
        () =>
          parseTaskAuthoring(
            { ...(editing ? { expectedVersion: 4 } : fields), deadlineTime },
            editing,
          ),
        (error) =>
          error instanceof TaskCommandError &&
          error.fields?.deadlineTime === "INVALID_TIME",
      );
  }
  for (const deadline of [null, undefined, ""])
    assert.throws(
      () => parseTaskAuthoring({ ...fields, deadline, deadlineTime: "08:00" }),
      denied(400),
    );
});

test("time edit uses one update/history/version, preserves acceptance and supports null/no-op/stale", async () => {
  for (const deadlineTime of ["16:00", "18:30", "23:59", null]) {
    const h = harness();
    h.row.deadlineTime = "08:00";
    const after = await h.service.updateDetails(user, eventId, taskId, {
      deadlineTime,
      expectedVersion: 4,
    });
    assert.equal(after.deadlineTime, deadlineTime);
    assert.equal(after.version, 5);
    assert.equal(after.acceptedAt, h.row.accepted_at!.toISOString());
    assert.equal(after.assignedMemberId, memberId);
    assert.equal(after.status, h.row.status);
    const updates = h.calls.filter((call) =>
      call.sql.startsWith("UPDATE public.task"),
    );
    const history = h.calls.filter((call) =>
      call.sql.startsWith("INSERT INTO public.activity_entry"),
    );
    assert.equal(updates.length, 1);
    assert.equal(history.length, 1);
    assert.equal(history[0]!.values![4], "task.updated");
    assert.deepEqual(JSON.parse(history[0]!.values![6] as string).changes, {
      deadlineTime: { before: "08:00", after: deadlineTime },
    });
  }
  const h = harness();
  h.row.deadlineTime = "16:00";
  assert.equal(
    (
      await h.service.updateDetails(user, eventId, taskId, {
        deadline: "2026-11-10",
        expectedVersion: 4,
      })
    ).deadlineTime,
    "16:00",
  );
  const noop = harness();
  assert.equal(
    (
      await noop.service.updateDetails(user, eventId, taskId, {
        deadlineTime: null,
        expectedVersion: 4,
      })
    ).version,
    4,
  );
  assert.equal(
    noop.calls.filter((call) => call.sql.startsWith("UPDATE")).length,
    0,
  );
  await assert.rejects(
    noop.service.updateDetails(user, eventId, taskId, {
      deadlineTime: "16:00",
      expectedVersion: 3,
    }),
    denied(409),
  );
});

test("create/edit whitelist rejects forged actors, scope, status, acceptance, assignment edits and version", () => {
  for (const field of [
    "id",
    "eventId",
    "createdBy",
    "updatedBy",
    "status",
    "accepted",
    "acceptedByMemberId",
    "acceptedAt",
    "version",
    "accessRole",
    "operationalRole",
    "blockedBy",
    "blocks",
    "createdAt",
    "updatedAt",
  ]) {
    assert.throws(
      () => parseTaskAuthoring({ ...fields, [field]: "forged" }),
      denied(400),
    );
    assert.throws(
      () =>
        parseTaskAuthoring(
          { ...fields, expectedVersion: 4, [field]: "forged" },
          true,
        ),
      denied(400),
    );
  }
  assert.throws(
    () => parseTaskAuthoring({ ...fields, expectedVersion: 1 }),
    denied(400),
  );
  assert.throws(
    () =>
      parseTaskAuthoring({ assignedMemberId: null, expectedVersion: 4 }, true),
    denied(400),
  );
  assert.deepEqual(parseTaskAuthoring({ ...fields }), {
    ...fields,
    title: "Setup 🥋",
    category: "Venue",
    context: "Details",
    assignedMemberId: null,
  });
});

test("strict bounded Unicode/free text, real calendar dates, enums and versions", () => {
  for (const [field, values] of Object.entries({
    title: ["", "   ", "x".repeat(201), "NUL\u0000", "\ud800"],
    category: ["x".repeat(101), 2, null, "\udc00"],
    context: ["x".repeat(5001), "\u0000", false],
    deadline: [
      "2026-02-29",
      "2026-04-31",
      "0000-01-01",
      "2026-01-01T00:00:00Z",
      "2026-1-01",
    ],
    priority: ["urgent", 3],
    assignedMemberId: ["", 2],
  })) {
    for (const value of values)
      assert.throws(
        () => parseTaskAuthoring({ ...fields, [field]: value }),
        denied(400),
      );
  }
  for (const expectedVersion of [0, -1, 1.5, "4", 2147483647])
    assert.throws(
      () => parseTaskAuthoring({ expectedVersion }, true),
      denied(400),
    );
  assert.equal(
    parseTaskAuthoring({ ...fields, deadline: "2028-02-29" }).deadline,
    "2028-02-29",
  );
  assert.equal(
    parseTaskAuthoring({
      title: "Preparation",
      deadline: "0001-01-01",
      deadlineTime: null,
      priority: "normal",
    }).category,
    "",
  );
});

test("Organizer create: scoped server ID/actor/defaults and one atomic task.created entry", async () => {
  for (const assignee of [null, memberId]) {
    const h = harness();
    const task = await h.service.create(user, eventId, {
      ...fields,
      assignedMemberId: assignee,
    });
    assert.notEqual(task.id, taskId);
    assert.equal(task.version, 1);
    assert.equal(task.status, "not-started");
    assert.equal(task.accepted, false);
    assert.equal(task.acceptedAt, null);
    assert.equal(task.assignedMemberId, assignee);
    const insert = h.calls.find((call) =>
      call.sql.startsWith("INSERT INTO public.task"),
    )!;
    assert.equal(insert.values![1], eventId);
    assert.equal(insert.values![8], memberId);
    const activity = h.calls.find((call) =>
      call.sql.startsWith("INSERT INTO public.activity_entry"),
    )!;
    assert.deepEqual(activity.values!.slice(1, 7), [
      eventId,
      user.id,
      memberId,
      "task.created",
      task.id,
      JSON.stringify({
        title: "Setup 🥋",
        category: "Venue",
        deadline: fields.deadline,
        deadlineTime: null,
        priority: "important",
        assignedMemberId: assignee,
        taskVersion: 1,
      }),
    ]);
    assert.equal(h.calls.at(-1)!.sql, "COMMIT");
  }
});

test("authoring authority derives only from active same-Event Organizer membership", async () => {
  const member = harness("MEMBER");
  await assert.rejects(
    member.service.create(user, eventId, fields),
    denied(403),
  );
  await assert.rejects(
    member.service.updateDetails(user, eventId, taskId, {
      title: "Changed",
      expectedVersion: 4,
    }),
    denied(403),
  );
  const h = harness();
  h.state.active = false;
  await assert.rejects(h.service.create(user, eventId, fields), denied(404));
  h.state.active = true;
  h.state.archived = true;
  await assert.rejects(h.service.create(user, eventId, fields), denied(403));
  h.state.archived = false;
  h.state.target = false;
  await assert.rejects(
    h.service.create(user, eventId, { ...fields, assignedMemberId: memberId }),
    denied(400),
  );
  h.state.task = false;
  await assert.rejects(
    h.service.updateDetails(user, eventId, taskId, { expectedVersion: 4 }),
    denied(404),
  );
});

test("all authored fields update once, only meaningful changes recorded, acceptance/status preserved", async () => {
  const h = harness();
  const after = await h.service.updateDetails(user, eventId, taskId, {
    title: "Edited",
    category: "",
    context: "More",
    deadline: "2026-09-02",
    deadlineTime: null,
    priority: "critical",
    expectedVersion: 4,
  });
  assert.equal(after.version, 5);
  assert.equal(after.accepted, true);
  assert.equal(after.acceptedAt, h.row.accepted_at!.toISOString());
  assert.equal(after.status, h.row.status);
  const update = h.calls.find((call) =>
    call.sql.startsWith("UPDATE public.task"),
  )!;
  assert.doesNotMatch(
    update.sql.split("WHERE")[0]!,
    /assigned_member_id|accepted_by_member_id|accepted_at|status =/,
  );
  const activity = h.calls.find((call) =>
    call.sql.startsWith("INSERT INTO public.activity_entry"),
  )!;
  const payload = JSON.parse(activity.values![6] as string);
  assert.deepEqual(Object.keys(payload.changes).sort(), [
    "category",
    "context",
    "deadline",
    "priority",
    "title",
  ]);
  assert.equal(activity.values![4], "task.updated");
});

test("current no-op skips update/history; stale no-op conflicts before equality; failed write/history rolls back", async () => {
  const h = harness();
  assert.equal(
    (
      await h.service.updateDetails(user, eventId, taskId, {
        ...fields,
        expectedVersion: 4,
      })
    ).version,
    4,
  );
  assert.ok(
    h.calls.every(
      (call) =>
        !call.sql.startsWith("UPDATE") && !call.sql.startsWith("INSERT"),
    ),
  );
  await assert.rejects(
    h.service.updateDetails(user, eventId, taskId, {
      ...fields,
      expectedVersion: 3,
    }),
    denied(409),
  );
  for (const fail of [
    "INSERT INTO public.task",
    "UPDATE public.task",
    "INSERT INTO public.activity_entry",
  ]) {
    const failing = harness();
    failing.state.fail = fail;
    await assert.rejects(
      fail.startsWith("UPDATE")
        ? failing.service.updateDetails(user, eventId, taskId, {
            title: "Change",
            expectedVersion: 4,
          })
        : failing.service.create(user, eventId, fields),
    );
    assert.equal(failing.calls.at(-1)!.sql, "ROLLBACK");
  }
  h.state.loseUpdate = true;
  await assert.rejects(
    h.service.updateDetails(user, eventId, taskId, {
      title: "Change",
      expectedVersion: 4,
    }),
    denied(409),
  );
});

test("HTTP authoring authenticates, guards origin, sanitizes errors and returns 201/200", async () => {
  const h = harness();
  let authenticated = true;
  const app = createApp({
    checkDatabase: async () => {},
    tasks: h.service,
    authentication: {
      baseURL: "http://localhost:3001",
      taskMutationOrigins: ["http://localhost:5173"],
      auth: {
        handler: async () => new Response(),
        api: {
          getSession: async () =>
            authenticated ? { user: { ...user, active: true } } : null,
        },
      },
    },
  });
  try {
    const url = `/api/events/${eventId}/tasks`,
      headers = { origin: "http://localhost:5173" };
    authenticated = false;
    assert.equal(
      (await app.inject({ method: "POST", url, headers, payload: fields }))
        .statusCode,
      401,
    );
    authenticated = true;
    for (const origin of ["", "http://evil.invalid"])
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url,
            headers: { origin },
            payload: fields,
          })
        ).statusCode,
        403,
      );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url,
          headers: { ...headers, "sec-fetch-site": "cross-site" },
          payload: fields,
        })
      ).statusCode,
      403,
    );
    const created = await app.inject({
      method: "POST",
      url,
      headers,
      payload: fields,
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.headers["cache-control"], "no-store");
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `${url}/${taskId}`,
          headers,
          payload: { title: "Edit", expectedVersion: 4 },
        })
      ).statusCode,
      200,
    );
    const invalid = await app.inject({
      method: "POST",
      url,
      headers,
      payload: { ...fields, title: "" },
    });
    assert.equal(invalid.statusCode, 400);
    assert.deepEqual(invalid.json().fields, { title: "INVALID_TEXT" });
    h.state.fail = "INSERT INTO public.activity_entry";
    const failure = await app.inject({
      method: "POST",
      url,
      headers,
      payload: fields,
    });
    assert.equal(failure.statusCode, 500);
    assert.doesNotMatch(failure.body, /PRIVATE_SQL_DETAIL|stack/);
  } finally {
    await app.close();
  }
});
