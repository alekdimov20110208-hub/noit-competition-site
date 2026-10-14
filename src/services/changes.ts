import { getCalendarDayNumber } from "../domain/taskTiming.ts";
import { isTaskDeadlineTime } from "../domain/taskDeadlineTime.ts";
import type { TaskStatus } from "../domain/types.ts";
import type { TaskAssignee } from "./RemoteWorkspaceService.ts";

export interface ChangeImpactTask {
  id: string;
  title: string;
  status: TaskStatus;
  assignedMember: TaskAssignee | null;
  deadline: string | null;
  deadlineTime: string | null;
}
export interface RemoteChange {
  id: string;
  eventId: string;
  title: string;
  context: string;
  reporter: TaskAssignee;
  responseOwner: TaskAssignee | null;
  decision: {
    text: string;
    authoredBy: TaskAssignee;
    createdAt: string;
    updatedAt: string;
  } | null;
  response: string | null;
  planB: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  affectedTasks: ChangeImpactTask[];
  removedTasks?: { id: string; title: string }[];
  removedTaskCount?: number;
  impact: { taskCount: number; people: TaskAssignee[]; deadlines: string[] };
}
export interface ChangeFields {
  title: string;
  context: string;
  responseOwnerMemberId: string | null;
  affectedTaskIds: string[];
  decision: string | null;
  response: string | null;
  planB: string | null;
}
export type ChangeFieldErrors = Partial<
  Record<keyof ChangeFields | "expectedVersion", string>
>;
export type ChangeError =
  | "invalid"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "unavailable";
export class ChangeFailure extends Error {
  readonly code: ChangeError;
  readonly fields: ChangeFieldErrors;
  constructor(code: ChangeError, fields: ChangeFieldErrors = {}) {
    super("Change request failed.");
    this.code = code;
    this.fields = fields;
  }
}
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function invalid(): never {
  throw new ChangeFailure("invalid");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
}
function text(value: unknown): string {
  return typeof value === "string" ? value : invalid();
}
function id(value: unknown): string {
  const valueId = text(value);
  return uuid.test(valueId) ? valueId.toLowerCase() : invalid();
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : invalid();
}
function member(value: unknown): TaskAssignee {
  const row = record(value);
  return { id: id(row.id), name: text(row.name), role: text(row.role) };
}
function date(value: unknown): string {
  const day = text(value);
  return getCalendarDayNumber(day) !== null && !day.startsWith("0000-")
    ? day
    : invalid();
}
function instant(value: unknown): string {
  const time = text(value);
  return /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(time) &&
    Number.isFinite(Date.parse(time))
    ? time
    : invalid();
}
function unique(values: readonly string[]) {
  if (new Set(values).size !== values.length) invalid();
}
function responseText(value: unknown, limit: number): string | null {
  if (value === null) return null;
  const result = text(value);
  if (
    !result.trim() ||
    result.length > limit ||
    result.includes("\u0000") ||
    /[\uD800-\uDFFF]/u.test(result)
  )
    invalid();
  return result;
}
export function readRemoteChange(
  value: unknown,
  eventId: string,
  changeId?: string,
): RemoteChange {
  const row = record(value);
  const change = id(row.id),
    event = id(row.eventId);
  if (event !== id(eventId) || (changeId && change !== id(changeId))) invalid();
  if (
    !Number.isSafeInteger(row.version) ||
    (row.version as number) < 1 ||
    (row.version as number) > 2147483647
  )
    invalid();
  const affectedTasks = array(row.affectedTasks).map(
    (value): ChangeImpactTask => {
      const task = record(value);
      if (
        task.deadlineTime !== null &&
        (!isTaskDeadlineTime(task.deadlineTime) || task.deadline === null)
      )
        invalid();
      if (
        !["not-started", "in-progress", "blocked", "completed"].includes(
          task.status as string,
        )
      )
        invalid();
      return {
        id: id(task.id),
        title: text(task.title),
        status: task.status as TaskStatus,
        assignedMember:
          task.assignedMember === null ? null : member(task.assignedMember),
        deadline: task.deadline === null ? null : date(task.deadline),
        deadlineTime: task.deadlineTime as string | null,
      };
    },
  );
  unique(affectedTasks.map((task) => task.id));
  const impact = record(row.impact),
    people = array(impact.people).map(member),
    deadlines = array(impact.deadlines).map(date);
  unique(people.map((person) => person.id));
  unique(deadlines);
  // Validate the server projection; rendering always uses its canonical summary.
  const expectedPeople = [
    ...new Map(
      affectedTasks.flatMap((task) =>
        task.assignedMember
          ? [[task.assignedMember.id, task.assignedMember] as const]
          : [],
      ),
    ).values(),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const expectedDates = [
    ...new Set(
      affectedTasks.flatMap((task) => (task.deadline ? [task.deadline] : [])),
    ),
  ].sort();
  if (
    impact.taskCount !== affectedTasks.length ||
    JSON.stringify(people) !== JSON.stringify(expectedPeople) ||
    JSON.stringify(deadlines) !== JSON.stringify(expectedDates)
  )
    invalid();
  if (
    row.removedTaskCount !== undefined &&
    (!Number.isSafeInteger(row.removedTaskCount) ||
      (row.removedTaskCount as number) < array(row.removedTasks).length)
  )
    invalid();
  if (row.removedTasks !== undefined && array(row.removedTasks).length > 50)
    invalid();
  const title = text(row.title),
    context = text(row.context);
  if (!title.trim() || title.length > 200 || context.length > 5000) invalid();
  let decision: RemoteChange["decision"] = null;
  if (row.decision !== null) {
    const current = record(row.decision);
    const decisionText = responseText(current.text, 2000);
    if (decisionText === null) invalid();
    decision = {
      text: decisionText,
      authoredBy: member(current.authoredBy),
      createdAt: instant(current.createdAt),
      updatedAt: instant(current.updatedAt),
    };
    if (Date.parse(decision.updatedAt) < Date.parse(decision.createdAt))
      invalid();
  }
  return {
    id: change,
    eventId: event,
    title,
    context,
    reporter: member(row.reporter),
    responseOwner:
      row.responseOwner === null ? null : member(row.responseOwner),
    decision,
    response: responseText(row.response, 5000),
    planB: responseText(row.planB, 5000),
    version: row.version as number,
    createdAt: instant(row.createdAt),
    updatedAt: instant(row.updatedAt),
    affectedTasks,
    ...(row.removedTaskCount === undefined
      ? {}
      : { removedTaskCount: row.removedTaskCount as number }),
    ...(row.removedTasks === undefined
      ? {}
      : {
          removedTasks: array(row.removedTasks).map((value) => {
            const task = record(value);
            return { id: id(task.id), title: text(task.title) };
          }),
        }),
    impact: { taskCount: affectedTasks.length, people, deadlines },
  };
}
export function authoredChange(change: RemoteChange): ChangeFields {
  return {
    title: change.title,
    context: change.context,
    responseOwnerMemberId: change.responseOwner?.id ?? null,
    affectedTaskIds: change.affectedTasks.map((task) => task.id).sort(),
    decision: change.decision?.text ?? null,
    response: change.response,
    planB: change.planB,
  };
}
export function validateChangeFields(fields: ChangeFields): ChangeFieldErrors {
  const errors: ChangeFieldErrors = {};
  for (const [key, limit] of [
    ["title", 200],
    ["context", 5000],
  ] as const) {
    const value = fields[key].trim();
    if (
      (key === "title" && !value) ||
      value.length > limit ||
      value.includes("\u0000") ||
      /[\uD800-\uDFFF]/u.test(value)
    )
      errors[key] = "INVALID_TEXT";
  }
  for (const [key, limit] of [
    ["decision", 2000],
    ["response", 5000],
    ["planB", 5000],
  ] as const) {
    const value = fields[key];
    if (
      value !== null &&
      (!value.trim() ||
        value.trim().length > limit ||
        value.includes("\u0000") ||
        /[\uD800-\uDFFF]/u.test(value))
    )
      errors[key] = "INVALID_TEXT";
  }
  if (fields.responseOwnerMemberId && !uuid.test(fields.responseOwnerMemberId))
    errors.responseOwnerMemberId = "INVALID_OWNER";
  if (
    fields.affectedTaskIds.length > 1000 ||
    fields.affectedTaskIds.some((value) => !uuid.test(value))
  )
    errors.affectedTaskIds = "INVALID_TASKS";
  return errors;
}
export class ChangeService {
  private request: typeof fetch;
  constructor(request: typeof fetch = fetch) {
    this.request = request;
  }
  private async send(
    path: string,
    signal: AbortSignal,
    method: "GET" | "POST" | "PATCH" = "GET",
    body?: object,
  ): Promise<unknown> {
    let response: Response;
    try {
      const request = this.request;
      response = await request(path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
        ...(body
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new ChangeFailure("unavailable");
    }
    signal.throwIfAborted();
    if (!response.ok) {
      const codes: Record<number, ChangeError> = {
        400: "invalid",
        401: "unauthenticated",
        403: "forbidden",
        404: "not-found",
        409: "conflict",
      };
      const fields: ChangeFieldErrors = {};
      if (response.status === 400) {
        try {
          const raw = record(record(await response.json()).fields);
          const allowed = {
            title: "INVALID_TEXT",
            context: "INVALID_TEXT",
            responseOwnerMemberId: "INVALID_OWNER",
            affectedTaskIds: "INVALID_TASKS",
            expectedVersion: "INVALID_VERSION",
            decision: "INVALID_TEXT",
            response: "INVALID_TEXT",
            planB: "INVALID_TEXT",
          };
          for (const key of Object.keys(allowed) as (keyof typeof allowed)[])
            if (raw[key] === allowed[key]) fields[key] = allowed[key];
        } catch {
          /* Only fixed field codes cross the boundary. */
        }
      }
      throw new ChangeFailure(codes[response.status] ?? "unavailable", fields);
    }
    try {
      const value: unknown = await response.json();
      signal.throwIfAborted();
      return value;
    } catch {
      if (signal.aborted) throw signal.reason;
      invalid();
    }
  }
  async list(eventId: string, signal: AbortSignal): Promise<RemoteChange[]> {
    const event = id(eventId);
    const result = array(
      record(await this.send(`/api/events/${event}/changes`, signal)).changes,
    ).map((value) => readRemoteChange(value, event));
    unique(result.map((change) => change.id));
    signal.throwIfAborted();
    return result;
  }
  async get(
    eventId: string,
    changeId: string,
    signal: AbortSignal,
  ): Promise<RemoteChange> {
    const event = id(eventId),
      change = id(changeId);
    const result = readRemoteChange(
      record(await this.send(`/api/events/${event}/changes/${change}`, signal))
        .change,
      event,
      change,
    );
    signal.throwIfAborted();
    return result;
  }
  async save(
    eventId: string,
    fields: ChangeFields,
    signal: AbortSignal,
    edit?: { id: string; expectedVersion: number },
  ): Promise<RemoteChange> {
    const event = id(eventId),
      change = edit ? id(edit.id) : undefined;
    const body = {
      title: fields.title.trim(),
      context: fields.context.trim(),
      responseOwnerMemberId: fields.responseOwnerMemberId,
      affectedTaskIds: [...new Set(fields.affectedTaskIds)].sort(),
      decision: fields.decision === null ? null : fields.decision.trim(),
      response: fields.response === null ? null : fields.response.trim(),
      planB: fields.planB === null ? null : fields.planB.trim(),
      ...(edit ? { expectedVersion: edit.expectedVersion } : {}),
    };
    const result = readRemoteChange(
      record(
        await this.send(
          `/api/events/${event}/changes${change ? `/${change}` : ""}`,
          signal,
          edit ? "PATCH" : "POST",
          body,
        ),
      ).change,
      event,
      change,
    );
    if (!edit && result.version !== 1) invalid();
    signal.throwIfAborted();
    return result;
  }
}
