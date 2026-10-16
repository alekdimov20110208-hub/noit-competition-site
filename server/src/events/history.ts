import { UnauthorizedError, type AuthenticatedUser } from "../auth/session.ts";
import type { AuthorizationDatabase } from "../authorization/events.ts";
import { uuidPattern } from "../tasks/model.ts";
import { EventCommandError } from "./model.ts";
import { templateHistoryOrigin } from "../templates/history.ts";

export const HISTORY_PAGE_SIZE = 50;
const historyFields = new Set([
  "name",
  "startDate",
  "endDate",
  "timezone",
  "title",
  "category",
  "context",
  "deadline",
  "deadlineTime",
  "priority",
  "reminderOffsets",
  "assignedMemberId",
  "responseOwnerMemberId",
  "affectedTaskIds",
  "decision",
  "response",
  "planB",
]);
function version(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function stateChanges(action: string, payload: Record<string, unknown>) {
  const result: { field: string; before: string | null; after: string }[] = [];
  if (action === "CHANGE_CREATED" || action === "CHANGE_UPDATED") {
    for (const field of ["decision", "response", "planB"]) {
      const change = object(object(payload.changes)[field]);
      const before = action === "CHANGE_CREATED" ? null : change.before;
      const after = action === "CHANGE_CREATED" ? payload[field] : change.after;
      if (
        (before === null || before === "present" || before === "absent") &&
        (after === "present" || after === "absent")
      )
        result.push({ field, before, after });
    }
  }
  const statuses = ["not-started", "in-progress", "blocked", "completed"];
  if (
    action === "task.status_changed" &&
    typeof payload.status === "string" &&
    statuses.includes(payload.status)
  )
    result.push({
      field: "status",
      before:
        typeof payload.previousStatus === "string" &&
        statuses.includes(payload.previousStatus)
          ? payload.previousStatus
          : null,
      after: payload.status,
    });
  return result;
}
interface HistoryRow {
  viewer_id: string;
  cursor_valid: boolean;
  id: string | null;
  event_id: string;
  action_type: string;
  actor_user_id: string;
  actor_member_id: string | null;
  actor_name: string;
  target_type: string;
  target_id: string;
  target_title: string | null;
  target_available: boolean;
  payload: Record<string, unknown>;
  created_at: string;
}

// A single statement authorizes and projects an Event snapshot. Cursor lookup
// stays in that Event and uses stored PostgreSQL microseconds, never JS dates.
export function createEventHistoryReadService(database: AuthorizationDatabase) {
  return async (
    user: AuthenticatedUser,
    event: string,
    before: string | null = null,
  ) => {
    if (!user?.id) throw new UnauthorizedError();
    if (
      !uuidPattern.test(event) ||
      (before !== null && !uuidPattern.test(before))
    )
      throw new EventCommandError(400, "INVALID_ID");
    const eventId = event.toLowerCase();
    const { rows } = await database.query(
      `WITH access AS (
         SELECT member.id FROM public.event_member member
         JOIN public."user" identity ON identity.id = member.user_id
         WHERE member.event_id = $1 AND member.user_id = $2
           AND member.active = TRUE AND member.deactivated_at IS NULL AND identity.active = TRUE
       ), cursor AS (
         SELECT created_at, id FROM public.activity_entry WHERE event_id = $1 AND id = $3::UUID
       )
       SELECT access.id AS viewer_id, ($3::UUID IS NULL OR EXISTS (SELECT 1 FROM cursor)) AS cursor_valid, page.*
       FROM access LEFT JOIN LATERAL (
         SELECT a.id, a.event_id, a.action_type, a.actor_user_id, a.actor_member_id,
                actor.name AS actor_name, a.target_type, a.target_id, a.payload,
                CASE a.target_type WHEN 'task' THEN task.title WHEN 'change' THEN change.title
                  WHEN 'event' THEN event.name ELSE NULL END AS target_title,
                CASE a.target_type WHEN 'task' THEN task.id IS NOT NULL AND task.deleted_at IS NULL
                  WHEN 'change' THEN change.id IS NOT NULL WHEN 'event' THEN event.id IS NOT NULL
                  ELSE FALSE END AS target_available,
                to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
                a.created_at AS sort_time
         FROM public.activity_entry a
         JOIN public."user" actor ON actor.id = a.actor_user_id
         LEFT JOIN public.task task ON a.target_type = 'task' AND task.event_id = a.event_id AND task.id = a.target_id
         LEFT JOIN public.event_change change ON a.target_type = 'change' AND change.event_id = a.event_id AND change.id = a.target_id
         LEFT JOIN public.event event ON a.target_type = 'event' AND event.id = a.event_id AND event.id = a.target_id
         WHERE a.event_id = $1 AND ($3::UUID IS NULL OR (a.created_at, a.id) < (SELECT created_at, id FROM cursor))
         ORDER BY a.created_at DESC, a.id DESC LIMIT $4
       ) page ON TRUE ORDER BY page.sort_time DESC, page.id DESC`,
      [eventId, user.id, before?.toLowerCase() ?? null, HISTORY_PAGE_SIZE + 1],
    );
    if (!rows.length) throw new EventCommandError(404, "NOT_FOUND");
    const records = rows as HistoryRow[];
    if (!records[0]!.cursor_valid)
      throw new EventCommandError(400, "INVALID_HISTORY_CURSOR");
    const existing = records.filter((row) => row.id !== null);
    const entries = existing.slice(0, HISTORY_PAGE_SIZE).map((row) => {
      const payload = object(row.payload),
        after = object(payload.after),
        previous = object(payload.before);
      const templateApplication = ["task.created", "TEMPLATE_APPLIED"].includes(
        row.action_type,
      )
        ? templateHistoryOrigin(payload.templateApplication)
        : undefined;
      return {
        ...(templateApplication ? { templateApplication } : {}),
        id: row.id!,
        eventId: row.event_id,
        action: row.action_type,
        createdAt: row.created_at,
        actor: {
          userId: row.actor_user_id,
          memberId: row.actor_member_id,
          name: row.actor_name,
        },
        target: {
          type: row.target_type,
          id: row.target_id,
          title: row.target_title,
          available: row.target_available,
        },
        version: version(
          payload.taskVersion ??
            payload.changeVersion ??
            after.version ??
            payload.version,
        ),
        previousVersion: version(payload.previousVersion ?? previous.version),
        stateChanges: stateChanges(row.action_type, payload),
        changedFields: Object.keys(
          row.action_type === "CHANGE_UPDATED" ||
            row.action_type === "task.updated"
            ? object(payload.changes)
            : after,
        )
          .filter((field) => historyFields.has(field))
          .sort(),
      };
    });
    return {
      eventId,
      entries,
      nextCursor:
        existing.length > HISTORY_PAGE_SIZE ? entries.at(-1)!.id : null,
    };
  };
}
