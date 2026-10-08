import { isTaskDeadlineTime } from "../domain/taskDeadlineTime.ts";
import { getCalendarDayNumber } from "../domain/taskTiming.ts";
import { REMINDER_OFFSETS } from "../domain/taskReminders.ts";

export interface InAppNotification {
  id: string;
  eventId: string;
  taskId: string;
  taskTitle: string;
  kind: "TASK_ASSIGNED" | "TASK_DUE_REMINDER";
  deadline: string;
  deadlineTime: string | null;
  timezone: string;
  reminderOffsetMinutes: number | null;
  dueAt: string | null;
  createdAt: string;
  readAt: string | null;
}
export interface NotificationSnapshot {
  notifications: InAppNotification[];
  unreadCount: number;
}
export class NotificationFailure extends Error {
  readonly code:
    "invalid" | "unavailable" | "unauthenticated" | "forbidden" | "not-found";
  constructor(code: NotificationFailure["code"]) {
    super("Notification request failed.");
    this.code = code;
  }
}
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const isInstant = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) &&
  Number.isFinite(Date.parse(value));
function invalid(): never {
  throw new NotificationFailure("invalid");
}
export function parseNotification(
  value: unknown,
  eventId: string,
): InAppNotification {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const n = value as InAppNotification;
  if (
    ![n.id, n.eventId, n.taskId].every(
      (value) => typeof value === "string" && uuid.test(value),
    ) ||
    n.eventId !== eventId ||
    typeof n.taskTitle !== "string" ||
    !n.taskTitle.trim() ||
    typeof n.deadline !== "string" ||
    getCalendarDayNumber(n.deadline) === null ||
    (n.deadlineTime !== null && !isTaskDeadlineTime(n.deadlineTime)) ||
    !isInstant(n.createdAt) ||
    (n.readAt !== null && !isInstant(n.readAt)) ||
    typeof n.timezone !== "string"
  )
    invalid();
  try {
    new Intl.DateTimeFormat("en", { timeZone: n.timezone });
  } catch {
    invalid();
  }
  if (n.kind === "TASK_ASSIGNED") {
    if (n.reminderOffsetMinutes !== null || n.dueAt !== null) invalid();
  } else if (n.kind === "TASK_DUE_REMINDER") {
    if (
      !REMINDER_OFFSETS.includes(n.reminderOffsetMinutes as 15) ||
      !isInstant(n.dueAt) ||
      n.deadlineTime === null
    )
      invalid();
  } else invalid();
  return {
    id: n.id,
    eventId: n.eventId,
    taskId: n.taskId,
    taskTitle: n.taskTitle,
    kind: n.kind,
    deadline: n.deadline,
    deadlineTime: n.deadlineTime,
    timezone: n.timezone,
    reminderOffsetMinutes: n.reminderOffsetMinutes,
    dueAt: n.dueAt,
    createdAt: n.createdAt,
    readAt: n.readAt,
  };
}
export function parseNotifications(
  value: unknown,
  eventId: string,
): NotificationSnapshot {
  if (!value || typeof value !== "object") invalid();
  const body = value as NotificationSnapshot;
  if (
    !Array.isArray(body.notifications) ||
    body.notifications.length > 50 ||
    !Number.isSafeInteger(body.unreadCount) ||
    body.unreadCount < 0
  )
    invalid();
  const notifications = body.notifications.map((n) =>
    parseNotification(n, eventId),
  );
  if (
    new Set(notifications.map((n) => n.id)).size !== notifications.length ||
    body.unreadCount < notifications.filter((n) => n.readAt === null).length
  )
    invalid();
  return { notifications, unreadCount: body.unreadCount };
}
export class NotificationService {
  private request: typeof fetch;
  constructor(request: typeof fetch = fetch) {
    this.request = request;
  }
  private async execute(
    eventId: string,
    suffix: string,
    signal: AbortSignal,
    write = false,
  ): Promise<unknown> {
    if (!uuid.test(eventId)) invalid();
    let response: Response;
    try {
      const request = this.request;
      response = await request(
        `/api/events/${eventId}/notifications${suffix}`,
        {
          method: write ? "POST" : "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        },
      );
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new NotificationFailure("unavailable");
    }
    if (!response.ok)
      throw new NotificationFailure(
        (
          {
            401: "unauthenticated",
            403: "forbidden",
            404: "not-found",
          } as const
        )[response.status as 401] ?? "unavailable",
      );
    try {
      const body = await response.json();
      signal.throwIfAborted();
      return body;
    } catch {
      if (signal.aborted) throw signal.reason;
      invalid();
    }
  }
  async list(event: string, signal: AbortSignal) {
    return parseNotifications(await this.execute(event, "", signal), event);
  }
  async markRead(event: string, id: string, signal: AbortSignal) {
    if (!uuid.test(id)) invalid();
    const result = (await this.execute(event, `/${id}/read`, signal, true)) as {
      notification: unknown;
    };
    const notification = parseNotification(result?.notification, event);
    if (notification.id !== id || notification.readAt === null) invalid();
    return notification;
  }
  async markAllRead(event: string, signal: AbortSignal) {
    const result = (await this.execute(event, "/read-all", signal, true)) as {
      status: unknown;
    };
    if (result?.status !== "ok") invalid();
  }
}
