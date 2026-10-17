import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { templateIsolatedPool } from "./helpers/template-isolated-db.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";
import { discoverMigrations, runMigrations } from "../src/db/migrations.ts";
import { createTemplateApplicationService } from "../src/templates/service.ts";
import { SEMINAR_BLUEPRINT } from "../src/templates/catalog.ts";
import { EventCommandError } from "../src/events/model.ts";
import type { TemplateSelection } from "../src/templates/model.ts";

// This suite deliberately commits to the explicitly confirmed disposable target.
// It never loads application environment files or uses the shared DB test flag.
const selection: TemplateSelection = {
  templateId: SEMINAR_BLUEPRINT.id,
  templateVersion: 1,
  language: "en",
  itemIds: SEMINAR_BLUEPRINT.items.map((item) => item.id),
};
const denied = (code: string, statusCode: number) => (error: unknown) =>
  error instanceof EventCommandError &&
  error.code === code &&
  error.statusCode === statusCode;

async function fixture(pool: Pool) {
  const client = await pool.connect();
  const f = await createPostgresFixture(client).finally(() => client.release());
  return {
    ...f,
    user: {
      id: f.organizerUser,
      name: "Isolated T2 acceptance",
      email: "t2@example.invalid",
    },
    service: createTemplateApplicationService(pool),
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function reviewCommand(f: Fixture, chosen = selection) {
  const review = await f.service.preview(f.user, f.eventId, chosen);
  return {
    ...chosen,
    expectedEventVersion: review.event.version,
    reviewRevision: review.reviewRevision,
    confirmed: true as const,
  };
}
async function snapshot(pool: Pool, eventId: string) {
  const result = await pool.query(
    `SELECT
      (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.task t WHERE event_id=$1) AS tasks,
      (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') FROM public.activity_entry a WHERE event_id=$1) AS history,
      (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY operation_id),'[]') FROM public.template_application_receipt r WHERE event_id=$1) AS receipts,
      (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM public.task_reminder r JOIN public.task t ON t.id=r.task_id WHERE t.event_id=$1) AS reminders`,
    [eventId],
  );
  return result.rows[0];
}

test(
  "ISOLATED PostgreSQL: T2 acceptance against real migrations and transactions",
  { skip: !process.env.BUDOGRAPH_T2_ISOLATED_DATABASE_URL, timeout: 120000 },
  async (t) => {
    let pool = await templateIsolatedPool();
    try {
      const directory = fileURLToPath(
        new URL("../migrations", import.meta.url),
      );
      await runMigrations(pool, directory);
      await t.test(
        "all migration names/checksums match; rerun has no effects; receipt is RLS protected",
        async () => {
          const expected = (await discoverMigrations(directory)).map(
            ({ version, name, checksum }) => ({ version, name, checksum }),
          );
          assert.equal(expected.length, 12);
          assert.deepEqual(
            (
              await pool.query(
                "SELECT version,name,checksum FROM public.schema_migrations ORDER BY version",
              )
            ).rows,
            expected,
          );
          assert.deepEqual(await runMigrations(pool, directory), {
            applied: 0,
            alreadyApplied: 12,
          });
          const protection = (
            await pool.query(`SELECT c.relrowsecurity,
          (SELECT count(*)::integer FROM pg_policy WHERE polrelid=c.oid) AS policies,
          (SELECT count(*)::integer FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal AND tgenabled='O') AS triggers
          FROM pg_class c WHERE c.oid='public.template_application_receipt'::regclass`)
          ).rows[0];
          assert.deepEqual(protection, {
            relrowsecurity: true,
            policies: 0,
            triggers: 1,
          });
        },
      );

      await t.test(
        "exact reviewed subset commits canonical Tasks, normal History and one receipt together",
        async () => {
          const f = await fixture(pool);
          const chosen = {
            ...selection,
            itemIds: [selection.itemIds[2]!, selection.itemIds[0]!],
          };
          const review = await f.service.preview(f.user, f.eventId, chosen);
          const key = randomUUID();
          const result = await f.service.apply(
            f.user,
            f.eventId,
            key,
            await reviewCommand(f, chosen),
          );
          assert.equal(result.createdCount, 2);
          assert.deepEqual(result.itemIds, [
            selection.itemIds[0],
            selection.itemIds[2],
          ]);
          const tasks = (
            await pool.query(
              `SELECT id,title,category,context,priority,deadline::text AS deadline,
          deadline_time::text AS time,assigned_member_id,accepted_by_member_id,accepted_at,status,version
          FROM public.task WHERE id=ANY($1::uuid[])`,
              [result.taskIds],
            )
          ).rows;
          for (const [index, taskId] of result.taskIds.entries()) {
            const item = review.items[index]!;
            assert.deepEqual(
              tasks.find((row) => row.id === taskId),
              {
                id: taskId,
                title: item.title,
                category: item.category,
                context: item.context,
                priority: item.priority,
                deadline: item.deadline,
                time: item.deadlineTime ? `${item.deadlineTime}:00` : null,
                assigned_member_id: null,
                accepted_by_member_id: null,
                accepted_at: null,
                status: "not-started",
                version: 1,
              },
            );
          }
          const state = await snapshot(pool, f.eventId);
          assert.equal(state.tasks.length, 3); // Two selected, plus untouched fixture Task.
          assert.equal(state.reminders.length, 0);
          assert.equal(state.history.length, 3);
          assert.equal(state.receipts.length, 1);
          assert.deepEqual(state.receipts[0].outcome, result);
          for (const entry of state.history) {
            assert.equal(entry.actor_user_id, f.user.id);
            assert.equal(entry.actor_member_id, f.organizerId);
            assert.equal(entry.payload.templateApplication.operationId, key);
          }
          assert.equal(
            state.history.filter(
              (entry: { action_type: string }) =>
                entry.action_type === "task.created",
            ).length,
            2,
          );
          assert.equal(
            state.history.filter(
              (entry: { action_type: string }) =>
                entry.action_type === "TEMPLATE_APPLIED",
            ).length,
            1,
          );
        },
      );

      await t.test(
        "Member review is read-only and apply is rejected with 403",
        async () => {
          const f = await fixture(pool),
            member = { ...f.user, id: f.memberUser };
          const body = await reviewCommand(f),
            before = await snapshot(pool, f.eventId);
          assert.equal(
            (await f.service.preview(member, f.eventId, selection)).canApply,
            false,
          );
          await assert.rejects(
            f.service.apply(member, f.eventId, randomUUID(), body),
            denied("FORBIDDEN", 403),
          );
          assert.deepEqual(await snapshot(pool, f.eventId), before);
        },
      );
      await t.test(
        "foreign Event preview/apply return non-disclosing 404 without effects",
        async () => {
          const f = await fixture(pool),
            body = await reviewCommand(f),
            before = await snapshot(pool, f.foreignEventId);
          await assert.rejects(
            f.service.preview(f.user, f.foreignEventId, selection),
            denied("NOT_FOUND", 404),
          );
          await assert.rejects(
            f.service.apply(f.user, f.foreignEventId, randomUUID(), body),
            denied("NOT_FOUND", 404),
          );
          assert.deepEqual(await snapshot(pool, f.foreignEventId), before);
        },
      );
      for (const revoked of [
        "membership",
        "identity",
        "role",
        "archive",
      ] as const) {
        await t.test(
          `${revoked}: current authority rejects new application and accepted receipt replay`,
          async () => {
            const f = await fixture(pool),
              body = await reviewCommand(f),
              key = randomUUID();
            await f.service.apply(f.user, f.eventId, key, body);
            if (revoked === "membership")
              await pool.query(
                "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE id=$1",
                [f.organizerId],
              );
            if (revoked === "identity")
              await pool.query(
                'UPDATE public."user" SET active=FALSE WHERE id=$1',
                [f.user.id],
              );
            if (revoked === "role")
              await pool.query(
                "UPDATE public.event_member SET access_role='MEMBER' WHERE id=$1",
                [f.organizerId],
              );
            if (revoked === "archive") {
              await pool.query(
                "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
                [f.eventId],
              );
              assert.equal(
                (await f.service.preview(f.user, f.eventId, selection))
                  .canApply,
                false,
              );
            }
            const before = await snapshot(pool, f.eventId);
            const code =
              revoked === "archive"
                ? "EVENT_ARCHIVED"
                : revoked === "role"
                  ? "FORBIDDEN"
                  : "NOT_FOUND";
            for (const operation of [key, randomUUID()])
              await assert.rejects(
                f.service.apply(f.user, f.eventId, operation, body),
                denied(code, code === "NOT_FOUND" ? 404 : 403),
              );
            assert.deepEqual(await snapshot(pool, f.eventId), before);
          },
        );
      }
      for (const stale of ["version", "date", "matching-task"] as const) {
        await t.test(
          `stale ${stale}: old confirmation is rejected before writes`,
          async () => {
            const f = await fixture(pool),
              body = await reviewCommand(f);
            if (stale === "version")
              await pool.query(
                "UPDATE public.event SET version=version+1 WHERE id=$1",
                [f.eventId],
              );
            if (stale === "date")
              await pool.query(
                "UPDATE public.event SET start_date='2026-10-04' WHERE id=$1",
                [f.eventId],
              );
            if (stale === "matching-task")
              await pool.query("UPDATE public.task SET title=$2 WHERE id=$1", [
                f.taskId,
                SEMINAR_BLUEPRINT.items[0]!.text.en.title,
              ]);
            const before = await snapshot(pool, f.eventId);
            await assert.rejects(
              f.service.apply(f.user, f.eventId, randomUUID(), body),
              denied(
                stale === "version"
                  ? "EVENT_VERSION_CONFLICT"
                  : "TEMPLATE_REVIEW_CONFLICT",
                409,
              ),
            );
            assert.deepEqual(await snapshot(pool, f.eventId), before);
          },
        );
      }

      for (const failure of [
        "task",
        "reminder",
        "history",
        "receipt",
      ] as const) {
        await t.test(
          `real SQL ${failure} failure rolls back all rows; same-key retry then commits`,
          async () => {
            const f = await fixture(pool),
              body = await reviewCommand(f),
              key = randomUUID();
            const before = await snapshot(pool, f.eventId);
            const name = `t2_fail_${failure}`,
              table =
                failure === "task"
                  ? "task"
                  : failure === "reminder"
                    ? "task_reminder"
                    : failure === "history"
                      ? "activity_entry"
                      : "template_application_receipt";
            await pool.query(
              `CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Controlled isolated T2 failure' USING ERRCODE='23514'; END $$`,
            );
            const when =
              failure === "task"
                ? `WHEN (NEW.title = '${SEMINAR_BLUEPRINT.items[2]!.text.en.title.replaceAll("'", "''")}')`
                : failure === "history"
                  ? "WHEN (NEW.action_type = 'TEMPLATE_APPLIED')"
                  : "";
            await pool.query(
              `CREATE TRIGGER ${name} BEFORE ${failure === "reminder" ? "DELETE" : "INSERT"} ON public.${table} FOR EACH ${failure === "reminder" ? "STATEMENT" : "ROW"} ${when} EXECUTE FUNCTION public.${name}()`,
            );
            try {
              await assert.rejects(
                f.service.apply(f.user, f.eventId, key, body),
                (error: unknown) =>
                  typeof error === "object" &&
                  error !== null &&
                  "code" in error &&
                  error.code === "23514",
              );
              assert.deepEqual(await snapshot(pool, f.eventId), before);
            } finally {
              await pool.query(`DROP TRIGGER ${name} ON public.${table}`);
              await pool.query(`DROP FUNCTION public.${name}()`);
            }
            assert.equal(
              (await f.service.apply(f.user, f.eventId, key, body))
                .createdCount,
              4,
            );
          },
        );
      }

      await t.test(
        "eight simultaneous same-key requests commit once; changed payload conflicts",
        async () => {
          const f = await fixture(pool),
            body = await reviewCommand(f),
            key = randomUUID();
          const results = await Promise.all(
            Array.from({ length: 8 }, () =>
              f.service.apply(f.user, f.eventId, key, body),
            ),
          );
          for (const result of results) assert.deepEqual(result, results[0]);
          for (const change of [
            { language: "bg" },
            { itemIds: [selection.itemIds[0]] },
            { reviewRevision: "f".repeat(64) },
          ]) {
            await assert.rejects(
              f.service.apply(f.user, f.eventId, key, { ...body, ...change }),
              denied("IDEMPOTENCY_KEY_REUSED", 409),
            );
          }
          const state = await snapshot(pool, f.eventId);
          assert.equal(state.tasks.length, 5);
          assert.equal(state.history.length, 5);
          assert.equal(state.receipts.length, 1);
        },
      );
      await t.test(
        "lost-response recovery survives closing the pool and changing Event version; receipt stays immutable",
        async () => {
          const f = await fixture(pool),
            body = await reviewCommand(f),
            key = randomUUID();
          // The caller discards the return value. Recovery must use persisted facts.
          await f.service.apply(f.user, f.eventId, key, body);
          const stored = (await snapshot(pool, f.eventId)).receipts[0].outcome;
          await pool.query(
            "UPDATE public.event SET version=version+1 WHERE id=$1",
            [f.eventId],
          );
          await pool.end();
          pool = await templateIsolatedPool();
          const before = await snapshot(pool, f.eventId);
          assert.deepEqual(
            await createTemplateApplicationService(pool).apply(
              f.user,
              f.eventId,
              key,
              body,
            ),
            stored,
          );
          assert.deepEqual(await snapshot(pool, f.eventId), before);
          for (const sql of [
            "UPDATE public.template_application_receipt SET created_at=created_at WHERE operation_id=$1",
            "DELETE FROM public.template_application_receipt WHERE operation_id=$1",
          ]) {
            await assert.rejects(
              pool.query(sql, [key]),
              (error: unknown) =>
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "55000",
            );
          }
          assert.deepEqual(await snapshot(pool, f.eventId), before);
        },
      );

      for (const [start, dates] of [
        [
          "2026-01-01",
          ["2025-12-25", "2025-12-31", "2025-12-31", "2026-01-01"],
        ],
        [
          "2024-03-01",
          ["2024-02-23", "2024-02-29", "2024-02-29", "2024-03-01"],
        ],
        [
          "1900-03-01",
          ["1900-02-22", "1900-02-28", "1900-02-28", "1900-03-01"],
        ],
        [
          "2000-03-01",
          ["2000-02-23", "2000-02-29", "2000-02-29", "2000-03-01"],
        ],
        [
          "2026-03-29",
          ["2026-03-22", "2026-03-28", "2026-03-28", "2026-03-29"],
        ],
        [
          "2026-10-25",
          ["2026-10-18", "2026-10-24", "2026-10-24", "2026-10-25"],
        ],
        [
          "0100-01-01",
          ["0099-12-25", "0099-12-31", "0099-12-31", "0100-01-01"],
        ],
      ] as const) {
        await t.test(
          `calendar ${start}: real DATE/TIME storage preserves day offsets and nullable local time`,
          async () => {
            const f = await fixture(pool);
            await pool.query(
              "UPDATE public.event SET start_date=$2::date,end_date=$2::date WHERE id=$1",
              [f.eventId, start],
            );
            const review = await f.service.preview(
              f.user,
              f.eventId,
              selection,
            );
            assert.deepEqual(
              review.items.map((item) => item.deadline),
              dates,
            );
            const result = await f.service.apply(
              f.user,
              f.eventId,
              randomUUID(),
              await reviewCommand(f),
            );
            const rows = (
              await pool.query(
                "SELECT id,deadline::text AS date,deadline_time::text AS time FROM public.task WHERE id=ANY($1::uuid[])",
                [result.taskIds],
              )
            ).rows;
            assert.deepEqual(
              result.taskIds.map(
                (id) => rows.find((row) => row.id === id).date,
              ),
              dates,
            );
            assert.deepEqual(
              result.taskIds.map(
                (id) => rows.find((row) => row.id === id).time,
              ),
              [null, null, "15:00:00", "08:30:00"],
            );
          },
        );
      }
      await t.test(
        "calendar underflow fails explicitly without rows",
        async () => {
          const f = await fixture(pool);
          await pool.query(
            "UPDATE public.event SET start_date='0001-01-01',end_date='0001-01-01' WHERE id=$1",
            [f.eventId],
          );
          const before = await snapshot(pool, f.eventId);
          await assert.rejects(
            f.service.preview(f.user, f.eventId, selection),
            denied("INVALID_TEMPLATE_DATE", 400),
          );
          assert.deepEqual(await snapshot(pool, f.eventId), before);
        },
      );
    } finally {
      await pool.end();
    }
  },
);
