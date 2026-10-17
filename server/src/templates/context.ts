import type { AuthenticatedUser } from "../auth/session.ts";
import type { TransactionDatabase } from "../db/transaction.ts";
import {
  eventColumns,
  EventCommandError,
  type EventRow,
} from "../events/model.ts";
export interface TemplateActor {
  id: string;
  access_role: "ORGANIZER" | "MEMBER";
  version: number;
}
export async function lockTemplateContext(
  db: TransactionDatabase,
  user: AuthenticatedUser,
  eventId: string,
  applying: boolean,
) {
  const events = await db.query(
    `SELECT ${eventColumns} FROM public.event WHERE id=$1 FOR ${applying ? "UPDATE" : "SHARE"}`,
    [eventId],
  );
  const members = await db.query(
    `SELECT member.id,member.access_role,member.version FROM public.event_member member
    JOIN public."user" identity ON identity.id=member.user_id
    WHERE member.event_id=$1 AND member.user_id=$2 AND member.active=TRUE
    AND member.deactivated_at IS NULL AND identity.active=TRUE FOR SHARE OF member,identity`,
    [eventId, user.id],
  );
  const event = events.rows[0] as EventRow | undefined,
    actor = members.rows[0] as TemplateActor | undefined;
  if (!event || !actor) throw new EventCommandError(404, "NOT_FOUND");
  if (applying && actor.access_role !== "ORGANIZER")
    throw new EventCommandError(403, "FORBIDDEN");
  if (applying && event.archived_at !== null)
    throw new EventCommandError(403, "EVENT_ARCHIVED");
  return { event, actor };
}
