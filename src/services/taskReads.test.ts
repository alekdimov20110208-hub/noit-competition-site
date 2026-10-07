import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RemoteWorkspaceService,
  WorkspaceReadFailure,
  emptyTasksWorkspace,
  mapTaskRead,
  readAccessibleEvents,
  selectAccessibleEvent,
  type TaskEvent,
  type TasksWorkspace,
} from "./RemoteWorkspaceService.ts";
import { TaskReadController, eventCalendarNow } from "./taskReadState.ts";
import { getDeadlineTiming } from "../domain/taskTiming.ts";

const event: TaskEvent = {
  id: randomUUID(),
  name: "Synthetic server event",
  startDate: "2026-10-04",
  endDate: "2026-10-05",
  timezone: "Europe/Sofia",
  archived: false,
  version: 1,
  createdAt: "2026-10-03T12:00:00Z",
  updatedAt: "2026-10-03T12:00:00Z",
  membership: { id: randomUUID(), accessRole: "ORGANIZER" },
};
const member = { id: randomUUID(), name: "Synthetic assignee", role: "Venue" };
const task = {
  id: randomUUID(),
  title: "Synthetic PostgreSQL task",
  category: "Venue",
  context: "Scoped task",
  deadline: "2026-10-04",
  deadlineTime: null,
  status: "in-progress",
  priority: "important",
  assignedMemberId: member.id,
  accepted: true,
  acceptedByMemberId: member.id,
  acceptedAt: "2026-10-03T12:00:00Z",
  version: 8,
  updatedAt: "2026-10-03T12:05:00Z",
  blockedBy: "",
  blocks: "Venue setup",
};
const body = { tasks: [task], members: [member] };
const workspace = mapTaskRead(event, body);
const failure = (code: string) => (error: unknown) =>
  error instanceof WorkspaceReadFailure && error.code === code;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("remote adapter maps server semantics, assignment, acceptance metadata, version and relationships", () => {
  const mapped = workspace.tasks[0]!;
  assert.equal(mapped.eventId, event.id);
  assert.equal(mapped.ownerId, member.id);
  assert.equal(mapped.acknowledged, true);
  for (const field of [
    "status",
    "priority",
    "deadline",
    "version",
    "assignedMemberId",
    "acceptedByMemberId",
    "acceptedAt",
    "updatedAt",
    "blocks",
  ] as const)
    assert.equal(mapped[field], task[field]);
  assert.deepEqual(workspace.teamMembers, [member]);
  assert.ok(!("isOrganizer" in workspace.teamMembers[0]!));
});

test("unassigned and withdrawn tasks retain nullable canonical metadata and display semantics", () => {
  const result = mapTaskRead(event, {
    members: [],
    tasks: [
      {
        ...task,
        assignedMemberId: null,
        accepted: false,
        acceptedByMemberId: null,
        acceptedAt: null,
      },
    ],
  }).tasks[0]!;
  assert.equal(result.ownerId, "");
  assert.equal(result.assignedMemberId, null);
  assert.equal(result.acknowledged, false);
});

test("accessible Event selection handles zero, one and multiple results independently of response order", () => {
  assert.equal(selectAccessibleEvent([]), null);
  assert.equal(selectAccessibleEvent([event]), event);
  const earlier = { ...event, id: randomUUID(), startDate: "2026-10-01" };
  assert.equal(selectAccessibleEvent([event, earlier]), earlier);
  assert.equal(selectAccessibleEvent([earlier, event]), earlier);
  const tied = { ...event, id: randomUUID() };
  assert.deepEqual(
    selectAccessibleEvent([event, tied]),
    selectAccessibleEvent([tied, event]),
  );
});

test("Event projection derives authenticated membership roles and excludes unrelated fields", () => {
  assert.deepEqual(
    readAccessibleEvents({
      events: [{ ...event, ownerPassword: "SYNTHETIC_RAW" }],
    }),
    [event],
  );
  for (const value of [
    { events: [{ ...event, id: "unsafe/id" }] },
    { events: [{ ...event, timezone: "Unknown/Timezone" }] },
    {
      events: [
        { ...event, membership: { ...event.membership, accessRole: "ADMIN" } },
      ],
    },
    { events: [event, event] },
  ])
    assert.throws(() => readAccessibleEvents(value), failure("invalid"));
});

for (const role of ["ORGANIZER", "MEMBER"] as const)
  test(`${role} remote task load uses real discovered scope and included cookie credentials`, async () => {
    const calls: { path: string; options?: RequestInit }[] = [];
    const service = new RemoteWorkspaceService(async (input, options) => {
      calls.push({ path: String(input), options });
      return Response.json(
        calls.length === 1
          ? {
              events: [
                {
                  ...event,
                  membership: { ...event.membership, accessRole: role },
                },
              ],
            }
          : String(input).endsWith("/changes")
            ? { changes: [] }
            : body,
      );
    });
    const result = await service.readTasks(new AbortController().signal);
    assert.equal(result.events[0]?.membership.accessRole, role);
    assert.equal(result.tasks[0]?.title, task.title);
    assert.deepEqual(
      calls.map((call) => call.path),
      [
        "/api/events",
        `/api/events/${event.id}/tasks`,
        `/api/events/${event.id}/members`,
        `/api/events/${event.id}/changes`,
      ],
    );
    for (const call of calls) {
      assert.equal(call.options?.credentials, "same-origin");
      assert.equal(call.options?.method, "GET");
      assert.equal(call.options?.cache, "no-store");
      assert.ok(call.options?.signal instanceof AbortSignal);
    }
    assert.deepEqual(result.changes, []);
    assert.equal(result.changeReadError, null);
  });

test("empty account does not issue task requests or return demo data", async () => {
  let count = 0;
  const service = new RemoteWorkspaceService(async () => {
    count++;
    return Response.json({ events: [] });
  });
  assert.deepEqual(
    await service.readTasks(new AbortController().signal),
    emptyTasksWorkspace(),
  );
  assert.equal(count, 1);
});

test("fetch transport is invoked without the adapter as receiver", async () => {
  const service = new RemoteWorkspaceService(async function (this: unknown) {
    assert.equal(this, undefined);
    return Response.json({ events: [] });
  });
  await service.readTasks(new AbortController().signal);
});

for (const [status, code] of [
  [401, "unauthenticated"],
  [403, "forbidden"],
  [404, "not-found"],
  [500, "unavailable"],
] as const)
  test(`HTTP ${status} fails explicitly with sanitized ${code}`, async () => {
    let call = 0;
    const service = new RemoteWorkspaceService(async () =>
      ++call === 1
        ? Response.json({ events: [event] })
        : new Response("SYNTHETIC_SQL_OR_SECRET", { status }),
    );
    await assert.rejects(
      service.readTasks(new AbortController().signal),
      (error) => {
        assert.ok(failure(code)(error));
        assert.doesNotMatch(String(error), /SYNTHETIC_SQL_OR_SECRET/);
        return true;
      },
    );
  });

test("network and malformed responses fail without any fictional fallback", async () => {
  const network = new RemoteWorkspaceService(async () => {
    throw new Error("SYNTHETIC_INTERNAL");
  });
  await assert.rejects(
    network.readTasks(new AbortController().signal),
    failure("unavailable"),
  );
  const malformed = new RemoteWorkspaceService(
    async () => new Response("not-json"),
  );
  await assert.rejects(
    malformed.readTasks(new AbortController().signal),
    failure("invalid"),
  );
  for (const invalidTask of [
    { ...task, deadline: "2026-10-04T00:00:00Z" },
    { ...task, deadline: "2026-02-30" },
    { ...task, acceptedByMemberId: randomUUID() },
    { ...task, status: "unknown" },
    { ...task, priority: "unknown" },
    { ...task, version: 0 },
  ])
    assert.throws(
      () => mapTaskRead(event, { members: [member], tasks: [invalidTask] }),
      failure("invalid"),
    );
  assert.throws(
    () => mapTaskRead(event, { ...body, members: [] }),
    failure("invalid"),
  );
});

test("DATE deadline remains identical across host timezones and real clock uses Event calendar", () => {
  const original = process.env.TZ;
  try {
    for (const timezone of [
      "Pacific/Honolulu",
      "Europe/Sofia",
      "Pacific/Kiritimati",
    ]) {
      process.env.TZ = timezone;
      assert.equal(mapTaskRead(event, body).tasks[0]?.deadline, "2026-10-04");
      const now = eventCalendarNow(
        new Date("2026-10-03T22:30:00Z"),
        event.timezone,
      );
      assert.equal(getDeadlineTiming(task.deadline, now), "today");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("loading remains deliberate and repeated reads coalesce", async () => {
  const d = deferred<TasksWorkspace>();
  let calls = 0;
  const controller = new TaskReadController(
    {
      readTasks: () => {
        calls++;
        return d.promise;
      },
    },
    () => {},
  );
  const first = controller.load(),
    second = controller.load();
  assert.equal(first, second);
  assert.equal(controller.getSnapshot().status, "loading");
  assert.deepEqual(controller.getSnapshot().workspace.tasks, []);
  d.resolve(workspace);
  await first;
  assert.equal(calls, 1);
  assert.equal(controller.getSnapshot().status, "ready");
});

test("empty task result is a ready server state", async () => {
  const controller = new TaskReadController(
    { readTasks: async () => mapTaskRead(event, { tasks: [], members: [] }) },
    () => {},
  );
  await controller.load();
  assert.equal(controller.getSnapshot().status, "ready");
  assert.equal(controller.getSnapshot().workspace.currentEventId, event.id);
  assert.deepEqual(controller.getSnapshot().workspace.tasks, []);
});

test("backend failure clears old tasks and explicit retry reloads", async () => {
  let shouldFail = false;
  const controller = new TaskReadController(
    {
      readTasks: async () => {
        if (shouldFail) throw new WorkspaceReadFailure("unavailable");
        return workspace;
      },
    },
    () => {},
  );
  await controller.load();
  shouldFail = true;
  await controller.load();
  assert.equal(controller.getSnapshot().status, "error");
  assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
  shouldFail = false;
  await controller.load();
  assert.equal(controller.getSnapshot().workspace.tasks[0]?.id, task.id);
});

test("expired session invokes auth clearing; authorization refusal preserves authentication", async () => {
  let expirations = 0;
  for (const code of ["forbidden", "unauthenticated"] as const) {
    const controller = new TaskReadController(
      {
        readTasks: async () => {
          throw new WorkspaceReadFailure(code);
        },
      },
      () => expirations++,
    );
    await controller.load();
    assert.equal(controller.getSnapshot().error, code);
    assert.deepEqual(controller.getSnapshot().workspace.tasks, []);
    assert.equal(expirations, code === "unauthenticated" ? 1 : 0);
  }
});

test("logout/navigation cancellation aborts and rejects late former-user responses", async () => {
  const d = deferred<TasksWorkspace>();
  let signal: AbortSignal | undefined;
  const controller = new TaskReadController(
    {
      readTasks: (cancellation) => {
        signal = cancellation;
        return d.promise;
      },
    },
    () => {},
  );
  const pending = controller.load();
  await Promise.resolve();
  controller.clear();
  assert.equal(signal?.aborted, true);
  d.resolve(workspace);
  await pending;
  assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
});

test("discarded StrictMode setup issues no uncontrolled requests", async () => {
  let calls = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => {
        calls++;
        return workspace;
      },
    },
    () => {},
  );
  const discarded = controller.load();
  controller.clear();
  const active = controller.load();
  await Promise.all([discarded, active]);
  assert.equal(calls, 1);
});

test("remote source contains no development Event UUID, demo fallback or browser token storage", () => {
  const source = readFileSync(
    new URL("./RemoteWorkspaceService.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/i,
  );
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage|createDemoWorkspace|LocalDemo/,
  );
});
