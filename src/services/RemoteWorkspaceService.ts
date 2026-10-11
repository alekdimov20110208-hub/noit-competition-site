import { getCalendarDayNumber } from "../domain/taskTiming.ts";
import { isTaskDeadlineTime } from "../domain/taskDeadlineTime.ts";
import { validReminderOffsets } from "../domain/taskReminders.ts";
import type { Event, Task, TaskStatus, TeamMember } from "../domain/types.ts";
import type { TaskFields, TaskFieldErrors } from "./taskAuthoring.ts";
import { InvitationService } from "./invitations.ts";
import { readEventHistory } from "./eventHistory.ts";
import {
  ChangeService,
  ChangeFailure,
  type RemoteChange,
  type ChangeError,
} from "./changes.ts";

export type TaskAssignee = Pick<TeamMember, "id" | "name" | "role">;
export type TaskEvent = Pick<Event, "id" | "name" | "startDate" | "endDate"> & {
  timezone: string;
  archived: boolean;
  membership: { id: string; accessRole: "ORGANIZER" | "MEMBER" };
  version: number;
  createdAt: string;
  updatedAt: string;
};
export interface RemoteTask extends Task {
  reminderOffsets: number[];
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
  assignableMembers?: TaskAssignee[];
  // Active roster only. Historical assignees remain in teamMembers for task names.
  activeMembers?: TaskAssignee[];
  accessibleEvents?: TaskEvent[];
  changes?: RemoteChange[] | null;
  changeReadError?: ChangeError | null;
}
export function emptyTasksWorkspace(): TasksWorkspace {
  return { currentEventId: "", events: [], teamMembers: [], tasks: [] };
}
export type WorkspaceReadError =
  "unauthenticated" | "forbidden" | "not-found" | "unavailable" | "invalid";
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
  const events = array(record(value).events).map(readRemoteEvent);
  uniqueIds(events);
  return events;
}

export function readRemoteEvent(value: unknown): TaskEvent {
  const row = record(value),
    member = record(row.membership);
  const timezone = string(row.timezone);
  const name = string(row.name);
  if (!name.trim() || name.length > 200 || name !== name.trim()) invalid();
  if (typeof row.archived !== "boolean" || /^[+-]/.test(timezone)) invalid();
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    invalid();
  }
  const accessRole = member.accessRole;
  if (accessRole !== "ORGANIZER" && accessRole !== "MEMBER") invalid();
  const startDate = date(row.startDate),
    endDate = date(row.endDate);
  if (
    startDate.startsWith("0000-") ||
    endDate.startsWith("0000-") ||
    endDate < startDate ||
    !Number.isSafeInteger(row.version) ||
    (row.version as number) < 1 ||
    (row.version as number) > 2147483647
  )
    invalid();
  return {
    id: id(row.id),
    name,
    startDate,
    endDate,
    timezone,
    archived: row.archived,
    membership: { id: id(member.id), accessRole },
    version: row.version as number,
    createdAt: instant(row.createdAt),
    updatedAt: instant(row.updatedAt),
  };
}

// Legacy entry without a scope chooses a deterministic landing Event; explicit
// Event URLs always resolve the requested membership and never use this fallback.
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
  const tasks = array(body.tasks).map((value) =>
    mapRemoteTask(event.id, value),
  );
  for (const task of tasks) {
    if (
      task.assignedMemberId !== null &&
      !teamMembers.some((member) => member.id === task.assignedMemberId)
    )
      invalid();
  }
  uniqueIds(tasks);
  return { currentEventId: event.id, events: [event], teamMembers, tasks };
}

export function mapRemoteTask(eventId: string, value: unknown): RemoteTask {
  const row = record(value);
  if (row.deadlineTime !== null && !isTaskDeadlineTime(row.deadlineTime))
    invalid();
  if (
    !validReminderOffsets(row.reminderOffsets) ||
    (row.deadlineTime === null && row.reminderOffsets.length)
  )
    invalid();
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
    (acceptedByMemberId !== null && acceptedByMemberId !== assignedMemberId) ||
    !Number.isSafeInteger(row.version) ||
    (row.version as number) < 1 ||
    (row.version as number) > 2147483647
  )
    invalid();
  return {
    id: id(row.id),
    eventId: id(eventId),
    title: string(row.title),
    category: string(row.category),
    context: string(row.context),
    deadline: date(row.deadline),
    deadlineTime: row.deadlineTime as string | null,
    reminderOffsets: [...row.reminderOffsets].sort((a, b) => b - a),
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
}

export type TaskAction =
  | { kind: "assignment"; assignedMemberId: string | null }
  | { kind: "acceptance"; accepted: boolean }
  | { kind: "status"; status: TaskStatus };
export type TaskActionError =
  | "conflict"
  | "invalid"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "unavailable";
export class TaskActionFailure extends Error {
  readonly code: TaskActionError;
  constructor(code: TaskActionError) {
    super("Task action failed.");
    this.code = code;
  }
}
export class TaskAuthoringFailure extends TaskActionFailure {
  readonly fields: TaskFieldErrors;
  constructor(code: TaskActionError, fields: TaskFieldErrors = {}) {
    super(code);
    this.fields = fields;
  }
}
export interface TaskAuthoringService {
  createTask(
    eventId: string,
    fields: TaskFields,
    assignedMemberId: string | null,
    signal: AbortSignal,
  ): Promise<RemoteTask>;
  updateTaskDetails(
    eventId: string,
    taskId: string,
    expectedVersion: number,
    fields: TaskFields,
    signal: AbortSignal,
  ): Promise<RemoteTask>;
  getTask(
    eventId: string,
    taskId: string,
    signal: AbortSignal,
  ): Promise<RemoteTask>;
}
export interface TasksMutationService {
  executeTaskAction(
    eventId: string,
    taskId: string,
    expectedVersion: number,
    action: TaskAction,
    signal: AbortSignal,
  ): Promise<RemoteTask>;
  refreshTasks(eventId: string, signal: AbortSignal): Promise<TasksWorkspace>;
}

export interface TasksReadService {
  readTasks(
    signal: AbortSignal,
    eventId?: string | null,
  ): Promise<TasksWorkspace>;
}

export interface EventFields {
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
}
export type EventActionError = TaskActionError;
export type EventFieldErrors = Partial<
  Record<keyof EventFields | "expectedVersion", string>
>;
export class EventActionFailure extends Error {
  readonly code: EventActionError;
  readonly fields: EventFieldErrors;
  constructor(code: EventActionError, fields: EventFieldErrors = {}) {
    super("Event action failed.");
    this.code = code;
    this.fields = fields;
  }
}
export interface EventWorkspaceService {
  listEvents(signal: AbortSignal): Promise<TaskEvent[]>;
  getEvent(eventId: string, signal: AbortSignal): Promise<TaskEvent>;
  readEventTasks(
    event: TaskEvent,
    signal: AbortSignal,
  ): Promise<TasksWorkspace>;
  createEvent(fields: EventFields, signal: AbortSignal): Promise<TaskEvent>;
  updateEvent(
    eventId: string,
    expectedVersion: number,
    fields: EventFields,
    signal: AbortSignal,
  ): Promise<TaskEvent>;
}

export class RemoteWorkspaceService
  implements
    TasksReadService,
    TasksMutationService,
    EventWorkspaceService,
    TaskAuthoringService
{
  private request: typeof fetch;
  readonly invitations: InvitationService;
  private readonly changes: ChangeService;
  constructor(request: typeof fetch = fetch) {
    this.request = request;
    this.invitations = new InvitationService(request);
    this.changes = new ChangeService(request);
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
    if (response.status === 403) throw new WorkspaceReadFailure("forbidden");
    if (response.status === 404) throw new WorkspaceReadFailure("not-found");
    if (!response.ok) throw new WorkspaceReadFailure("unavailable");
    try {
      return await response.json();
    } catch {
      throw new WorkspaceReadFailure("invalid");
    }
  }

  async listEvents(signal: AbortSignal): Promise<TaskEvent[]> {
    const events = readAccessibleEvents(await this.get("/api/events", signal));
    signal.throwIfAborted();
    return events;
  }
  async readEventHistory(
    eventId: string,
    before: string | null,
    signal: AbortSignal,
  ) {
    const requested = id(eventId);
    const query = before === null ? "" : `?before=${id(before)}`;
    const page = readEventHistory(
      await this.get(`/api/events/${requested}/history${query}`, signal),
      requested,
    );
    signal.throwIfAborted();
    return page;
  }

  async getEvent(eventId: string, signal: AbortSignal): Promise<TaskEvent> {
    const requested = id(eventId);
    const event = (await this.listEvents(signal)).find(
      (event) => event.id === requested,
    );
    if (!event) throw new WorkspaceReadFailure("not-found");
    return event;
  }

  async readTasks(
    signal: AbortSignal,
    eventId?: string | null,
  ): Promise<TasksWorkspace> {
    const events = await this.listEvents(signal);
    const event = eventId
      ? events.find((event) => event.id === id(eventId))
      : selectAccessibleEvent(events);
    if (!event) {
      if (eventId) throw new WorkspaceReadFailure("not-found");
      return emptyTasksWorkspace();
    }
    signal.throwIfAborted();
    return {
      ...(await this.readEventTasks(event, signal)),
      accessibleEvents: events,
    };
  }

  async readEventTasks(
    event: TaskEvent,
    signal: AbortSignal,
  ): Promise<TasksWorkspace> {
    const workspace = mapTaskRead(
      event,
      await this.get(`/api/events/${event.id}/tasks`, signal),
    );
    const members = array(
      record(await this.get(`/api/events/${event.id}/members`, signal)).members,
    ).map((value) => {
      const row = record(value);
      return { id: id(row.id), name: string(row.name), role: string(row.role) };
    });
    uniqueIds(members);
    let changes: RemoteChange[] | null = null;
    let changeReadError: ChangeError | null = null;
    try {
      changes = await this.changes.list(event.id, signal);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      const code = error instanceof ChangeFailure ? error.code : "unavailable";
      // Session/scope loss clears the entire protected snapshot. A Change-only
      // availability/DTO failure stays explicit without disabling Task commands.
      if (
        code === "unauthenticated" ||
        code === "forbidden" ||
        code === "not-found"
      )
        throw new WorkspaceReadFailure(code);
      changeReadError = code;
    }
    signal.throwIfAborted();
    return {
      ...workspace,
      changes,
      changeReadError,
      activeMembers: members,
      assignableMembers:
        event.membership.accessRole === "ORGANIZER" ? members : [],
      teamMembers: [
        ...new Map(
          [...workspace.teamMembers, ...members].map((member) => [
            member.id,
            member,
          ]),
        ).values(),
      ],
    };
  }

  async refreshTasks(
    eventId: string,
    signal: AbortSignal,
  ): Promise<TasksWorkspace> {
    const events = await this.listEvents(signal);
    const event = events.find((event) => event.id === id(eventId));
    if (!event) throw new WorkspaceReadFailure("forbidden");
    signal.throwIfAborted();
    return {
      ...(await this.readEventTasks(event, signal)),
      accessibleEvents: events,
    };
  }

  createEvent(fields: EventFields, signal: AbortSignal): Promise<TaskEvent> {
    return this.eventCommand("/api/events", "POST", fields, signal);
  }

  async getTask(
    eventId: string,
    taskId: string,
    signal: AbortSignal,
  ): Promise<RemoteTask> {
    const event = id(eventId),
      task = id(taskId);
    const result = mapRemoteTask(
      event,
      record(await this.get(`/api/events/${event}/tasks/${task}`, signal)).task,
    );
    if (result.id !== task) invalid();
    signal.throwIfAborted();
    return result;
  }

  createTask(
    eventId: string,
    fields: TaskFields,
    assignedMemberId: string | null,
    signal: AbortSignal,
  ) {
    return this.taskAuthoringCommand(eventId, fields, signal, {
      assignedMemberId,
    });
  }

  updateTaskDetails(
    eventId: string,
    taskId: string,
    expectedVersion: number,
    fields: TaskFields,
    signal: AbortSignal,
  ) {
    return this.taskAuthoringCommand(eventId, fields, signal, {
      taskId,
      expectedVersion,
    });
  }

  private async taskAuthoringCommand(
    eventId: string,
    fields: TaskFields,
    signal: AbortSignal,
    command:
      | { assignedMemberId: string | null }
      | { taskId: string; expectedVersion: number },
  ): Promise<RemoteTask> {
    const event = id(eventId);
    const taskId = "taskId" in command ? id(command.taskId) : null;
    const body = {
      title: fields.title,
      category: fields.category,
      context: fields.context,
      deadline: fields.deadline,
      deadlineTime: fields.deadlineTime,
      reminderOffsets: fields.reminderOffsets ?? [],
      priority: fields.priority,
      ...(taskId && "expectedVersion" in command
        ? { expectedVersion: command.expectedVersion }
        : {
            assignedMemberId:
              "assignedMemberId" in command ? command.assignedMemberId : null,
          }),
    };
    let response: Response;
    try {
      const request = this.request;
      response = await request(
        `/api/events/${event}/tasks${taskId ? `/${taskId}` : ""}`,
        {
          method: taskId ? "PATCH" : "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        },
      );
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new TaskAuthoringFailure("unavailable");
    }
    if (!response.ok) {
      const codes: Record<number, TaskActionError> = {
        400: "invalid",
        401: "unauthenticated",
        403: "forbidden",
        404: "not-found",
        409: "conflict",
      };
      const fields: TaskFieldErrors = {};
      if (response.status === 400) {
        try {
          const raw = record(record(await response.json()).fields);
          const allowed = {
            title: "INVALID_TEXT",
            category: "INVALID_TEXT",
            context: "INVALID_TEXT",
            deadline: "INVALID_DATE",
            deadlineTime: "INVALID_TIME",
            reminderOffsets: "INVALID_REMINDERS",
            priority: "INVALID_PRIORITY",
            assignedMemberId: "INVALID_ASSIGNEE",
            expectedVersion: "INVALID_VERSION",
          };
          for (const key of Object.keys(allowed) as (keyof typeof allowed)[])
            if (raw[key] === allowed[key]) fields[key] = allowed[key];
          if (raw.reminderOffsets === "REMINDERS_REQUIRE_TIME")
            fields.reminderOffsets = "REMINDERS_REQUIRE_TIME";
        } catch {
          /* Only fixed field codes are shown. */
        }
      }
      signal.throwIfAborted();
      throw new TaskAuthoringFailure(
        codes[response.status] ?? "unavailable",
        fields,
      );
    }
    try {
      const result = mapRemoteTask(event, record(await response.json()).task);
      if (taskId && result.id !== taskId) invalid();
      if (
        !taskId &&
        (result.version !== 1 ||
          result.status !== "not-started" ||
          result.acknowledged)
      )
        invalid();
      signal.throwIfAborted();
      return result;
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new TaskAuthoringFailure("invalid");
    }
  }

  updateEvent(
    eventId: string,
    expectedVersion: number,
    fields: EventFields,
    signal: AbortSignal,
  ): Promise<TaskEvent> {
    const event = id(eventId);
    return this.eventCommand(`/api/events/${event}`, "PATCH", fields, signal, {
      eventId: event,
      expectedVersion,
    });
  }

  private async eventCommand(
    path: string,
    method: "POST" | "PATCH",
    fields: EventFields,
    signal: AbortSignal,
    update?: { eventId: string; expectedVersion: number },
  ): Promise<TaskEvent> {
    // Explicit projection prevents client properties from becoming authority.
    const body = {
      name: fields.name,
      startDate: fields.startDate,
      endDate: fields.endDate,
      timezone: fields.timezone,
      ...(update ? { expectedVersion: update.expectedVersion } : {}),
    };
    let response: Response;
    try {
      const request = this.request;
      response = await request(path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      });
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new EventActionFailure("unavailable");
    }
    const errors: Record<number, EventActionError> = {
      400: "invalid",
      401: "unauthenticated",
      403: "forbidden",
      404: "not-found",
      409: "conflict",
    };
    if (!response.ok) {
      const code = errors[response.status] ?? "unavailable";
      const fieldErrors: EventFieldErrors = {};
      if (code === "invalid") {
        try {
          const raw = record(record(await response.json()).fields);
          const safeCodes: Record<keyof EventFieldErrors, readonly string[]> = {
            name: ["INVALID_NAME"],
            startDate: ["INVALID_DATE"],
            endDate: ["INVALID_DATE", "END_BEFORE_START"],
            timezone: ["INVALID_TIMEZONE"],
            expectedVersion: ["INVALID_VERSION"],
          };
          for (const key of Object.keys(
            safeCodes,
          ) as (keyof EventFieldErrors)[]) {
            if (
              typeof raw[key] === "string" &&
              safeCodes[key].includes(raw[key])
            )
              fieldErrors[key] = raw[key];
          }
        } catch {
          /* Only fixed validation codes cross the application boundary. */
        }
      }
      if (signal.aborted) throw signal.reason;
      throw new EventActionFailure(code, fieldErrors);
    }
    try {
      const event = readRemoteEvent(record(await response.json()).event);
      if (update && event.id !== update.eventId) invalid();
      if (
        !update &&
        (event.archived || event.membership.accessRole !== "ORGANIZER")
      )
        invalid();
      signal.throwIfAborted();
      return event;
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new EventActionFailure("invalid");
    }
  }

  assignTask(
    eventId: string,
    taskId: string,
    assignedMemberId: string | null,
    expectedVersion: number,
    signal: AbortSignal,
  ) {
    return this.executeTaskAction(
      eventId,
      taskId,
      expectedVersion,
      { kind: "assignment", assignedMemberId },
      signal,
    );
  }
  acceptTask(
    eventId: string,
    taskId: string,
    expectedVersion: number,
    signal: AbortSignal,
  ) {
    return this.executeTaskAction(
      eventId,
      taskId,
      expectedVersion,
      { kind: "acceptance", accepted: true },
      signal,
    );
  }
  withdrawTaskAcceptance(
    eventId: string,
    taskId: string,
    expectedVersion: number,
    signal: AbortSignal,
  ) {
    return this.executeTaskAction(
      eventId,
      taskId,
      expectedVersion,
      { kind: "acceptance", accepted: false },
      signal,
    );
  }
  updateTaskStatus(
    eventId: string,
    taskId: string,
    status: TaskStatus,
    expectedVersion: number,
    signal: AbortSignal,
  ) {
    return this.executeTaskAction(
      eventId,
      taskId,
      expectedVersion,
      { kind: "status", status },
      signal,
    );
  }
  async executeTaskAction(
    eventId: string,
    taskId: string,
    expectedVersion: number,
    action: TaskAction,
    signal: AbortSignal,
  ): Promise<RemoteTask> {
    const event = id(eventId),
      task = id(taskId);
    const method =
      action.kind === "assignment"
        ? "POST"
        : action.kind === "acceptance"
          ? "PUT"
          : "PATCH";
    const body =
      action.kind === "assignment"
        ? { assignedMemberId: action.assignedMemberId, expectedVersion }
        : action.kind === "acceptance"
          ? { accepted: action.accepted, expectedVersion }
          : { status: action.status, expectedVersion };
    let response: Response;
    try {
      const request = this.request;
      response = await request(
        `/api/events/${event}/tasks/${task}/${action.kind}`,
        {
          method,
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        },
      );
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new TaskActionFailure("unavailable");
    }
    const errors: Record<number, TaskActionError> = {
      400: "invalid",
      401: "unauthenticated",
      403: "forbidden",
      404: "not-found",
      409: "conflict",
    };
    if (!response.ok)
      throw new TaskActionFailure(errors[response.status] ?? "unavailable");
    try {
      const result = mapRemoteTask(event, record(await response.json()).task);
      if (result.id !== task) invalid();
      signal.throwIfAborted();
      return result;
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new TaskActionFailure("invalid");
    }
  }
}
