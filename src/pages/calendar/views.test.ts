import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnTo } from "../../auth/routing.ts";
import { calendarHref, parseAppLocation } from "../../routes.ts";
import { eventCalendarNow } from "../../services/taskReadState.ts";
import {
  currentCalendarDate,
  groupAgenda,
  parseCalendarLocation,
  shiftCalendarDate,
  weekDates,
} from "./views.ts";

test("Calendar navigation round-trips view and date through routing and login", () => {
  const eventId = "5c63b06d-fd52-4b13-8a0e-0df55490a919";
  const location = { view: "week", date: "2028-02-29" } as const;
  const href = calendarHref(eventId, location);
  const url = new URL(href, "http://localhost");
  assert.deepEqual(
    parseAppLocation(url.pathname, url.search).calendar,
    location,
  );
  assert.equal(safeReturnTo(href + "&ignored=x"), href);
  assert.equal(safeReturnTo("/calendar?view=list"), "/calendar?view=list");
  assert.deepEqual(
    parseCalendarLocation("?view=week&view=list&date=2027-02-29"),
    {
      view: "month",
      date: null,
    },
  );
  assert.deepEqual(parseCalendarLocation("?view=list&date=0000-01-01"), {
    view: "list",
    date: null,
  });
  assert.equal(
    parseCalendarLocation("?date=2028-01-01&date=2028-01-02").date,
    null,
  );
  assert.equal(parseAppLocation("/tasks", url.search).calendar, undefined);
});

test("Week uses Monday to Sunday across leap days and year boundaries", () => {
  assert.deepEqual(weekDates("2028-02-29"), [
    "2028-02-28",
    "2028-02-29",
    "2028-03-01",
    "2028-03-02",
    "2028-03-03",
    "2028-03-04",
    "2028-03-05",
  ]);
  const december = weekDates("2026-12-31");
  assert.equal(december[0], "2026-12-28");
  assert.equal(december.at(-1), "2027-01-03");
  assert.equal(shiftCalendarDate("2028-02-29", "week", 1), "2028-03-07");
  assert.equal(shiftCalendarDate("2028-02-29", "month", -1), "2028-01-01");
  assert.equal(shiftCalendarDate("9999-12-31", "week", 1), null);
  assert.equal(shiftCalendarDate("0001-01-01", "week", -1), null);
});

test("Event-local dates and civil weeks survive spring and autumn DST transitions", () => {
  const instant = new Date("2026-03-29T21:30:00Z");
  assert.equal(
    currentCalendarDate(eventCalendarNow(instant, "Europe/Sofia")),
    "2026-03-30",
  );
  assert.equal(
    currentCalendarDate(eventCalendarNow(instant, "America/Los_Angeles")),
    "2026-03-29",
  );
  assert.equal(weekDates("2026-03-29").at(-1), "2026-03-29");
  assert.equal(shiftCalendarDate("2026-10-25", "week", 1), "2026-11-01");
  const repeats = ["2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z"];
  for (const timestamp of repeats) {
    assert.equal(
      currentCalendarDate(
        eventCalendarNow(new Date(timestamp), "Europe/Sofia"),
      ),
      "2026-10-25",
    );
  }
});

test("Agenda keeps Event scope, deadline precision and stable ordering for ties", () => {
  const task = (
    id: string,
    deadline: string | null,
    deadlineTime: string | null,
    eventId = "event",
  ) => ({ id, eventId, title: "Same title", deadline, deadlineTime });
  const rows = [
    task("z", "2026-10-25", "03:30"),
    task("undated", null, null),
    task("foreign", "2026-10-25", null, "other"),
    task("after", "2026-10-26", "00:15"),
    task("a", "2026-10-25", "03:30"),
    task("day", "2026-10-25", null),
    task("earlier", "2026-10-25", "01:00"),
  ];
  const { dated, undated } = groupAgenda(rows, "event");
  assert.deepEqual(
    dated.map(({ date }) => date),
    ["2026-10-25", "2026-10-26"],
  );
  assert.deepEqual(
    dated[0]?.tasks.map(({ id }) => id),
    ["day", "earlier", "a", "z"],
  );
  assert.equal(dated[0]?.tasks[0]?.deadlineTime, null);
  assert.deepEqual(undated, [rows[1]]);
  assert.deepEqual(groupAgenda(rows, "empty"), { dated: [], undated: [] });
});
