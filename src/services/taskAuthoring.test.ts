import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  RemoteWorkspaceService,
  TaskAuthoringFailure,
  WorkspaceReadFailure,
  mapTaskRead,
  type TaskEvent,
  type TasksWorkspace,
  type RemoteTask,
} from "./RemoteWorkspaceService.ts";
import { TaskReadController } from "./taskReadState.ts";
import {
  authoredFields,
  validateTaskFields,
  taskAuthoringAllowed,
} from "./taskAuthoring.ts";
import { toWorkspaceView } from "./workspaceViews.ts";
import { getTaskCounts, getTeamWorkload } from "../domain/workspace.ts";

const event: TaskEvent = {
  id: randomUUID(),
  name: "Synthetic A",
  startDate: "2026-11-02",
  endDate: "2026-11-03",
  timezone: "Pacific/Honolulu",
  archived: false,
  membership: { id: randomUUID(), accessRole: "ORGANIZER" },
  version: 1,
  createdAt: "2026-10-03T12:00:00Z",
  updatedAt: "2026-10-03T12:00:00Z",
};
const other: TaskEvent = { ...event, id: randomUUID(), name: "Synthetic B" };
const fields = {
  title: "Created task",
  category: "Venue",
  context: "Details",
  deadline: "2026-11-01",
  priority: "important" as const,
};
const dto = {
  ...fields,
  id: randomUUID(),
  status: "not-started",
  assignedMemberId: event.membership.id,
  accepted: false,
  acceptedByMemberId: null,
  acceptedAt: null,
  version: 1,
  updatedAt: event.updatedAt,
  blockedBy: "",
  blocks: "",
};
const members = [{ id: event.membership.id, name: "Organizer", role: "Venue" }];
const workspace = (
  value = event,
  tasks: (typeof dto)[] = [],
): TasksWorkspace => ({
  ...mapTaskRead(value, { tasks, members }),
  activeMembers: members,
  assignableMembers: members,
  accessibleEvents: [event, other],
});
const task = workspace(event, [dto]).tasks[0]!;
const signal = () => new AbortController().signal;
const fails = (code: string) => (error: unknown) =>
  error instanceof TaskAuthoringFailure && error.code === code;

test("authoring affordances and validation preserve schema free-text/optional/calendar semantics", () => {
  assert.equal(taskAuthoringAllowed(event), true);
  assert.equal(
    taskAuthoringAllowed({
      ...event,
      membership: { ...event.membership, accessRole: "MEMBER" },
    }),
    false,
  );
  assert.equal(taskAuthoringAllowed({ ...event, archived: true }), false);
  assert.equal(taskAuthoringAllowed(undefined), false);
  assert.deepEqual(
    validateTaskFields({ ...fields, category: "", context: "" }),
    {},
  );
  for (const deadline of ["2026-02-29", "0000-01-01", "2026-11-01T00:00:00Z"])
    assert.equal(
      validateTaskFields({ ...fields, deadline }).deadline,
      "INVALID_DATE",
    );
  for (const title of ["  ", "x".repeat(201), "\u0000", "\ud800"])
    assert.equal(
      validateTaskFields({ ...fields, title }).title,
      "INVALID_TEXT",
    );
  assert.deepEqual(authoredFields(task), fields);
});

for (const editing of [false, true])
  test(`remote ${editing ? "edit" : "create"} explicitly projects fields, version/assignee and canonical DATE`, async () => {
    const service = new RemoteWorkspaceService(async (url, options) => {
      assert.equal(
        url,
        `/api/events/${event.id}/tasks${editing ? `/${dto.id}` : ""}`,
      );
      assert.equal(options?.method, editing ? "PATCH" : "POST");
      assert.equal(options?.cache, "no-store");
      assert.equal(options?.credentials, "same-origin");
      assert.deepEqual(JSON.parse(options!.body as string), {
        ...fields,
        ...(editing
          ? { expectedVersion: 1 }
          : { assignedMemberId: event.membership.id }),
      });
      return Response.json(
        { task: { ...dto, version: editing ? 2 : 1 } },
        { status: editing ? 200 : 201 },
      );
    });
    const forged = {
      ...fields,
      eventId: other.id,
      status: "completed",
      version: 99,
      accepted: true,
      actor: "forged",
    };
    const canonical = editing
      ? await service.updateTaskDetails(event.id, dto.id, 1, forged, signal())
      : await service.createTask(
          event.id,
          forged,
          event.membership.id,
          signal(),
        );
    assert.equal(canonical.deadline, "2026-11-01");
    assert.equal(canonical.eventId, event.id);
    assert.equal(canonical.acknowledged, false);
  });

for (const [status, code] of [
  [400, "invalid"],
  [401, "unauthenticated"],
  [403, "forbidden"],
  [404, "not-found"],
  [409, "conflict"],
  [500, "unavailable"],
] as const)
  test(`authoring ${status} maps safe error and whitelists field feedback`, async () => {
    const service = new RemoteWorkspaceService(async () =>
      Response.json(
        {
          fields: {
            title: "RAW_SQL_SECRET",
            category: "INVALID_TEXT",
            deadline: "INVALID_DATE",
            actor: "PRIVATE",
          },
          error: "RAW_SQL_SECRET",
        },
        { status },
      ),
    );
    await assert.rejects(
      service.createTask(event.id, fields, null, signal()),
      (error) => {
        assert.ok(error instanceof TaskAuthoringFailure);
        assert.equal(error.code, code);
        assert.deepEqual(
          error.fields,
          status === 400
            ? { category: "INVALID_TEXT", deadline: "INVALID_DATE" }
            : {},
        );
        assert.doesNotMatch(error.message, /RAW_SQL_SECRET/);
        return true;
      },
    );
    await assert.rejects(
      service.updateTaskDetails(event.id, dto.id, 1, fields, signal()),
      fails(code),
    );
  });

test("network, malformed/wrong-ID canonical results and abort never fall back", async () => {
  const network = new RemoteWorkspaceService(async () => {
    throw new Error("PRIVATE");
  });
  await assert.rejects(
    network.createTask(event.id, fields, null, signal()),
    fails("unavailable"),
  );
  for (const task of [
    { ...dto, version: 99 },
    { ...dto, accepted: true },
    { ...dto, status: "completed" },
  ]) {
    const service = new RemoteWorkspaceService(async () =>
      Response.json({ task }),
    );
    await assert.rejects(
      service.createTask(event.id, fields, null, signal()),
      fails("invalid"),
    );
  }
  const service = new RemoteWorkspaceService(async () =>
    Response.json({ task: { ...dto, id: randomUUID() } }),
  );
  await assert.rejects(
    service.updateTaskDetails(event.id, dto.id, 1, fields, signal()),
    fails("invalid"),
  );
});

function controllerHarness() {
  let canonical = workspace(),
    writes = 0,
    refreshes = 0,
    expired = 0;
  let failure: string | null = null,
    refreshFailure = false;
  const service = {
    readTasks: async (_signal: AbortSignal, selected?: string | null) =>
      selected === other.id ? workspace(other) : canonical,
    refreshTasks: async (selected: string) => {
      refreshes++;
      if (refreshFailure) throw new WorkspaceReadFailure("unavailable");
      return selected === other.id ? workspace(other) : canonical;
    },
    createTask: async () => {
      writes++;
      if (failure) throw new TaskAuthoringFailure(failure as "conflict");
      canonical = workspace(event, [dto]);
      return task;
    },
    updateTaskDetails: async (
      _event: string,
      _task: string,
      version: number,
    ) => {
      writes++;
      assert.equal(version, 1);
      if (failure) {
        canonical = workspace(event, [
          { ...dto, title: "Changed elsewhere", version: 2 },
        ]);
        throw new TaskAuthoringFailure(failure as "conflict");
      }
      canonical = workspace(event, [{ ...dto, title: "Edited", version: 2 }]);
      return canonical.tasks[0]!;
    },
    getTask: async () => canonical.tasks[0]!,
  };
  const controller = new TaskReadController(service, () => expired++);
  return {
    controller,
    service,
    get writes() {
      return writes;
    },
    get refreshes() {
      return refreshes;
    },
    get expired() {
      return expired;
    },
    set failure(value: string | null) {
      failure = value;
    },
    set refreshFailure(value: boolean) {
      refreshFailure = value;
    },
  };
}

test("controller fresh zero-to-one uses canonical refreshed snapshot for Tasks/Dashboard/Team", async () => {
  const h = controllerHarness();
  await h.controller.load();
  assert.equal(h.controller.getSnapshot().workspace.tasks.length, 0);
  await h.controller.createTask(fields, event.membership.id, signal());
  const view = toWorkspaceView(h.controller.getSnapshot().workspace);
  assert.equal(view.tasks[0]!.title, dto.title);
  assert.equal(getTaskCounts(view.tasks, new Date(2026, 9, 3)).total, 1);
  assert.equal(
    getTeamWorkload(view.teamMembers, view.tasks, new Date(2026, 9, 3))[0]!
      .active,
    1,
  );
  assert.equal(h.writes, 1);
  assert.equal(h.refreshes, 1);
});

test("edit conflict refreshes canonical task but rejects intent, with explicit retry only", async () => {
  const h = controllerHarness();
  await h.controller.load();
  await h.controller.createTask(fields, null, signal());
  h.failure = "conflict";
  await assert.rejects(
    h.controller.updateTaskDetails(dto.id, 1, fields, signal()),
    fails("conflict"),
  );
  assert.equal(
    h.controller.getSnapshot().workspace.tasks[0]!.title,
    "Changed elsewhere",
  );
  assert.equal(h.writes, 2);
  assert.equal(h.refreshes, 2);
});

test("failed conflict refresh blocks writes but explicit canonical recovery remains available", async () => {
  const h = controllerHarness();
  await h.controller.load();
  await h.controller.createTask(fields, null, signal());
  h.controller.setTaskAuthoringOpen(true);
  h.failure = "conflict";
  h.refreshFailure = true;
  await assert.rejects(
    h.controller.updateTaskDetails(dto.id, 1, fields, signal()),
    fails("conflict"),
  );
  assert.equal(h.controller.getSnapshot().mutation?.needsRefresh, true);
  assert.equal(h.writes, 2);
  await assert.rejects(
    h.controller.updateTaskDetails(dto.id, 1, fields, signal()),
    fails("unavailable"),
  );
  assert.equal(h.writes, 2);
  h.refreshFailure = false;
  const latest = await h.controller.getTask(event.id, dto.id, signal());
  assert.equal(latest.version, 2);
  assert.equal(latest.title, "Changed elsewhere");
  assert.equal(h.controller.getSnapshot().mutation, null);
  assert.equal(h.writes, 2);
});

test("focus reads preserve an open draft/version, explicit recovery and Event switches still refresh", async () => {
  const h = controllerHarness();
  await h.controller.load();
  h.controller.setTaskAuthoringOpen(true);
  await h.controller.load();
  assert.equal(h.refreshes, 0);
  await h.controller.createTask(fields, null, signal());
  h.controller.setTaskAuthoringOpen(false);
  await h.controller.load();
  assert.equal(h.refreshes, 2);
  h.controller.setTaskAuthoringOpen(true);
  h.controller.selectEvent(other.id);
  await h.controller.load();
  assert.equal(h.controller.getSnapshot().workspace.currentEventId, other.id);
});

test("lost create response refetches, failed recovery blocks further writes, 401 expires identity", async () => {
  const h = controllerHarness();
  await h.controller.load();
  h.failure = "unavailable";
  await assert.rejects(
    h.controller.createTask(fields, null, signal()),
    fails("unavailable"),
  );
  assert.equal(h.refreshes, 1);
  assert.equal(h.writes, 1);
  h.refreshFailure = true;
  await assert.rejects(
    h.controller.createTask(fields, null, signal()),
    fails("unavailable"),
  );
  assert.equal(h.controller.getSnapshot().mutation?.needsRefresh, true);
  await assert.rejects(
    h.controller.createTask(fields, null, signal()),
    fails("unavailable"),
  );
  assert.equal(h.writes, 2);
  h.refreshFailure = false;
  await h.controller.load();
  h.failure = "unauthenticated";
  await assert.rejects(
    h.controller.createTask(fields, null, signal()),
    fails("unauthenticated"),
  );
  assert.equal(h.expired, 1);
  assert.equal(h.controller.getSnapshot().workspace.tasks.length, 0);
});

for (const editing of [false, true])
  test(`late ${editing ? "edit" : "create"} completion after Event switch never publishes A into B`, async () => {
    const h = controllerHarness();
    await h.controller.load();
    let resolve!: (task: RemoteTask) => void;
    const held = new Promise<RemoteTask>((done) => (resolve = done));
    h.service.createTask = async () => held;
    h.service.updateTaskDetails = async () => held;
    const request = editing
      ? h.controller.updateTaskDetails(dto.id, 1, fields, signal())
      : h.controller.createTask(fields, null, signal());
    const rejected = assert.rejects(
      request,
      (error) => error instanceof DOMException && error.name === "AbortError",
    );
    h.controller.selectEvent(other.id);
    await h.controller.load();
    resolve(task);
    await rejected;
    assert.equal(h.controller.getSnapshot().workspace.currentEventId, other.id);
    assert.equal(h.controller.getSnapshot().workspace.tasks.length, 0);
    assert.equal(h.refreshes, 1);
  });
