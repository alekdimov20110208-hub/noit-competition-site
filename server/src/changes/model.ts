import { uuidPattern, type TaskStatus } from "../tasks/model.ts";

export interface ChangeMember {
  id: string;
  name: string;
  role: string;
}
export interface AffectedTask {
  id: string;
  title: string;
  status: TaskStatus;
  assignedMember: ChangeMember | null;
  deadline: string | null;
}
export interface ChangeDto {
  id: string;
  eventId: string;
  title: string;
  context: string;
  reporter: ChangeMember;
  responseOwner: ChangeMember | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  affectedTasks: AffectedTask[];
  impact: {
    taskCount: number;
    people: ChangeMember[];
    deadlines: string[];
  };
}
export interface ChangeFields {
  title: string;
  context: string;
  responseOwnerMemberId: string | null;
  affectedTaskIds: string[];
}
export type ChangeFieldErrors = Partial<
  Record<keyof ChangeFields | "expectedVersion", string>
>;
export type ChangeCommand = Partial<ChangeFields> & {
  expectedVersion?: number;
};
export class ChangeCommandError extends Error {
  readonly statusCode: 400 | 403 | 404 | 409;
  readonly code: string;
  readonly fields?: ChangeFieldErrors;
  constructor(
    statusCode: 400 | 403 | 404 | 409,
    code: string,
    fields?: ChangeFieldErrors,
  ) {
    super(code);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    this.name = "ChangeCommandError";
  }
}

export function parseChangeCommand(
  input: unknown,
  editing = false,
): ChangeCommand {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ChangeCommandError(400, "INVALID_CHANGE_COMMAND");
  const body = input as Record<string, unknown>;
  const allowed = [
    "title",
    "context",
    "responseOwnerMemberId",
    "affectedTaskIds",
    ...(editing ? ["expectedVersion"] : []),
  ];
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new ChangeCommandError(400, "INVALID_CHANGE_COMMAND");
  const errors: ChangeFieldErrors = {};
  const result: ChangeCommand = {};
  for (const [field, limit] of [
    ["title", 200],
    ["context", 5000],
  ] as const) {
    if (editing && !Object.hasOwn(body, field)) continue;
    const raw = Object.hasOwn(body, field)
      ? body[field]
      : field === "context"
        ? ""
        : undefined;
    const value = typeof raw === "string" ? raw.trim() : "";
    if (
      typeof raw !== "string" ||
      (field === "title" && !value) ||
      value.length > limit ||
      value.includes("\u0000") ||
      /[\uD800-\uDFFF]/u.test(value)
    )
      errors[field] = "INVALID_TEXT";
    result[field] = value;
  }
  if (!editing || Object.hasOwn(body, "responseOwnerMemberId")) {
    const owner = Object.hasOwn(body, "responseOwnerMemberId")
      ? body.responseOwnerMemberId
      : null;
    if (
      owner !== null &&
      (typeof owner !== "string" || !uuidPattern.test(owner))
    )
      errors.responseOwnerMemberId = "INVALID_OWNER";
    else
      result.responseOwnerMemberId =
        typeof owner === "string" ? owner.toLowerCase() : null;
  }
  if (!editing || Object.hasOwn(body, "affectedTaskIds")) {
    const tasks = Object.hasOwn(body, "affectedTaskIds")
      ? body.affectedTaskIds
      : [];
    if (
      !Array.isArray(tasks) ||
      tasks.length > 1000 ||
      tasks.some((id) => typeof id !== "string" || !uuidPattern.test(id))
    )
      errors.affectedTaskIds = "INVALID_TASKS";
    else
      result.affectedTaskIds = [
        ...new Set((tasks as string[]).map((id) => id.toLowerCase())),
      ].sort();
  }
  if (editing) {
    if (
      !Number.isSafeInteger(body.expectedVersion) ||
      (body.expectedVersion as number) < 1 ||
      (body.expectedVersion as number) >= 2147483647
    )
      errors.expectedVersion = "INVALID_VERSION";
    else result.expectedVersion = body.expectedVersion as number;
  }
  if (Object.keys(errors).length)
    throw new ChangeCommandError(400, "INVALID_CHANGE_COMMAND", errors);
  return result;
}

export function deriveImpact(
  tasks: readonly AffectedTask[],
): ChangeDto["impact"] {
  return {
    taskCount: tasks.length,
    people: [
      ...new Map(
        tasks.flatMap((task) =>
          task.assignedMember
            ? [[task.assignedMember.id, task.assignedMember] as const]
            : [],
        ),
      ).values(),
    ].sort((a, b) => a.id.localeCompare(b.id)),
    deadlines: [
      ...new Set(
        tasks.flatMap((task) => (task.deadline ? [task.deadline] : [])),
      ),
    ].sort(),
  };
}
