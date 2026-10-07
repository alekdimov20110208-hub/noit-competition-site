import { getCalendarDayNumber } from "../domain/taskTiming.ts";
import { isTaskDeadlineTime } from "../domain/taskDeadlineTime.ts";
import type { Task } from "../domain/types.ts";
import type { TaskEvent } from "./RemoteWorkspaceService.ts";

export interface TaskFields {
  title: string;
  category: string;
  context: string;
  deadline: string;
  deadlineTime: string | null;
  priority: Task["priority"];
}
export type TaskFieldErrors = Partial<
  Record<keyof TaskFields | "assignedMemberId" | "expectedVersion", string>
>;
export function taskAuthoringAllowed(event: TaskEvent | undefined) {
  return Boolean(
    event && !event.archived && event.membership.accessRole === "ORGANIZER",
  );
}
export function authoredFields(task: Task): TaskFields {
  return {
    title: task.title,
    category: task.category,
    context: task.context,
    deadline: task.deadline,
    deadlineTime: task.deadlineTime,
    priority: task.priority,
  };
}
export function validateTaskFields(fields: TaskFields): TaskFieldErrors {
  const errors: TaskFieldErrors = {};
  for (const [field, limit] of [
    ["title", 200],
    ["category", 100],
    ["context", 5000],
  ] as const) {
    const value = fields[field].trim();
    if (
      (field === "title" && !value) ||
      value.length > limit ||
      value.includes("\u0000") ||
      /[\uD800-\uDFFF]/u.test(value)
    )
      errors[field] = "INVALID_TEXT";
  }
  if (
    getCalendarDayNumber(fields.deadline) === null ||
    fields.deadline.startsWith("0000-")
  )
    errors.deadline = "INVALID_DATE";
  if (fields.deadlineTime !== null && !isTaskDeadlineTime(fields.deadlineTime))
    errors.deadlineTime = "INVALID_TIME";
  if (!["normal", "important", "critical"].includes(fields.priority))
    errors.priority = "INVALID_PRIORITY";
  return errors;
}
