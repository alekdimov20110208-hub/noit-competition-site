import { createHash } from "node:crypto";
import type { AuthenticatedUser } from "../auth/session.ts";
import { UnauthorizedError } from "../auth/session.ts";
import {
  inTransaction,
  type TransactionDatabase,
  type TransactionPool,
} from "../db/transaction.ts";
import { uuidPattern } from "../tasks/model.ts";
import {
  EventCommandError,
  eventColumns,
  parseEventCommand,
  type AccessibleEvent,
  type EventFields,
  type EventRow,
} from "./model.ts";

export function parseEventOperation(
  user: AuthenticatedUser,
  source: string,
  key: unknown,
  input: unknown,
) {
  if (!user?.id) throw new UnauthorizedError();
  if (!uuidPattern.test(source)) throw new EventCommandError(400, "INVALID_ID");
  if (typeof key !== "string" || !uuidPattern.test(key))
    throw new EventCommandError(400, "INVALID_IDEMPOTENCY_KEY");
  const fields = parseEventCommand(input, "duplicate") as EventFields & {
    expectedVersion: number;
  };
  const sourceId = source.toLowerCase(),
    commandId = key.toLowerCase();
  // Fixed field order, after server validation/canonicalization. No raw body is stored.
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        command: "EVENT_DUPLICATE",
        sourceId,
        expectedVersion: fields.expectedVersion,
        name: fields.name,
        startDate: fields.startDate,
        endDate: fields.endDate,
        timezone: fields.timezone,
      }),
    )
    .digest("hex");
  return { sourceId, commandId, digest, fields };
}

// Narrow Event command boundary, not a framework for unrelated commands.
// Stage 4 establishes it before Stage 5 supplies the duplicate business effect.
export async function runEventOperation(
  pool: TransactionPool,
  user: AuthenticatedUser,
  source: string,
  key: unknown,
  input: unknown,
  work: (
    database: TransactionDatabase,
    fields: EventFields,
    source: EventRow,
    commandId: string,
  ) => Promise<AccessibleEvent>,
): Promise<AccessibleEvent> {
  const command = parseEventOperation(user, source, key, input);
  return inTransaction(pool, async (database) => {
    // Actor/key serialization precedes Event/member locks consistently. Hash
    // collisions only serialize unrelated requests; the exact primary key and
    // digest determine correctness. Independent connections/processes share it.
    await database.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [JSON.stringify([user.id, command.commandId])],
    );
    const selected = await database.query(
      `SELECT ${eventColumns} FROM public.event WHERE id = $1 FOR SHARE`,
      [command.sourceId],
    );
    const members = await database.query(
      `SELECT member.id, member.access_role FROM public.event_member AS member
       JOIN public."user" AS identity ON identity.id = member.user_id
       WHERE member.event_id = $1 AND member.user_id = $2 AND member.active = TRUE
         AND member.deactivated_at IS NULL AND identity.active = TRUE
       FOR SHARE OF member, identity`,
      [command.sourceId, user.id],
    );
    const event = selected.rows[0] as EventRow | undefined;
    const member = members.rows[0] as { access_role: string } | undefined;
    // Always authorize the current source before receipt lookup, including replay.
    if (!event || !member) throw new EventCommandError(404, "NOT_FOUND");
    if (member.access_role !== "ORGANIZER")
      throw new EventCommandError(403, "FORBIDDEN");
    const receipts = await database.query(
      `SELECT command_type, source_event_id, result_event_id, request_digest, outcome
       FROM public.event_command_receipt WHERE actor_user_id = $1 AND command_id = $2`,
      [user.id, command.commandId],
    );
    const receipt = receipts.rows[0] as
      | {
          command_type: string;
          source_event_id: string;
          result_event_id: string;
          request_digest: string;
          outcome: AccessibleEvent;
        }
      | undefined;
    if (receipt) {
      if (
        receipt.command_type !== "EVENT_DUPLICATE" ||
        receipt.source_event_id !== command.sourceId ||
        receipt.request_digest !== command.digest
      )
        throw new EventCommandError(409, "IDEMPOTENCY_KEY_REUSED");
      const destination = await database.query(
        `SELECT id FROM public.event_member WHERE event_id = $1 AND user_id = $2
         AND active = TRUE AND deactivated_at IS NULL AND access_role = 'ORGANIZER' FOR SHARE`,
        [receipt.result_event_id, user.id],
      );
      if (!destination.rows.length)
        throw new EventCommandError(404, "NOT_FOUND");
      return receipt.outcome;
    }
    // Archived sources are eligible. A new command still needs the reviewed
    // version; an accepted exact replay survives later source metadata changes.
    if (event.version !== command.fields.expectedVersion)
      throw new EventCommandError(409, "EVENT_VERSION_CONFLICT");
    const outcome = await work(
      database,
      command.fields,
      event,
      command.commandId,
    );
    await database.query(
      `INSERT INTO public.event_command_receipt
       (actor_user_id, command_id, command_type, source_event_id, result_event_id, request_digest, outcome)
       VALUES ($1, $2, 'EVENT_DUPLICATE', $3, $4, $5, $6::JSONB)`,
      [
        user.id,
        command.commandId,
        command.sourceId,
        outcome.id,
        command.digest,
        JSON.stringify(outcome),
      ],
    );
    return outcome;
  });
}
