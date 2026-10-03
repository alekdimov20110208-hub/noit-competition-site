import type { AccessRole } from "../authorization/events.ts";

export interface EventFields {
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
}

export interface AccessibleEvent extends EventFields {
  id: string;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  membership: { id: string; accessRole: AccessRole };
}

export interface EventRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  timezone: string;
  archived_at: Date | null;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export type EventFieldErrors = Partial<
  Record<keyof EventFields | "expectedVersion", string>
>;

export class EventCommandError extends Error {
  readonly statusCode: 400 | 403 | 404 | 409;
  readonly code: string;
  readonly fields?: EventFieldErrors;

  constructor(
    statusCode: 400 | 403 | 404 | 409,
    code: string,
    fields?: EventFieldErrors,
  ) {
    super(code);
    this.name = "EventCommandError";
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

// Calendar dates stay as strings throughout the command. No local/UTC instant
// conversion, rollover normalization, or implementation-defined Date parsing.
export function validEventDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

export function validEventTimezone(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 100 ||
    !/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(value) ||
    /^(posix\/|right\/)/.test(value) ||
    ["localtime", "posixrules"].includes(value)
  )
    return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function parseEventCommand(
  input: unknown,
  editing = false,
): EventFields & { expectedVersion?: number } {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new EventCommandError(400, "INVALID_EVENT_COMMAND");
  const body = input as Record<string, unknown>;
  const allowed = [
    "name",
    "startDate",
    "endDate",
    "timezone",
    ...(editing ? ["expectedVersion"] : []),
  ];
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new EventCommandError(400, "INVALID_EVENT_COMMAND");
  const fields: EventFieldErrors = {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  // In Unicode mode valid surrogate pairs are single astral code points; this
  // range matches only malformed lone surrogates that PostgreSQL JSONB rejects.
  if (
    !name ||
    name.length > 200 ||
    name.includes("\u0000") ||
    /[\uD800-\uDFFF]/u.test(name)
  )
    fields.name = "INVALID_NAME";
  if (!validEventDate(body.startDate)) fields.startDate = "INVALID_DATE";
  if (!validEventDate(body.endDate)) fields.endDate = "INVALID_DATE";
  if (
    !fields.startDate &&
    !fields.endDate &&
    (body.endDate as string) < (body.startDate as string)
  )
    fields.endDate = "END_BEFORE_START";
  if (!validEventTimezone(body.timezone)) fields.timezone = "INVALID_TIMEZONE";
  if (
    editing &&
    (!Number.isSafeInteger(body.expectedVersion) ||
      (body.expectedVersion as number) < 1 ||
      (body.expectedVersion as number) >= 2147483647)
  )
    fields.expectedVersion = "INVALID_VERSION";
  if (Object.keys(fields).length)
    throw new EventCommandError(400, "INVALID_EVENT_COMMAND", fields);
  return {
    name,
    startDate: body.startDate as string,
    endDate: body.endDate as string,
    timezone: body.timezone as string,
    ...(editing ? { expectedVersion: body.expectedVersion as number } : {}),
  };
}

export const eventColumns = `id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date,
  to_char(end_date, 'YYYY-MM-DD') AS end_date, timezone, archived_at, version, created_at, updated_at`;

export function eventDto(
  row: EventRow,
  membership: AccessibleEvent["membership"],
): AccessibleEvent {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    timezone: row.timezone,
    archived: row.archived_at !== null,
    version: row.version,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : row.created_at.toISOString(),
    updatedAt:
      typeof row.updated_at === "string"
        ? row.updated_at
        : row.updated_at.toISOString(),
    membership,
  };
}
