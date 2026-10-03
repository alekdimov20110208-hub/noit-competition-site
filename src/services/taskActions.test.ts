import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  RemoteWorkspaceService,
  TaskActionFailure,
  WorkspaceReadFailure,
  mapTaskRead,
  type TaskAction,
  type TaskEvent,
  type RemoteTask,
  type TasksWorkspace,
} from "./RemoteWorkspaceService.ts";
import { TaskReadController } from "./taskReadState.ts";
import { taskAffordances } from "./taskAffordances.ts";

const member = { id: randomUUID(), name: "Synthetic member", role: "Venue" };
const event: TaskEvent = {
  id: randomUUID(),
  name: "Synthetic event",
  startDate: "2026-10-03",
  endDate: "2026-10-04",
  timezone: "Europe/Sofia",
  archived: false,
  membership: { id: member.id, accessRole: "MEMBER" },
};
const dto = {
  id: randomUUID(),
  title: "Synthetic task",
  category: "Venue",
  context: "",
  deadline: "2026-10-04",
  status: "not-started",
  priority: "normal",
  assignedMemberId: member.id,
  accepted: false,
  acceptedByMemberId: null,
  acceptedAt: null,
  version: 3,
  updatedAt: "2026-10-03T12:00:00Z",
  blockedBy: "",
  blocks: "",
};
const workspace = mapTaskRead(event, { tasks: [dto], members: [member] });
const task = workspace.tasks[0]!;
const signal = () => new AbortController().signal;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const statusAction: TaskAction = { kind: "status", status: "blocked" };

for (const [label, kind, method, fields] of [
  ["assignment", "assignment", "POST", { assignedMemberId: member.id }],
  ["reassignment", "assignment", "POST", { assignedMemberId: randomUUID() }],
  ["unassignment", "assignment", "POST", { assignedMemberId: null }],
  ["acceptance", "acceptance", "PUT", { accepted: true }],
  ["withdrawal", "acceptance", "PUT", { accepted: false }],
  ["status", "status", "PATCH", { status: "blocked" }],
] as const)
  test(`${label}: exact scoped command, expectedVersion and canonical projection`, async () => {
    let calls = 0;
    const canonical = {
      ...dto,
      version: 4,
      status: "blocked",
      secret: "SYNTHETIC_INTERNAL",
    };
    const service = new RemoteWorkspaceService(async (url, options) => {
      calls++;
      assert.equal(url, `/api/events/${event.id}/tasks/${dto.id}/${kind}`);
      assert.equal(options?.method, method);
      assert.equal(options?.credentials, "same-origin");
      assert.deepEqual(JSON.parse(options?.body as string), {
        ...fields,
        expectedVersion: 3,
      });
      assert.ok(options?.signal instanceof AbortSignal);
      return Response.json({ task: canonical });
    });
    const result =
      kind === "assignment"
        ? await service.assignTask(
            event.id,
            dto.id,
            (fields as { assignedMemberId: string | null }).assignedMemberId,
            3,
            signal(),
          )
        : kind === "acceptance"
          ? label === "acceptance"
            ? await service.acceptTask(event.id, dto.id, 3, signal())
            : await service.withdrawTaskAcceptance(
                event.id,
                dto.id,
                3,
                signal(),
              )
          : await service.updateTaskStatus(
              event.id,
              dto.id,
              "blocked",
              3,
              signal(),
            );
    assert.equal(calls, 1);
    assert.equal(result.version, 4);
    assert.equal(result.status, "blocked");
    assert.equal(result.ownerId, member.id);
    assert.ok(!("secret" in result));
  });

for (const [status, code] of [
  [400, "invalid"],
  [401, "unauthenticated"],
  [403, "forbidden"],
  [404, "not-found"],
  [409, "conflict"],
  [500, "unavailable"],
] as const)
  test(`mutation HTTP ${status} maps to safe ${code} without leaking raw response`, async () => {
    const service = new RemoteWorkspaceService(
      async () => new Response("SYNTHETIC_SQL_OR_SECRET", { status }),
    );
    await assert.rejects(
      service.updateTaskStatus(event.id, dto.id, "blocked", 3, signal()),
      (error) => {
        assert.ok(error instanceof TaskActionFailure && error.code === code);
        assert.doesNotMatch(String(error), /SYNTHETIC_SQL_OR_SECRET/);
        return true;
      },
    );
  });

test("aborted transport and malformed/foreign canonical responses fail closed", async () => {
  const cancellation = new AbortController();
  const service = new RemoteWorkspaceService(async (_url, options) => {
    cancellation.abort();
    options?.signal?.throwIfAborted();
    throw new Error("unreachable");
  });
  await assert.rejects(
    service.acceptTask(event.id, dto.id, 3, cancellation.signal),
    { name: "AbortError" },
  );
  for (const response of [
    { task: { ...dto, id: randomUUID() } },
    { task: { ...dto, accepted: true } },
    { task: { ...dto, version: 0 } },
  ]) {
    await assert.rejects(
      new RemoteWorkspaceService(async () =>
        Response.json(response),
      ).acceptTask(event.id, dto.id, 3, signal()),
      (error) => error instanceof TaskActionFailure && error.code === "invalid",
    );
  }
});

test("scoped refresh re-resolves real membership and never switches to another Event", async () => {
  const service = new RemoteWorkspaceService(async () =>
    Response.json({ events: [{ ...event, id: randomUUID() }] }),
  );
  await assert.rejects(
    service.refreshTasks(event.id, signal()),
    (error) =>
      error instanceof WorkspaceReadFailure && error.code === "forbidden",
  );
});

test("Organizer candidate read projects minimum fields; historical assignees remain named", async () => {
  const other = {
    id: randomUUID(),
    name: "Active candidate",
    role: "Organizer",
    userId: "DO_NOT_USE",
    email: "private@example.invalid",
  };
  const service = new RemoteWorkspaceService(async (url) =>
    Response.json(
      String(url) === "/api/events"
        ? {
            events: [
              {
                ...event,
                membership: { ...event.membership, accessRole: "ORGANIZER" },
              },
            ],
          }
        : String(url).endsWith("/members")
          ? { members: [other] }
          : { tasks: [dto], members: [member] },
    ),
  );
  const result = await service.readTasks(signal());
  assert.deepEqual(result.assignableMembers, [
    { id: other.id, name: other.name, role: other.role },
  ]);
  assert.equal(result.teamMembers.length, 2);
  assert.ok(!JSON.stringify(result).includes("DO_NOT_USE"));
});

test("role/member affordances use Event membership, never operational role or display identity", () => {
  assert.deepEqual(taskAffordances(event, task), {
    assignment: false,
    acceptance: true,
    status: true,
  });
  assert.deepEqual(
    taskAffordances(
      {
        ...event,
        membership: { ...event.membership, accessRole: "ORGANIZER" },
      },
      task,
    ),
    { assignment: true, acceptance: false, status: true },
  );
  assert.deepEqual(
    taskAffordances(
      { ...event, membership: { ...event.membership, id: randomUUID() } },
      task,
    ),
    { assignment: false, acceptance: false, status: false },
  );
  assert.deepEqual(
    taskAffordances(event, { ...task, assignedMemberId: null }),
    { assignment: false, acceptance: false, status: false },
  );
  assert.deepEqual(taskAffordances(undefined, task), {
    assignment: false,
    acceptance: false,
    status: false,
  });
  assert.deepEqual(taskAffordances({ ...event, archived: true }, task), {
    assignment: false,
    acceptance: false,
    status: false,
  });
  assert.deepEqual(taskAffordances(event, { ...task, eventId: randomUUID() }), {
    assignment: false,
    acceptance: false,
    status: false,
  });
});

test("pending retains confirmed state, coalesces duplicate actions/refocus, then refetches canonical data", async () => {
  const command = deferred<RemoteTask>(),
    refresh = deferred<TasksWorkspace>();
  let writes = 0,
    reads = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace,
      executeTaskAction: async (_event, _task, version) => {
        writes++;
        assert.equal(version, 3);
        return command.promise;
      },
      refreshTasks: async () => {
        reads++;
        return refresh.promise;
      },
    },
    () => {},
  );
  await controller.load();
  const pending = controller.mutate(task.id, statusAction);
  assert.equal(controller.mutate(task.id, statusAction), pending);
  assert.equal(controller.load(), pending);
  assert.equal(
    controller.getSnapshot().workspace.tasks[0]?.status,
    "not-started",
  );
  assert.equal(controller.getSnapshot().mutation?.pending, true);
  const canonical = { ...task, version: 4, status: "blocked" as const };
  command.resolve(canonical);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.getSnapshot().workspace.tasks[0]?.version, 4);
  assert.equal(controller.getSnapshot().mutation?.pending, true);
  refresh.resolve({ ...workspace, tasks: [canonical] });
  await pending;
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  assert.equal(controller.getSnapshot().mutation?.pending, false);
});

test("409 refreshes changed assignment/acceptance/status and requires explicit next action using new version", async () => {
  let writes = 0;
  const canonical = {
    ...task,
    assignedMemberId: null,
    ownerId: "",
    status: "in-progress" as const,
    version: 4,
  };
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace,
      executeTaskAction: async (_event, _task, version) => {
        writes++;
        assert.equal(version, writes === 1 ? 3 : 4);
        if (writes === 1) throw new TaskActionFailure("conflict");
        return { ...canonical, version: 5 };
      },
      refreshTasks: async () => ({
        ...workspace,
        tasks: [{ ...canonical, version: writes === 1 ? 4 : 5 }],
      }),
    },
    () => {},
  );
  await controller.load();
  await controller.mutate(task.id, statusAction);
  assert.equal(writes, 1);
  assert.equal(controller.getSnapshot().mutation?.message, "conflict");
  assert.deepEqual(controller.getSnapshot().workspace.tasks[0], canonical);
  await controller.mutate(task.id, statusAction);
  assert.equal(writes, 2);
});

test("failed conflict refetch blocks writes until explicit successful refresh", async () => {
  let writes = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace,
      executeTaskAction: async () => {
        writes++;
        throw new TaskActionFailure("conflict");
      },
      refreshTasks: async () => {
        throw new WorkspaceReadFailure("unavailable");
      },
    },
    () => {},
  );
  await controller.load();
  await controller.mutate(task.id, statusAction);
  assert.equal(
    controller.getSnapshot().mutation?.message,
    "conflict-refresh-failed",
  );
  assert.equal(controller.getSnapshot().mutation?.needsRefresh, true);
  await controller.mutate(task.id, statusAction);
  assert.equal(writes, 1);
  await controller.load();
  assert.equal(controller.getSnapshot().mutation, undefined);
});

test("confirmed response survives a failed refetch but followup writes stay blocked", async () => {
  let writes = 0;
  const canonical = { ...task, status: "blocked" as const, version: 4 };
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace,
      executeTaskAction: async () => {
        writes++;
        return canonical;
      },
      refreshTasks: async () => {
        throw new WorkspaceReadFailure("unavailable");
      },
    },
    () => {},
  );
  await controller.load();
  await controller.mutate(task.id, statusAction);
  assert.deepEqual(controller.getSnapshot().workspace.tasks[0], canonical);
  assert.equal(controller.getSnapshot().mutation?.message, "refresh-failed");
  await controller.mutate(task.id, statusAction);
  assert.equal(writes, 1);
});

test("revoked Event membership during action refetch removes all scoped data", async () => {
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace,
      executeTaskAction: async () => {
        throw new TaskActionFailure("forbidden");
      },
      refreshTasks: async () => {
        throw new WorkspaceReadFailure("forbidden");
      },
    },
    () => {},
  );
  await controller.load();
  await controller.mutate(task.id, statusAction);
  assert.equal(controller.getSnapshot().status, "error");
  assert.deepEqual(controller.getSnapshot().workspace.tasks, []);
});

for (const code of ["forbidden", "not-found", "unavailable"] as const)
  test(`${code} preserves safe feedback, refetches canonical state and never retries command`, async () => {
    let writes = 0;
    const controller = new TaskReadController(
      {
        readTasks: async () => workspace,
        executeTaskAction: async () => {
          writes++;
          throw new TaskActionFailure(code);
        },
        refreshTasks: async () => ({
          ...workspace,
          tasks: code === "not-found" ? [] : [task],
        }),
      },
      () => {},
    );
    await controller.load();
    await controller.mutate(task.id, statusAction);
    assert.equal(writes, 1);
    assert.equal(controller.getSnapshot().mutation?.message, code);
    assert.equal(
      controller.getSnapshot().workspace.tasks.length,
      code === "not-found" ? 0 : 1,
    );
  });

test("navigation/logout aborts pending command and late response cannot resurrect former identity data", async () => {
  const command = deferred<RemoteTask>();
  let cancellation: AbortSignal | undefined,
    refreshes = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => workspace,
      executeTaskAction: async (_event, _task, _version, _action, signal) => {
        cancellation = signal;
        return command.promise;
      },
      refreshTasks: async () => {
        refreshes++;
        return workspace;
      },
    },
    () => {},
  );
  await controller.load();
  const pending = controller.mutate(task.id, statusAction);
  await Promise.resolve();
  controller.clear();
  assert.equal(cancellation?.aborted, true);
  command.resolve(task);
  await pending;
  assert.equal(refreshes, 0);
  assert.deepEqual(controller.getSnapshot().workspace.tasks, []);
});

for (const phase of ["command", "refetch"] as const)
  test(`${phase} 401 clears workspace and expires the existing auth boundary`, async () => {
    let expired = 0;
    const controller = new TaskReadController(
      {
        readTasks: async () => workspace,
        executeTaskAction: async () => {
          if (phase === "command")
            throw new TaskActionFailure("unauthenticated");
          return task;
        },
        refreshTasks: async () => {
          throw new WorkspaceReadFailure("unauthenticated");
        },
      },
      () => expired++,
    );
    await controller.load();
    await controller.mutate(task.id, statusAction);
    assert.equal(expired, 1);
    assert.deepEqual(controller.getSnapshot().workspace.tasks, []);
  });
