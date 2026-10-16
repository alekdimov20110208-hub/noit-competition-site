import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { AIKIDO_SEMINAR_STARTER as catalog } from "../domain/eventTemplates.ts";
import { resolveTemplateDeadline } from "../domain/templateDates.ts";
import { createI18n } from "../i18n/createI18n.ts";
import {
  TemplateApplicationService,
  TemplateFailure,
  templateSelection,
  readTemplateReview,
  readTemplateResult,
  rememberTemplateAttempt,
  readTemplateAttempt,
  forgetTemplateAttempt,
  validTemplateAttempt,
  type TemplateAttempt,
  type TemplateReview,
} from "./templateApplications.ts";
import { TemplateApplicationController } from "./templateApplicationState.ts";
import { readEventHistory } from "./eventHistory.ts";

const eventId = randomUUID(),
  memberId = randomUUID();
const selection = templateSelection(
  catalog.items.map((i) => i.id),
  "en",
);
const i18n = createI18n("en");
const review: TemplateReview = {
  ...selection,
  event: {
    id: eventId,
    name: "Synthetic Event",
    startDate: "2026-11-20",
    endDate: "2026-11-22",
    timezone: "Europe/Sofia",
    archived: false,
    version: 1,
    membership: { id: memberId, accessRole: "ORGANIZER" },
    createdAt: "2026-10-16T00:00:00Z",
    updatedAt: "2026-10-16T00:00:00Z",
  },
  reviewRevision: "a".repeat(64),
  canApply: true,
  matchingTaskCount: 0,
  items: catalog.items.map((item) => ({
    itemId: item.id,
    title: i18n.t(item.titleKey),
    category: i18n.t(item.categoryKey),
    context: i18n.t(item.contextKey),
    priority: item.priority,
    ...resolveTemplateDeadline("2026-11-20", item.dayOffset, item.deadlineTime),
    reminderOffsets: [],
    assignedMemberId: null,
    accepted: false,
    status: "not-started",
  })),
};
const attempt: TemplateAttempt = {
  ...selection,
  operationId: randomUUID(),
  expectedEventVersion: 1,
  reviewRevision: review.reviewRevision,
  confirmed: true,
};
const outcome = (held: TemplateAttempt) => ({
  ...selection,
  operationId: held.operationId,
  eventId,
  createdCount: held.itemIds.length,
  taskIds: held.itemIds.map(() => randomUUID()),
});
const failure = (code: string) => (error: unknown) =>
  error instanceof TemplateFailure && error.code === code;

test("History accepts canonical template operation provenance and rejects forged scope/version", () => {
  const origin = {
    templateId: catalog.id,
    templateVersion: 1,
    operationId: randomUUID(),
  };
  const entry = {
    id: randomUUID(),
    eventId,
    action: "TEMPLATE_APPLIED",
    createdAt: "2026-10-16T00:00:00.123456Z",
    actor: { userId: "test", memberId, name: "Synthetic" },
    target: { type: "event", id: eventId, title: "Synthetic", available: true },
    version: 1,
    previousVersion: null,
    changedFields: [],
    stateChanges: [],
    templateApplication: origin,
  };
  const page = { eventId, entries: [entry], nextCursor: null };
  assert.deepEqual(
    readEventHistory(page, eventId).entries[0]?.templateApplication,
    origin,
  );
  for (const change of [
    { templateId: "other" },
    { templateVersion: 2 },
    { operationId: "invalid" },
  ])
    assert.throws(() =>
      readEventHistory(
        {
          ...page,
          entries: [
            { ...entry, templateApplication: { ...origin, ...change } },
          ],
        },
        eventId,
      ),
    );
});

test("frontend review validates canonical content, Event scope, exact selection, dates and initial semantics", () => {
  assert.deepEqual(readTemplateReview(review, eventId, selection), review);
  for (const change of [
    { event: { ...review.event, id: randomUUID() } },
    { itemIds: [] },
    { templateVersion: 9 },
    { language: "bg" },
    { canApply: false },
    { matchingTaskCount: -1 },
    {
      items: review.items.map((item, index) =>
        index ? item : { ...item, deadline: "2026-11-14" },
      ),
    },
    {
      items: review.items.map((item, index) =>
        index ? item : { ...item, assignedMemberId: memberId },
      ),
    },
    {
      items: review.items.map((item, index) =>
        index ? item : { ...item, title: "forged" },
      ),
    },
  ])
    assert.throws(
      () => readTemplateReview({ ...review, ...change }, eventId, selection),
      failure("invalid"),
    );
  for (const ids of [
    [],
    ["unknown"],
    [selection.itemIds[0]!, selection.itemIds[0]!],
  ])
    assert.throws(() => templateSelection(ids, "en"));
});

test("frontend accepted result requires same operation/Event/selection and exact unique created Task count", () => {
  const result = outcome(attempt);
  assert.deepEqual(readTemplateResult(result, eventId, attempt), result);
  for (const change of [
    { operationId: randomUUID() },
    { eventId: randomUUID() },
    { createdCount: 0 },
    { itemIds: [] },
    { taskIds: Array(4).fill(randomUUID()) },
    { taskIds: ["invalid"] },
  ])
    assert.throws(
      () => readTemplateResult({ ...result, ...change }, eventId, attempt),
      failure("uncertain"),
    );
});

test("transport sends only identifiers/review metadata, uses same-origin credentials and one apply request", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const service = new TemplateApplicationService(async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      String(url).endsWith("preview") ? review : outcome(attempt),
    );
  });
  await service.preview(eventId, selection);
  await service.apply(eventId, attempt);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]!.init?.credentials, "same-origin");
  assert.equal(calls[1]!.init?.method, "POST");
  assert.deepEqual(
    Object.keys(JSON.parse(calls[0]!.init?.body as string)).sort(),
    ["itemIds", "language", "templateId", "templateVersion"],
  );
  assert.equal(
    (calls[1]!.init?.headers as Record<string, string>)["idempotency-key"],
    attempt.operationId,
  );
  assert.equal(
    JSON.parse(calls[1]!.init?.body as string).operationId,
    undefined,
  );
});

test("transport retains uncertainty for lost/malformed/500/unknown-409 responses and maps definite stale review", async () => {
  for (const response of [
    null,
    new Response("bad", { status: 201 }),
    Response.json({}, { status: 201 }),
    Response.json({}, { status: 500 }),
    Response.json({ code: "OTHER" }, { status: 409 }),
  ]) {
    const service = new TemplateApplicationService(async () => {
      if (!response) throw Error("offline");
      return response;
    });
    await assert.rejects(service.apply(eventId, attempt), failure("uncertain"));
  }
  for (const [status, code, expected] of [
    [409, "TEMPLATE_REVIEW_CONFLICT", "conflict"],
    [409, "IDEMPOTENCY_KEY_REUSED", "key-reused"],
    [403, "EVENT_ARCHIVED", "archived"],
    [401, "", "unauthenticated"],
    [404, "NOT_FOUND", "unavailable"],
  ] as const) {
    const service = new TemplateApplicationService(async () =>
      Response.json({ code }, { status }),
    );
    await assert.rejects(service.apply(eventId, attempt), failure(expected));
  }
});

test("recovery hint is scoped to user and Event; malformed hints never become canonical state", () => {
  const map = new Map<string, string>(),
    storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
    } as Storage;
  const user = randomUUID();
  rememberTemplateAttempt(user, eventId, attempt, storage);
  assert.deepEqual(readTemplateAttempt(user, eventId, storage), attempt);
  assert.equal(readTemplateAttempt(randomUUID(), eventId, storage), null);
  assert.equal(readTemplateAttempt(user, randomUUID(), storage), null);
  assert.equal(
    validTemplateAttempt({ ...attempt, itemIds: ["unknown"] }),
    false,
  );
  assert.equal(validTemplateAttempt({ ...attempt, confirmed: false }), false);
  forgetTemplateAttempt(user, eventId, storage);
  assert.equal(readTemplateAttempt(user, eventId, storage), null);
});

test("controller requires review, coalesces repeated confirmation and refreshes after confirmed creation", async () => {
  let calls = 0,
    refresh = 0,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const c = new TemplateApplicationController(
    randomUUID(),
    eventId,
    {
      preview: async () => review,
      apply: async (_event, held) => {
        calls++;
        await gate;
        return outcome(held);
      },
    },
    async () => {
      refresh++;
    },
    () => {},
  );
  await c.apply();
  assert.equal(calls, 0);
  await c.review(selection);
  const pending = c.apply();
  await c.apply();
  assert.equal(calls, 1);
  assert.equal(c.getSnapshot().pending, "apply");
  release();
  await pending;
  assert.equal(c.getSnapshot().result?.createdCount, 4);
  assert.equal(refresh, 1);
  await c.apply();
  assert.equal(calls, 1);
});

test("uncertain result survives controller recreation/navigation and retries exactly the held key and payload", async () => {
  const user = randomUUID(),
    calls: TemplateAttempt[] = [];
  const service = {
    preview: async () => review,
    apply: async (_event: string, held: TemplateAttempt) => {
      calls.push(held);
      if (calls.length === 1) throw new TemplateFailure("uncertain");
      return outcome(held);
    },
  };
  let generated = 0;
  const c = new TemplateApplicationController(
    user,
    eventId,
    service,
    async () => {},
    () => {},
    () => {
      generated++;
      return attempt.operationId;
    },
  );
  await c.review(selection);
  await c.apply();
  assert.equal(c.getSnapshot().error, "uncertain");
  c.dispose();
  const recovered = new TemplateApplicationController(
    user,
    eventId,
    service,
    async () => {},
    () => {},
    () => {
      throw Error("must not generate a fresh key");
    },
  );
  await recovered.review({ ...selection, itemIds: [selection.itemIds[0]!] });
  await recovered.apply();
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(generated, 1);
  assert.equal(recovered.getSnapshot().result?.createdCount, 4);
  assert.equal(readTemplateAttempt(user, eventId), null);
});

test("late accepted response after navigation preserves the unseen operation for recovery", async () => {
  const user = randomUUID();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const c = new TemplateApplicationController(
    user,
    eventId,
    {
      preview: async () => review,
      apply: async (_event, held) => {
        await gate;
        return outcome(held);
      },
    },
    async () => {},
    () => {},
  );
  await c.review(selection);
  const pending = c.apply();
  const held = readTemplateAttempt(user, eventId);
  assert.ok(held);
  c.dispose();
  release();
  await pending;
  assert.deepEqual(readTemplateAttempt(user, eventId), held);
  const recovered = new TemplateApplicationController(
    user,
    eventId,
    {
      preview: async () => review,
      apply: async (_event, attempt) => outcome(attempt),
    },
    async () => {},
    () => {},
  );
  await recovered.apply();
  assert.equal(recovered.getSnapshot().result?.operationId, held.operationId);
  assert.equal(readTemplateAttempt(user, eventId), null);
});

test("stale review clears confirmation context; permission/archive/key conflict keep the recovery attempt", async () => {
  for (const code of [
    "conflict",
    "forbidden",
    "archived",
    "key-reused",
    "unavailable",
  ] as const) {
    const user = randomUUID();
    let calls = 0;
    const c = new TemplateApplicationController(
      user,
      eventId,
      {
        preview: async () => review,
        apply: async () => {
          calls++;
          throw new TemplateFailure(code);
        },
      },
      async () => {},
      () => {},
    );
    await c.review(selection);
    await c.apply();
    assert.equal(c.getSnapshot().error, code);
    if (code === "conflict") {
      assert.equal(c.getSnapshot().review, null);
      assert.equal(c.getSnapshot().attempt, null);
      await c.apply();
      assert.equal(calls, 1);
    } else {
      const held = c.getSnapshot().attempt;
      c.startNew();
      assert.equal(c.getSnapshot().attempt, held);
      forgetTemplateAttempt(user, eventId);
    }
  }
});

test("confirmed creation remains confirmed on refresh failure; Member preview and expired auth cannot fabricate success", async () => {
  let expired = 0,
    writes = 0;
  const c = new TemplateApplicationController(
    randomUUID(),
    eventId,
    {
      preview: async () => ({ ...review, canApply: false }),
      apply: async () => {
        writes++;
        return outcome(attempt);
      },
    },
    async () => {},
    () => {},
  );
  await c.review(selection);
  await c.apply();
  assert.equal(writes, 0);
  const success = new TemplateApplicationController(
    randomUUID(),
    eventId,
    {
      preview: async () => review,
      apply: async (_event, held) => outcome(held),
    },
    async () => {
      throw Error();
    },
    () => {},
  );
  await success.review(selection);
  await success.apply();
  assert.equal(success.getSnapshot().result?.createdCount, 4);
  assert.equal(success.getSnapshot().refreshFailed, true);
  const unauthorized = new TemplateApplicationController(
    randomUUID(),
    eventId,
    {
      preview: async () => {
        throw new TemplateFailure("unauthenticated");
      },
      apply: async () => outcome(attempt),
    },
    async () => {},
    () => {
      expired++;
    },
  );
  await unauthorized.review(selection);
  assert.equal(expired, 1);
  assert.equal(unauthorized.getSnapshot().result, null);
});
