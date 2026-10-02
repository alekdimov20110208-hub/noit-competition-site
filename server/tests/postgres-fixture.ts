import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { TransactionPool } from "../src/db/transaction.ts";

// Explicit test-only outer transaction. Each production command's BEGIN/COMMIT
// maps to a real PostgreSQL savepoint; the outer fixture transaction rolls back.
// Do not use this wrapper for concurrent tests or in runtime code.
export function rollbackCommandPool(client: PoolClient): TransactionPool {
  let busy = false;
  return {
    async connect() {
      if (busy)
        throw new Error("Fixture client cannot run concurrent commands.");
      busy = true;
      return {
        on: (event, listener) => client.on(event, listener),
        removeListener: (event, listener) =>
          client.removeListener(event, listener),
        release: () => {
          busy = false;
        },
        async query(sql, values) {
          if (sql === "BEGIN") return client.query("SAVEPOINT p1c_command");
          if (sql === "COMMIT")
            return client.query("RELEASE SAVEPOINT p1c_command");
          if (sql === "ROLLBACK") {
            await client.query("ROLLBACK TO SAVEPOINT p1c_command");
            return client.query("RELEASE SAVEPOINT p1c_command");
          }
          return client.query(sql, values);
        },
      };
    },
  };
}

export async function createPostgresFixture(client: PoolClient) {
  const prefix = `p1c-${randomUUID()}`;
  const organizerUser = `${prefix}-organizer`,
    memberUser = `${prefix}-member`,
    foreignUser = `${prefix}-foreign`,
    inactiveUser = `${prefix}-inactive`;
  const eventId = randomUUID(),
    foreignEventId = randomUUID(),
    organizerId = randomUUID(),
    memberId = randomUUID(),
    inactiveId = randomUUID(),
    inactiveUserMemberId = randomUUID(),
    foreignMemberId = randomUUID(),
    taskId = randomUUID(),
    foreignTaskId = randomUUID();
  for (const userId of [organizerUser, memberUser, foreignUser, inactiveUser]) {
    await client.query(
      `INSERT INTO public."user" (id, name, email, "emailVerified", active, "createdAt", "updatedAt")
      VALUES ($1, 'Disposable P1C fixture', $2, FALSE, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, `${userId}@example.invalid`, userId !== inactiveUser],
    );
  }
  for (const [id, owner] of [
    [eventId, organizerUser],
    [foreignEventId, foreignUser],
  ]) {
    await client.query(
      `INSERT INTO public.event (id, name, start_date, end_date, timezone, owner_user_id)
      VALUES ($1, 'Disposable P1C fixture', '2026-10-03', '2026-10-04', 'Europe/Sofia', $2)`,
      [id, owner],
    );
  }
  // inactiveId belongs to a distinct active user in Event A, but is deactivated.
  for (const [id, event, user, role, active] of [
    [organizerId, eventId, organizerUser, "ORGANIZER", true],
    [memberId, eventId, memberUser, "MEMBER", true],
    [inactiveId, eventId, foreignUser, "MEMBER", false],
    [inactiveUserMemberId, eventId, inactiveUser, "MEMBER", true],
    [foreignMemberId, foreignEventId, foreignUser, "ORGANIZER", true],
  ] as const) {
    await client.query(
      `INSERT INTO public.event_member (id, event_id, user_id, access_role, operational_role, active, deactivated_at)
      VALUES ($1, $2, $3, $4, 'Organizer', $5, CASE WHEN $5 THEN NULL ELSE CURRENT_TIMESTAMP END)`,
      [id, event, user, role, active],
    );
  }
  for (const [id, event, creator] of [
    [taskId, eventId, organizerId],
    [foreignTaskId, foreignEventId, foreignMemberId],
  ]) {
    await client.query(
      `INSERT INTO public.task (id, event_id, title, deadline, created_by, updated_by)
      VALUES ($1, $2, 'Disposable P1C task', '2026-10-04', $3, $3)`,
      [id, event, creator],
    );
  }
  return {
    prefix,
    eventId,
    foreignEventId,
    organizerId,
    memberId,
    inactiveId,
    inactiveUserMemberId,
    foreignMemberId,
    taskId,
    foreignTaskId,
    organizerUser,
    memberUser,
    foreignUser,
    inactiveUser,
  };
}
