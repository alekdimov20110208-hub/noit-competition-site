import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { SEMINAR_BLUEPRINT } from "../src/templates/catalog.ts";
import {
  parseTemplateSelection,
  resolveBlueprint,
  resolveBlueprintDate,
  type TemplateApplyCommand,
  type TemplateSelection,
} from "../src/templates/model.ts";
import { createTemplateApplicationService } from "../src/templates/service.ts";
import { EventCommandError } from "../src/events/model.ts";
import {
  templateFixture,
  eventId,
  actorId,
  user,
  operationId,
} from "./helpers/template-fixture.ts";
import { templateHistoryOrigin } from "../src/templates/history.ts";

const selection: TemplateSelection = {
  templateId: SEMINAR_BLUEPRINT.id,
  templateVersion: 1,
  language: "en",
  itemIds: SEMINAR_BLUEPRINT.items.map((i) => i.id),
};
const command = (
  review: { event: { version: number }; reviewRevision: string },
  selected = selection,
): TemplateApplyCommand => ({
  ...selected,
  expectedEventVersion: review.event.version,
  reviewRevision: review.reviewRevision,
  confirmed: true,
});
const denied = (code: string) => (error: unknown) =>
  error instanceof EventCommandError && error.code === code;

test("template selection strictly rejects unknown/duplicate/zero/excessive items, versions and forged fields", () => {
  for (const body of [
    null,
    [],
    {},
    { ...selection, templateId: "other" },
    { ...selection, templateVersion: 2 },
    { ...selection, itemIds: [] },
    { ...selection, itemIds: ["missing"] },
    { ...selection, itemIds: [selection.itemIds[0], selection.itemIds[0]] },
    { ...selection, itemIds: Array(5).fill(selection.itemIds[0]) },
    { ...selection, language: "fr" },
    { ...selection, title: "forged" },
    { ...selection, actorUserId: "forged" },
  ])
    assert.throws(() => parseTemplateSelection(body));
  const good = command({
    event: { version: 1 },
    reviewRevision: "a".repeat(64),
  });
  for (const change of [
    { confirmed: false },
    { confirmed: undefined },
    { expectedEventVersion: 0 },
    { expectedEventVersion: 2147483648 },
    { reviewRevision: "bad" },
    { assignedMemberId: actorId },
    { deadline: "2026-01-01" },
  ])
    assert.throws(() => parseTemplateSelection({ ...good, ...change }, true));
  assert.deepEqual(
    parseTemplateSelection({
      ...selection,
      itemIds: [...selection.itemIds].reverse(),
    }),
    selection,
  );
});

test("server Gregorian calendar preserves month/year/leap/DST boundaries and date-only versus time", () => {
  for (const [start, offset, expected] of [
    ["2026-01-01", -1, "2025-12-31"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2024-03-01", -1, "2024-02-29"],
    ["1900-02-28", 1, "1900-03-01"],
    ["2000-02-28", 1, "2000-02-29"],
    ["2026-03-29", 1, "2026-03-30"],
    ["2026-10-25", -1, "2026-10-24"],
    ["0099-12-31", 1, "0100-01-01"],
  ] as const)
    assert.equal(resolveBlueprintDate(start, offset), expected);
  for (const start of ["2026-02-29", "0000-01-01", "2026-1-01", "2026-04-31"])
    assert.throws(() => resolveBlueprintDate(start, 0));
  for (const [start, offset] of [
    ["0001-01-01", -1],
    ["9999-12-31", 1],
    ["2026-01-01", Infinity],
    ["2026-01-01", 0.5],
  ] as const)
    assert.throws(() => resolveBlueprintDate(start, offset));
  assert.deepEqual(
    resolveBlueprint(selection, "2026-11-20").map((i) => [
      i.deadline,
      i.deadlineTime,
      i.reminderOffsets,
    ]),
    [
      ["2026-11-13", null, []],
      ["2026-11-19", null, []],
      ["2026-11-19", "15:00", []],
      ["2026-11-20", "08:30", []],
    ],
  );
});

test("server review is Event scoped and distinguishes Organizer/Member/archive without writes", async () => {
  const f = templateFixture(),
    service = createTemplateApplicationService(f.pool);
  for (const role of ["ORGANIZER", "MEMBER"])
    for (const archived of [false, true]) {
      f.options.role = role;
      f.store.event.archived_at = archived ? new Date() : null;
      const review = await service.preview(user, eventId, selection);
      assert.equal(review.canApply, role === "ORGANIZER" && !archived);
      assert.equal(review.event.timezone, "Europe/Sofia");
    }
  await assert.rejects(
    service.preview(user, randomUUID(), selection),
    denied("NOT_FOUND"),
  );
  assert.equal(f.store.tasks.length, 0);
  assert.equal(f.store.receipts.length, 0);
  assert.equal(f.store.activities.length, 0);
});

test("apply uses one transaction and creates canonical unassigned/unaccepted Tasks, normal history and receipt", async () => {
  const f = templateFixture(),
    service = createTemplateApplicationService(f.pool);
  const review = await service.preview(user, eventId, selection);
  f.calls.length = 0;
  const result = await service.apply(
    user,
    eventId,
    operationId,
    command(review),
  );
  assert.equal(result.createdCount, 4);
  assert.equal(new Set(result.taskIds).size, 4);
  assert.equal(f.store.tasks.length, 4);
  assert.equal(f.store.activities.length, 5);
  assert.equal(f.store.receipts.length, 1);
  assert.equal(f.calls.filter((c) => c.sql === "BEGIN").length, 1);
  assert.equal(f.calls.filter((c) => c.sql === "COMMIT").length, 1);
  assert.ok(f.calls.some((c) => c.sql.includes("pg_advisory_xact_lock")));
  assert.ok(
    f.calls.some(
      (c) =>
        c.sql.includes("FROM public.event WHERE") &&
        c.sql.endsWith("FOR UPDATE"),
    ),
  );
  for (const task of f.store.tasks) {
    assert.equal(task.assigned_member_id, null);
    assert.equal(task.accepted_by_member_id, null);
    assert.equal(task.accepted_at, null);
    assert.equal(task.status, "not-started");
    assert.equal(task.version, 1);
    assert.deepEqual(task.reminderOffsets, []);
  }
  for (const entry of f.store.activities) {
    assert.equal(entry.eventId, eventId);
    assert.equal(entry.actorUserId, user.id);
    assert.equal(entry.actorMemberId, actorId);
    assert.equal(
      templateHistoryOrigin(entry.payload.templateApplication)?.operationId,
      operationId,
    );
  }
  assert.equal(f.store.activities.at(-1)?.action, "TEMPLATE_APPLIED");
});

test("execution and receipt recovery recheck Member, revoked identity/membership and archive", async () => {
  for (const change of [
    { role: "MEMBER" },
    { membershipActive: false },
    { identityActive: false },
    { archived: true },
  ]) {
    const f = templateFixture(),
      service = createTemplateApplicationService(f.pool),
      review = await service.preview(user, eventId, selection);
    await service.apply(user, eventId, operationId, command(review));
    Object.assign(f.options, change);
    if (change.archived) f.store.event.archived_at = new Date();
    await assert.rejects(
      service.apply(user, eventId, operationId, command(review)),
    );
    await assert.rejects(
      service.apply(user, eventId, randomUUID(), command(review)),
    );
    assert.equal(f.store.tasks.length, 4);
    assert.equal(f.store.receipts.length, 1);
  }
});

test("stale Event/version/timezone, template/selection and matching names require a new review", async () => {
  for (const change of [
    "version",
    "start_date",
    "timezone",
    "selection",
    "review",
  ] as const) {
    const f = templateFixture(),
      service = createTemplateApplicationService(f.pool),
      review = await service.preview(user, eventId, selection);
    const body = command(review);
    if (change === "version") f.store.event.version++;
    if (change === "start_date") f.store.event.start_date = "2026-11-21";
    if (change === "timezone") f.store.event.timezone = "America/New_York";
    if (change === "selection") body.itemIds = [selection.itemIds[0]!];
    if (change === "review") body.reviewRevision = "0".repeat(64);
    await assert.rejects(service.apply(user, eventId, operationId, body));
    assert.equal(f.store.tasks.length, 0);
    assert.equal(f.store.receipts.length, 0);
  }
  const f = templateFixture(),
    service = createTemplateApplicationService(f.pool),
    review = await service.preview(user, eventId, selection);
  await service.apply(user, eventId, operationId, command(review));
  await assert.rejects(
    service.apply(user, eventId, randomUUID(), command(review)),
    denied("TEMPLATE_REVIEW_CONFLICT"),
  );
  const next = await service.preview(user, eventId, selection);
  assert.equal(next.matchingTaskCount, 4);
  await service.apply(user, eventId, randomUUID(), command(next));
  assert.equal(f.store.tasks.length, 8);
});

test("forced Task, activity and receipt failures leave no partial Tasks, history or successful receipt", async () => {
  for (const failure of [
    { failTaskNumber: 3 },
    { failActivityNumber: 3 },
    { failActivityNumber: 5 },
    { failReceipt: true },
  ]) {
    const f = templateFixture(),
      service = createTemplateApplicationService(f.pool),
      review = await service.preview(user, eventId, selection);
    Object.assign(f.options, failure);
    await assert.rejects(
      service.apply(user, eventId, operationId, command(review)),
    );
    assert.equal(f.store.tasks.length, 0);
    assert.equal(f.store.activities.length, 0);
    assert.equal(f.store.receipts.length, 0);
    assert.equal(f.calls.at(-1)?.sql, "ROLLBACK");
    Object.assign(f.options, {
      failTaskNumber: 0,
      failActivityNumber: 0,
      failReceipt: false,
    });
    assert.equal(
      (await service.apply(user, eventId, operationId, command(review)))
        .createdCount,
      4,
    );
  }
});

test("same-key replay/concurrent unit requests and recreated service recover original receipt; changed payload conflicts", async () => {
  const f = templateFixture(),
    service = createTemplateApplicationService(f.pool),
    review = await service.preview(user, eventId, selection),
    body = command(review);
  const [a, b] = await Promise.all([
    service.apply(user, eventId, operationId, body),
    service.apply(user, eventId, operationId, body),
  ]);
  assert.deepEqual(a, b);
  assert.equal(f.store.tasks.length, 4);
  assert.equal(f.store.receipts.length, 1);
  f.store.event.version++;
  assert.deepEqual(
    await createTemplateApplicationService(f.pool).apply(
      user,
      eventId,
      operationId,
      body,
    ),
    a,
  );
  for (const change of [
    { language: "bg" },
    { itemIds: [selection.itemIds[0]] },
    { reviewRevision: "b".repeat(64) },
  ])
    await assert.rejects(
      service.apply(user, eventId, operationId, { ...body, ...change }),
      denied("IDEMPOTENCY_KEY_REUSED"),
    );
  assert.equal(f.store.tasks.length, 4);
});
