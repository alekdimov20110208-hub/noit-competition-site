import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "../auth/session.ts";
import { UnauthorizedError } from "../auth/session.ts";
import {
  inTransaction,
  type TransactionPool,
  type TransactionDatabase,
} from "../db/transaction.ts";
import { TaskCommandError, uuidPattern } from "../tasks/model.ts";

// Called only inside the successful canonical assignment transaction.
export async function recordTaskAssignment(
  database: TransactionDatabase,
  eventId: string,
  taskId: string,
  actorUserId: string,
) {
  await database.query(
    `INSERT INTO public.notification
    (id,event_id,recipient_user_id,kind,task_id,actor_user_id,task_title,deadline,deadline_time,timezone,task_version)
    SELECT $1,t.event_id,m.user_id,'TASK_ASSIGNED',t.id,$4,t.title,t.deadline,t.deadline_time,e.timezone,t.version
    FROM public.task t JOIN public.event e ON e.id=t.event_id
    JOIN public.event_member m ON m.id=t.assigned_member_id AND m.event_id=t.event_id
    WHERE t.event_id=$2 AND t.id=$3 AND m.user_id<>$4
    ON CONFLICT DO NOTHING`,
    [randomUUID(), eventId, taskId, actorUserId],
  );
}

const columns = `id, event_id AS "eventId", kind, task_id AS "taskId", task_title AS "taskTitle",
  to_char(deadline,'YYYY-MM-DD') AS deadline, to_char(deadline_time,'HH24:MI') AS "deadlineTime", timezone,
  reminder_offset_minutes AS "reminderOffsetMinutes", due_at AS "dueAt", created_at AS "createdAt", read_at AS "readAt"`;
interface NotificationRow {
  id: string;
  eventId: string;
  kind: "TASK_ASSIGNED" | "TASK_DUE_REMINDER";
  taskId: string;
  taskTitle: string;
  deadline: string;
  deadlineTime: string | null;
  timezone: string;
  reminderOffsetMinutes: number | null;
  dueAt: Date | null;
  createdAt: Date;
  readAt: Date | null;
}
function dto(row: NotificationRow) {
  return {
    id: row.id,
    eventId: row.eventId,
    kind: row.kind,
    taskId: row.taskId,
    taskTitle: row.taskTitle,
    deadline: row.deadline,
    deadlineTime: row.deadlineTime,
    timezone: row.timezone,
    reminderOffsetMinutes: row.reminderOffsetMinutes,
    dueAt: row.dueAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}
export function createNotificationService(pool: TransactionPool) {
  async function authorized<T>(
    user: AuthenticatedUser,
    eventId: string,
    run: (db: TransactionDatabase, event: string) => Promise<T>,
  ) {
    if (!user?.id) throw new UnauthorizedError();
    if (!uuidPattern.test(eventId))
      throw new TaskCommandError(400, "INVALID_ID");
    const event = eventId.toLowerCase();
    return inTransaction(pool, async (db) => {
      // Lifecycle commands lock Event before membership/identity. Establish that
      // same order explicitly rather than relying on a joined query's plan.
      await db.query("SELECT id FROM public.event WHERE id=$1 FOR SHARE", [
        event,
      ]);
      const membership = await db.query(
        `SELECT m.id FROM public.event_member m
        JOIN public."user" u ON u.id=m.user_id JOIN public.event e ON e.id=m.event_id
        WHERE m.event_id=$1 AND m.user_id=$2 AND m.active AND m.deactivated_at IS NULL AND u.active
        FOR SHARE OF e,m,u`,
        [event, user.id],
      );
      if (!membership.rows.length) throw new TaskCommandError(404, "NOT_FOUND");
      return run(db, event);
    });
  }
  return {
    list: (user: AuthenticatedUser, event: string) =>
      authorized(user, event, async (db, eventId) => {
        const result = await db.query(
          `SELECT ${columns}, (SELECT count(*)::INTEGER FROM public.notification WHERE event_id=$1 AND recipient_user_id=$2 AND read_at IS NULL) AS "unreadCount" FROM public.notification
        WHERE event_id=$1 AND recipient_user_id=$2 ORDER BY created_at DESC,id DESC LIMIT 50`,
          [eventId, user.id],
        );
        const rows = result.rows as (NotificationRow & {
          unreadCount: number;
        })[];
        return {
          notifications: rows.map(dto),
          unreadCount: rows[0]?.unreadCount ?? 0,
        };
      }),
    markRead: (
      user: AuthenticatedUser,
      event: string,
      notificationId: string,
    ) =>
      authorized(user, event, async (db, eventId) => {
        if (!uuidPattern.test(notificationId))
          throw new TaskCommandError(400, "INVALID_ID");
        const result = await db.query(
          `UPDATE public.notification SET read_at=COALESCE(read_at,clock_timestamp())
        WHERE id=$3 AND event_id=$1 AND recipient_user_id=$2 RETURNING ${columns}`,
          [eventId, user.id, notificationId.toLowerCase()],
        );
        if (!result.rows.length) throw new TaskCommandError(404, "NOT_FOUND");
        return { notification: dto(result.rows[0] as NotificationRow) };
      }),
    markAllRead: (user: AuthenticatedUser, event: string) =>
      authorized(user, event, async (db, eventId) => {
        await db.query(
          `UPDATE public.notification SET read_at=clock_timestamp() WHERE event_id=$1 AND recipient_user_id=$2 AND read_at IS NULL`,
          [eventId, user.id],
        );
        return { status: "ok" };
      }),
  };
}
export type NotificationService = ReturnType<typeof createNotificationService>;
