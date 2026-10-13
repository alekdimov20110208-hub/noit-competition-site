import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  readArchiveAttempt,
  rememberArchiveAttempt,
  forgetArchiveAttempt,
} from "./eventArchiving.ts";
import {
  RemoteWorkspaceService,
  EventActionFailure,
  emptyTasksWorkspace,
  type TaskEvent,
} from "./RemoteWorkspaceService.ts";
import { TaskReadController } from "./taskReadState.ts";
const event: TaskEvent = {
  id: randomUUID(),
  name: "Exact Name",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  timezone: "UTC",
  archived: false,
  version: 1,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  membership: { id: randomUUID(), accessRole: "ORGANIZER" },
};
const archived = { ...event, archived: true, version: 2 },
  key = randomUUID();
test("Archive sends only reviewed exact name/version and UUID; checks same archived Event acknowledgement", async () => {
  let sent: RequestInit | undefined;
  const service = new RemoteWorkspaceService(async (path, init) => {
    assert.equal(path, `/api/events/${event.id}/archive`);
    sent = init;
    return Response.json({ event: archived });
  });
  assert.deepEqual(
    await service.archiveEvent(
      event.id,
      1,
      " Exact Name ",
      key,
      new AbortController().signal,
    ),
    archived,
  );
  assert.deepEqual(JSON.parse(sent!.body as string), {
    expectedVersion: 1,
    confirmationName: " Exact Name ",
  });
  assert.equal(
    (sent!.headers as Record<string, string>)["Idempotency-Key"],
    key,
  );
  for (const ack of [
    { ...archived, id: randomUUID() },
    { ...archived, archived: false },
    { ...archived, membership: { ...event.membership, accessRole: "MEMBER" } },
  ])
    await assert.rejects(
      new RemoteWorkspaceService(async () =>
        Response.json({ event: ack }),
      ).archiveEvent(
        event.id,
        1,
        event.name,
        key,
        new AbortController().signal,
      ),
      (e: unknown) => e instanceof EventActionFailure && e.code === "uncertain",
    );
});
test("Archive transport loss/unknown conflicts remain uncertain; known rejection never silently replays", async () => {
  for (const response of [
    new Response("not JSON", { status: 409 }),
    Response.json({ code: "UNKNOWN" }, { status: 409 }),
    new Response("", { status: 500 }),
  ])
    await assert.rejects(
      new RemoteWorkspaceService(async () => response).archiveEvent(
        event.id,
        1,
        event.name,
        key,
        new AbortController().signal,
      ),
      (e: unknown) => e instanceof EventActionFailure && e.code === "uncertain",
    );
  await assert.rejects(
    new RemoteWorkspaceService(async () => {
      throw Error("lost response");
    }).archiveEvent(event.id, 1, event.name, key, new AbortController().signal),
    (e: unknown) => e instanceof EventActionFailure && e.code === "uncertain",
  );
  for (const [status, code, expected] of [
    [409, "EVENT_VERSION_CONFLICT", "conflict"],
    [409, "IDEMPOTENCY_KEY_REUSED", "key-reused"],
    [409, "VERSION_LIMIT_REACHED", "version-limit"],
    [401, "", "unauthenticated"],
    [403, "", "forbidden"],
    [404, "", "not-found"],
  ] as const)
    await assert.rejects(
      new RemoteWorkspaceService(async () =>
        Response.json({ code }, { status }),
      ).archiveEvent(
        event.id,
        1,
        event.name,
        key,
        new AbortController().signal,
      ),
      (e: unknown) => e instanceof EventActionFailure && e.code === expected,
    );
});
test("Held Archive attempt is identity/Event scoped across refresh; no client canonicalization or authority", () => {
  const data = new Map<string, string>(),
    storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
      removeItem: (k: string) => {
        data.delete(k);
      },
    } as Storage;
  const attempt = {
    commandId: key,
    expectedVersion: 1,
    confirmationName: " Exact Name ",
  };
  rememberArchiveAttempt("one", event.id, attempt, storage);
  assert.deepEqual(readArchiveAttempt("one", event.id, storage), attempt);
  assert.equal(readArchiveAttempt("two", event.id, storage), null);
  assert.equal(readArchiveAttempt("one", randomUUID(), storage), null);
  forgetArchiveAttempt("one", event.id, storage);
  assert.equal(readArchiveAttempt("one", event.id, storage), null);
});
test("Archive controller coalesces rapid submits and rejects late identity/context publication", async () => {
  let resolve!: (e: TaskEvent) => void,
    calls = 0;
  const controller = new TaskReadController(
    {
      readTasks: async () => emptyTasksWorkspace(),
      archiveEvent: async () => {
        calls++;
        return new Promise((r) => {
          resolve = r;
        });
      },
    },
    () => {},
  );
  const first = controller.archiveEvent(event.id, 1, event.name, key),
    second = controller.archiveEvent(event.id, 1, event.name, key);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  controller.clear();
  resolve(archived);
  await assert.rejects(first);
  assert.deepEqual(controller.getSnapshot().accessibleEvents, []);
});
