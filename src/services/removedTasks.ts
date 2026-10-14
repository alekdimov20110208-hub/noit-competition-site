import { getCalendarDayNumber } from "../domain/taskTiming.ts";
import { isTaskDeadlineTime } from "../domain/taskDeadlineTime.ts";
import type { TaskStatus } from "../domain/types.ts";
export interface RetainedTask {
  id: string;
  eventId: string;
  title: string;
  context: string;
  status: TaskStatus;
  deadline: string;
  deadlineTime: string | null;
  version: number;
  removedAt: string;
  assigneeName: string | null;
  removerName: string;
  acceptedAt: string | null;
  reminderCount: number;
}
export class RemovedTaskFailure extends Error {
  readonly code: "unknown" | "unavailable" | "unauthenticated";
  constructor(code: "unknown" | "unavailable" | "unauthenticated") {
    super("Retained Task read failed.");
    this.code = code;
  }
}
export function parseRetainedTask(
  value: unknown,
  eventId: string,
  taskId: string,
): RetainedTask {
  const task = value as RetainedTask;
  if (
    !task ||
    task.id !== taskId ||
    task.eventId !== eventId ||
    typeof task.title !== "string" ||
    !task.title.trim() ||
    task.title.length > 200 ||
    typeof task.context !== "string" ||
    task.context.length > 5000 ||
    !["not-started", "in-progress", "blocked", "completed"].includes(
      task.status,
    ) ||
    !Number.isFinite(Date.parse(task.removedAt)) ||
    !Number.isSafeInteger(task.version) ||
    task.version < 1 ||
    !Number.isSafeInteger(task.reminderCount) ||
    task.reminderCount < 0 ||
    typeof task.deadline !== "string" ||
    getCalendarDayNumber(task.deadline) === null ||
    (task.deadlineTime !== null && !isTaskDeadlineTime(task.deadlineTime)) ||
    typeof task.removerName !== "string" ||
    (task.assigneeName !== null && typeof task.assigneeName !== "string") ||
    (task.acceptedAt !== null && !Number.isFinite(Date.parse(task.acceptedAt)))
  )
    throw new RemovedTaskFailure("unavailable");
  return task;
}
export async function readRetainedTask(
  eventId: string,
  taskId: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<RetainedTask> {
  const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
  if (!uuid.test(eventId) || !uuid.test(taskId))
    throw new RemovedTaskFailure("unknown");
  try {
    const response = await request(
      `/api/events/${eventId}/task-history/${taskId}`,
      {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      },
    );
    signal.throwIfAborted();
    if (response.status === 401)
      throw new RemovedTaskFailure("unauthenticated");
    if (response.status === 403 || response.status === 404)
      throw new RemovedTaskFailure("unknown");
    if (!response.ok) throw new RemovedTaskFailure("unavailable");
    const task = parseRetainedTask(await response.json(), eventId, taskId);
    signal.throwIfAborted();
    return task;
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof RemovedTaskFailure) throw error;
    throw new RemovedTaskFailure("unavailable");
  }
}
