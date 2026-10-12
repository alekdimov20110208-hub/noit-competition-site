import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  duplicateEventDefaults,
  readDuplicateAttempt,
  rememberDuplicateAttempt,
  forgetDuplicateAttempt,
} from "./eventDuplication.ts";
import {
  RemoteWorkspaceService,
  EventActionFailure,
  emptyTasksWorkspace,
  type TaskEvent,
} from "./RemoteWorkspaceService.ts";
import { TaskReadController } from "./taskReadState.ts";
import { eventDuplicateHref, parseAppLocation } from "../routes.ts";
import { safeReturnTo } from "../auth/routing.ts";
import { canDuplicateEvent } from "../pages/events/listing.ts";

const source: TaskEvent = {
  id: randomUUID(),
  name: "Source",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  timezone: "Europe/Sofia",
  archived: false,
  version: 1,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  membership: { id: randomUUID(), accessRole: "ORGANIZER" },
};
const result = {
  ...source,
  id: randomUUID(),
  name: "Reviewed copy",
  membership: { id: randomUUID(), accessRole: "ORGANIZER" as const },
};
const fields = {
  name: result.name,
  startDate: "2026-11-01",
  endDate: "2026-11-02",
  timezone: "UTC",
};
test("Duplicate defaults copy only name/timezone, require explicit dates and truncate without splitting Unicode", () => {
  assert.deepEqual(duplicateEventDefaults(source, " (copy)"), {
    name: "Source (copy)",
    startDate: "",
    endDate: "",
    timezone: source.timezone,
  });
  const long = duplicateEventDefaults(
    { ...source, name: "x".repeat(192) + "🙂" },
    " (копие)",
  );
  assert.ok(long.name.length <= 200);
  assert.doesNotMatch(long.name, /[\uD800-\uDFFF]/u);
  assert.equal(canDuplicateEvent({ ...source, archived: true }), true);
  assert.equal(
    canDuplicateEvent({
      ...source,
      membership: { ...source.membership, accessRole: "MEMBER" },
    }),
    false,
  );
});
test("Duplicate routes survive strict login return and retain explicit source scope", () => {
  const href = eventDuplicateHref(source.id);
  assert.deepEqual(parseAppLocation(href, ""), {
    path: "/",
    taskId: null,
    eventId: source.id,
    eventMode: "duplicate",
  });
  assert.equal(safeReturnTo(href), href);
  assert.equal(safeReturnTo("/events/forged/duplicate"), "/");
});
test("Uncertain draft recovery is scoped to identity/source, survives tab storage and never grants authority", () => {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    clear: () => {
      values.clear();
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  } satisfies Storage;
  const actor = randomUUID(),
    attempt = { commandId: randomUUID(), expectedVersion: 1, fields };
  rememberDuplicateAttempt(actor, source.id, attempt, storage);
  assert.deepEqual(readDuplicateAttempt(actor, source.id, storage), attempt);
  assert.equal(readDuplicateAttempt(randomUUID(), source.id, storage), null);
  assert.equal(readDuplicateAttempt(actor, randomUUID(), storage), null);
  forgetDuplicateAttempt(actor, source.id, storage);
  assert.equal(readDuplicateAttempt(actor, source.id, storage), null);
  values.set(
    [...values.keys()][0] ?? `budograph:duplicate:v1:${actor}:${source.id}`,
    '{"commandId":"forged"}',
  );
  assert.equal(readDuplicateAttempt(actor, source.id, storage), null);
});
test("Duplicate transport carries stable UUID, explicit five-field projection and accepts a fresh Event only", async () => {
  const key = randomUUID();
  let sent: RequestInit | undefined;
  const remote = new RemoteWorkspaceService(async (url, init) => {
    assert.equal(url, `/api/events/${source.id}/duplicate`);
    sent = init;
    return Response.json({ event: result });
  });
  assert.deepEqual(
    await remote.duplicateEvent(
      source.id,
      1,
      { ...fields, tasks: ["forged"] } as typeof fields,
      key,
      new AbortController().signal,
    ),
    result,
  );
  assert.equal(new Headers(sent!.headers).get("Idempotency-Key"), key);
  assert.deepEqual(JSON.parse(sent!.body as string), {
    ...fields,
    expectedVersion: 1,
  });
  for (const event of [
    source,
    { ...result, membership: { ...result.membership, accessRole: "MEMBER" } },
  ]) {
    const invalid = new RemoteWorkspaceService(async () =>
      Response.json({ event }),
    );
    await assert.rejects(
      invalid.duplicateEvent(
        source.id,
        1,
        fields,
        key,
        new AbortController().signal,
      ),
      (e: unknown) => e instanceof EventActionFailure && e.code === "uncertain",
    );
  }
});
test("Duplicate key conflict is distinct from source version conflict and never auto-retries", async () => {
  let requests = 0;
  const remote = new RemoteWorkspaceService(async () => {
    requests++;
    return Response.json({ code: "IDEMPOTENCY_KEY_REUSED" }, { status: 409 });
  });
  await assert.rejects(
    remote.duplicateEvent(
      source.id,
      1,
      fields,
      randomUUID(),
      new AbortController().signal,
    ),
    (e: unknown) => e instanceof EventActionFailure && e.code === "key-reused",
  );
  assert.equal(requests, 1);
  for (const response of [
    new Response("unreadable", { status: 409 }),
    Response.json({ code: "UNKNOWN_CONFLICT" }, { status: 409 }),
  ]) {
    const uncertain = new RemoteWorkspaceService(async () => response);
    await assert.rejects(
      uncertain.duplicateEvent(
        source.id,
        1,
        fields,
        randomUUID(),
        new AbortController().signal,
      ),
      (e: unknown) => e instanceof EventActionFailure && e.code === "uncertain",
    );
  }
});
test("Duplicate controller coalesces rapid submissions and rejects late results after source/identity context changes", async () => {
  let finish!: (event: TaskEvent) => void,
    requests = 0;
  const pending = new Promise<TaskEvent>((resolve) => {
    finish = resolve;
  });
  const controller = new TaskReadController(
    {
      readTasks: async () => emptyTasksWorkspace(),
      duplicateEvent: async () => {
        requests++;
        return pending;
      },
    },
    () => {},
  );
  controller.selectEvent(source.id, true);
  const key = randomUUID(),
    a = controller.duplicateEvent(source.id, 1, fields, key),
    b = controller.duplicateEvent(source.id, 1, fields, key);
  assert.equal(a, b);
  await Promise.resolve();
  controller.selectEvent(randomUUID(), true);
  finish(result);
  await assert.rejects(
    a,
    (e: unknown) => e instanceof DOMException && e.name === "AbortError",
  );
  assert.equal(requests, 1);
  assert.deepEqual(controller.getSnapshot().accessibleEvents, []);
});
