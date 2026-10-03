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
  constructor(statusCode: 400 | 403 | 404 | 409, code: string) {
    super(code);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "TaskCommandError";
  }
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
