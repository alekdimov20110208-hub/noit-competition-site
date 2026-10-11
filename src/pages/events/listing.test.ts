import assert from "node:assert/strict";
import test from "node:test";
import { filterEvents, canEditEvent } from "./listing.ts";
import type { TaskEvent } from "../../services/RemoteWorkspaceService.ts";

const member: TaskEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Семинар Sofia",
  startDate: "2026-10-09",
  endDate: "2026-10-10",
  timezone: "Europe/Sofia",
  archived: false,
  membership: {
    id: "00000000-0000-4000-8000-000000000002",
    accessRole: "MEMBER",
  },
  version: 1,
  createdAt: "2026-10-09T00:00:00Z",
  updatedAt: "2026-10-09T00:00:00Z",
};
const organizer = {
  ...member,
  id: "00000000-0000-4000-8000-000000000003",
  name: "Organizer Event",
  membership: { ...member.membership, accessRole: "ORGANIZER" as const },
};
const archived = {
  ...organizer,
  id: "00000000-0000-4000-8000-000000000004",
  archived: true,
};
const events = [member, organizer, archived];

test("Active and Archived filters preserve only supplied authorized Events", () => {
  assert.deepEqual(filterEvents(events, false, ""), [member, organizer]);
  assert.deepEqual(filterEvents(events, true, ""), [archived]);
  assert.deepEqual(filterEvents([], false, ""), []);
  assert.deepEqual(events, [member, organizer, archived]);
});
test("Event-name search trims and matches BG/EN case and Unicode normalization", () => {
  for (const query of ["  СОФИЯ-NO-MATCH  ", "Europe/Sofia", "MEMBER"])
    assert.deepEqual(filterEvents(events, false, query), []);
  assert.deepEqual(filterEvents(events, false, "  СЕМИНАР  "), [member]);
  assert.deepEqual(filterEvents(events, false, " SOFIA "), [member]);
  assert.deepEqual(
    filterEvents([{ ...member, name: "Café" }], false, "Cafe\u0301"),
    [{ ...member, name: "Café" }],
  );
  assert.deepEqual(filterEvents(events, true, "ORGANIZER"), [archived]);
});
test("Edit requires active same-Event Organizer membership", () => {
  assert.equal(canEditEvent(member), false);
  assert.equal(canEditEvent(organizer), true);
  assert.equal(canEditEvent(archived), false);
  assert.equal(canEditEvent({ ...member, archived: true }), false);
});
