import assert from "node:assert/strict";
import test from "node:test";
import {
  currentMonth,
  calendarDateLabel,
  monthLabel,
  monthWeeks,
  shiftMonth,
  tasksByDay,
  weekdayLabels,
} from "./month.ts";
import { createDemoWorkspace } from "../../data/demo.ts";
import { eventCalendarNow } from "../../services/taskReadState.ts";

test("month navigation crosses years and guards the canonical date range", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2027-01", -1), "2026-12");
  assert.equal(shiftMonth("0001-01", -1), null);
  assert.equal(shiftMonth("9999-12", 1), null);
  assert.equal(monthWeeks("9999-12").flat().filter(Boolean).length, 31);
  assert.equal(monthWeeks("0001-01")[0]![0], "0001-01-01");
});

test("Monday-first weeks include every date once and only blank padding", () => {
  const weeks = monthWeeks("2026-02");
  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks[0], [
    null,
    null,
    null,
    null,
    null,
    null,
    "2026-02-01",
  ]);
  assert.equal(weeks.flat().filter(Boolean).length, 28);
  assert.equal(monthWeeks("2021-02").length, 4);
  assert.equal(monthWeeks("2026-03").length, 6);
});

test("Gregorian leap and century rules hold over a full 400-year cycle", () => {
  for (let year = 2000; year < 2400; year++) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = monthWeeks(`${year}-02`).flat().filter(Boolean);
    assert.equal(days.length, leap ? 29 : 28);
    assert.equal(new Set(days).size, days.length);
  }
});

test("malformed months fail explicitly", () => {
  for (const month of [
    "2026-00",
    "2026-13",
    "0000-01",
    "10000-01",
    "26-01",
    "2026-1",
    "2026-02-03",
    "bad",
  ]) {
    assert.throws(() => monthWeeks(month), RangeError);
    assert.throws(() => shiftMonth(month, 1), RangeError);
  }
});

test("BG/EN headings use Gregorian month and Monday-first weekday names", () => {
  assert.match(monthLabel("2024-02", "en-GB"), /February 2024/);
  assert.match(monthLabel("2024-02", "bg-BG"), /февруари 2024/);
  assert.equal(weekdayLabels("en-GB")[0]!.full, "Monday");
  assert.equal(weekdayLabels("bg-BG")[6]!.full, "неделя");
});

test("grouping preserves canonical dates, local HH:mm, all statuses and Event isolation", () => {
  const task = createDemoWorkspace().tasks[0]!;
  const tasks = [
    {
      ...task,
      id: "date",
      eventId: "A",
      deadline: "2024-02-29",
      deadlineTime: null,
    },
    {
      ...task,
      id: "late",
      eventId: "A",
      deadline: "2024-02-29",
      deadlineTime: "23:59",
      status: "completed" as const,
    },
    {
      ...task,
      id: "early",
      eventId: "A",
      deadline: "2024-02-29",
      deadlineTime: "00:00",
    },
    { ...task, id: "foreign", eventId: "B", deadline: "2024-02-29" },
    { ...task, id: "other-month", eventId: "A", deadline: "2024-03-01" },
    { ...task, id: "invalid", eventId: "A", deadline: "2024-02-30" },
    { ...task, id: "missing", eventId: "A", deadline: null },
    { ...task, id: "blank", eventId: "A", deadline: "" },
    { ...task, id: "omitted", eventId: "A", deadline: undefined },
  ];
  const before = structuredClone(tasks);
  const result = tasksByDay(tasks, "A", "2024-02");
  assert.deepEqual([...result.keys()], ["2024-02-29"]);
  assert.deepEqual(
    result.get("2024-02-29")!.map((t) => [t.id, t.deadlineTime]),
    [
      ["date", null],
      ["early", "00:00"],
      ["late", "23:59"],
    ],
  );
  assert.deepEqual(tasks, before);
  assert.equal(tasksByDay(tasks, "missing", "2024-02").size, 0);
});

test("current month follows Event calendar near UTC midnight and across DST", () => {
  const instant = new Date("2027-01-01T01:00:00Z");
  assert.equal(
    currentMonth(eventCalendarNow(instant, "America/Los_Angeles")),
    "2026-12",
  );
  assert.equal(
    currentMonth(eventCalendarNow(instant, "Pacific/Kiritimati")),
    "2027-01",
  );
  for (const date of [
    "2026-03-29T00:30:00Z",
    "2026-03-29T02:30:00Z",
    "2026-10-25T00:30:00Z",
    "2026-10-25T02:30:00Z",
  ])
    assert.equal(
      monthWeeks(currentMonth(eventCalendarNow(new Date(date), "Europe/Sofia")))
        .flat()
        .includes(date.slice(0, 10)),
      true,
    );
});

test("calendar arithmetic and localized month names do not shift with host timezone", () => {
  const original = process.env.TZ;
  try {
    for (const tz of [
      "UTC",
      "America/Los_Angeles",
      "Europe/Sofia",
      "Pacific/Kiritimati",
      "Pacific/Apia",
    ]) {
      process.env.TZ = tz;
      assert.equal(
        monthWeeks("2024-02").flat().filter(Boolean).at(-1),
        "2024-02-29",
      );
      assert.match(monthLabel("2026-03", "en-GB"), /March 2026/);
      assert.equal(
        calendarDateLabel("2011-12-30", "en-GB"),
        "30 December 2011",
      );
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
