import assert from "node:assert/strict";
import test from "node:test";
import { parseSaveCommand, calendarOffset } from "../src/templates/library.ts";
import { parseTemplateSelection } from "../src/templates/model.ts";
import { templateHistoryOrigin } from "../src/templates/history.ts";
const id = "a1111111-1111-4111-8111-111111111111";
const item = {
  sourceTaskId: id,
  expectedTaskVersion: 1,
  title: "Reviewed",
  category: "Logistics",
  context: "",
  contextReviewed: false,
  priority: "normal",
};
const body = {
  name: "Private plan",
  description: "",
  expectedEventVersion: 1,
  items: [item],
  confirmed: true,
};
test("personal Save validates a bounded explicit allowlist and requires opt-in context review", () => {
  assert.equal(parseSaveCommand(body).items[0]!.context, "");
  assert.equal(
    parseSaveCommand({
      ...body,
      items: [{ ...item, context: "Reviewed", contextReviewed: true }],
    }).items[0]!.context,
    "Reviewed",
  );
  for (const bad of [
    null,
    {},
    { ...body, ownerUserId: "other" },
    { ...body, confirmed: false },
    { ...body, name: " " },
    { ...body, description: "a".repeat(2001) },
    { ...body, items: [] },
    { ...body, items: Array(51).fill(item) },
    { ...body, items: [item, item] },
    ...[
      { context: "secret" },
      { assignedMemberId: id },
      { status: "completed" },
      { expectedTaskVersion: 0 },
      { expectedTaskVersion: 2147483648 },
      { title: "x".repeat(201) },
      { category: "x".repeat(101) },
      { context: "x".repeat(5001), contextReviewed: true },
      { priority: "unknown" },
    ].map((change) => ({ ...body, items: [{ ...item, ...change }] })),
  ])
    assert.throws(() => parseSaveCommand(bad));
});
test("private selection canonicalizes IDs and prevents case-variant duplicates; History redacts private identity", () => {
  const s = {
    templateId: id,
    templateVersion: 1,
    itemIds: [id],
    language: "en",
  };
  assert.deepEqual(parseTemplateSelection(s), s);
  assert.throws(() =>
    parseTemplateSelection({ ...s, itemIds: [id, id.toUpperCase()] }),
  );
  assert.deepEqual(
    templateHistoryOrigin({
      templateId: id,
      templateVersion: 1,
      operationId: id,
      name: "Never expose",
    }),
    { templateId: "private-template", templateVersion: 1, operationId: id },
  );
});
test("saved calendar offsets are bounded Gregorian day differences across leap, year and DST boundaries", () => {
  for (const [a, b, n] of [
    ["2024-02-28", "2024-03-01", 2],
    ["1900-02-28", "1900-03-01", 1],
    ["2000-02-28", "2000-03-01", 2],
    ["2026-03-28", "2026-03-30", 2],
    ["2026-10-24", "2026-10-26", 2],
    ["2026-01-01", "2025-12-31", -1],
    ["0099-12-31", "0100-01-01", 1],
  ] as const)
    assert.equal(calendarOffset(a, b), n);
  for (const [a, b] of [
    ["2025-02-29", "2025-03-01"],
    ["0000-01-01", "0001-01-01"],
    ["2000-01-01", "2026-01-01"],
  ])
    assert.throws(() => calendarOffset(a!, b!));
});
