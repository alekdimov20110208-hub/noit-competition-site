import { getCalendarDayNumber } from "../../domain/taskTiming.ts";
import { currentMonth, shiftMonth } from "./month.ts";

export const CALENDAR_VIEWS = ["month", "week", "list"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];
export interface CalendarLocation {
  view: CalendarView;
  date: string | null;
}

const DAY_MS = 86_400_000;

export function isCalendarDate(date: string): boolean {
  return !date.startsWith("0000-") && getCalendarDayNumber(date) !== null;
}

export function parseCalendarLocation(search: string): CalendarLocation {
  const params = new URLSearchParams(search);
  const views = params.getAll("view");
  const dates = params.getAll("date");
  return {
    view:
      (views.length === 1
        ? CALENDAR_VIEWS.find((view) => view === views[0])
        : undefined) ?? "month",
    date: dates.length === 1 && isCalendarDate(dates[0]!) ? dates[0]! : null,
  };
}

export function currentCalendarDate(now: Date): string {
  return `${currentMonth(now)}-${String(now.getDate()).padStart(2, "0")}`;
}

function ordinal(date: string): number {
  const day = getCalendarDayNumber(date);
  if (day === null || date.startsWith("0000-"))
    throw new RangeError("Invalid calendar date");
  return day;
}

function dateAt(day: number): string | null {
  const iso = new Date(day * DAY_MS).toISOString();
  return /^\d{4}-/.test(iso) && !iso.startsWith("0000-")
    ? iso.slice(0, 10)
    : null;
}

// UTC is a Gregorian day calculator. No deadline is converted to an instant.
export function weekDates(date: string): (string | null)[] {
  const day = ordinal(date);
  const monday = day - ((new Date(day * DAY_MS).getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => dateAt(monday + index));
}

export function shiftCalendarDate(
  date: string,
  view: Exclude<CalendarView, "list">,
  offset: -1 | 1,
): string | null {
  if (view === "week") return dateAt(ordinal(date) + offset * 7);
  const month = shiftMonth(date.slice(0, 7), offset);
  return month ? `${month}-01` : null;
}

type AgendaTask = {
  id: string;
  eventId: string;
  title: string;
  deadline?: string | null;
  deadlineTime: string | null;
};

export function groupAgenda<T extends AgendaTask>(
  tasks: readonly T[],
  eventId: string,
) {
  const groups = new Map<string, T[]>();
  const undated: T[] = [];
  for (const task of tasks) {
    if (task.eventId !== eventId) continue;
    if (!task.deadline) {
      undated.push(task);
    } else if (isCalendarDate(task.deadline)) {
      const group = groups.get(task.deadline) ?? [];
      group.push(task);
      groups.set(task.deadline, group);
    }
  }
  const compareTitle = (a: T, b: T) =>
    a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  const dated = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      tasks: items.sort(
        (a, b) =>
          (a.deadlineTime ?? "").localeCompare(b.deadlineTime ?? "") ||
          compareTitle(a, b),
      ),
    }));
  return { dated, undated: undated.sort(compareTitle) };
}
