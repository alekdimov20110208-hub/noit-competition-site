import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { parseClearOperation } from "../src/events/clear.ts";
const user = { id: "test", name: "Synthetic", email: "test@example.invalid" };
const event = randomUUID(),
  key = randomUUID(),
  fields = {
    expectedVersion: 1,
    confirmationName: "Exact Event",
    scopeRevision: "a".repeat(64),
  };
test("Clear strict schema rejects forged fields, malformed versions, keys, names and revisions", () => {
  for (const input of [
    null,
    [],
    {},
    { ...fields, actorMemberId: randomUUID() },
    { ...fields, expectedVersion: 0 },
    { ...fields, expectedVersion: 2147483648 },
    { ...fields, expectedVersion: "1" },
    { ...fields, confirmationName: "" },
    { ...fields, confirmationName: "x".repeat(201) },
    { ...fields, confirmationName: "\u0000" },
    { ...fields, scopeRevision: "A".repeat(64) },
    { ...fields, scopeRevision: "" },
  ])
    assert.throws(() => parseClearOperation(user, event, key, input));
  assert.throws(() => parseClearOperation(user, event, "invalid", fields));
  assert.throws(() => parseClearOperation(user, "invalid", key, fields));
  assert.throws(() =>
    parseClearOperation({ ...user, id: "" }, event, key, fields),
  );
});
test("Clear canonical digest is field-order-independent and separates review/name/version/Event", () => {
  const a = parseClearOperation(
    user,
    event.toUpperCase(),
    key.toUpperCase(),
    fields,
  );
  assert.equal(
    a.digest,
    parseClearOperation(user, event, key, {
      scopeRevision: fields.scopeRevision,
      confirmationName: fields.confirmationName,
      expectedVersion: 1,
    }).digest,
  );
  assert.equal(a.sourceId, event);
  assert.equal(a.commandId, key);
  for (const change of [
    { scopeRevision: "b".repeat(64) },
    { expectedVersion: 2 },
    { confirmationName: "Exact Event " },
    { confirmationName: "exact event" },
  ])
    assert.notEqual(
      a.digest,
      parseClearOperation(user, event, key, { ...fields, ...change }).digest,
    );
  assert.notEqual(
    a.digest,
    parseClearOperation(user, randomUUID(), key, fields).digest,
  );
});
