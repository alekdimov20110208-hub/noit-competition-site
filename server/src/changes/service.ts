import { randomUUID } from "node:crypto";
import { UnauthorizedError, type AuthenticatedUser } from "../auth/session.ts";
import {
  inTransaction,
  type TransactionDatabase,
  type TransactionPool,
} from "../db/transaction.ts";
import { uuidPattern } from "../tasks/model.ts";
import {
  ChangeCommandError,
  deriveImpact,
  parseChangeCommand,
  type ChangeDto,
  type ChangeFields,
  type ChangeMember,
  type AffectedTask,
} from "./model.ts";

interface ChangeRow {
  id: string;
  event_id: string;
  title: string;
  context: string;
  created_by: string;
  response_owner_member_id: string | null;
  decision_text: string | null;
  decision_author_member_id: string | null;
  decision_created_at: Date | null;
  decision_updated_at: Date | null;
  response_text: string | null;
  plan_b_text: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}
interface ProjectionRow extends ChangeRow {
  reporter: ChangeMember;
  response_owner: ChangeMember | null;
  affected_tasks: AffectedTask[];
  decision_author: ChangeMember | null;
}

// One SQL snapshot for the complete current impact. No duplicated assignments,
// dates, statuses, affected-people rows, or frontend inference are persisted.
async function project(
  database: TransactionDatabase,
  eventId: string,
  changeId?: string,
): Promise<ChangeDto[]> {
  const result = await database.query(
    `SELECT change.*, jsonb_build_object('id', reporter.id, 'name', author.name, 'role', reporter.operational_role) AS reporter,
       CASE WHEN owner.id IS NULL THEN NULL ELSE jsonb_build_object('id', owner.id, 'name', responder.name, 'role', owner.operational_role) END AS response_owner,
       CASE WHEN decision_author.id IS NULL THEN NULL ELSE jsonb_build_object('id', decision_author.id, 'name', decider.name, 'role', decision_author.operational_role) END AS decision_author,
       COALESCE(impact.tasks, '[]'::JSONB) AS affected_tasks
     FROM public.event_change AS change
     JOIN public.event_member AS reporter ON reporter.event_id = change.event_id AND reporter.id = change.created_by
     JOIN public."user" AS author ON author.id = reporter.user_id
     LEFT JOIN public.event_member AS owner ON owner.event_id = change.event_id AND owner.id = change.response_owner_member_id
     LEFT JOIN public."user" AS responder ON responder.id = owner.user_id
     LEFT JOIN public.event_member AS decision_author ON decision_author.event_id = change.event_id AND decision_author.id = change.decision_author_member_id
     LEFT JOIN public."user" AS decider ON decider.id = decision_author.user_id
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(jsonb_build_object('id', task.id, 'title', task.title, 'status', task.status,
         'deadline', to_char(task.deadline, 'YYYY-MM-DD'),
         'deadlineTime', to_char(task.deadline_time, 'HH24:MI'),
         'assignedMember', CASE WHEN assignee.id IS NULL THEN NULL ELSE jsonb_build_object('id', assignee.id, 'name', identity.name, 'role', assignee.operational_role) END)
         ORDER BY task.deadline, task.id) AS tasks
       FROM public.change_task AS link
       JOIN public.task AS task ON task.event_id = link.event_id AND task.id = link.task_id AND task.deleted_at IS NULL
       LEFT JOIN public.event_member AS assignee ON assignee.event_id = task.event_id AND assignee.id = task.assigned_member_id
       LEFT JOIN public."user" AS identity ON identity.id = assignee.user_id
       WHERE link.event_id = change.event_id AND link.change_id = change.id
     ) AS impact ON TRUE
     WHERE change.event_id = $1 ${changeId ? "AND change.id = $2" : ""}
     ORDER BY change.created_at DESC, change.id`,
    changeId ? [eventId, changeId] : [eventId],
  );
  if (changeId && !result.rows.length)
    throw new ChangeCommandError(404, "NOT_FOUND");
  return (result.rows as ProjectionRow[]).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    context: row.context,
    reporter: row.reporter,
    responseOwner: row.response_owner,
    decision:
      row.decision_text === null
        ? null
        : {
            text: row.decision_text,
            authoredBy: row.decision_author!,
            createdAt: row.decision_created_at!.toISOString(),
            updatedAt: row.decision_updated_at!.toISOString(),
          },
    response: row.response_text,
    planB: row.plan_b_text,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    affectedTasks: row.affected_tasks,
    impact: deriveImpact(row.affected_tasks),
  }));
}

async function authorize(
  database: TransactionDatabase,
  user: AuthenticatedUser,
  eventId: string,
  writing: boolean,
) {
  // Match established Event -> identity/membership -> resource lock order.
  const events = await database.query(
    "SELECT archived_at FROM public.event WHERE id = $1 FOR SHARE",
    [eventId],
  );
  const members = await database.query(
    `SELECT member.id, member.access_role FROM public.event_member AS member
     JOIN public."user" AS identity ON identity.id = member.user_id
     WHERE member.event_id = $1 AND member.user_id = $2 AND member.active = TRUE
       AND member.deactivated_at IS NULL AND identity.active = TRUE
     FOR SHARE OF member, identity`,
    [eventId, user.id],
  );
  const event = events.rows[0] as { archived_at: Date | null } | undefined;
  const actor = members.rows[0] as
    { id: string; access_role: string } | undefined;
  if (!event || !actor) throw new ChangeCommandError(404, "NOT_FOUND");
  if (writing && actor.access_role !== "ORGANIZER")
    throw new ChangeCommandError(403, "FORBIDDEN");
  if (writing && event.archived_at !== null)
    throw new ChangeCommandError(403, "EVENT_ARCHIVED");
  return actor;
}
function scope(user: AuthenticatedUser, event: string, change?: string) {
  if (!user?.id) throw new UnauthorizedError();
  if (
    !uuidPattern.test(event) ||
    (change !== undefined && !uuidPattern.test(change))
  )
    throw new ChangeCommandError(400, "INVALID_ID");
  return { eventId: event.toLowerCase(), changeId: change?.toLowerCase() };
}

export function createChangeService(pool: TransactionPool) {
  async function read(user: AuthenticatedUser, event: string, change?: string) {
    const { eventId, changeId } = scope(user, event, change);
    return inTransaction(pool, async (database) => {
      await authorize(database, user, eventId, false);
      return project(database, eventId, changeId);
    });
  }
  async function author(
    user: AuthenticatedUser,
    event: string,
    input: unknown,
    change?: string,
  ): Promise<ChangeDto> {
    const { eventId, changeId } = scope(user, event, change);
    const editing = changeId !== undefined;
    const command = parseChangeCommand(input, editing);
    return inTransaction(pool, async (database) => {
      const actor = await authorize(database, user, eventId, true);
      const targetId = changeId ?? randomUUID();
      let before: ChangeRow | undefined;
      let previousTasks: string[] = [];
      if (editing) {
        const selected = await database.query(
          "SELECT * FROM public.event_change WHERE event_id = $1 AND id = $2 FOR UPDATE",
          [eventId, targetId],
        );
        before = selected.rows[0] as ChangeRow | undefined;
        if (!before) throw new ChangeCommandError(404, "NOT_FOUND");
        if (before.version !== command.expectedVersion)
          throw new ChangeCommandError(409, "CHANGE_VERSION_CONFLICT");
        const links = await database.query(
          "SELECT task_id FROM public.change_task WHERE event_id = $1 AND change_id = $2 ORDER BY task_id",
          [eventId, targetId],
        );
        previousTasks = links.rows.map(
          (value) => (value as { task_id: string }).task_id,
        );
      }
      const fields: ChangeFields = {
        title: command.title ?? before!.title,
        context: command.context ?? before!.context,
        responseOwnerMemberId: Object.hasOwn(command, "responseOwnerMemberId")
          ? command.responseOwnerMemberId!
          : before!.response_owner_member_id,
        affectedTaskIds: command.affectedTaskIds ?? previousTasks,
        decision: Object.hasOwn(command, "decision")
          ? command.decision!
          : before!.decision_text,
        response: Object.hasOwn(command, "response")
          ? command.response!
          : before!.response_text,
        planB: Object.hasOwn(command, "planB")
          ? command.planB!
          : before!.plan_b_text,
      };
      if (command.responseOwnerMemberId) {
        const owners = await database.query(
          `SELECT member.id FROM public.event_member AS member
           JOIN public."user" AS identity ON identity.id = member.user_id
           WHERE member.event_id = $1 AND member.id = $2 AND member.active = TRUE
             AND member.deactivated_at IS NULL AND identity.active = TRUE
           FOR SHARE OF member, identity`,
          [eventId, command.responseOwnerMemberId],
        );
        if (!owners.rows.length)
          throw new ChangeCommandError(400, "INVALID_CHANGE_COMMAND", {
            responseOwnerMemberId: "INVALID_OWNER",
          });
      }
      if (command.affectedTaskIds?.length) {
        const tasks = await database.query(
          "SELECT id FROM public.task WHERE event_id = $1 AND id = ANY($2::UUID[]) AND deleted_at IS NULL ORDER BY id FOR SHARE",
          [eventId, command.affectedTaskIds],
        );
        if (tasks.rows.length !== command.affectedTaskIds.length)
          throw new ChangeCommandError(400, "INVALID_CHANGE_COMMAND", {
            affectedTaskIds: "INVALID_TASKS",
          });
      }
      const changed: Record<string, { before: unknown; after: unknown }> = {};
      if (before) {
        const previous: ChangeFields = {
          title: before.title,
          context: before.context,
          responseOwnerMemberId: before.response_owner_member_id,
          affectedTaskIds: previousTasks,
          decision: before.decision_text,
          response: before.response_text,
          planB: before.plan_b_text,
        };
        for (const key of Object.keys(fields) as (keyof ChangeFields)[]) {
          if (JSON.stringify(previous[key]) !== JSON.stringify(fields[key])) {
            // Describe added/changed/cleared without copying coordination prose
            // into history. The current Change remains authoritative.
            const responseField = ["decision", "response", "planB"].includes(
              key,
            );
            changed[key] = responseField
              ? {
                  before: previous[key] === null ? "absent" : "present",
                  after: fields[key] === null ? "absent" : "present",
                }
              : { before: previous[key], after: fields[key] };
          }
        }
        // Follow existing Task/Event behavior: check stale versions before no-op.
        if (!Object.keys(changed).length)
          return (await project(database, eventId, targetId))[0]!;
        const updated = await database.query(
          `UPDATE public.event_change SET title = $3, context = $4, response_owner_member_id = $5,
             decision_text = $7, response_text = $8, plan_b_text = $9,
             decision_author_member_id = CASE WHEN $10::BOOLEAN THEN CASE WHEN $7::TEXT IS NULL THEN NULL ELSE $11::UUID END ELSE decision_author_member_id END,
             decision_created_at = CASE WHEN $7::TEXT IS NULL THEN NULL ELSE COALESCE(decision_created_at, statement_timestamp()) END,
             decision_updated_at = CASE WHEN $10::BOOLEAN THEN CASE WHEN $7::TEXT IS NULL THEN NULL ELSE statement_timestamp() END ELSE decision_updated_at END,
             version = version + 1, updated_at = statement_timestamp()
           WHERE event_id = $1 AND id = $2 AND version = $6 RETURNING id`,
          [
            eventId,
            targetId,
            fields.title,
            fields.context,
            fields.responseOwnerMemberId,
            command.expectedVersion,
            fields.decision,
            fields.response,
            fields.planB,
            Object.hasOwn(changed, "decision"),
            actor.id,
          ],
        );
        if (!updated.rows.length)
          throw new ChangeCommandError(409, "CHANGE_VERSION_CONFLICT");
      } else {
        await database.query(
          `INSERT INTO public.event_change (id, event_id, title, context, created_by, response_owner_member_id,
             decision_text, response_text, plan_b_text, decision_author_member_id, decision_created_at, decision_updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             CASE WHEN $7::TEXT IS NULL THEN NULL ELSE $5::UUID END,
             CASE WHEN $7::TEXT IS NULL THEN NULL ELSE statement_timestamp() END,
             CASE WHEN $7::TEXT IS NULL THEN NULL ELSE statement_timestamp() END)`,
          [
            targetId,
            eventId,
            fields.title,
            fields.context,
            actor.id,
            fields.responseOwnerMemberId,
            fields.decision,
            fields.response,
            fields.planB,
          ],
        );
      }
      if (!before || Object.hasOwn(changed, "affectedTaskIds")) {
        // Remove only this command's relation rows; no business record deletion.
        await database.query(
          "DELETE FROM public.change_task WHERE event_id = $1 AND change_id = $2",
          [eventId, targetId],
        );
        await database.query(
          "INSERT INTO public.change_task (event_id, change_id, task_id) SELECT $1, $2, unnest($3::UUID[])",
          [eventId, targetId, fields.affectedTaskIds],
        );
      }
      await database.query(
        `INSERT INTO public.activity_entry (id, event_id, actor_user_id, actor_member_id, action_type, target_type, target_id, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, 'change', $6, $7::JSONB, clock_timestamp())`,
        [
          randomUUID(),
          eventId,
          user.id,
          actor.id,
          editing ? "CHANGE_UPDATED" : "CHANGE_CREATED",
          targetId,
          JSON.stringify(
            before
              ? {
                  changes: changed,
                  previousVersion: before.version,
                  changeVersion: before.version + 1,
                }
              : {
                  ...fields,
                  decision: fields.decision === null ? "absent" : "present",
                  response: fields.response === null ? "absent" : "present",
                  planB: fields.planB === null ? "absent" : "present",
                  changeVersion: 1,
                },
          ),
        ],
      );
      return (await project(database, eventId, targetId))[0]!;
    });
  }
  return {
    read,
    create: (user: AuthenticatedUser, event: string, input: unknown) =>
      author(user, event, input),
    update: (
      user: AuthenticatedUser,
      event: string,
      change: string,
      input: unknown,
    ) => author(user, event, input, change),
  };
}
export type ChangeService = ReturnType<typeof createChangeService>;
