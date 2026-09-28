import type { Task } from "./types.ts";

export type DeadlineTiming = "overdue" | "today" | "near" | "later" | "invalid";

const DAY_MS = 86_400_000;

// A calendar ordinal, not a deadline instant. UTC arithmetic avoids 23/25-hour
// DST days; the reference date's year/month/day always come from LOCAL time.
export function getCalendarDayNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day!);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date.getTime() / DAY_MS;
}

export function getCalendarDaysFromNow(
  deadline: string,
  now: Date,
): number | null {
  const dueDay = getCalendarDayNumber(deadline);
  if (dueDay === null || !Number.isFinite(now.getTime())) return null;
  const localDay = new Date(0);
  localDay.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDay - localDay.getTime() / DAY_MS;
}

export function getDeadlineTiming(deadline: string, now: Date): DeadlineTiming {
  const days = getCalendarDaysFromNow(deadline, now);
  if (days === null) return "invalid";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return days <= 7 ? "near" : "later";
}

export function isTaskOverdue(task: Task, now = new Date()): boolean {
  return (
    task.status !== "completed" &&
    getDeadlineTiming(task.deadline, now) === "overdue"
  );
}

export function isUpcomingTask(task: Task, now: Date): boolean {
  const timing = getDeadlineTiming(task.deadline, now);
  return (
    task.status !== "completed" && timing !== "overdue" && timing !== "invalid"
  );
}

export function compareDeadlineDates(first: string, second: string): number {
  const firstDay = getCalendarDayNumber(first) ?? Number.POSITIVE_INFINITY;
  const secondDay = getCalendarDayNumber(second) ?? Number.POSITIVE_INFINITY;
  return firstDay === secondDay ? 0 : firstDay - secondDay;
}
