import type { AuthenticatedUser } from "../auth/session.ts";
import { UnauthorizedError } from "../auth/session.ts";
import type {
  AuthorizationDatabase,
  AccessRole,
} from "../authorization/events.ts";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type TransactionPool,
  type TransactionDatabase,
} from "../db/transaction.ts";
import {
  eventColumns,
  eventDto,
  EventCommandError,
  parseEventCommand,
  type EventRow,
  type AccessibleEvent,
  type EventFields,
} from "./model.ts";
import { uuidPattern } from "../tasks/model.ts";
import { createEventHistoryReadService } from "./history.ts";
import { runEventOperation } from "./operations.ts";
import { archiveEvent } from "./archive.ts";
import { clearEventTasks, previewTaskClear } from "./clear.ts";
import { readRemovedTask } from "./removedTask.ts";
export type { AccessibleEvent } from "./model.ts";

export function createEventReadService(database: AuthorizationDatabase) {
  return {
    async list(user: AuthenticatedUser): Promise<AccessibleEvent[]> {
      if (!user?.id) throw new UnauthorizedError();
      const { rows } = await database.query(
        `SELECT event.id, event.name, to_char(event.start_date, 'YYYY-MM-DD') AS start_date,
                to_char(event.end_date, 'YYYY-MM-DD') AS end_date, event.timezone, event.archived_at,
                event.version,
                to_char(event.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
                to_char(event.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at,
                member.id AS member_id, member.access_role
         FROM public.event AS event
         JOIN public.event_member AS member ON member.event_id = event.id
         JOIN public."user" AS identity ON identity.id = member.user_id
         WHERE member.user_id = $1 AND member.active = TRUE
           AND member.deactivated_at IS NULL AND identity.active = TRUE
         ORDER BY event.start_date, event.id`,
        [user.id],
      );
      return rows.map((value) => {
        const row = value as EventRow & {
          member_id: string;
          access_role: AccessRole;
        };
        return eventDto(row, {
          id: row.member_id,
          accessRole: row.access_role,
        });
      });
    },
  };
}

export type EventReadService = ReturnType<typeof createEventReadService>;

async function requireStoredTimezone(
  database: TransactionDatabase,
  timezone: string,
) {
  // PostgreSQL and the runtime may carry different tzdata versions. Reject a
  // valid runtime zone unsupported by the database as a safe validation error.
  const result = await database.query(
    "SELECT public.is_valid_event_timezone($1) AS valid",
    [timezone],
  );
  if (!(result.rows[0] as { valid: boolean } | undefined)?.valid)
    throw new EventCommandError(400, "INVALID_EVENT_COMMAND", {
      timezone: "INVALID_TIMEZONE",
    });
}

async function recordEventActivity(
  database: TransactionDatabase,
  userId: string,
  memberId: string,
  eventId: string,
  action: "EVENT_CREATED" | "EVENT_UPDATED",
  payload: object,
) {
  await database.query(
    `INSERT INTO public.activity_entry
       (id, event_id, actor_user_id, actor_member_id, action_type, target_type, target_id, payload, created_at)
     VALUES ($1, $2, $3, $4, $5, 'event', $2, $6::JSONB, clock_timestamp())`,
    [randomUUID(), eventId, userId, memberId, action, JSON.stringify(payload)],
  );
}

async function insertEvent(
  transaction: TransactionDatabase,
  userId: string,
  fields: EventFields,
  duplication?: {
    sourceEventId: string;
    sourceVersion: number;
    operationId: string;
  },
): Promise<AccessibleEvent> {
  await requireStoredTimezone(transaction, fields.timezone);
  const eventId = randomUUID(),
    memberId = randomUUID();
  const inserted = await transaction.query(
    `INSERT INTO public.event (id, name, start_date, end_date, timezone, owner_user_id)
     VALUES ($1, $2, $3::DATE, $4::DATE, $5, $6) RETURNING ${eventColumns}`,
    [
      eventId,
      fields.name,
      fields.startDate,
      fields.endDate,
      fields.timezone,
      userId,
    ],
  );
  const event = inserted.rows[0] as EventRow;
  await transaction.query(
    `INSERT INTO public.event_member (id, event_id, user_id, access_role, operational_role, active)
     VALUES ($1, $2, $3, 'ORGANIZER', '', TRUE)`,
    [memberId, eventId, userId],
  );
  await recordEventActivity(
    transaction,
    userId,
    memberId,
    eventId,
    "EVENT_CREATED",
    {
      ...fields,
      version: event.version,
      ...(duplication ? { duplication } : {}),
    },
  );
  return eventDto(event, { id: memberId, accessRole: "ORGANIZER" });
}

export function createEventService(
  database: AuthorizationDatabase & TransactionPool,
) {
  const reads = createEventReadService(database);
  async function create(
    user: AuthenticatedUser,
    input: unknown,
  ): Promise<AccessibleEvent> {
    if (!user?.id) throw new UnauthorizedError();
    const fields = parseEventCommand(input);
    return inTransaction(database, async (transaction) => {
      // Keep the creator identity active throughout ownership/membership creation.
      const identities = await transaction.query(
        'SELECT id FROM public."user" WHERE id = $1 AND active = TRUE FOR SHARE',
        [user.id],
      );
      if (!identities.rows.length) throw new UnauthorizedError();
      return insertEvent(transaction, user.id, fields);
    });
  }

  async function update(
    user: AuthenticatedUser,
    event: string,
    input: unknown,
  ): Promise<AccessibleEvent> {
    if (!user?.id) throw new UnauthorizedError();
    if (!uuidPattern.test(event))
      throw new EventCommandError(400, "INVALID_ID");
    const eventId = event.toLowerCase();
    const fields = parseEventCommand(input, true);
    return inTransaction(database, async (transaction) => {
      // Match P1's Event-before-membership lock order. UPDATE serializes Event
      // editors and blocks archive/task commands until this transaction commits.
      const selected = await transaction.query(
        `SELECT ${eventColumns} FROM public.event WHERE id = $1 FOR UPDATE`,
        [eventId],
      );
      const before = selected.rows[0] as EventRow | undefined;
      const members = await transaction.query(
        `SELECT member.id, member.access_role FROM public.event_member AS member
         JOIN public."user" AS identity ON identity.id = member.user_id
         WHERE member.event_id = $1 AND member.user_id = $2 AND member.active = TRUE
           AND member.deactivated_at IS NULL AND identity.active = TRUE
         FOR SHARE OF member, identity`,
        [eventId, user.id],
      );
      const actor = members.rows[0] as
        { id: string; access_role: AccessRole } | undefined;
      if (!before || !actor) throw new EventCommandError(404, "NOT_FOUND");
      if (actor.access_role !== "ORGANIZER")
        throw new EventCommandError(403, "FORBIDDEN");
      if (before.archived_at !== null)
        throw new EventCommandError(403, "EVENT_ARCHIVED");
      // Stale retries conflict even when the requested state now happens to match.
      if (before.version !== fields.expectedVersion)
        throw new EventCommandError(409, "EVENT_VERSION_CONFLICT");
      const previous: EventFields = {
        name: before.name,
        startDate: before.start_date,
        endDate: before.end_date,
        timezone: before.timezone,
      };
      const changedBefore: Partial<EventFields> = {},
        changedAfter: Partial<EventFields> = {};
      for (const key of ["name", "startDate", "endDate", "timezone"] as const) {
        if (previous[key] !== fields[key]) {
          changedBefore[key] = previous[key];
          changedAfter[key] = fields[key];
        }
      }
      if (!Object.keys(changedAfter).length)
        return eventDto(before, {
          id: actor.id,
          accessRole: actor.access_role,
        });
      await requireStoredTimezone(transaction, fields.timezone);
      const updated = await transaction.query(
        `UPDATE public.event SET name = $2, start_date = $3::DATE, end_date = $4::DATE,
           timezone = $5, version = version + 1, updated_at = clock_timestamp()
         WHERE id = $1 AND version = $6 AND archived_at IS NULL RETURNING ${eventColumns}`,
        [
          eventId,
          fields.name,
          fields.startDate,
          fields.endDate,
          fields.timezone,
          fields.expectedVersion,
        ],
      );
      const after = updated.rows[0] as EventRow | undefined;
      if (!after) throw new EventCommandError(409, "EVENT_VERSION_CONFLICT");
      await recordEventActivity(
        transaction,
        user.id,
        actor.id,
        eventId,
        "EVENT_UPDATED",
        {
          before: { ...changedBefore, version: before.version },
          after: { ...changedAfter, version: after.version },
        },
      );
      return eventDto(after, { id: actor.id, accessRole: actor.access_role });
    });
  }
  return {
    ...reads,
    create,
    update,
    archive(
      user: AuthenticatedUser,
      sourceId: string,
      key: unknown,
      input: unknown,
    ) {
      return archiveEvent(database, user, sourceId, key, input);
    },
    duplicate(
      user: AuthenticatedUser,
      sourceId: string,
      key: unknown,
      input: unknown,
    ) {
      return runEventOperation(
        database,
        user,
        sourceId,
        key,
        input,
        async (transaction, fields, source, operationId) => {
          // Project only reviewed target basics; source relationships/lifecycle are
          // never selected or copied. Source is locked and remains untouched.
          const target = {
            name: fields.name,
            startDate: fields.startDate,
            endDate: fields.endDate,
            timezone: fields.timezone,
          };
          return insertEvent(transaction, user.id, target, {
            sourceEventId: source.id,
            sourceVersion: source.version,
            operationId,
          });
        },
      );
    },
    clearPreview: (user: AuthenticatedUser, sourceId: string) =>
      previewTaskClear(database, user, sourceId),
    removedTask: (user: AuthenticatedUser, event: string, task: string) =>
      readRemovedTask(database, user, event, task),
    clearTasks: (
      user: AuthenticatedUser,
      sourceId: string,
      key: unknown,
      input: unknown,
    ) => clearEventTasks(database, user, sourceId, key, input),
    history: createEventHistoryReadService(database),
  };
}

export type EventService = EventReadService &
  Partial<
    Pick<
      ReturnType<typeof createEventService>,
      | "create"
      | "update"
      | "history"
      | "duplicate"
      | "archive"
      | "clearPreview"
      | "clearTasks"
      | "removedTask"
    >
  >;
