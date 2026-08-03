const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function parseDate(value: string): Date {
  return value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
}

function formatOrFallback(
  formatter: Intl.DateTimeFormat,
  value: string,
): string {
  const date = parseDate(value);
  return Number.isFinite(date.getTime())
    ? formatter.format(date)
    : "Invalid date";
}

export function formatDate(value: string): string {
  return formatOrFallback(DATE_FORMATTER, value);
}

export function formatShortDate(value: string): string {
  return formatOrFallback(SHORT_DATE_FORMATTER, value);
}

export function formatDateTime(value: string): string {
  return formatOrFallback(DATE_TIME_FORMATTER, value);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
