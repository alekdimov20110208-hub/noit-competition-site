import { createHash, randomUUID } from "node:crypto";
import { UnauthorizedError, type AuthenticatedUser } from "../auth/session.ts";
import {
  inTransaction,
  type TransactionDatabase,
  type TransactionPool,
} from "../db/transaction.ts";
import { uuidPattern } from "../tasks/model.ts";
import {
  eventColumns,
  eventDto,
  EventCommandError,
  type EventRow,
  type AccessibleEvent,
} from "./model.ts";

export function parseClearOperation(
  user: AuthenticatedUser,
  source: string,
  key: unknown,
  input: unknown,
) {
  if (!user?.id) throw new UnauthorizedError();
  if (!uuidPattern.test(source)) throw new EventCommandError(400, "INVALID_ID");
  if (typeof key !== "string" || !uuidPattern.test(key))
    throw new EventCommandError(400, "INVALID_IDEMPOTENCY_KEY");
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new EventCommandError(400, "INVALID_CLEAR_COMMAND");
  const body = input as Record<string, unknown>;
  if (
    Object.keys(body).some(
      (k) =>
        !["expectedVersion", "confirmationName", "scopeRevision"].includes(k),
    ) ||
    !Number.isSafeInteger(body.expectedVersion) ||
    (body.expectedVersion as number) < 1 ||
    (body.expectedVersion as number) > 2147483647 ||
    typeof body.confirmationName !== "string" ||
    !body.confirmationName.length ||
    body.confirmationName.length > 200 ||
    body.confirmationName.includes("\u0000") ||
    /[\uD800-\uDFFF]/u.test(body.confirmationName) ||
    typeof body.scopeRevision !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.scopeRevision)
  )
    throw new EventCommandError(400, "INVALID_CLEAR_COMMAND");
  const sourceId = source.toLowerCase(),
    commandId = key.toLowerCase();
  const fields = {
    expectedVersion: body.expectedVersion as number,
    confirmationName: body.confirmationName,
    scopeRevision: body.scopeRevision,
  };
  const digest = createHash("sha256")
    .update(
      JSON.stringify({ command: "EVENT_TASKS_CLEAR", sourceId, ...fields }),
    )
    .digest("hex");
  return { sourceId, commandId, digest, fields };
}

async function lockOrganizer(
  db: TransactionDatabase,
  user: AuthenticatedUser,
  eventId: string,
) {
  if (!user?.id) throw new UnauthorizedError();
  if (!uuidPattern.test(eventId))
    throw new EventCommandError(400, "INVALID_ID");
  const events = await db.query(
    `SELECT ${eventColumns} FROM public.event WHERE id=$1 FOR UPDATE`,
    [eventId],
  );
  const members = await db.query(
    `SELECT m.id,m.access_role FROM public.event_member m
    JOIN public."user" u ON u.id=m.user_id WHERE m.event_id=$1 AND m.user_id=$2
    AND m.active=TRUE AND m.deactivated_at IS NULL AND u.active=TRUE FOR SHARE OF m,u`,
    [eventId, user.id],
  );
  const event = events.rows[0] as EventRow | undefined;
  const actor = members.rows[0] as
    { id: string; access_role: "ORGANIZER" | "MEMBER" } | undefined;
  if (!event || !actor) throw new EventCommandError(404, "NOT_FOUND");
  if (actor.access_role !== "ORGANIZER")
    throw new EventCommandError(403, "FORBIDDEN");
  if (event.archived_at !== null)
    throw new EventCommandError(403, "EVENT_ARCHIVED");
  return { event, actor };
}

// Event-exclusive serialization stabilizes the whole review across statements.
// Deterministic individual rows are hashed; no list of Task IDs is sent to clients.
async function scopeSnapshot(
  db: TransactionDatabase,
  eventId: string,
  locking: boolean,
) {
  const tasks = await db.query(
    `SELECT id,version,status FROM public.task WHERE event_id=$1 AND deleted_at IS NULL ORDER BY id${locking ? " FOR UPDATE" : ""}`,
    [eventId],
  );
  const reminders = await db.query(
    `SELECT r.id,r.task_id,r.offset_minutes,extract(epoch FROM r.due_at)::TEXT AS due_at,extract(epoch FROM r.trigger_at)::TEXT AS trigger_at FROM public.task_reminder r
    JOIN public.task t ON t.id=r.task_id WHERE t.event_id=$1 AND t.deleted_at IS NULL ORDER BY r.task_id,r.offset_minutes,r.id`,
    [eventId],
  );
  const links = await db.query(
    `SELECT c.id,c.version,l.task_id FROM public.event_change c
    JOIN public.change_task l ON l.event_id=c.event_id AND l.change_id=c.id
    WHERE c.event_id=$1 AND EXISTS (SELECT 1 FROM public.change_task a JOIN public.task t ON t.event_id=a.event_id AND t.id=a.task_id
      WHERE a.event_id=c.event_id AND a.change_id=c.id AND t.deleted_at IS NULL)
    ORDER BY c.id,l.task_id`,
    [eventId],
  );
  const hash = createHash("sha256");
  hash.update("budograph-clear-scope-v1\n");
  for (const [kind, rows] of [
    ["task", tasks.rows],
    ["reminder", reminders.rows],
    ["link", links.rows],
  ] as const)
    for (const row of rows) hash.update(JSON.stringify([kind, row]) + "\n");
  const taskRows = tasks.rows as {
    id: string;
    version: number;
    status: string;
  }[];
  return {
    scopeRevision: hash.digest("hex"),
    taskCount: taskRows.length,
    completedCount: taskRows.filter((t) => t.status === "completed").length,
    affectedChangeCount: new Set(
      (links.rows as { id: string }[]).map((c) => c.id),
    ).size,
    reminderCount: reminders.rows.length,
    versionLimit: taskRows.some((t) => t.version === 2147483647),
  };
}

export async function previewTaskClear(
  pool: TransactionPool,
  user: AuthenticatedUser,
  source: string,
) {
  return inTransaction(pool, async (db) => {
    const { event, actor } = await lockOrganizer(db, user, source);
    const counts = await scopeSnapshot(db, source, false);
    return {
      event: eventDto(event, { id: actor.id, accessRole: actor.access_role }),
      scopeRevision: counts.scopeRevision,
      taskCount: counts.taskCount,
      completedCount: counts.completedCount,
      affectedChangeCount: counts.affectedChangeCount,
      reminderCount: counts.reminderCount,
    };
  });
}
export interface ClearOutcome {
  id: string;
  event: AccessibleEvent;
  operationId: string;
  clearedCount: number;
  completedCount: number;
  affectedChangeCount: number;
  reminderCount: number;
}
export async function clearEventTasks(
  pool: TransactionPool,
  user: AuthenticatedUser,
  source: string,
  key: unknown,
  input: unknown,
): Promise<ClearOutcome> {
  const command = parseClearOperation(user, source, key, input);
  return inTransaction(pool, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      JSON.stringify([user.id, command.commandId]),
    ]);
    const { event: before, actor } = await lockOrganizer(
      db,
      user,
      command.sourceId,
    );
    // Current authority and active lifecycle precede even exact accepted replay.
    const receipts = await db.query(
      "SELECT command_type,source_event_id,request_digest,outcome FROM public.event_command_receipt WHERE actor_user_id=$1 AND command_id=$2",
      [user.id, command.commandId],
    );
    const receipt = receipts.rows[0] as
      | {
          command_type: string;
          source_event_id: string;
          request_digest: string;
          outcome: ClearOutcome;
        }
      | undefined;
    if (receipt) {
      if (
        receipt.command_type !== "EVENT_TASKS_CLEAR" ||
        receipt.source_event_id !== command.sourceId ||
        receipt.request_digest !== command.digest
      )
        throw new EventCommandError(409, "IDEMPOTENCY_KEY_REUSED");
      return receipt.outcome;
    }
    if (before.version !== command.fields.expectedVersion)
      throw new EventCommandError(409, "EVENT_VERSION_CONFLICT");
    if (before.name !== command.fields.confirmationName)
      throw new EventCommandError(400, "INVALID_CLEAR_COMMAND");
    const snapshot = await scopeSnapshot(db, command.sourceId, true);
    if (snapshot.scopeRevision !== command.fields.scopeRevision)
      throw new EventCommandError(409, "TASK_SET_CONFLICT");
    let after = before;
    if (snapshot.taskCount) {
      if (snapshot.versionLimit || before.version === 2147483647)
        throw new EventCommandError(409, "VERSION_LIMIT_REACHED");
      const timestamp = (
        await db.query("SELECT clock_timestamp()::TEXT AS instant")
      ).rows[0] as { instant: string };
      // One set-based effect and bounded per-Task audit; titles and responsibility
      // are preserved. Activity failure rolls back every Task in this transaction.
      await db.query(
        `WITH removed AS (
        UPDATE public.task SET deleted_at=$3::TIMESTAMPTZ,deleted_by=$2,updated_at=$3::TIMESTAMPTZ,updated_by=$2,version=version+1
        WHERE event_id=$1 AND deleted_at IS NULL RETURNING id,version
      ) INSERT INTO public.activity_entry(id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload,created_at)
        SELECT gen_random_uuid(),$1,$4,$2,'task.removed','task',id,
          jsonb_build_object('operationId',$5::TEXT,'previousVersion',version-1,'taskVersion',version,'removedAt',$3::TEXT),$3::TIMESTAMPTZ FROM removed`,
        [
          command.sourceId,
          actor.id,
          timestamp.instant,
          user.id,
          command.commandId,
        ],
      );
      const updated = await db.query(
        `UPDATE public.event SET version=version+1,updated_at=$2::TIMESTAMPTZ WHERE id=$1 RETURNING ${eventColumns}`,
        [command.sourceId, timestamp.instant],
      );
      after = updated.rows[0] as EventRow;
      await db.query(
        `INSERT INTO public.activity_entry(id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload,created_at)
        VALUES($1,$2,$3,$4,'EVENT_TASKS_CLEARED','event',$2,$5::JSONB,$6::TIMESTAMPTZ)`,
        [
          randomUUID(),
          command.sourceId,
          user.id,
          actor.id,
          JSON.stringify({
            operationId: command.commandId,
            scopeRevision: snapshot.scopeRevision,
            clearedCount: snapshot.taskCount,
            completedCount: snapshot.completedCount,
            affectedChangeCount: snapshot.affectedChangeCount,
            reminderCount: snapshot.reminderCount,
            before: { version: before.version },
            after: { version: after.version },
          }),
          timestamp.instant,
        ],
      );
    }
    const outcome: ClearOutcome = {
      id: command.sourceId,
      event: eventDto(after, { id: actor.id, accessRole: actor.access_role }),
      operationId: command.commandId,
      clearedCount: snapshot.taskCount,
      completedCount: snapshot.completedCount,
      affectedChangeCount: snapshot.affectedChangeCount,
      reminderCount: snapshot.reminderCount,
    };
    await db.query(
      `INSERT INTO public.event_command_receipt(actor_user_id,command_id,command_type,source_event_id,result_event_id,request_digest,outcome)
      VALUES($1,$2,'EVENT_TASKS_CLEAR',$3,$3,$4,$5::JSONB)`,
      [
        user.id,
        command.commandId,
        command.sourceId,
        command.digest,
        JSON.stringify(outcome),
      ],
    );
    return outcome;
  });
}
