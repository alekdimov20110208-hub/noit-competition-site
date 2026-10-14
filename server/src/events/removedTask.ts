import { UnauthorizedError, type AuthenticatedUser } from "../auth/session.ts";
import type { AuthorizationDatabase } from "../authorization/events.ts";
import { uuidPattern } from "../tasks/model.ts";
import { EventCommandError } from "./model.ts";
export async function readRemovedTask(
  db: AuthorizationDatabase,
  user: AuthenticatedUser,
  event: string,
  task: string,
) {
  if (!user?.id) throw new UnauthorizedError();
  if (!uuidPattern.test(event) || !uuidPattern.test(task))
    throw new EventCommandError(400, "INVALID_ID");
  const rows = await db.query(
    `SELECT t.id,t.title,t.context,t.category,t.status,t.version,
    to_char(t.deadline,'YYYY-MM-DD') AS deadline,to_char(t.deadline_time,'HH24:MI') AS deadline_time,
    to_char(t.deleted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS removed_at,to_char(t.accepted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS accepted_at,
    assignee.name AS assignee_name,remover.name AS remover_name,
    (SELECT count(*)::INT FROM public.task_reminder r WHERE r.task_id=t.id) AS reminder_count
    FROM public.task t JOIN public.event_member viewer ON viewer.event_id=t.event_id
    JOIN public."user" identity ON identity.id=viewer.user_id
    LEFT JOIN public.event_member assigned ON assigned.event_id=t.event_id AND assigned.id=t.assigned_member_id
    LEFT JOIN public."user" assignee ON assignee.id=assigned.user_id
    JOIN public.event_member removing ON removing.event_id=t.event_id AND removing.id=t.deleted_by
    JOIN public."user" remover ON remover.id=removing.user_id
    WHERE t.event_id=$1 AND t.id=$2 AND t.deleted_at IS NOT NULL AND viewer.user_id=$3
    AND viewer.active=TRUE AND viewer.deactivated_at IS NULL AND identity.active=TRUE`,
    [event.toLowerCase(), task.toLowerCase(), user.id],
  );
  const row = rows.rows[0] as
    | {
        id: string;
        title: string;
        context: string;
        category: string;
        status: string;
        version: number;
        deadline: string;
        deadline_time: string | null;
        removed_at: string;
        accepted_at: string | null;
        assignee_name: string | null;
        remover_name: string;
        reminder_count: number;
      }
    | undefined;
  if (!row) throw new EventCommandError(404, "NOT_FOUND");
  return {
    id: row.id,
    eventId: event.toLowerCase(),
    title: row.title,
    context: row.context,
    category: row.category,
    status: row.status,
    version: row.version,
    deadline: row.deadline,
    deadlineTime: row.deadline_time,
    removedAt: row.removed_at,
    acceptedAt: row.accepted_at,
    assigneeName: row.assignee_name,
    removerName: row.remover_name,
    reminderCount: row.reminder_count,
  };
}
