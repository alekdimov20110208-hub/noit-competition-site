import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { templateIsolatedPool } from "./helpers/template-isolated-db.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";
import { runMigrations } from "../src/db/migrations.ts";
import { CURATED_TEMPLATES } from "../src/templates/curated.ts";
import { SEMINAR_BLUEPRINT } from "../src/templates/catalog.ts";
import { createTemplateApplicationService } from "../src/templates/service.ts";
import type { TransactionPool } from "../src/db/transaction.ts";

const enabled = Boolean(process.env.BUDOGRAPH_T2_ISOLATED_DATABASE_URL);
const migrations = fileURLToPath(new URL("../migrations", import.meta.url));
for (const template of CURATED_TEMPLATES)
  test(
    `ISOLATED PostgreSQL curated ${template.id}: BG/EN, same-key concurrency, durable replay, exact Tasks and History`,
    { skip: !enabled, timeout: 30000 },
    async () => {
      const pool = await templateIsolatedPool();
      try {
        await runMigrations(pool, migrations);
        const client = await pool.connect(),
          f = await createPostgresFixture(client).finally(() =>
            client.release(),
          );
        const user = {
          id: f.organizerUser,
          name: "Isolated curated",
          email: "curated@example.invalid",
        };
        const service = createTemplateApplicationService(pool);
        for (const language of ["bg", "en"] as const) {
          const selection = {
            templateId: template.id,
            templateVersion: 1,
            itemIds: template.items.map((i) => i.id),
            language,
          };
          const review = await service.preview(user, f.eventId, selection);
          const command = {
              ...selection,
              expectedEventVersion: review.event.version,
              reviewRevision: review.reviewRevision,
              confirmed: true,
            },
            key = randomUUID();
          const [a, b] = await Promise.all([
            service.apply(user, f.eventId, key, command),
            service.apply(user, f.eventId, key, command),
          ]);
          assert.deepEqual(a, b);
          assert.equal(a.createdCount, template.items.length);
          const rows = (
            await pool.query(
              "SELECT title,context,category,priority,deadline::TEXT,deadline_time,assigned_member_id,accepted_at,accepted_by_member_id,status,version FROM public.task WHERE id=ANY($1::UUID[])",
              [a.taskIds],
            )
          ).rows;
          assert.equal(rows.length, template.items.length);
          for (const item of review.items) {
            const row = rows.find((r) => r.title === item.title);
            assert.ok(row);
            assert.deepEqual(row, {
              title: item.title,
              context: item.context,
              category: item.category,
              priority: item.priority,
              deadline: item.deadline,
              deadline_time: null,
              assigned_member_id: null,
              accepted_at: null,
              accepted_by_member_id: null,
              status: "not-started",
              version: 1,
            });
          }
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT n FROM public.task_reminder WHERE task_id=ANY($1::UUID[])",
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
          assert.equal(history.length, template.items.length + 1);
          assert.ok(
            history.every(
              (h) => h.payload.templateApplication.templateId === template.id,
            ),
          );
          assert.equal(
            history.filter((h) => h.action_type === "TEMPLATE_APPLIED").length,
            1,
          );
          const receipt = (
            await pool.query(
              "SELECT outcome FROM public.template_application_receipt WHERE actor_user_id=$1 AND operation_id=$2",
              [user.id, key],
            )
          ).rows;
          assert.equal(receipt.length, 1);
          assert.deepEqual(receipt[0].outcome, a);
          const restarted = await promisify(execFile)(process.execPath, [
            fileURLToPath(
              new URL("./helpers/template-isolated-replay.ts", import.meta.url),
            ),
            user.id,
            f.eventId,
            key,
            JSON.stringify(command),
          ]);
          assert.deepEqual(JSON.parse(restarted.stdout), a);
          await assert.rejects(
            service.apply(user, f.eventId, key, {
              ...command,
              language: language === "en" ? "bg" : "en",
            }),
            { code: "IDEMPOTENCY_KEY_REUSED" },
          );
          const other = CURATED_TEMPLATES.find((t) => t.id !== template.id)!;
          const otherSelection = {
            ...selection,
            templateId: other.id,
            itemIds: [other.items[0]!.id],
          };
          const otherReview = await service.preview(
            user,
            f.eventId,
            otherSelection,
          );
          await assert.rejects(
            service.apply(user, f.eventId, key, {
              ...otherSelection,
              expectedEventVersion: otherReview.event.version,
              reviewRevision: otherReview.reviewRevision,
              confirmed: true,
            }),
            { code: "IDEMPOTENCY_KEY_REUSED" },
          );
        }
      } finally {
        await pool.end();
      }
    },
  );

test(
  "ISOLATED PostgreSQL curated: permissions, stale review, duplicate matching, UUID separation, rollback at Task/History/receipt and 0013 checks",
  { skip: !enabled, timeout: 30000 },
  async () => {
    const pool = await templateIsolatedPool();
    try {
      await runMigrations(pool, migrations);
      const client = await pool.connect(),
        f = await createPostgresFixture(client).finally(() => client.release());
      const user = {
          id: f.organizerUser,
          name: "Isolated curated",
          email: "curated@example.invalid",
        },
        service = createTemplateApplicationService(pool),
        template = CURATED_TEMPLATES[0]!;
      const selection = {
        templateId: template.id,
        templateVersion: 1,
        itemIds: template.items.slice(0, 3).map((i) => i.id),
        language: "en",
      };
      const member = { ...user, id: f.memberUser },
        memberReview = await service.preview(member, f.eventId, selection);
      assert.equal(memberReview.canApply, false);
      const review = await service.preview(user, f.eventId, selection);
      const command = {
        ...selection,
        expectedEventVersion: review.event.version,
        reviewRevision: review.reviewRevision,
        confirmed: true,
      };
      await assert.rejects(
        service.apply(member, f.eventId, randomUUID(), command),
        { code: "FORBIDDEN" },
      );
      await assert.rejects(service.preview(user, f.foreignEventId, selection), {
        code: "NOT_FOUND",
      });
      await assert.rejects(
        service.preview(user, f.eventId, {
          ...selection,
          templateId: randomUUID(),
          itemIds: [randomUUID()],
        }),
        { code: "NOT_FOUND" },
      );
      const counts = async () =>
        (
          await pool.query(
            "SELECT (SELECT count(*) FROM public.task WHERE event_id=$1)::INT tasks,(SELECT count(*) FROM public.activity_entry WHERE event_id=$1)::INT history,(SELECT count(*) FROM public.template_application_receipt WHERE event_id=$1)::INT receipts",
            [f.eventId],
          )
        ).rows[0];
      for (const point of [
        "task",
        "activity_entry",
        "template_application_receipt",
      ]) {
        const before = await counts();
        let inserts = 0;
        const failing: TransactionPool = {
          connect: async () => {
            const db = await pool.connect();
            return {
              on: db.on.bind(db),
              removeListener: db.removeListener.bind(db),
              release: db.release.bind(db),
              query: async (sql, values) => {
                if (
                  sql.startsWith(`INSERT INTO public.${point}`) &&
                  ++inserts === (point === "task" ? 2 : 1)
                )
                  throw Error("injected curated rollback");
                return db.query(sql, values);
              },
            };
          },
        };
        await assert.rejects(
          createTemplateApplicationService(failing).apply(
            user,
            f.eventId,
            randomUUID(),
            command,
          ),
        );
        assert.deepEqual(await counts(), before);
      }
      const result = await service.apply(
        user,
        f.eventId,
        randomUUID(),
        command,
      );
      const fresh = await service.preview(user, f.eventId, selection);
      assert.equal(fresh.matchingTaskCount, 3);
      await assert.rejects(
        service.apply(user, f.eventId, randomUUID(), command),
        { code: "TEMPLATE_REVIEW_CONFLICT" },
      );
      const receipt = (
        await pool.query(
          "SELECT * FROM public.template_application_receipt WHERE operation_id=$1",
          [result.operationId],
        )
      ).rows[0];
      for (const [id, version] of [
        ["curated-../escape", 1],
        ["curated-" + "x".repeat(101), 1],
        [template.id, 2],
        [randomUUID(), 0],
      ] as const) {
        const operation = randomUUID(),
          outcome = {
            ...receipt.outcome,
            templateId: id,
            templateVersion: version,
            operationId: operation,
          };
        await assert.rejects(
          pool.query(
            "INSERT INTO public.template_application_receipt(actor_user_id,operation_id,event_id,template_id,template_version,request_digest,outcome) VALUES($1,$2,$3,$4,$5,$6,$7::JSONB)",
            [
              user.id,
              operation,
              f.eventId,
              id,
              version,
              receipt.request_digest,
              JSON.stringify(outcome),
            ],
          ),
          { code: "23514" },
        );
      }
      const immutable = (
        await pool.query(
          "SELECT tgenabled FROM pg_trigger WHERE tgrelid='public.template_application_receipt'::regclass AND tgname='template_application_receipt_immutable'",
        )
      ).rows;
      assert.equal(immutable[0].tgenabled, "O");
      assert.equal(
        (
          await pool.query(
            "SELECT relrowsecurity FROM pg_class WHERE oid='public.template_application_receipt'::regclass",
          )
        ).rows[0].relrowsecurity,
        true,
      );
      const original = {
        ...selection,
        templateId: SEMINAR_BLUEPRINT.id,
        itemIds: SEMINAR_BLUEPRINT.items.map((i) => i.id),
      };
      assert.equal(
        (await service.preview(user, f.eventId, original)).items.length,
        4,
      );
      await pool.query(
        "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
        [f.eventId],
      );
      assert.equal(
        (await service.preview(user, f.eventId, selection)).canApply,
        false,
      );
      await assert.rejects(
        service.apply(user, f.eventId, result.operationId, command),
        { code: "EVENT_ARCHIVED" },
      );
    } finally {
      await pool.end();
    }
  },
);
