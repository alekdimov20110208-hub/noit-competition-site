import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { templateHistoryOrigin } from "../src/templates/history.ts";
test("History exposes only known bounded template provenance and never arbitrary payload fields", () => {
  const origin = {
    templateId: "international-aikido-seminar",
    templateVersion: 1,
    operationId: randomUUID(),
  };
  assert.deepEqual(
    templateHistoryOrigin({
      ...origin,
      secret: "omit",
      itemId: "omit",
      taskIds: [randomUUID()],
    }),
    origin,
  );
  for (const invalid of [
    null,
    [],
    { ...origin, templateId: "foreign" },
    { ...origin, templateVersion: 2 },
    { ...origin, operationId: "not-an-id" },
  ])
    assert.equal(templateHistoryOrigin(invalid), undefined);
});
