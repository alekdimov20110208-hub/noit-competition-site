import { getCalendarDayNumber } from "../domain/taskTiming.ts";
import type { Event, Task, TeamMember } from "../domain/types.ts";

export type TaskAssignee = Pick<TeamMember, "id" | "name" | "role">;
export type TaskEvent = Pick<Event, "id" | "name" | "startDate" | "endDate"> & {
  timezone: string;
  membership: { id: string; accessRole: "ORGANIZER" | "MEMBER" };
};
export interface RemoteTask extends Task {
  assignedMemberId: string | null;
  acceptedByMemberId: string | null;
  acceptedAt: string | null;
  version: number;
}
export interface TasksWorkspace {
  currentEventId: string;
  events: TaskEvent[];
  teamMembers: TaskAssignee[];
  tasks: RemoteTask[];
}
export function emptyTasksWorkspace(): TasksWorkspace {
  return { currentEventId: "", events: [], teamMembers: [], tasks: [] };
}
export type WorkspaceReadError =
  "unauthenticated" | "forbidden" | "unavailable" | "invalid";
export class WorkspaceReadFailure extends Error {
  readonly code: WorkspaceReadError;
  constructor(code: WorkspaceReadError) {
    super("Workspace read failed.");
    this.code = code;
  }
}

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function invalid(): never {
  throw new WorkspaceReadFailure("invalid");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
}
function string(value: unknown): string {
  return typeof value === "string" ? value : invalid();
}
function id(value: unknown): string {
  const result = string(value);
  return uuid.test(result) ? result.toLowerCase() : invalid();
}
function nullableId(value: unknown): string | null {
  return value === null ? null : id(value);
}
function date(value: unknown): string {
  const result = string(value);
  return getCalendarDayNumber(result) === null ? invalid() : result;
}
function instant(value: unknown): string {
  const result = string(value);
  return /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(result) &&
    Number.isFinite(Date.parse(result))
    ? result
    : invalid();
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : invalid();
}
function uniqueIds(values: { id: string }[]) {
  if (new Set(values.map((value) => value.id)).size !== values.length)
    invalid();
}

export function readAccessibleEvents(value: unknown): TaskEvent[] {
  const events = array(record(value).events).map<TaskEvent>((value) => {
    const row = record(value),
      member = record(row.membership);
    const timezone = string(row.timezone);
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      invalid();
    }
    const accessRole = member.accessRole;
    if (accessRole !== "ORGANIZER" && accessRole !== "MEMBER") invalid();
    const startDate = date(row.startDate),
      endDate = date(row.endDate);
    if (endDate < startDate) invalid();
    return {
      id: id(row.id),
      name: string(row.name),
      startDate,
      endDate,
      timezone,
      membership: { id: id(member.id), accessRole },
    };
  });
  uniqueIds(events);
  return events;
}

// Temporary P1 selection: earliest startDate, then opaque ID. Never a stored
// privileged ID or an email/name guess. Each subsequent server read authorizes.
export function selectAccessibleEvent(
  events: readonly TaskEvent[],
): TaskEvent | null {
  return (
    [...events].sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
    )[0] ?? null
  );
}

export function mapTaskRead(event: TaskEvent, value: unknown): TasksWorkspace {
  const body = record(value);
  const teamMembers = array(body.members).map((value) => {
    const row = record(value);
    return { id: id(row.id), name: string(row.name), role: string(row.role) };
  });
  uniqueIds(teamMembers);
  const tasks = array(body.tasks).map<RemoteTask>((value) => {
    const row = record(value);
    const status = row.status,
      priority = row.priority;
    if (
      status !== "not-started" &&
      status !== "in-progress" &&
      status !== "blocked" &&
      status !== "completed"
    )
      invalid();
    if (
      priority !== "normal" &&
      priority !== "important" &&
      priority !== "critical"
    )
      invalid();
    const assignedMemberId = nullableId(row.assignedMemberId);
    const acceptedByMemberId = nullableId(row.acceptedByMemberId);
    const acceptedAt = row.acceptedAt === null ? null : instant(row.acceptedAt);
    if (
      typeof row.accepted !== "boolean" ||
      row.accepted !== (acceptedByMemberId !== null) ||
      (acceptedAt === null) !== (acceptedByMemberId === null) ||
      (acceptedByMemberId !== null &&
        acceptedByMemberId !== assignedMemberId) ||
      !Number.isSafeInteger(row.version) ||
      (row.version as number) < 1 ||
      (assignedMemberId !== null &&
        !teamMembers.some((member) => member.id === assignedMemberId))
    )
      invalid();
    return {
      id: id(row.id),
      eventId: event.id,
      title: string(row.title),
      category: string(row.category),
      context: string(row.context),
      deadline: date(row.deadline),
      status,
      priority,
      ownerId: assignedMemberId ?? "",
      acknowledged: row.accepted,
      blockedBy: string(row.blockedBy),
      blocks: string(row.blocks),
      assignedMemberId,
      acceptedByMemberId,
      acceptedAt,
      version: row.version as number,
      updatedAt: instant(row.updatedAt),
    };
  });
  uniqueIds(tasks);
  return { currentEventId: event.id, events: [event], teamMembers, tasks };
}

export interface TasksReadService {
  readTasks(signal: AbortSignal): Promise<TasksWorkspace>;
}

export class RemoteWorkspaceService implements TasksReadService {
  private request: typeof fetch;
  constructor(request: typeof fetch = fetch) {
    this.request = request;
  }

  private async get(path: string, signal: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      // Native window.fetch requires the Window receiver (or no receiver).
      // Do not invoke it as a method on this adapter instance.
      const request = this.request;
      response = await request(path, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      });
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new WorkspaceReadFailure("unavailable");
    }
    if (response.status === 401)
      throw new WorkspaceReadFailure("unauthenticated");
    if (response.status === 403 || response.status === 404)
      throw new WorkspaceReadFailure("forbidden");
    if (!response.ok) throw new WorkspaceReadFailure("unavailable");
    try {
      return await response.json();
    } catch {
      throw new WorkspaceReadFailure("invalid");
    }
  }

  async readTasks(signal: AbortSignal): Promise<TasksWorkspace> {
    const event = selectAccessibleEvent(
      readAccessibleEvents(await this.get("/api/events", signal)),
    );
    if (!event) return emptyTasksWorkspace();
    signal.throwIfAborted();
    return mapTaskRead(
      event,
      await this.get(
        `/api/events/${encodeURIComponent(event.id)}/tasks`,
        signal,
      ),
    );
  }
}
