import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { templateIsolatedPool } from "./helpers/template-isolated-db.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";
import { runMigrations } from "../src/db/migrations.ts";
import { createTemplateApplicationService } from "../src/templates/service.ts";
import { SEMINAR_BLUEPRINT } from "../src/templates/catalog.ts";
import type { TransactionPool } from "../src/db/transaction.ts";

test(
  "ISOLATED PostgreSQL: template atomicity, real same-key concurrency and receipt recovery in a fresh process",
  {
    skip: !process.env.BUDOGRAPH_T2_ISOLATED_DATABASE_URL,
    timeout: 120000,
  },
  async () => {
    const pool = await templateIsolatedPool();
    try {
      await runMigrations(
        pool,
        fileURLToPath(new URL("../migrations", import.meta.url)),
      );
      const client = await pool.connect();
      const f = await createPostgresFixture(client).finally(() =>
        client.release(),
      );
      const service = createTemplateApplicationService(pool);
      const user = {
        id: f.organizerUser,
        name: "Isolated",
        email: "isolated@example.invalid",
      };
      const selection = {
        templateId: SEMINAR_BLUEPRINT.id,
        templateVersion: 1,
        language: "en",
        itemIds: SEMINAR_BLUEPRINT.items.map((i) => i.id),
      };
      const review = await service.preview(user, f.eventId, selection);
      const body = {
        ...selection,
        expectedEventVersion: review.event.version,
        reviewRevision: review.reviewRevision,
        confirmed: true,
      };
      const key = randomUUID();
      const [a, b] = await Promise.all([
        service.apply(user, f.eventId, key, body),
        service.apply(user, f.eventId, key, body),
      ]);
      assert.deepEqual(a, b);
      assert.equal(a.createdCount, 4);
      const tasks = (
        await pool.query(
          `SELECT assigned_member_id,accepted_by_member_id,accepted_at,status,version FROM public.task WHERE id=ANY($1::UUID[])`,
          [a.taskIds],
        )
      ).rows;
      assert.equal(tasks.length, 4);
      for (const task of tasks)
        assert.deepEqual(task, {
          assigned_member_id: null,
          accepted_by_member_id: null,
          accepted_at: null,
          status: "not-started",
          version: 1,
        });
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::INTEGER AS n FROM public.task_reminder WHERE task_id=ANY($1::UUID[])",
            [a.taskIds],
          )
        ).rows[0].n,
        0,
      );
      const history = (
        await pool.query(
          "SELECT action_type,payload FROM public.activity_entry WHERE event_id=$1 AND payload->'templateApplication'->>'operationId'=$2",
          [f.eventId, key],
        )
      ).rows;
      assert.equal(history.length, 5);
      assert.equal(
        history.filter((h) => h.action_type === "task.created").length,
        4,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::INTEGER AS n FROM public.template_application_receipt WHERE actor_user_id=$1 AND operation_id=$2",
            [user.id, key],
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(
        service.apply(user, f.eventId, key, { ...body, language: "bg" }),
      );
      await assert.rejects(
        service.apply({ ...user, id: f.memberUser }, f.eventId, key, body),
      );
      await assert.rejects(service.apply(user, f.foreignEventId, key, body));
      const restarted = await promisify(execFile)(process.execPath, [
        fileURLToPath(
          new URL("./helpers/template-isolated-replay.ts", import.meta.url),
        ),
        user.id,
        f.eventId,
        key,
        JSON.stringify(body),
      ]);
      assert.deepEqual(JSON.parse(restarted.stdout), a);
      const counts = async () =>
        (
          await pool.query(
            `SELECT (SELECT count(*) FROM public.task WHERE event_id=$1)::INTEGER AS tasks,
      (SELECT count(*) FROM public.activity_entry WHERE event_id=$1)::INTEGER AS history,
      (SELECT count(*) FROM public.template_application_receipt WHERE event_id=$1)::INTEGER AS receipts`,
            [f.eventId],
          )
        ).rows[0];
      const before = await counts();
      const failing: TransactionPool = {
        connect: async () => {
          const connection = await pool.connect();
          return {
            on: connection.on.bind(connection),
            removeListener: connection.removeListener.bind(connection),
            release: connection.release.bind(connection),
            query: async (sql, values) => {
              if (
                sql.startsWith(
                  "INSERT INTO public.template_application_receipt",
                )
              )
                throw Error("forced receipt failure");
              return connection.query(sql, values);
            },
          };
        },
      };
      const fresh = await service.preview(user, f.eventId, selection),
        failedKey = randomUUID();
      const freshBody = { ...body, reviewRevision: fresh.reviewRevision };
      await assert.rejects(
        createTemplateApplicationService(failing).apply(
          user,
          f.eventId,
          failedKey,
          freshBody,
        ),
      );
      assert.deepEqual(await counts(), before);
      await service.apply(user, f.eventId, failedKey, freshBody);
      assert.equal((await counts()).tasks, before.tasks + 4);
      await pool.query(
        "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE id=$1",
        [f.organizerId],
      );
      await assert.rejects(service.apply(user, f.eventId, key, body));
    } finally {
      await pool.end();
    }
  },
);
