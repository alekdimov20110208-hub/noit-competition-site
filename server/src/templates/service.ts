import { randomUUID } from "node:crypto";
import { UnauthorizedError, type AuthenticatedUser } from "../auth/session.ts";
import {
  inTransaction,
  type TransactionDatabase,
  type TransactionPool,
} from "../db/transaction.ts";
import {
  eventColumns,
  eventDto,
  EventCommandError,
  type EventRow,
} from "../events/model.ts";
import { insertAuthoredTaskRecord } from "../tasks/creation.ts";
import { uuidPattern } from "../tasks/model.ts";
import {
  digest,
  parseTemplateSelection,
  resolveBlueprint,
  templateEventId,
  type TemplateApplyCommand,
  type TemplateSelection,
} from "./model.ts";

interface TemplateActor {
  id: string;
  access_role: "ORGANIZER" | "MEMBER";
  version: number;
}
export interface TemplateApplyResult {
  eventId: string;
  operationId: string;
  templateId: string;
  templateVersion: number;
  itemIds: string[];
  language: "bg" | "en";
  createdCount: number;
  taskIds: string[];
}

async function lockContext(
  db: TransactionDatabase,
  user: AuthenticatedUser,
  eventId: string,
  applying: boolean,
) {
  // Same Event -> membership -> identity lock order as existing Task commands.
  // Exclusive Event lock serializes application with Task creation/clear/archive.
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

async function reviewSnapshot(
  db: TransactionDatabase,
  user: AuthenticatedUser,
  event: EventRow,
  actor: TemplateActor,
  selection: TemplateSelection,
) {
  const items = resolveBlueprint(selection, event.start_date);
  const matching = await db.query(
    `SELECT id,title,version FROM public.task WHERE event_id=$1 AND deleted_at IS NULL
    AND lower(btrim(title))=ANY($2::TEXT[]) ORDER BY id`,
    [event.id, items.map((item) => item.title.trim().toLowerCase())],
  );
  const target = eventDto(event, {
    id: actor.id,
    accessRole: actor.access_role,
  });
  return {
    event: target,
    ...selection,
    items,
    matchingTaskCount: matching.rows.length,
    canApply: actor.access_role === "ORGANIZER" && event.archived_at === null,
    reviewRevision: digest({
      kind: "TEMPLATE_REVIEW_V1",
      actorUserId: user.id,
      actor,
      event: target,
      selection,
      items,
      matching: matching.rows,
    }),
  };
}

export function createTemplateApplicationService(pool: TransactionPool) {
  async function preview(
    user: AuthenticatedUser,
    target: string,
    input: unknown,
  ) {
    if (!user?.id) throw new UnauthorizedError();
    const eventId = templateEventId(target),
      selection = parseTemplateSelection(input) as TemplateSelection;
    return inTransaction(pool, async (db) => {
      const { event, actor } = await lockContext(db, user, eventId, false);
      return reviewSnapshot(db, user, event, actor, selection);
    });
  }
  async function apply(
    user: AuthenticatedUser,
    target: string,
    key: unknown,
    input: unknown,
  ): Promise<TemplateApplyResult> {
    if (!user?.id) throw new UnauthorizedError();
    const eventId = templateEventId(target);
    if (typeof key !== "string" || !uuidPattern.test(key))
      throw new EventCommandError(400, "INVALID_IDEMPOTENCY_KEY");
    const operationId = key.toLowerCase(),
      command = parseTemplateSelection(input, true) as TemplateApplyCommand;
    const selection: TemplateSelection = {
      templateId: command.templateId,
      templateVersion: command.templateVersion,
      itemIds: command.itemIds,
      language: command.language,
    };
    const requestDigest = digest({
      kind: "TEMPLATE_APPLY_V1",
      actorUserId: user.id,
      eventId,
      command,
    });
    return inTransaction(pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        JSON.stringify(["template-apply", user.id, operationId]),
      ]);
      const { event, actor } = await lockContext(db, user, eventId, true);
      // Replays always require CURRENT active Organizer authority and active Event.
      const receipts = await db.query(
        `SELECT event_id,request_digest,outcome FROM public.template_application_receipt
        WHERE actor_user_id=$1 AND operation_id=$2`,
        [user.id, operationId],
      );
      const receipt = receipts.rows[0] as
        | {
            event_id: string;
            request_digest: string;
            outcome: TemplateApplyResult;
          }
        | undefined;
      if (receipt) {
        if (
          receipt.event_id !== eventId ||
          receipt.request_digest !== requestDigest
        )
          throw new EventCommandError(409, "IDEMPOTENCY_KEY_REUSED");
        return receipt.outcome;
      }
      if (event.version !== command.expectedEventVersion)
        throw new EventCommandError(409, "EVENT_VERSION_CONFLICT");
      const review = await reviewSnapshot(db, user, event, actor, selection);
      if (review.reviewRevision !== command.reviewRevision)
        throw new EventCommandError(409, "TEMPLATE_REVIEW_CONFLICT");
      const taskIds: string[] = [];
      for (const item of review.items) {
        const taskId = randomUUID();
        const after = await insertAuthoredTaskRecord(
          db,
          eventId,
          actor.id,
          item,
          taskId,
        );
        taskIds.push(taskId);
        await db.query(
          `INSERT INTO public.activity_entry
          (id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload,created_at)
          VALUES($1,$2,$3,$4,'task.created','task',$5,$6::JSONB,clock_timestamp())`,
          [
            randomUUID(),
            eventId,
            user.id,
            actor.id,
            taskId,
            JSON.stringify({
              title: after.title,
              category: after.category,
              deadline: after.deadline,
              deadlineTime: after.deadlineTime,
              priority: after.priority,
              reminderOffsets: [],
              assignedMemberId: null,
              taskVersion: after.version,
              templateApplication: {
                operationId,
                templateId: selection.templateId,
                templateVersion: selection.templateVersion,
                itemId: item.itemId,
              },
            }),
          ],
        );
      }
      const outcome: TemplateApplyResult = {
        eventId,
        operationId,
        ...selection,
        createdCount: taskIds.length,
        taskIds,
      };
      await db.query(
        `INSERT INTO public.activity_entry
        (id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload,created_at)
        VALUES($1,$2,$3,$4,'TEMPLATE_APPLIED','event',$2,$5::JSONB,clock_timestamp())`,
        [
          randomUUID(),
          eventId,
          user.id,
          actor.id,
          JSON.stringify({
            templateApplication: {
              operationId,
              templateId: selection.templateId,
              templateVersion: selection.templateVersion,
              createdCount: taskIds.length,
            },
            itemIds: selection.itemIds,
            taskIds,
            language: selection.language,
            reviewRevision: command.reviewRevision,
            version: event.version,
          }),
        ],
      );
      await db.query(
        `INSERT INTO public.template_application_receipt
        (actor_user_id,operation_id,event_id,template_id,template_version,request_digest,outcome)
        VALUES($1,$2,$3,$4,$5,$6,$7::JSONB)`,
        [
          user.id,
          operationId,
          eventId,
          selection.templateId,
          selection.templateVersion,
          requestDigest,
          JSON.stringify(outcome),
        ],
      );
      return outcome;
    });
  }
  return { preview, apply };
}
export type TemplateApplicationService = ReturnType<
  typeof createTemplateApplicationService
>;
