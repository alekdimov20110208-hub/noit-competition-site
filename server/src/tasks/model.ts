import { validEventDate } from "../events/model.ts";

export const taskStatuses = [
  "not-started",
  "in-progress",
  "blocked",
  "completed",
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export interface TaskDto {
  id: string;
  title: string;
  category: string;
  context: string;
  blockedBy: string;
  blocks: string;
  deadline: string;
  status: TaskStatus;
  priority: "normal" | "important" | "critical";
  assignedMemberId: string | null;
  accepted: boolean;
  acceptedByMemberId: string | null;
  acceptedAt: string | null;
  version: number;
  updatedAt: string;
}

export interface TaskRow {
  id: string;
  title: string;
  category: string;
  context: string;
  blocked_by?: string;
  blocks?: string;
  deadline: string;
  status: TaskStatus;
  priority: TaskDto["priority"];
  assigned_member_id: string | null;
  accepted_by_member_id: string | null;
  accepted_at: Date | null;
  version: number;
  updated_at: Date;
}

// DATE is formatted in SQL: pg's DATE-to-Date parsing and session DateStyle
// never alter a calendar date or its canonical YYYY-MM-DD representation.
export const taskColumns = `id, title, category, context, blocked_by, blocks, to_char(deadline, 'YYYY-MM-DD') AS deadline,
  status, priority, assigned_member_id, accepted_by_member_id, accepted_at, version, updated_at`;

export function taskDto(row: TaskRow): TaskDto {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    context: row.context,
    blockedBy: row.blocked_by ?? "",
    blocks: row.blocks ?? "",
    deadline: row.deadline,
    status: row.status,
    priority: row.priority,
    assignedMemberId: row.assigned_member_id,
    accepted: row.accepted_by_member_id !== null,
    acceptedByMemberId: row.accepted_by_member_id,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
  };
}

export class TaskCommandError extends Error {
  readonly statusCode: 400 | 403 | 404 | 409;
  readonly code: string;
  readonly fields?: TaskFieldErrors;
  constructor(
    statusCode: 400 | 403 | 404 | 409,
    code: string,
    fields?: TaskFieldErrors,
  ) {
    super(code);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    this.name = "TaskCommandError";
  }
}

export interface TaskFields {
  title: string;
  category: string;
  context: string;
  deadline: string;
  priority: TaskDto["priority"];
}
export type TaskFieldErrors = Partial<
  Record<keyof TaskFields | "assignedMemberId" | "expectedVersion", string>
>;
export type TaskAuthoringCommand = Partial<TaskFields> & {
  assignedMemberId?: string | null;
  expectedVersion?: number;
};

// PATCH accepts only authored fields; assignment remains its dedicated command.
export function parseTaskAuthoring(
  input: unknown,
  editing = false,
): TaskAuthoringCommand {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TaskCommandError(400, "INVALID_TASK_COMMAND");
  const body = input as Record<string, unknown>;
  const allowed = [
    "title",
    "category",
    "context",
    "deadline",
    "priority",
    editing ? "expectedVersion" : "assignedMemberId",
  ];
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new TaskCommandError(400, "INVALID_TASK_COMMAND");
  const fields: TaskFieldErrors = {};
  const result: TaskAuthoringCommand = {};
  for (const [field, limit] of [
    ["title", 200],
    ["category", 100],
    ["context", 5000],
  ] as const) {
    if (editing && !Object.hasOwn(body, field)) continue;
    const raw =
      body[field] ??
      (field !== "title" && !Object.hasOwn(body, field) ? "" : undefined);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (
      typeof raw !== "string" ||
      (field === "title" && !value) ||
      value.length > limit ||
      value.includes("\u0000") ||
      /[\uD800-\uDFFF]/u.test(value)
    )
      fields[field] = "INVALID_TEXT";
    result[field] = value;
  }
  if (!editing || Object.hasOwn(body, "deadline")) {
    if (!validEventDate(body.deadline)) fields.deadline = "INVALID_DATE";
    else result.deadline = body.deadline;
  }
  if (!editing || Object.hasOwn(body, "priority")) {
    if (!["normal", "important", "critical"].includes(body.priority as string))
      fields.priority = "INVALID_PRIORITY";
    else result.priority = body.priority as TaskDto["priority"];
  }
  if (editing) {
    if (
      !Number.isSafeInteger(body.expectedVersion) ||
      (body.expectedVersion as number) < 1 ||
      (body.expectedVersion as number) >= 2147483647
    )
      fields.expectedVersion = "INVALID_VERSION";
    else result.expectedVersion = body.expectedVersion as number;
  } else {
    const assignee = Object.hasOwn(body, "assignedMemberId")
      ? body.assignedMemberId
      : null;
    if (
      assignee !== null &&
      (typeof assignee !== "string" || !uuidPattern.test(assignee))
    )
      fields.assignedMemberId = "INVALID_ASSIGNEE";
    else
      result.assignedMemberId =
        typeof assignee === "string" ? assignee.toLowerCase() : null;
  }
  if (Object.keys(fields).length)
    throw new TaskCommandError(400, "INVALID_TASK_COMMAND", fields);
  return result;
}

export const uuidPattern =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export type TaskCommand =
  | {
      kind: "assignment";
      assignedMemberId: string | null;
      expectedVersion: number;
    }
  | { kind: "acceptance"; accepted: boolean; expectedVersion: number }
  | { kind: "status"; status: TaskStatus; expectedVersion: number };

// Runtime validation is also used by direct service callers. Unknown fields are
// rejected, including client actor/time/history/role fields. No coercion/defaults.
export function parseTaskCommand(
  kind: TaskCommand["kind"],
  input: unknown,
): TaskCommand {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TaskCommandError(400, "INVALID_COMMAND");
  }
  const body = input as Record<string, unknown>;
  const field =
    kind === "assignment"
      ? "assignedMemberId"
      : kind === "acceptance"
        ? "accepted"
        : "status";
  if (
    Object.keys(body).length !== 2 ||
    !Object.hasOwn(body, field) ||
    !Object.hasOwn(body, "expectedVersion") ||
    !Number.isSafeInteger(body.expectedVersion) ||
    (body.expectedVersion as number) < 1 ||
    (body.expectedVersion as number) >= 2147483647
  ) {
    throw new TaskCommandError(400, "INVALID_COMMAND");
  }
  const expectedVersion = body.expectedVersion as number;
  if (
    kind === "assignment" &&
    (body.assignedMemberId === null ||
      (typeof body.assignedMemberId === "string" &&
        uuidPattern.test(body.assignedMemberId)))
  ) {
    return {
      kind,
      assignedMemberId:
        typeof body.assignedMemberId === "string"
          ? body.assignedMemberId.toLowerCase()
          : null,
      expectedVersion,
    };
  }
  if (kind === "acceptance" && typeof body.accepted === "boolean") {
    return { kind, accepted: body.accepted, expectedVersion };
  }
  if (kind === "status" && taskStatuses.includes(body.status as TaskStatus)) {
    return { kind, status: body.status as TaskStatus, expectedVersion };
  }
  throw new TaskCommandError(400, "INVALID_COMMAND");
}
