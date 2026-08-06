import type { Language } from "../preferences/types.ts";
import { translate } from "./messages.ts";

export const LANGUAGE_LOCALES: Record<Language, string> = {
  bg: "bg-BG",
  en: "en-GB",
};

export type DateInput = Date | string;

function parseDate(value: DateInput): Date | null {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00`)
        : new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
}

function formatDateValue(
  language: Language,
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = parseDate(value);
  if (!date) return translate(language, "common.invalidDate");
  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], options).format(
    date,
  );
}

export function formatDate(language: Language, value: DateInput): string {
  return formatDateValue(language, value, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(language: Language, value: DateInput): string {
  return formatDateValue(language, value, {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(language: Language, value: DateInput): string {
  return formatDateValue(language, value, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateRange(
  language: Language,
  startValue: DateInput,
  endValue: DateInput,
): string {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end) return translate(language, "common.invalidDate");

  const formatter = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  try {
    return formatter.formatRange(start, end);
  } catch {
    return `${formatter.format(start)} – ${formatter.format(end)}`;
  }
}

export function formatNumber(
  language: Language,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(LANGUAGE_LOCALES[language], options).format(
    value,
  );
}

/** Formats an application percentage expressed from 0 to 100. */
export function formatPercent(language: Language, value: number): string {
  return new Intl.NumberFormat(LANGUAGE_LOCALES[language], {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function calendarDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatRelativeDate(
  language: Language,
  value: DateInput,
  now: Date = new Date(),
): string {
  const target = parseDate(value);
  if (!target || !Number.isFinite(now.getTime())) {
    return translate(language, "common.invalidDate");
  }

  const millisecondsPerDay = 86_400_000;
  const dayDifference = Math.round(
    (calendarDayNumber(target) - calendarDayNumber(now)) / millisecondsPerDay,
  );

  return new Intl.RelativeTimeFormat(LANGUAGE_LOCALES[language], {
    numeric: "auto",
  }).format(dayDifference, "day");
}
