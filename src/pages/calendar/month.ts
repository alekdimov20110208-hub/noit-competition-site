import { getCalendarDayNumber } from "../../domain/taskTiming.ts";
import type { Task } from "../../domain/types.ts";

const DAY_MS = 86_400_000;

export function currentMonth(now: Date): string {
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(month: string): number {
  if (!/^\d{4}-\d{2}$/.test(month) || month.startsWith("0000-"))
    throw new RangeError("Invalid calendar month");
  const day = getCalendarDayNumber(`${month}-01`);
  if (day === null) throw new RangeError("Invalid calendar month");
  return day;
}

export function shiftMonth(month: string, offset: -1 | 1): string | null {
  monthStart(month);
  const [year, number] = month.split("-").map(Number);
  const index = (year! - 1) * 12 + number! - 1 + offset;
  if (index < 0 || index >= 9999 * 12) return null;
  return `${String(Math.floor(index / 12) + 1).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// Monday first. UTC is only a Gregorian calculator; deadlines are never instants.
// Blank cells keep complete weeks without extrapolating business dates.
export function monthWeeks(month: string): (string | null)[][] {
  const start = monthStart(month);
  const leading = (new Date(start * DAY_MS).getUTCDay() + 6) % 7;
  const next = shiftMonth(month, 1);
  const days = next ? monthStart(next) - start : 31;
  const cells = Array.from(
    { length: Math.ceil((leading + days) / 7) * 7 },
    (_, i) => {
      const day = i - leading + 1;
      return day < 1 || day > days
        ? null
        : `${month}-${String(day).padStart(2, "0")}`;
    },
  );
  return Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
}

export function monthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(monthStart(month) * DAY_MS));
}

export function calendarDateLabel(date: string, locale: string): string {
  const day = getCalendarDayNumber(date);
  if (day === null) throw new RangeError("Invalid calendar date");
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

export function weekdayLabels(
  locale: string,
): { short: string; full: string }[] {
  const formatter = (weekday: "short" | "long", day: number) =>
    new Intl.DateTimeFormat(locale, { weekday, timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, day)),
    );
  return Array.from({ length: 7 }, (_, i) => ({
    short: formatter("short", i + 1),
    full: formatter("long", i + 1),
  }));
}

type CalendarTask = Pick<Task, "id" | "eventId" | "title" | "deadlineTime"> & {
  deadline?: string | null;
};

export function tasksByDay<T extends CalendarTask>(
  tasks: readonly T[],
  eventId: string,
  month: string,
): Map<string, T[]> {
  monthStart(month);
  const result = new Map<string, T[]>();
  for (const task of tasks) {
    if (
      task.eventId !== eventId ||
      !task.deadline?.startsWith(`${month}-`) ||
      getCalendarDayNumber(task.deadline) === null
    )
      continue;
    const day = result.get(task.deadline) ?? [];
    day.push(task);
    result.set(task.deadline, day);
  }
  for (const day of result.values())
    day.sort(
      (a, b) =>
        (a.deadlineTime ?? "").localeCompare(b.deadlineTime ?? "") ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );
  return result;
}
