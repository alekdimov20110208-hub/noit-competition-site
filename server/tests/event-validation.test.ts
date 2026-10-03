import assert from "node:assert/strict";
import test from "node:test";
import {
  EventCommandError,
  parseEventCommand,
  validEventDate,
  validEventTimezone,
} from "../src/events/model.ts";

export const eventInput = {
  name: "Development Event",
  startDate: "2026-10-04",
  endDate: "2026-10-05",
  timezone: "Europe/Sofia",
};

const invalid = (field?: string) => (error: unknown) => {
  assert.ok(error instanceof EventCommandError);
  assert.equal(error.statusCode, 400);
  assert.equal(error.code, "INVALID_EVENT_COMMAND");
  if (field) assert.ok(error.fields?.[field as keyof typeof error.fields]);
  return true;
};

test("Event names are trimmed, required and bounded to 200 characters", () => {
  assert.equal(
    parseEventCommand({ ...eventInput, name: "  A seminar  " }).name,
    "A seminar",
  );
  assert.equal(
    parseEventCommand({ ...eventInput, name: "A".repeat(200) }).name.length,
    200,
  );
  assert.equal(
    parseEventCommand({ ...eventInput, name: "Event \uD83D\uDE80" }).name,
    "Event \uD83D\uDE80",
  );
  for (const name of [
    "",
    " \t\n",
    "A".repeat(201),
    "A\u0000B",
    "A\uD800B",
    "A\uDC00B",
    "A\uD800\uD800B",
    null,
    42,
  ])
    assert.throws(
      () => parseEventCommand({ ...eventInput, name }),
      invalid("name"),
    );
});

test("Event date validation rejects normalization, year zero, timestamps and rollover", () => {
  for (const date of [
    "2026-2-01",
    "2026-02-30",
    "2026-04-31",
    "2026-00-01",
    "2026-13-01",
    "2026-01-00",
    "0000-01-01",
    "1900-02-29",
    "2026-10-04T00:00:00Z",
    "infinity",
    " 2026-10-04",
    null,
  ]) {
    assert.equal(validEventDate(date), false);
    assert.throws(
      () => parseEventCommand({ ...eventInput, startDate: date }),
      invalid("startDate"),
    );
    assert.throws(
      () => parseEventCommand({ ...eventInput, endDate: date }),
      invalid("endDate"),
    );
  }
  for (const date of ["2000-02-29", "2024-02-29", "0001-01-01", "9999-12-31"])
    assert.equal(validEventDate(date), true);
  assert.equal(
    parseEventCommand({ ...eventInput, endDate: eventInput.startDate }).endDate,
    eventInput.startDate,
  );
});

test("Event end-before-start validation gives a safe field code", () => {
  assert.throws(
    () => parseEventCommand({ ...eventInput, endDate: "2026-10-03" }),
    (error) => {
      assert.ok(error instanceof EventCommandError);
      assert.deepEqual(error.fields, { endDate: "END_BEFORE_START" });
      return true;
    },
  );
});

test("Event timezone requires a supported named IANA identifier and rejects raw offsets", () => {
  for (const timezone of [
    "Europe/Sofia",
    "America/New_York",
    "Pacific/Honolulu",
    "UTC",
    "Etc/GMT+3",
  ])
    assert.equal(validEventTimezone(timezone), true);
  for (const timezone of [
    "",
    "Mars/Base",
    "+03:00",
    "-05",
    "UTC+03:00",
    " Europe/Sofia",
    "posix/Europe/Sofia",
    "right/UTC",
    "localtime",
    "posixrules",
    3,
  ])
    assert.throws(
      () => parseEventCommand({ ...eventInput, timezone }),
      invalid("timezone"),
    );
});

test("Event commands reject all client identity, role, timestamp, ID and history fields", () => {
  for (const field of [
    "id",
    "eventId",
    "ownerUserId",
    "owner_user_id",
    "createdAt",
    "updatedAt",
    "version",
    "actorUserId",
    "actorMemberId",
    "memberId",
    "accessRole",
    "operationalRole",
    "membership",
    "archivedAt",
    "__proto__",
  ])
    assert.throws(
      () => parseEventCommand({ ...eventInput, [field]: "FORGED" }),
      invalid(),
    );
  for (const input of [
    null,
    [],
    "event",
    1,
    {},
    { ...eventInput, timezone: undefined },
  ])
    assert.throws(() => parseEventCommand(input), invalid());
});

test("Event updates require every product field and a strict positive bounded expectedVersion", () => {
  assert.equal(
    parseEventCommand({ ...eventInput, expectedVersion: 7 }, true)
      .expectedVersion,
    7,
  );
  for (const expectedVersion of [
    undefined,
    null,
    "1",
    0,
    -1,
    1.5,
    2147483647,
    Number.MAX_SAFE_INTEGER,
    NaN,
  ])
    assert.throws(
      () => parseEventCommand({ ...eventInput, expectedVersion }, true),
      invalid("expectedVersion"),
    );
  assert.throws(
    () => parseEventCommand({ ...eventInput, expectedVersion: 1 }),
    invalid(),
  );
  assert.throws(
    () => parseEventCommand({ name: "Changed", expectedVersion: 1 }, true),
    invalid(),
  );
});
