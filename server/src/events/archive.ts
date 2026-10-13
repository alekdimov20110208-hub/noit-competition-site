import { createHash, randomUUID } from "node:crypto";
import { UnauthorizedError, type AuthenticatedUser } from "../auth/session.ts";
import { inTransaction, type TransactionPool } from "../db/transaction.ts";
import { uuidPattern } from "../tasks/model.ts";
import {
  eventColumns,
  eventDto,
  EventCommandError,
  type EventRow,
  type AccessibleEvent,
} from "./model.ts";

export function parseArchiveOperation(
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
    throw new EventCommandError(400, "INVALID_ARCHIVE_COMMAND");
  const body = input as Record<string, unknown>;
  if (
    Object.keys(body).some(
      (k) => !["confirmationName", "expectedVersion"].includes(k),
    )
  )
    throw new EventCommandError(400, "INVALID_ARCHIVE_COMMAND");
  if (
    !Number.isSafeInteger(body.expectedVersion) ||
    (body.expectedVersion as number) < 1 ||
    (body.expectedVersion as number) > 2147483647
  )
    throw new EventCommandError(400, "INVALID_ARCHIVE_COMMAND", {
      expectedVersion: "INVALID_VERSION",
    });
  if (
    typeof body.confirmationName !== "string" ||
    !body.confirmationName.length ||
    body.confirmationName.length > 200 ||
    body.confirmationName.includes("\u0000") ||
    /[\uD800-\uDFFF]/u.test(body.confirmationName)
  )
    throw new EventCommandError(400, "INVALID_ARCHIVE_COMMAND", {
      confirmationName: "INVALID_CONFIRMATION",
    });
  const sourceId = source.toLowerCase(),
    commandId = key.toLowerCase();
  const fields = {
    expectedVersion: body.expectedVersion as number,
    confirmationName: body.confirmationName,
  };
  const digest = createHash("sha256")
    .update(JSON.stringify({ command: "EVENT_ARCHIVE", sourceId, ...fields }))
    .digest("hex");
  return { sourceId, commandId, digest, fields };
}

export async function archiveEvent(
  pool: TransactionPool,
  user: AuthenticatedUser,
  source: string,
  key: unknown,
  input: unknown,
): Promise<AccessibleEvent> {
  const command = parseArchiveOperation(user, source, key, input);
  return inTransaction(pool, async (db) => {
    // Same actor/key serialization as Duplicate, then exclusive Event lock.
    // All business writers/workers take Event first; none can cross this commit.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      JSON.stringify([user.id, command.commandId]),
    ]);
    const events = await db.query(
      `SELECT ${eventColumns} FROM public.event WHERE id = $1 FOR UPDATE`,
      [command.sourceId],
    );
    const members = await db.query(
      `SELECT member.id, member.access_role FROM public.event_member member
      JOIN public."user" identity ON identity.id = member.user_id
      WHERE member.event_id = $1 AND member.user_id = $2 AND member.active = TRUE
        AND member.deactivated_at IS NULL AND identity.active = TRUE FOR SHARE OF member, identity`,
      [command.sourceId, user.id],
    );
    const before = events.rows[0] as EventRow | undefined;
    const actor = members.rows[0] as
      { id: string; access_role: "ORGANIZER" | "MEMBER" } | undefined;
    // Approved Event Management contract: any active same-Event Organizer.
    // Ownership and descriptive operational responsibilities do not grant access.
    if (!before || !actor) throw new EventCommandError(404, "NOT_FOUND");
    if (actor.access_role !== "ORGANIZER")
      throw new EventCommandError(403, "FORBIDDEN");
    const receipts = await db.query(
      `SELECT command_type, source_event_id, request_digest, outcome FROM public.event_command_receipt WHERE actor_user_id=$1 AND command_id=$2`,
      [user.id, command.commandId],
    );
    const receipt = receipts.rows[0] as
      | {
          command_type: string;
          source_event_id: string;
          request_digest: string;
          outcome: AccessibleEvent;
        }
      | undefined;
    if (receipt) {
      if (
        receipt.command_type !== "EVENT_ARCHIVE" ||
        receipt.source_event_id !== command.sourceId ||
        receipt.request_digest !== command.digest
      )
        throw new EventCommandError(409, "IDEMPOTENCY_KEY_REUSED");
      return receipt.outcome;
    }
    if (before.version !== command.fields.expectedVersion)
      throw new EventCommandError(409, "EVENT_VERSION_CONFLICT");
    // No trimming, case folding or Unicode normalization of typed confirmation.
    if (before.name !== command.fields.confirmationName)
      throw new EventCommandError(400, "INVALID_ARCHIVE_COMMAND", {
        confirmationName: "INVALID_CONFIRMATION",
      });
    let after = before;
    if (before.archived_at === null) {
      if (before.version === 2147483647)
        throw new EventCommandError(409, "VERSION_LIMIT_REACHED");
      const result = await db.query(
        `UPDATE public.event SET archived_at=clock_timestamp(), updated_at=clock_timestamp(), version=version+1 WHERE id=$1 RETURNING ${eventColumns}`,
        [command.sourceId],
      );
      after = result.rows[0] as EventRow;
      await db.query(
        `INSERT INTO public.activity_entry (id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload,created_at)
        VALUES ($1,$2,$3,$4,'EVENT_ARCHIVED','event',$2,$5::JSONB,clock_timestamp())`,
        [
          randomUUID(),
          command.sourceId,
          user.id,
          actor.id,
          JSON.stringify({
            before: { version: before.version, archived: false },
            after: { version: after.version, archived: true },
            operationId: command.commandId,
          }),
        ],
      );
    }
    // Current-version already-archived requests are recorded no-ops; stale ones
    // conflict. Exact accepted replay is the sole version-check exception.
    const outcome = eventDto(after, {
      id: actor.id,
      accessRole: actor.access_role,
    });
    await db.query(
      `INSERT INTO public.event_command_receipt (actor_user_id,command_id,command_type,source_event_id,result_event_id,request_digest,outcome)
      VALUES ($1,$2,'EVENT_ARCHIVE',$3,$3,$4,$5::JSONB)`,
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
