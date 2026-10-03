import assert from "node:assert/strict";
import test from "node:test";
import {
  browserEventTimezone,
  eventTimezoneOptions,
  validateEventForm,
  isEventTimezone,
} from "./helpers.ts";

const valid = {
  name: "  Seminar  ",
  startDate: "2028-02-29",
  endDate: "2028-03-01",
  timezone: "Europe/Sofia",
};
test("event form accepts real leap dates without interpreting them as instants", () => {
  assert.deepEqual(validateEventForm(valid), {});
  assert.deepEqual(
    validateEventForm({ ...valid, endDate: valid.startDate }),
    {},
  );
});
test("event form rejects empty/bounded name, invalid dates and reversed range", () => {
  assert.equal(validateEventForm({ ...valid, name: "   " }).name, "name");
  assert.equal(
    validateEventForm({ ...valid, name: "bad\u0000name" }).name,
    "name",
  );
  for (const name of ["bad\uD800name", "bad\uDC00name"])
    assert.equal(validateEventForm({ ...valid, name }).name, "name");
  assert.deepEqual(validateEventForm({ ...valid, name: "Seminar 🥋" }), {});
  assert.equal(
    validateEventForm({ ...valid, name: "x".repeat(201) }).name,
    "name",
  );
  for (const startDate of [
    "2027-02-29",
    "2028-2-29",
    "0000-01-01",
    "2028-04-31",
    "2028-02-29T00:00:00Z",
  ])
    assert.equal(validateEventForm({ ...valid, startDate }).startDate, "date");
  assert.equal(
    validateEventForm({ ...valid, endDate: "2028-02-28" }).endDate,
    "dateOrder",
  );
});
test("timezone convenience remains an editable valid zone, never a raw offset", () => {
  for (const zone of ["UTC", "Europe/Sofia", "Pacific/Kiritimati"])
    assert.equal(isEventTimezone(zone), true);
  for (const zone of ["", "fake/zone", "+03:00", "-05:00", "UTC+3"])
    assert.equal(isEventTimezone(zone), false);
  assert.equal(isEventTimezone(browserEventTimezone()), true);
  assert.ok(eventTimezoneOptions("Europe/Sofia").includes("Europe/Sofia"));
  assert.ok(eventTimezoneOptions("fake/zone").every(isEventTimezone));
});
