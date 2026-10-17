import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import {
  discoverMigrations,
  runMigrations,
  validateAppliedMigrations,
} from "../src/db/migrations.ts";
import { createEventAuthorization } from "../src/authorization/events.ts";

const integrationEnabled = process.env.RUN_DATABASE_INTEGRATION === "1";
const migrationDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);

interface SchemaTestDatabase {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

function safeIntegrationError(error: unknown): Error & { code?: string } {
  const code = (error as { code?: unknown } | null)?.code;
  return Object.assign(
    new Error(
      "PostgreSQL integration operation failed; database details omitted.",
    ),
    {
      code:
        typeof code === "string" && /^[\dA-Z]{5}$/.test(code)
          ? code
          : undefined,
    },
  );
}

function safeTestDatabase(client: PoolClient): SchemaTestDatabase {
  let disconnected = false;
  client.on("error", () => {
    disconnected = true;
  });
  return {
    query: async (text, values) => {
      try {
        if (disconnected) throw new Error("Integration client disconnected.");
        const result = await client.query(text, values);
        if (disconnected) throw new Error("Integration client disconnected.");
        return result;
      } catch (error) {
        throw safeIntegrationError(error);
      }
    },
  };
}

// Each negative SQL case rolls back to a savepoint. Never print a raw pg error:
// its detail can contain a row or connection information.
async function rejectsSql(
  client: SchemaTestDatabase,
  sql: string,
  values: unknown[],
  expectedCode: string,
): Promise<void> {
  await client.query("SAVEPOINT p1b_negative_case");
  let actualCode: string | undefined;
  try {
    await client.query(sql, values);
  } catch (error) {
    actualCode = (error as { code?: string }).code;
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT p1b_negative_case");
    await client.query("RELEASE SAVEPOINT p1b_negative_case");
  }
  assert.equal(
    actualCode,
    expectedCode,
    "PostgreSQL must reject the invalid fixture with the expected SQLSTATE.",
  );
}

test(
  "approved PostgreSQL P1B schema and authorization integration (rollback-only fixtures)",
  { skip: !integrationEnabled, timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(
      config.nodeEnv,
      "production",
      "Schema fixtures are forbidden in production mode.",
    );
    const pool = createDatabasePool(config, () => {
      // Do not expose pg connection errors. The checked-out client reports failure.
    });
    let client: PoolClient | undefined;
    let transactionOpen = false;
    let cleanupFailed = false;
    try {
      try {
        client = await pool.connect();
      } catch {
        throw new Error(
          "Approved integration database unavailable; connection details omitted.",
        );
      }
      // Do not apply pending migrations from a test suite against a shared DB.
      // The explicit reviewed migration CLI must have run successfully first.
      const files = await discoverMigrations(migrationDirectory);
      const history = await client.query(
        "SELECT version, name, checksum FROM public.schema_migrations ORDER BY version",
      );
      assert.equal(
        validateAppliedMigrations(files, history.rows).length,
        0,
        "Run reviewed P1B migrations explicitly before enabling integration tests.",
      );
      assert.deepEqual(
        files.map((file) => file.name),
        [
          "0001_better_auth_core.sql",
          "0002_budograph_core.sql",
          "0003_event_invitations.sql",
          "0004_event_changes.sql",
          "0005_change_response.sql",
          "0006_task_deadline_time.sql",
          "0007_task_reminders_notifications.sql",
          "0008_event_command_receipts.sql",
          "0009_event_archive_receipts.sql",
          "0010_event_clear_receipts.sql",
          "0011_template_application_receipts.sql",
          "0012_personal_templates.sql",
          "0013_curated_template_catalog.sql",
        ],
      );
      client.release();
      client = undefined;

      await t.test(
        "real migration runner recognizes unchanged history and checksums twice",
        async () => {
          for (let index = 0; index < 2; index += 1) {
            assert.deepEqual(await runMigrations(pool, migrationDirectory), {
              applied: 0,
              alreadyApplied: 13,
            });
          }
        },
      );

      client = await pool.connect();
      const database = safeTestDatabase(client);
      await database.query("BEGIN");
      transactionOpen = true;
      await database.query("SET LOCAL statement_timeout = '10s'");
      await database.query("SET LOCAL lock_timeout = '3s'");
      await database.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");

      const prefix = `p1b-schema-${randomUUID()}`;
      const organizerUser = `${prefix}-organizer`;
      const memberUser = `${prefix}-member`;
      const inactiveUser = `${prefix}-inactive`;
      const eventId = randomUUID();
      const foreignEventId = randomUUID();
      const organizerMember = randomUUID();
      const memberId = randomUUID();
      const foreignMember = randomUUID();
      const inactiveMember = randomUUID();
      const taskId = randomUUID();
      const activityId = randomUUID();

      // Disposable identity rows verify FK storage only, not authentication.
      // Account passwords and sessions are never created by these fixtures.
      for (const [id, active] of [
        [organizerUser, true],
        [memberUser, true],
        [inactiveUser, false],
      ] as const) {
        await database.query(
          `INSERT INTO public."user" (id, name, email, "emailVerified", active, "createdAt", "updatedAt")
           VALUES ($1, 'Disposable schema fixture', $2, FALSE, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [id, `${id}@example.invalid`, active],
        );
      }
      for (const id of [eventId, foreignEventId]) {
        await database.query(
          `INSERT INTO public.event (id, name, start_date, end_date, timezone, owner_user_id)
           VALUES ($1, 'Explicit integration fixture', '2026-10-03', '2026-10-04', 'Europe/Sofia', $2)`,
          [id, organizerUser],
        );
      }
      for (const [id, scopedEventId, userId, role] of [
        [organizerMember, eventId, organizerUser, "ORGANIZER"],
        [memberId, eventId, memberUser, "MEMBER"],
        [foreignMember, foreignEventId, memberUser, "MEMBER"],
        [inactiveMember, eventId, inactiveUser, "MEMBER"],
      ]) {
        await database.query(
          `INSERT INTO public.event_member (id, event_id, user_id, access_role, operational_role)
           VALUES ($1, $2, $3, $4, 'Organizer is descriptive text only')`,
          [id, scopedEventId, userId, role],
        );
      }
      await database.query(
        `INSERT INTO public.task (id, event_id, title, deadline, assigned_member_id, created_by, updated_by)
         VALUES ($1, $2, 'Verify responsibility storage', '2026-10-04', $3, $4, $4)`,
        [taskId, eventId, memberId, organizerMember],
      );

      await t.test(
        "auth/business tables exist with RLS enabled and no direct browser policies",
        async () => {
          const { rows } = await database.query(
            `SELECT relation.relname AS name, relation.relrowsecurity AS row_security,
                  (SELECT COUNT(*)::INT FROM pg_catalog.pg_policy WHERE polrelid = relation.oid) AS policies
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           WHERE namespace.nspname = 'public'
             AND relation.relname = ANY($1::TEXT[])
           ORDER BY relation.relname`,
            [
              [
                "user",
                "session",
                "account",
                "verification",
                "event",
                "event_member",
                "task",
                "activity_entry",
                "event_invitation",
                "event_change",
                "change_task",
                "task_reminder",
                "notification",
              ],
            ],
          );
          assert.equal(rows.length, 13);
          assert.ok(
            rows.every(
              (row) => row.row_security === true && row.policies === 0,
            ),
          );
        },
      );

      await t.test(
        "direct Supabase anon/authenticated roles cannot read auth or business rows",
        async (roleTest) => {
          const roles = ["anon", "authenticated"] as const;
          const existing = await database.query(
            "SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = ANY($1::TEXT[])",
            [[...roles]],
          );
          if (existing.rows.length !== roles.length) {
            roleTest.skip(
              "Supabase browser roles are absent on this PostgreSQL instance.",
            );
            return;
          }
          for (const role of roles) {
            for (const table of [
              'public."user"',
              "public.session",
              "public.account",
              "public.verification",
              "public.event",
              "public.event_member",
              "public.task",
              "public.activity_entry",
              "public.event_invitation",
              "public.event_change",
              "public.change_task",
              "public.task_reminder",
              "public.notification",
            ]) {
              await database.query("SAVEPOINT p1b_browser_role");
              let count: unknown;
              let deniedCode: string | undefined;
              try {
                // Identifiers come only from these fixed test-owned allowlists.
                await database.query(`SET LOCAL ROLE ${role}`);
                const identity = await database.query(
                  "SELECT current_user = $1 AS switched",
                  [role],
                );
                assert.equal(identity.rows[0]?.switched, true);
                try {
                  const result = await database.query(
                    `SELECT COUNT(*)::INT AS count FROM ${table}`,
                  );
                  count = result.rows[0]?.count;
                } catch (error) {
                  deniedCode = (error as { code?: string }).code;
                }
              } finally {
                await database.query("ROLLBACK TO SAVEPOINT p1b_browser_role");
                await database.query("RELEASE SAVEPOINT p1b_browser_role");
              }
              assert.ok(
                count === 0 || deniedCode === "42501",
                "Browser database role must see no rows or receive insufficient-privilege denial.",
              );
            }
          }
        },
      );

      await t.test(
        "Event name is not globally unique and timestamp/version defaults are server-generated",
        async () => {
          const { rows } = await database.query(
            `SELECT COUNT(*)::INT AS count, MIN(version) AS version,
                  BOOL_AND(created_at = CURRENT_TIMESTAMP AND updated_at = CURRENT_TIMESTAMP) AS generated
           FROM public.event WHERE id = ANY($1::UUID[])`,
            [[eventId, foreignEventId]],
          );
          assert.deepEqual(rows[0], { count: 2, version: 1, generated: true });
        },
      );

      await t.test(
        "Event rejects reversed, invalid, infinite dates and invalid timezone",
        async () => {
          for (const [sql, values, code] of [
            [
              "UPDATE public.event SET end_date = '2026-10-01' WHERE id = $1",
              [eventId],
              "23514",
            ],
            [
              "UPDATE public.event SET start_date = '2026-02-30' WHERE id = $1",
              [eventId],
              "22008",
            ],
            [
              "UPDATE public.event SET start_date = '-infinity' WHERE id = $1",
              [eventId],
              "23514",
            ],
            [
              "UPDATE public.event SET end_date = 'infinity' WHERE id = $1",
              [eventId],
              "23514",
            ],
            [
              "UPDATE public.event SET timezone = $2 WHERE id = $1",
              [eventId, "Invented/Timezone"],
              "23514",
            ],
            [
              "UPDATE public.event SET timezone = $2 WHERE id = $1",
              [eventId, "+03:00"],
              "23514",
            ],
            [
              "UPDATE public.event SET name = $2 WHERE id = $1",
              [eventId, " \t\n"],
              "23514",
            ],
            [
              "UPDATE public.event SET version = 0 WHERE id = $1",
              [eventId],
              "23514",
            ],
          ] as const) {
            await rejectsSql(database, sql, [...values], code);
          }
          const { rows } = await database.query(
            "SELECT public.is_valid_event_timezone('UTC') AS utc, public.is_valid_event_timezone('Europe/Sofia') AS sofia",
          );
          assert.deepEqual(rows[0], { utc: true, sofia: true });
        },
      );

      await t.test(
        "membership uniqueness, access roles, version and deactivation are enforced",
        async () => {
          await rejectsSql(
            database,
            "INSERT INTO public.event_member (id, event_id, user_id, access_role) VALUES ($1, $2, $3, 'MEMBER')",
            [randomUUID(), eventId, memberUser],
            "23505",
          );
          for (const sql of [
            "UPDATE public.event_member SET access_role = 'ADMIN' WHERE id = $1",
            "UPDATE public.event_member SET version = 0 WHERE id = $1",
            "UPDATE public.event_member SET active = FALSE WHERE id = $1",
          ])
            await rejectsSql(database, sql, [memberId], "23514");
        },
      );

      await t.test(
        "Task validates all lifecycle and priority values and rejects blank title/version",
        async () => {
          for (const status of [
            "not-started",
            "in-progress",
            "blocked",
            "completed",
          ]) {
            await database.query(
              "UPDATE public.task SET status = $2 WHERE id = $1 AND event_id = $3",
              [taskId, status, eventId],
            );
          }
          for (const priority of ["normal", "important", "critical"]) {
            await database.query(
              "UPDATE public.task SET priority = $2 WHERE id = $1 AND event_id = $3",
              [taskId, priority, eventId],
            );
          }
          for (const sql of [
            "UPDATE public.task SET status = 'ready' WHERE id = $1",
            "UPDATE public.task SET priority = 'urgent' WHERE id = $1",
            "UPDATE public.task SET title = '   ' WHERE id = $1",
            "UPDATE public.task SET title = E' \\t\\n' WHERE id = $1",
            "UPDATE public.task SET version = 0 WHERE id = $1",
            "UPDATE public.task SET deadline = 'infinity' WHERE id = $1",
          ])
            await rejectsSql(database, sql, [taskId], "23514");
        },
      );

      await t.test(
        "assignee and creation/update/deletion actors must share the task Event",
        async () => {
          for (const column of [
            "assigned_member_id",
            "created_by",
            "updated_by",
          ]) {
            // Column names come only from this fixed test-owned allowlist.
            await rejectsSql(
              database,
              `UPDATE public.task SET ${column} = $2 WHERE id = $1 AND event_id = $3`,
              [taskId, foreignMember, eventId],
              "23503",
            );
          }
          await rejectsSql(
            database,
            "UPDATE public.task SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2 WHERE id = $1 AND event_id = $3",
            [taskId, foreignMember, eventId],
            "23503",
          );
        },
      );

      await t.test(
        "acceptance is paired, scoped, and only for the current assigned member",
        async () => {
          for (const [sql, values, code] of [
            [
              "UPDATE public.task SET accepted_by_member_id = $2 WHERE id = $1",
              [taskId, memberId],
              "23514",
            ],
            [
              "UPDATE public.task SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1",
              [taskId],
              "23514",
            ],
            [
              "UPDATE public.task SET accepted_by_member_id = $2, accepted_at = CURRENT_TIMESTAMP WHERE id = $1",
              [taskId, organizerMember],
              "23514",
            ],
            [
              "UPDATE public.task SET assigned_member_id = NULL, accepted_by_member_id = $2, accepted_at = CURRENT_TIMESTAMP WHERE id = $1",
              [taskId, memberId],
              "23514",
            ],
            [
              "UPDATE public.task SET assigned_member_id = $2, accepted_by_member_id = $2, accepted_at = CURRENT_TIMESTAMP WHERE id = $1",
              [taskId, foreignMember],
              "23503",
            ],
          ] as const)
            await rejectsSql(database, sql, [...values], code);
          await database.query(
            "UPDATE public.task SET accepted_by_member_id = $2, accepted_at = CURRENT_TIMESTAMP WHERE id = $1 AND event_id = $3",
            [taskId, memberId, eventId],
          );
          const { rows } = await database.query(
            "SELECT accepted_by_member_id = assigned_member_id AS consistent, accepted_at = CURRENT_TIMESTAMP AS generated FROM public.task WHERE id = $1 AND event_id = $2",
            [taskId, eventId],
          );
          assert.deepEqual(rows[0], { consistent: true, generated: true });
        },
      );

      await t.test(
        "deadline and Event calendar dates stay DATE under a non-UTC database session",
        async () => {
          const { rows } = await database.query(
            `SELECT task.deadline::TEXT AS deadline, pg_typeof(task.deadline)::TEXT AS type,
                  to_char(task.deadline_time, 'HH24:MI') AS "deadlineTime",
                  event.start_date::TEXT AS start_date, event.end_date::TEXT AS end_date
           FROM public.task AS task JOIN public.event AS event ON event.id = task.event_id
           WHERE task.event_id = $1 AND task.id = $2`,
            [eventId, taskId],
          );
          assert.deepEqual(rows[0], {
            deadline: "2026-10-04",
            deadlineTime: null,
            type: "date",
            start_date: "2026-10-03",
            end_date: "2026-10-04",
          });
        },
      );

      await database.query(
        `INSERT INTO public.activity_entry
           (id, event_id, actor_user_id, actor_member_id, action_type, target_type, target_id, payload)
         VALUES ($1, $2, $3, $4, 'task.accepted', 'task', $5, $6::JSONB)`,
        [
          activityId,
          eventId,
          memberUser,
          memberId,
          taskId,
          JSON.stringify({
            before: { acceptedByMemberId: null },
            after: { acceptedByMemberId: memberId },
          }),
        ],
      );

      await t.test(
        "ActivityEntry persists JSONB and server time without mutable version fields",
        async () => {
          const { rows } = await database.query(
            "SELECT payload, created_at = CURRENT_TIMESTAMP AS generated FROM public.activity_entry WHERE id = $1 AND event_id = $2",
            [activityId, eventId],
          );
          assert.equal(rows[0]?.generated, true);
          assert.deepEqual(rows[0]?.payload, {
            before: { acceptedByMemberId: null },
            after: { acceptedByMemberId: memberId },
          });
          const columns = await database.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_entry' AND column_name = ANY($1::TEXT[])",
            [["updated_at", "version"]],
          );
          assert.deepEqual(columns.rows, []);
        },
      );

      await t.test(
        "Activity actor member must match both Event and actor User",
        async () => {
          const sql = `INSERT INTO public.activity_entry
          (id, event_id, actor_user_id, actor_member_id, action_type, target_type, target_id)
          VALUES ($1, $2, $3, $4, 'task.updated', 'task', $5)`;
          await rejectsSql(
            database,
            sql,
            [randomUUID(), eventId, organizerUser, memberId, taskId],
            "23503",
          );
          await rejectsSql(
            database,
            sql,
            [randomUUID(), eventId, memberUser, foreignMember, taskId],
            "23503",
          );
          await database.query(sql, [
            randomUUID(),
            eventId,
            organizerUser,
            null,
            taskId,
          ]);
        },
      );

      await t.test(
        "Activity UPDATE/DELETE are rejected and history survives deactivation/soft deletion",
        async () => {
          await rejectsSql(
            database,
            "UPDATE public.activity_entry SET payload = '{}'::JSONB WHERE id = $1 AND event_id = $2",
            [activityId, eventId],
            "55000",
          );
          await rejectsSql(
            database,
            "DELETE FROM public.activity_entry WHERE id = $1 AND event_id = $2",
            [activityId, eventId],
            "55000",
          );
          const guard = await database.query(
            "SELECT tgtype::INT AS type FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.activity_entry'::REGCLASS AND tgname = 'activity_entry_append_only'",
          );
          // BEFORE (2), DELETE (8), UPDATE (16), TRUNCATE (32), statement-level.
          assert.equal(guard.rows[0]?.type, 58);
          await database.query(
            "UPDATE public.event_member SET active = FALSE, deactivated_at = CURRENT_TIMESTAMP WHERE id = $1 AND event_id = $2",
            [memberId, eventId],
          );
          await database.query(
            "UPDATE public.task SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2 WHERE id = $1 AND event_id = $3",
            [taskId, organizerMember, eventId],
          );
          const { rows } = await database.query(
            "SELECT COUNT(*)::INT AS count FROM public.activity_entry WHERE id = $1 AND event_id = $2",
            [activityId, eventId],
          );
          assert.equal(rows[0]?.count, 1);
        },
      );

      await t.test(
        "history references prevent destructive Event/Member/User cascades",
        async () => {
          await rejectsSql(
            database,
            "DELETE FROM public.event WHERE id = $1",
            [eventId],
            "23503",
          );
          await rejectsSql(
            database,
            "DELETE FROM public.event_member WHERE id = $1 AND event_id = $2",
            [memberId, eventId],
            "23503",
          );
          await rejectsSql(
            database,
            'DELETE FROM public."user" WHERE id = $1',
            [memberUser],
            "23503",
          );
        },
      );

      await t.test(
        "real pg authorization denies inactive User/Member, foreign scope, and operational-role escalation",
        async () => {
          const authorization = createEventAuthorization<{ userId: string }>({
            database,
            // Auth behavior is tested separately; this trusted identity fixture
            // allows real PostgreSQL scope/active-state lookup verification.
            requireAuthenticatedUser: async (request) => ({
              id: request.userId,
              name: "Synthetic identity",
              email: "fixture@example.invalid",
            }),
          });
          assert.equal(
            (
              await authorization.requireOrganizerMembership(
                { userId: organizerUser },
                eventId,
              )
            ).id,
            organizerMember,
          );
          for (const [userId, scopedEventId] of [
            [memberUser, eventId],
            [inactiveUser, eventId],
            [organizerUser, foreignEventId],
          ]) {
            await assert.rejects(
              authorization.requireActiveEventMembership(
                { userId: userId! },
                scopedEventId!,
              ),
              (error: unknown) =>
                (error as { statusCode: number }).statusCode === 404,
            );
          }
          await assert.rejects(
            authorization.requireOrganizerMembership(
              { userId: memberUser },
              foreignEventId,
            ),
            (error: unknown) =>
              (error as { statusCode: number }).statusCode === 403,
          );
        },
      );

      await database.query("ROLLBACK");
      transactionOpen = false;
      await t.test(
        "all synthetic schema fixtures were rolled back",
        async () => {
          const users = await database.query(
            'SELECT COUNT(*)::INT AS count FROM public."user" WHERE id = ANY($1::TEXT[])',
            [[organizerUser, memberUser, inactiveUser]],
          );
          const events = await database.query(
            "SELECT COUNT(*)::INT AS count FROM public.event WHERE id = ANY($1::UUID[])",
            [[eventId, foreignEventId]],
          );
          assert.equal(users.rows[0]?.count, 0);
          assert.equal(events.rows[0]?.count, 0);
        },
      );
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      throw safeIntegrationError(error);
    } finally {
      if (client) {
        try {
          if (transactionOpen) await client.query("ROLLBACK");
        } catch {
          cleanupFailed = true;
        } finally {
          client.release(cleanupFailed);
        }
      }
      try {
        await pool.end();
      } catch {
        cleanupFailed = true;
      }
    }
    assert.equal(
      cleanupFailed,
      false,
      "Integration resource cleanup failed; details omitted.",
    );
  },
);
