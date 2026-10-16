import { getCalendarDayNumber } from "./taskTiming.ts";
import { isTaskDeadlineTime } from "./taskDeadlineTime.ts";

const firstDay = getCalendarDayNumber("0001-01-01")!;
const lastDay = getCalendarDayNumber("9999-12-31")!;

// startDate is the Event's stored local calendar date, never a timestamp.
// UTC fields are only a Gregorian calendar calculator, not the Event timezone.
export function resolveTemplateDate(
  startDate: string,
  dayOffset: number,
): string {
  const start = getCalendarDayNumber(startDate);
  if (start === null || start < firstDay || !Number.isSafeInteger(dayOffset))
    throw new RangeError("Invalid template date or calendar-day offset");
  const result = start + dayOffset;
  if (result < firstDay || result > lastDay)
    throw new RangeError("Template date is outside 0001–9999");
  const [year, month, day] = startDate.split("-").map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day + dayOffset);
  return calendar.toISOString().slice(0, 10);
}

export function resolveTemplateDeadline(
  startDate: string,
  dayOffset: number,
  localTime: string | null = null,
): { deadline: string; deadlineTime: string | null } {
  if (localTime !== null && !isTaskDeadlineTime(localTime))
    throw new RangeError("Invalid template local time");
  return {
    deadline: resolveTemplateDate(startDate, dayOffset),
    deadlineTime: localTime,
  };
}
