import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  EventActionFailure,
  RemoteWorkspaceService,
  WorkspaceReadFailure,
  emptyTasksWorkspace,
  mapTaskRead,
  readRemoteEvent,
  type EventFields,
  type TaskEvent,
  type TasksWorkspace,
} from "./RemoteWorkspaceService.ts";
import { TaskReadController } from "./taskReadState.ts";
import { toWorkspaceView } from "./workspaceViews.ts";

const event: TaskEvent = {
  id: randomUUID(),
  name: "Synthetic Event A",
  startDate: "2026-10-04",
  endDate: "2026-10-05",
  timezone: "Europe/Sofia",
  archived: false,
  membership: { id: randomUUID(), accessRole: "MEMBER" },
  version: 1,
  createdAt: "2026-10-03T12:00:00Z",
  updatedAt: "2026-10-03T12:00:00Z",
};
const next: TaskEvent = {
  ...event,
  id: randomUUID(),
  name: "Synthetic Event B",
  membership: { id: randomUUID(), accessRole: "ORGANIZER" },
};
const fields: EventFields = {
  name: next.name,
  startDate: next.startDate,
  endDate: next.endDate,
  timezone: next.timezone,
};
const signal = () => new AbortController().signal;
const fails = (code: string) => (error: unknown) =>
  error instanceof EventActionFailure && error.code === code;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const members = (value: TaskEvent) => [
  { id: value.membership.id, name: `${value.name} creator`, role: "Organizer" },
];
const workspace = (value: TaskEvent) => ({
  ...mapTaskRead(value, { tasks: [], members: members(value) }),
  activeMembers: members(value),
});
const scopedWorkspace: TasksWorkspace = {
  ...mapTaskRead(next, {
    tasks: [
      {
        id: randomUUID(),
        title: "Synthetic scoped task",
        category: "Venue",
        context: "Preserved through Event edit",
        deadline: next.startDate,
        status: "not-started",
        priority: "normal",
        assignedMemberId: null,
        accepted: false,
        acceptedByMemberId: null,
        acceptedAt: null,
        version: 1,
        updatedAt: next.updatedAt,
        blockedBy: "",
        blocks: "",
      },
    ],
    members: members(next),
  }),
  activeMembers: members(next),
};

test("Event create sends only editable calendar fields and uses canonical Organizer projection", async () => {
  const service = new RemoteWorkspaceService(async (url, options) => {
    assert.equal(url, "/api/events");
    assert.equal(options?.method, "POST");
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.cache, "no-store");
    assert.deepEqual(JSON.parse(options?.body as string), fields);
    return Response.json(
      {
        event: {
          ...next,
          ownerUserId: "SYNTHETIC_EXTRA",
          actorId: "SYNTHETIC_EXTRA",
        },
      },
      { status: 201 },
    );
  });
  const result = await service.createEvent(
    { ...fields, ownerUserId: "SYNTHETIC_FORGED", version: 900 } as EventFields,
    signal(),
  );
  assert.deepEqual(result, next);
  assert.equal(result.membership.accessRole, "ORGANIZER");
  assert.equal(result.startDate, "2026-10-04");
});

test("Event edit targets explicit Event and carries the caller's expectedVersion", async () => {
  const canonical = {
    ...next,
    name: "Canonical edited",
    timezone: "Pacific/Kiritimati",
    version: 2,
  };
  const service = new RemoteWorkspaceService(async (url, options) => {
    assert.equal(url, `/api/events/${next.id}`);
    assert.equal(options?.method, "PATCH");
    assert.deepEqual(JSON.parse(options?.body as string), {
      ...fields,
      expectedVersion: 1,
    });
    return Response.json({ event: canonical });
  });
  assert.deepEqual(
    await service.updateEvent(next.id, 1, fields, signal()),
    canonical,
  );
});

for (const [status, code] of [
  [400, "invalid"],
  [401, "unauthenticated"],
  [403, "forbidden"],
  [404, "not-found"],
  [409, "conflict"],
  [500, "unavailable"],
] as const)
  test(`Event HTTP ${status} returns safe ${code} and discards raw backend details`, async () => {
    const service = new RemoteWorkspaceService(async () =>
      Response.json(
        {
          message: "SYNTHETIC_POSTGRES_INTERNAL",
          fields: {
            name: "INVALID_NAME",
            endDate: "END_BEFORE_START",
            timezone: "SYNTHETIC_PRIVATE_TEXT",
            ownerUserId: "SYNTHETIC_PRIVATE_TEXT",
          },
        },
        { status },
      ),
    );
    await assert.rejects(service.createEvent(fields, signal()), (error) => {
      assert.ok(fails(code)(error));
      assert.doesNotMatch(JSON.stringify(error), /SYNTHETIC_/);
      assert.deepEqual(
        (error as EventActionFailure).fields,
        status === 400
          ? { name: "INVALID_NAME", endDate: "END_BEFORE_START" }
          : {},
      );
      return true;
    });
  });

test("Event projections reject malformed version, dates, timezone, foreign update and non-Organizer creation", async () => {
  for (const row of [
    { ...next, version: undefined },
    { ...next, version: 0 },
    { ...next, version: 1.5 },
    { ...next, startDate: "2026-02-30" },
    { ...next, startDate: "0000-01-01" },
    { ...next, startDate: "2026-10-06" },
    { ...next, timezone: "+02:00" },
    { ...next, timezone: "Invalid/Timezone" },
    { ...next, updatedAt: "2026-10-03" },
  ])
    assert.throws(() => readRemoteEvent(row), WorkspaceReadFailure);
  for (const row of [
    { ...next, membership: event.membership },
    { ...next, archived: true },
  ]) {
    const service = new RemoteWorkspaceService(async () =>
      Response.json({ event: row }),
    );
    await assert.rejects(
      service.createEvent(fields, signal()),
      fails("invalid"),
    );
  }
  const foreign = new RemoteWorkspaceService(async () =>
    Response.json({ event }),
  );
  await assert.rejects(
    foreign.updateEvent(next.id, 1, fields, signal()),
    fails("invalid"),
  );
});

test("network and cancelled Event commands never leak transport details or apply a late response", async () => {
  const unavailable = new RemoteWorkspaceService(async () => {
    throw new Error("SYNTHETIC_NETWORK_DETAIL");
  });
  await assert.rejects(
    unavailable.createEvent(fields, signal()),
    fails("unavailable"),
  );
  const response = deferred<Response>();
  const remote = new RemoteWorkspaceService(async () => response.promise);
  const cancellation = new AbortController();
  const pending = remote.createEvent(fields, cancellation.signal);
  cancellation.abort();
  response.resolve(Response.json({ event: next }));
  await assert.rejects(pending, { name: "AbortError" });
});

test("explicit Event discovery reads only selected Tasks and Team and refuses foreign URLs", async () => {
  const paths: string[] = [];
  const remote = new RemoteWorkspaceService(async (url) => {
    paths.push(String(url));
    return Response.json(
      url === "/api/events"
        ? { events: [event, next] }
        : String(url).endsWith("/members")
          ? { members: members(next) }
          : String(url).endsWith("/changes")
            ? { changes: [] }
            : { tasks: [], members: [] },
    );
  });
  const result = await remote.readTasks(signal(), next.id);
  assert.equal(result.currentEventId, next.id);
  assert.deepEqual(result.accessibleEvents, [event, next]);
  assert.deepEqual(result.activeMembers, members(next));
  assert.deepEqual(result.tasks, []);
  assert.deepEqual(paths, [
    "/api/events",
    `/api/events/${next.id}/tasks`,
    `/api/events/${next.id}/members`,
    `/api/events/${next.id}/changes`,
  ]);
  const count = paths.length;
  await assert.rejects(
    remote.readTasks(signal(), randomUUID()),
    (error) =>
      error instanceof WorkspaceReadFailure && error.code === "not-found",
  );
  assert.equal(paths.length, count + 1);
  await assert.rejects(
    remote.getEvent(randomUUID(), signal()),
    (error) =>
      error instanceof WorkspaceReadFailure && error.code === "not-found",
  );
});

test("zero Event account has a ready honest empty workspace and no business requests", async () => {
  let requests = 0;
  const remote = new RemoteWorkspaceService(async (url) => {
    ++requests;
    assert.equal(url, "/api/events");
    return Response.json({ events: [] });
  });
  const controller = new TaskReadController(remote, () => {});
  await controller.load();
  assert.equal(controller.getSnapshot().status, "ready");
  assert.deepEqual(controller.getSnapshot().accessibleEvents, []);
  assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
  assert.equal(requests, 1);
});

test("switching replaces every workspace projection, retains accessible list, and cancels late Event A reads", async () => {
  const late = deferred<TasksWorkspace>();
  let oldSignal: AbortSignal | undefined;
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace(event),
      listEvents: async () => [event, next],
      readEventTasks: async (value, cancellation) => {
        if (value.id === event.id) {
          oldSignal = cancellation;
          return late.promise;
        }
        return workspace(next);
      },
    },
    () => {},
  );
  controller.selectEvent(event.id);
  const oldLoad = controller.load();
  await Promise.resolve();
  await Promise.resolve();
  controller.selectEvent(next.id);
  assert.equal(oldSignal?.aborted, true);
  assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
  assert.deepEqual(controller.getSnapshot().accessibleEvents, [event, next]);
  await controller.load();
  late.resolve(workspace(event));
  await oldLoad;
  const state = controller.getSnapshot();
  assert.equal(state.workspace.currentEventId, next.id);
  assert.deepEqual(toWorkspaceView(state.workspace).teamMembers, members(next));
  assert.deepEqual(state.workspace.tasks, []);
  assert.equal(state.workspace.events[0]?.membership.accessRole, "ORGANIZER");
  controller.selectEvent(event.id);
  assert.deepEqual(controller.getSnapshot().workspace.teamMembers, []);
});

test("Member-in-A can create B, then explicit selection opens fresh Organizer workspace", async () => {
  let created = false;
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace(event),
      listEvents: async () => (created ? [event, next] : [event]),
      readEventTasks: async (value) => workspace(value),
      createEvent: async () => {
        created = true;
        return next;
      },
    },
    () => {},
  );
  controller.selectEvent(event.id);
  await controller.load();
  assert.equal(
    controller.getSnapshot().workspace.events[0]?.membership.accessRole,
    "MEMBER",
  );
  assert.deepEqual(await controller.createEvent(fields), next);
  assert.deepEqual(controller.getSnapshot().accessibleEvents, [event, next]);
  controller.selectEvent(next.id);
  await controller.load();
  assert.equal(
    controller.getSnapshot().workspace.events[0]?.membership.accessRole,
    "ORGANIZER",
  );
  assert.deepEqual(controller.getSnapshot().workspace.tasks, []);
  assert.deepEqual(
    controller.getSnapshot().workspace.activeMembers,
    members(next),
  );
});

test("Event 409 never replays update; canonical refetch precedes explicit retry using fresh version", async () => {
  let commands = 0;
  const canonical = { ...next, version: 2, name: "Changed elsewhere" };
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace(next),
      updateEvent: async (_id, version) => {
        ++commands;
        if (version === 1) throw new EventActionFailure("conflict");
        return { ...canonical, version: 3, name: fields.name };
      },
      getEvent: async () => canonical,
    },
    () => {},
  );
  await controller.load();
  await assert.rejects(
    controller.updateEvent(next.id, 1, fields),
    fails("conflict"),
  );
  assert.equal(commands, 1);
  assert.equal(controller.getSnapshot().workspace.events[0]?.version, 1);
  const refreshed = await controller.getEvent(next.id);
  assert.equal(refreshed.version, 2);
  assert.equal(
    controller.getSnapshot().workspace.events[0]?.name,
    "Changed elsewhere",
  );
  assert.equal(commands, 1);
  const saved = await controller.updateEvent(
    next.id,
    refreshed.version,
    fields,
  );
  assert.equal(commands, 2);
  assert.equal(saved.version, 3);
  assert.equal(controller.getSnapshot().accessibleEvents[0]?.version, 3);
});

test("Event command 401 clears Tasks, Team, Event list and existing auth identity boundary", async () => {
  let expired = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace(event),
      createEvent: async () => {
        throw new EventActionFailure("unauthenticated");
      },
    },
    () => ++expired,
  );
  await controller.load();
  await assert.rejects(
    controller.createEvent(fields),
    fails("unauthenticated"),
  );
  assert.equal(expired, 1);
  assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
  assert.deepEqual(controller.getSnapshot().accessibleEvents, []);
});

test("Event command pending coalesces duplicate submissions and refocus; logout rejects late canonical response", async () => {
  const response = deferred<TaskEvent>();
  let reads = 0,
    commands = 0;
  let commandSignal: AbortSignal | undefined;
  const controller = new TaskReadController(
    {
      readTasks: async () => {
        ++reads;
        return workspace(event);
      },
      createEvent: async (_fields, cancellation) => {
        ++commands;
        commandSignal = cancellation;
        return response.promise;
      },
    },
    () => {},
  );
  await controller.load();
  const first = controller.createEvent(fields);
  assert.equal(controller.createEvent(fields), first);
  const focus = controller.load();
  controller.clear();
  assert.equal(commandSignal?.aborted, true);
  response.resolve(next);
  await assert.rejects(first, { name: "AbortError" });
  await focus;
  assert.equal(commands, 1);
  assert.equal(reads, 1);
  assert.deepEqual(controller.getSnapshot().accessibleEvents, []);
});

test("Event edit waits for a pre-write list read, then keeps canonical version and full scoped workspace", async () => {
  const staleList = deferred<TaskEvent[]>();
  const canonical = { ...next, name: "Saved canonical Event", version: 2 };
  let lists = 0,
    commands = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => scopedWorkspace,
      listEvents: async () => (++lists === 1 ? [next] : staleList.promise),
      readEventTasks: async () => scopedWorkspace,
      updateEvent: async (id, expectedVersion) => {
        ++commands;
        assert.equal(id, next.id);
        assert.equal(expectedVersion, 1);
        return canonical;
      },
    },
    () => {},
  );
  controller.selectEvent(next.id);
  await controller.load();
  const priorRead = controller.load();
  await Promise.resolve();
  const command = controller.updateEvent(next.id, 1, fields);
  assert.equal(controller.updateEvent(next.id, 1, fields), command);
  const refocus = controller.load();
  assert.equal(commands, 0);
  assert.deepEqual(controller.getSnapshot().accessibleEvents, [next]);
  staleList.resolve([next]);
  await Promise.all([priorRead, command, refocus]);
  const state = controller.getSnapshot();
  assert.equal(commands, 1);
  assert.equal(lists, 2);
  assert.equal(state.status, "ready");
  assert.equal(state.workspace.currentEventId, next.id);
  assert.deepEqual(state.workspace.events, [canonical]);
  assert.deepEqual(state.accessibleEvents, [canonical]);
  assert.deepEqual(state.workspace.tasks, scopedWorkspace.tasks);
  assert.deepEqual(state.workspace.activeMembers, members(next));
});

test("Event create waits for a pre-write list read so the new membership is retained", async () => {
  const staleList = deferred<TaskEvent[]>();
  let commands = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace(event),
      listEvents: async () => staleList.promise,
      readEventTasks: async () => workspace(event),
      createEvent: async () => {
        ++commands;
        return next;
      },
    },
    () => {},
  );
  const priorRead = controller.load();
  const command = controller.createEvent(fields);
  assert.equal(commands, 0);
  staleList.resolve([event]);
  await Promise.all([priorRead, command]);
  assert.equal(commands, 1);
  assert.deepEqual(controller.getSnapshot().accessibleEvents, [event, next]);
  assert.equal(controller.getSnapshot().workspace.currentEventId, event.id);
});

test("Event edit waits for pending task action refetch without losing canonical Task or Event results", async () => {
  const taskRefresh = deferred<TasksWorkspace>();
  const task = scopedWorkspace.tasks[0]!;
  const changedTask = { ...task, status: "in-progress" as const, version: 2 };
  const canonical = { ...next, name: "Saved after task", version: 2 };
  let eventCommands = 0,
    taskCommands = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => scopedWorkspace,
      executeTaskAction: async () => {
        ++taskCommands;
        return changedTask;
      },
      refreshTasks: async () => taskRefresh.promise,
      updateEvent: async () => {
        ++eventCommands;
        return canonical;
      },
    },
    () => {},
  );
  await controller.load();
  const action = controller.mutate(task.id, {
    kind: "status",
    status: "in-progress",
  });
  const command = controller.updateEvent(next.id, 1, fields);
  await Promise.resolve();
  assert.equal(eventCommands, 0);
  taskRefresh.resolve({ ...scopedWorkspace, tasks: [changedTask] });
  await Promise.all([action, command]);
  const state = controller.getSnapshot();
  assert.equal(taskCommands, 1);
  assert.equal(eventCommands, 1);
  assert.equal(state.status, "ready");
  assert.deepEqual(state.workspace.events, [canonical]);
  assert.deepEqual(state.workspace.tasks, [changedTask]);
  assert.deepEqual(state.workspace.activeMembers, members(next));
  assert.equal(state.mutation?.pending, false);
});

test("failed Event edit preserves the settled prior read and never replays the command", async () => {
  const priorWorkspace = deferred<TasksWorkspace>();
  let commands = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => priorWorkspace.promise,
      updateEvent: async () => {
        ++commands;
        throw new EventActionFailure("conflict");
      },
    },
    () => {},
  );
  const priorRead = controller.load();
  const command = controller.updateEvent(next.id, 1, fields);
  const rejected = assert.rejects(command, fails("conflict"));
  assert.equal(commands, 0);
  priorWorkspace.resolve(scopedWorkspace);
  await Promise.all([priorRead, rejected]);
  assert.equal(commands, 1);
  assert.equal(controller.getSnapshot().status, "ready");
  assert.deepEqual(controller.getSnapshot().workspace, scopedWorkspace);
  assert.deepEqual(controller.getSnapshot().accessibleEvents, [next]);
});

test("cancelled Event command waiting for a read settles refocus promptly without sending a write", async () => {
  const priorWorkspace = deferred<TasksWorkspace>();
  const cancellation = new AbortController();
  let commands = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => priorWorkspace.promise,
      updateEvent: async () => {
        ++commands;
        return { ...next, version: 2 };
      },
    },
    () => {},
  );
  const priorRead = controller.load();
  const command = controller.updateEvent(
    next.id,
    1,
    fields,
    cancellation.signal,
  );
  const refocus = controller.load();
  cancellation.abort();
  await assert.rejects(command, { name: "AbortError" });
  await refocus;
  assert.equal(commands, 0);
  priorWorkspace.resolve(scopedWorkspace);
  await priorRead;
  assert.deepEqual(controller.getSnapshot().workspace, scopedWorkspace);
});

test("a removed explicit Event fails closed while remaining accessible Events stay selectable", async () => {
  let events = [event, next];
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace(event),
      listEvents: async () => events,
      readEventTasks: async (value) => workspace(value),
    },
    () => {},
  );
  controller.selectEvent(event.id);
  await controller.load();
  events = [next];
  await controller.load();
  assert.equal(controller.getSnapshot().error, "not-found");
  assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
  assert.deepEqual(controller.getSnapshot().accessibleEvents, [next]);
});

for (const code of ["forbidden", "not-found"] as const)
  test(`membership revoked between Event list and scoped read (${code}) removes only denied Event`, async () => {
    const controller = new TaskReadController(
      {
        readTasks: async () => workspace(event),
        listEvents: async () => [event, next],
        readEventTasks: async () => {
          throw new WorkspaceReadFailure(code);
        },
      },
      () => {},
    );
    controller.selectEvent(event.id);
    await controller.load();
    assert.equal(controller.getSnapshot().error, code);
    assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
    assert.deepEqual(controller.getSnapshot().accessibleEvents, [next]);
  });

test("fresh accessible-list refresh removes scoped data when current membership disappears", async () => {
  let events = [event, next];
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace(event),
      listEvents: async () => events,
      readEventTasks: async (value) => workspace(value),
    },
    () => {},
  );
  controller.selectEvent(event.id);
  await controller.load();
  events = [next];
  await controller.refreshEvents();
  assert.equal(controller.getSnapshot().error, "not-found");
  assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
  assert.deepEqual(controller.getSnapshot().accessibleEvents, [next]);
});
