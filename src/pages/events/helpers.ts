import { getCalendarDayNumber } from "../../domain/taskTiming.ts";

export interface EventFormFields {
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
}
export type EventFieldError = "name" | "date" | "dateOrder" | "timezone";
export type EventFormErrors = Partial<
  Record<keyof EventFormFields, EventFieldError>
>;

export function isEventTimezone(value: string): boolean {
  if (!value || /^[+-]/.test(value) || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function browserEventTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isEventTimezone(timezone) ? timezone : "UTC";
}

export function validateEventForm(fields: EventFormFields): EventFormErrors {
  const errors: EventFormErrors = {};
  if (
    !fields.name.trim() ||
    fields.name.trim().length > 200 ||
    fields.name.includes("\u0000") ||
    /[\uD800-\uDFFF]/u.test(fields.name)
  )
    errors.name = "name";
  for (const field of ["startDate", "endDate"] as const) {
    if (
      fields[field].startsWith("0000-") ||
      getCalendarDayNumber(fields[field]) === null
    )
      errors[field] = "date";
  }
  if (!errors.startDate && !errors.endDate && fields.endDate < fields.startDate)
    errors.endDate = "dateOrder";
  if (!isEventTimezone(fields.timezone)) errors.timezone = "timezone";
  return errors;
}

export function eventTimezoneOptions(current: string): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  const supported = intl.supportedValuesOf?.("timeZone") ?? [
    "Europe/Sofia",
    "Europe/Kyiv",
    "America/New_York",
    "Asia/Tokyo",
  ];
  return [
    ...new Set([
      "UTC",
      ...supported,
      ...(isEventTimezone(current) ? [current] : []),
    ]),
  ].sort();
}
