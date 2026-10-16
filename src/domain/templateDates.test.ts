import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveTemplateDate,
  resolveTemplateDeadline,
} from "./templateDates.ts";

test("template calendar offsets cross month, year and leap-year boundaries", () => {
  for (const [start, offset, expected] of [
    ["2026-11-20", -7, "2026-11-13"],
    ["2026-11-20", 0, "2026-11-20"],
    ["2026-11-20", 3, "2026-11-23"],
    ["2026-01-01", -1, "2025-12-31"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2024-03-01", -1, "2024-02-29"],
    ["2024-02-28", 2, "2024-03-01"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2000-02-28", 1, "2000-02-29"],
    ["1900-02-28", 1, "1900-03-01"],
    ["0099-12-31", 1, "0100-01-01"],
    ["0001-01-01", 0, "0001-01-01"],
    ["9999-12-31", 0, "9999-12-31"],
  ] as const)
    assert.equal(resolveTemplateDate(start, offset), expected);
});

test("DST dates use calendar fields regardless of the host timezone", () => {
  const original = process.env.TZ;
  try {
    for (const zone of [
      "Europe/Sofia",
      "America/New_York",
      "Pacific/Kiritimati",
      "UTC",
    ]) {
      process.env.TZ = zone;
      for (const [start, offset, expected] of [
        ["2026-03-28", 1, "2026-03-29"],
        ["2026-03-29", 1, "2026-03-30"],
        ["2026-10-25", -1, "2026-10-24"],
        ["2026-10-25", 1, "2026-10-26"],
        ["2026-03-08", 1, "2026-03-09"],
        ["2026-11-01", -1, "2026-10-31"],
      ] as const)
        assert.equal(resolveTemplateDate(start, offset), expected, zone);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("invalid calendar dates, noninteger offsets and out-of-range results are rejected", () => {
  for (const date of [
    "",
    "2026-2-01",
    "2026-02-29",
    "1900-02-29",
    "0000-01-01",
    "10000-01-01",
    "2026-04-31",
    "2026-00-10",
    "2026-01-00",
    "2026-01-01T00:00:00Z",
  ])
    assert.throws(() => resolveTemplateDate(date, 0), RangeError, date);
  for (const offset of [
    NaN,
    Infinity,
    -Infinity,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MAX_SAFE_INTEGER,
    -Number.MAX_SAFE_INTEGER,
  ])
    assert.throws(() => resolveTemplateDate("2026-01-01", offset), RangeError);
  assert.throws(() => resolveTemplateDate("0001-01-01", -1), RangeError);
  assert.throws(() => resolveTemplateDate("9999-12-31", 1), RangeError);
});

test("local time stays separate: date-only, DST gap and repeated time are never converted", () => {
  assert.deepEqual(resolveTemplateDeadline("2026-11-20", -1), {
    deadline: "2026-11-19",
    deadlineTime: null,
  });
  for (const [start, time] of [
    ["2026-03-29", "03:30"],
    ["2026-10-25", "03:30"],
    ["2026-11-20", "00:00"],
    ["2026-11-20", "23:59"],
  ])
    assert.deepEqual(resolveTemplateDeadline(start, 0, time), {
      deadline: start,
      deadlineTime: time,
    });
  for (const time of ["", "8:30", "24:00", "12:60", "08:30Z"])
    assert.throws(
      () => resolveTemplateDeadline("2026-11-20", 0, time),
      RangeError,
    );
});
