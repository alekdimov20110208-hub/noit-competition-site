import assert from "node:assert/strict";
import test from "node:test";
import {
  RemoteWorkspaceService,
  WorkspaceReadFailure,
} from "./RemoteWorkspaceService.ts";
import { readEventHistory, type EventHistoryEntry } from "./eventHistory.ts";
import { EventHistoryController } from "./eventHistoryState.ts";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const eventId = id(1);
function entry(n: number): EventHistoryEntry {
  return {
    id: id(n),
    eventId,
    action: "EVENT_CREATED",
    createdAt: "2026-10-11T10:00:00.123456Z",
    actor: { userId: "actor", memberId: id(2), name: "Recorded actor" },
    target: {
      type: "event",
      id: eventId,
      title: "Current event",
      available: true,
    },
    version: 1,
    previousVersion: null,
    changedFields: [],
    stateChanges: [],
  };
}
const page = (
  entries: EventHistoryEntry[],
  nextCursor: string | null = null,
) => ({ eventId, entries, nextCursor });
test("history DTO keeps actual actors/versions and microseconds while discarding arbitrary payload", () => {
  const recorded = {
    ...entry(5),
    action: "CHANGE_UPDATED",
    target: {
      type: "change",
      id: id(3),
      title: "Current change",
      available: true,
    },
    version: 2,
    previousVersion: 1,
    changedFields: ["decision"],
    stateChanges: [{ field: "decision", before: "present", after: "absent" }],
    payload: "PRIVATE_INTERNAL",
  };
  const result = readEventHistory(page([recorded, entry(4)]), eventId);
  assert.deepEqual(result.entries[0]!.stateChanges, [
    { field: "decision", before: "present", after: "absent" },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_INTERNAL/);
  assert.deepEqual(readEventHistory(page([]), eventId), page([]));
});
test("history rejects foreign scope, reversed/duplicate ordering, forged versions and malformed pagination", () => {
  for (const body of [
    { ...page([entry(4)]), eventId: id(6) },
    page([{ ...entry(4), eventId: id(6) }]),
    page([entry(4), entry(5)]),
    page([entry(4), entry(4)]),
    page([{ ...entry(4), version: 2, previousVersion: 3 }]),
    page([{ ...entry(4), createdAt: "2026-10-11T10:00:00Z" }]),
    page([entry(4)], id(4)),
    page([
      {
        ...entry(4),
        stateChanges: [
          { field: "decision", before: "present", after: "invented" },
        ],
      },
    ]),
  ])
    assert.throws(() => readEventHistory(body, eventId), WorkspaceReadFailure);
  const entries = Array.from({ length: 50 }, (_, i) => entry(100 - i));
  assert.equal(
    readEventHistory(page(entries, id(51)), eventId).nextCursor,
    id(51),
  );
});
test("history transport is scoped, cookie-bound and no-store with safe status failures", async () => {
  const service = new RemoteWorkspaceService(async (path, options) => {
    assert.equal(path, `/api/events/${eventId}/history?before=${id(9)}`);
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.cache, "no-store");
    return Response.json(page([entry(5)]));
  });
  await service.readEventHistory(eventId, id(9), new AbortController().signal);
  for (const [status, code] of [
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [500, "unavailable"],
  ] as const) {
    const denied = new RemoteWorkspaceService(async () =>
      Response.json({ private: "DO_NOT_EXPOSE" }, { status }),
    );
    await assert.rejects(
      denied.readEventHistory(eventId, null, new AbortController().signal),
      (e: unknown) =>
        e instanceof WorkspaceReadFailure &&
        e.code === code &&
        !e.message.includes("DO_NOT_EXPOSE"),
    );
  }
});
test("history paging appends deterministically, coalesces clicks and rejects duplicate page content", async () => {
  const first = Array.from({ length: 50 }, (_, i) => entry(100 - i));
  let calls = 0;
  const controller = new EventHistoryController(
    eventId,
    async (_, before) => {
      calls++;
      return before ? page([entry(50)]) : page(first, id(51));
    },
    () => {},
  );
  const a = controller.load();
  await controller.load();
  await a;
  assert.equal(calls, 1);
  await controller.load(true);
  assert.equal(controller.getSnapshot().entries.length, 51);
  await controller.load(true);
  assert.equal(calls, 2);
  const bad = new EventHistoryController(
    eventId,
    async (_, before) => (before ? page([entry(51)]) : page(first, id(51))),
    () => {},
  );
  await bad.load();
  await bad.load(true);
  assert.equal(bad.getSnapshot().error, "invalid");
  assert.deepEqual(bad.getSnapshot().entries, []);
});
test("history cancellation suppresses late responses and permits StrictMode remount", async () => {
  let release!: (value: ReturnType<typeof page>) => void;
  let calls = 0;
  const controller = new EventHistoryController(
    eventId,
    async () =>
      ++calls === 1
        ? new Promise((resolve) => {
            release = resolve;
          })
        : page([entry(4)]),
    () => {},
  );
  const pending = controller.load();
  controller.dispose();
  release(page([entry(9)]));
  await pending;
  assert.deepEqual(controller.getSnapshot().entries, []);
  await controller.load();
  assert.equal(controller.getSnapshot().entries[0]?.id, id(4));
});
test("revoked/expired reads clear entries; 401 expires identity and unavailable reads remain errors", async () => {
  for (const code of [
    "unauthenticated",
    "forbidden",
    "not-found",
    "unavailable",
  ] as const) {
    let calls = 0,
      expired = 0;
    const controller = new EventHistoryController(
      eventId,
      async () => {
        if (++calls === 1) return page([entry(4)]);
        throw new WorkspaceReadFailure(code);
      },
      () => expired++,
    );
    await controller.load();
    await controller.load();
    assert.equal(controller.getSnapshot().status, "error");
    assert.deepEqual(controller.getSnapshot().entries, []);
    assert.equal(expired, code === "unauthenticated" ? 1 : 0);
  }
});
