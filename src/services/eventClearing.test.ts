import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  readClearAttempt,
  rememberClearAttempt,
  forgetClearAttempt,
  readClearPreview,
  readClearResult,
} from "./eventClearing.ts";
import {
  RemoteWorkspaceService,
  EventActionFailure,
  emptyTasksWorkspace,
  type TaskEvent,
} from "./RemoteWorkspaceService.ts";
import { TaskReadController } from "./taskReadState.ts";
import {
  parseRetainedTask,
  readRetainedTask,
  RemovedTaskFailure,
} from "./removedTasks.ts";
const event: TaskEvent = {
  id: randomUUID(),
  name: "Exact Event",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  timezone: "UTC",
  archived: false,
  version: 1,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  membership: { id: randomUUID(), accessRole: "ORGANIZER" },
};
const attempt = {
  commandId: randomUUID(),
  expectedVersion: 1,
  confirmationName: event.name,
  scopeRevision: "a".repeat(64),
  reviewedCount: 3,
};
const preview = {
  event,
  scopeRevision: attempt.scopeRevision,
  taskCount: 3,
  completedCount: 1,
  affectedChangeCount: 1,
  reminderCount: 2,
};
test("Retained Task lookup rejects foreign/malformed records and keeps unavailable distinct from unknown", async () => {
  const retained = {
    id: randomUUID(),
    eventId: event.id,
    title: "Retained",
    context: "",
    status: "completed",
    deadline: "2026-10-01",
    deadlineTime: null,
    version: 2,
    removedAt: "2026-10-01T00:00:00Z",
    assigneeName: null,
    removerName: "Synthetic",
    acceptedAt: null,
    reminderCount: 1,
  };
  assert.deepEqual(
    parseRetainedTask(retained, event.id, retained.id),
    retained,
  );
  for (const value of [
    { ...retained, eventId: randomUUID() },
    { ...retained, status: "invented" },
    { ...retained, deadline: "2026-02-31" },
    { ...retained, removedAt: "invalid" },
  ])
    assert.throws(() => parseRetainedTask(value, event.id, retained.id));
  for (const [status, code] of [
    [401, "unauthenticated"],
    [404, "unknown"],
    [503, "unavailable"],
  ] as const)
    await assert.rejects(
      readRetainedTask(
        event.id,
        retained.id,
        new AbortController().signal,
        async () => new Response("", { status }),
      ),
      (e) => e instanceof RemovedTaskFailure && e.code === code,
    );
});
const result = {
  id: event.id,
  event: { ...event, version: 2 },
  operationId: attempt.commandId,
  clearedCount: 3,
  completedCount: 1,
  affectedChangeCount: 1,
  reminderCount: 2,
};
test("Clear request sends exact reviewed scope and original UUID, bounded body and same-origin/no-store", async () => {
  let sent: RequestInit | undefined;
  const service = new RemoteWorkspaceService(async (path, init) => {
    assert.equal(path, `/api/events/${event.id}/tasks/clear`);
    sent = init;
    return Response.json(result);
  });
  assert.deepEqual(
    await service.clearTasks(event.id, attempt, new AbortController().signal),
    result,
  );
  assert.deepEqual(JSON.parse(sent!.body as string), {
    expectedVersion: 1,
    confirmationName: event.name,
    scopeRevision: attempt.scopeRevision,
  });
  assert.equal(
    (sent!.headers as Record<string, string>)["Idempotency-Key"],
    attempt.commandId,
  );
  assert.equal(sent!.cache, "no-store");
  assert.equal(sent!.credentials, "same-origin");
});
test("Clear preview rejects malformed, foreign, archived, Member and inconsistent counts", () => {
  assert.deepEqual(readClearPreview(preview, event.id), preview);
  for (const p of [
    { ...preview, event: { ...event, id: randomUUID() } },
    { ...preview, event: { ...event, archived: true } },
    {
      ...preview,
      event: {
        ...event,
        membership: { ...event.membership, accessRole: "MEMBER" },
      },
    },
    { ...preview, taskCount: -1 },
    { ...preview, completedCount: 4 },
    { ...preview, scopeRevision: "wrong" },
  ])
    assert.throws(() => readClearPreview(p, event.id));
});
test("Clear result validates identity, operation UUID, count, lifecycle and exact version/no-op before announcing success", () => {
  assert.deepEqual(readClearResult(result, event.id, attempt), result);
  for (const r of [
    { ...result, id: randomUUID() },
    { ...result, operationId: randomUUID() },
    { ...result, clearedCount: 4 },
    { ...result, event: { ...result.event, archived: true } },
    { ...result, event: { ...result.event, version: 3 } },
  ])
    assert.throws(
      () => readClearResult(r, event.id, attempt),
      (e) => e instanceof EventActionFailure && e.code === "uncertain",
    );
  const zero = { ...result, event, clearedCount: 0, completedCount: 0 };
  assert.deepEqual(
    readClearResult(zero, event.id, { ...attempt, reviewedCount: 0 }),
    zero,
  );
});
test("Known scope/version failures require review; lost/malformed responses preserve uncertainty", async () => {
  for (const [status, code, expected] of [
    [409, "TASK_SET_CONFLICT", "conflict"],
    [409, "EVENT_VERSION_CONFLICT", "conflict"],
    [409, "IDEMPOTENCY_KEY_REUSED", "key-reused"],
    [409, "VERSION_LIMIT_REACHED", "version-limit"],
    [401, "", "unauthenticated"],
    [403, "", "forbidden"],
    [404, "", "not-found"],
    [409, "unknown", "uncertain"],
    [500, "", "uncertain"],
  ] as const)
    await assert.rejects(
      new RemoteWorkspaceService(async () =>
        Response.json({ code }, { status }),
      ).clearTasks(event.id, attempt, new AbortController().signal),
      (e) => e instanceof EventActionFailure && e.code === expected,
    );
  await assert.rejects(
    new RemoteWorkspaceService(async () => {
      throw Error("lost");
    }).clearTasks(event.id, attempt, new AbortController().signal),
    (e) => e instanceof EventActionFailure && e.code === "uncertain",
  );
});
test("Recovery is identity/Event scoped, validates stored scope/count and has memory fallback", () => {
  const data = new Map<string, string>(),
    storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    } as unknown as Storage;
  rememberClearAttempt("one", event.id, attempt, storage);
  assert.deepEqual(readClearAttempt("one", event.id, storage), attempt);
  assert.equal(readClearAttempt("two", event.id, storage), null);
  assert.equal(readClearAttempt("one", randomUUID(), storage), null);
  forgetClearAttempt("one", event.id, storage);
  assert.equal(readClearAttempt("one", event.id, storage), null);
  assert.throws(() =>
    rememberClearAttempt(
      "one",
      event.id,
      { ...attempt, scopeRevision: "bad" },
      storage,
    ),
  );
  const broken = {
    getItem: () => {
      throw Error();
    },
    setItem: () => {
      throw Error();
    },
    removeItem: () => {
      throw Error();
    },
  } as unknown as Storage;
  rememberClearAttempt("one", event.id, attempt, broken);
  assert.deepEqual(readClearAttempt("one", event.id, broken), attempt);
  forgetClearAttempt("one", event.id, broken);
});
test("Clear controller rejects late identity/context results and expires real unauthorized state", async () => {
  let resolve!: (value: typeof result) => void;
  let expired = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => emptyTasksWorkspace(),
      clearTasks: async () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
    () => expired++,
  );
  const pending = controller.clearTasks(event.id, attempt);
  controller.clear();
  resolve(result);
  await assert.rejects(pending, /context changed|Abort/);
  const denied = new TaskReadController(
    {
      readTasks: async () => emptyTasksWorkspace(),
      clearPreview: async () => {
        throw new EventActionFailure("unauthenticated");
      },
    },
    () => expired++,
  );
  await assert.rejects(denied.clearPreview(event.id));
  assert.equal(expired, 1);
  assert.equal(denied.getSnapshot().workspace.tasks.length, 0);
});
