import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { templateIsolatedPool } from "./helpers/template-isolated-db.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";
import { runMigrations, discoverMigrations } from "../src/db/migrations.ts";
import {
  createPersonalTemplateService,
  calendarOffset,
  parseSaveCommand,
} from "../src/templates/library.ts";
import { createTemplateApplicationService } from "../src/templates/service.ts";
import { resolveBlueprintDate } from "../src/templates/model.ts";
import { templateHistoryOrigin } from "../src/templates/history.ts";
import { createApp } from "../src/app.ts";
const denied = (code: string) => (e: unknown) =>
  e instanceof Error && "code" in e && e.code === code;
test(
  "ISOLATED PostgreSQL: private template Save, persistence and canonical T2 reuse",
  { skip: !process.env.BUDOGRAPH_T2_ISOLATED_DATABASE_URL, timeout: 180000 },
  async (t) => {
    const pool = await templateIsolatedPool(),
      library = createPersonalTemplateService(pool),
      engine = createTemplateApplicationService(pool);
    const directory = fileURLToPath(new URL("../migrations", import.meta.url));
    const fixture = async () => {
      const client = await pool.connect();
      const f = await createPostgresFixture(client).finally(() =>
        client.release(),
      );
      return {
        ...f,
        user: {
          id: f.organizerUser,
          name: "Synthetic T3",
          email: "t3@example.invalid",
        },
        other: {
          id: f.memberUser,
          name: "Other",
          email: "other@example.invalid",
        },
      };
    };
    const command = async (f: Awaited<ReturnType<typeof fixture>>) => {
      const s = await library.source(f.user, f.eventId);
      return {
        name: "Reusable plan",
        description: "Reviewed synthetic blueprint",
        expectedEventVersion: s.eventVersion,
        items: s.items.map((i) => ({
          sourceTaskId: i.id,
          expectedTaskVersion: i.version,
          title: i.title,
          category: i.category,
          priority: i.priority,
          context: "",
          contextReviewed: false,
        })),
        confirmed: true,
      };
    };
    const snapshot = async () => {
      const r: Record<string, unknown> = {};
      for (const table of [
        "personal_template",
        "personal_template_version",
        "personal_template_item",
        "personal_template_save_receipt",
        "task",
        "activity_entry",
      ])
        r[table] = (
          await pool.query(
            `SELECT to_jsonb(t) row FROM public.${table} t ORDER BY to_jsonb(t)::text`,
          )
        ).rows;
      return r;
    };
    try {
      await runMigrations(pool, directory);
      await t.test(
        "13 exact migration checksums, no-op rerun and RLS deny browser tables",
        async () => {
          const expected = (await discoverMigrations(directory)).map(
            ({ version, name, checksum }) => ({ version, name, checksum }),
          );
          assert.equal(expected.length, 13);
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
            alreadyApplied: 13,
          });
          for (const name of [
            "personal_template",
            "personal_template_version",
            "personal_template_item",
            "personal_template_save_receipt",
          ]) {
            const r = (
              await pool.query(
                `SELECT relrowsecurity,(SELECT count(*)::INTEGER FROM pg_policy WHERE polrelid=c.oid) policies FROM pg_class c WHERE oid=$1::regclass`,
                ["public." + name],
              )
            ).rows[0];
            assert.deepEqual(r, { relrowsecurity: true, policies: 0 });
          }
        },
      );
      await t.test(
        "private CREATE/LIST/DETAIL stores only reviewed fields and never changes source Tasks",
        async () => {
          const f = await fixture();
          await pool.query(
            "UPDATE public.task SET context=$2,assigned_member_id=$3,status=$4 WHERE id=$1",
            [
              f.taskId,
              "Sensitive synthetic contact",
              f.memberId,
              "in-progress",
            ],
          );
          const sourceBefore = (
            await pool.query(
              "SELECT to_jsonb(t) row FROM public.task t WHERE id=$1",
              [f.taskId],
            )
          ).rows;
          const body = await command(f),
            saved = await library.save(f.user, f.eventId, randomUUID(), body),
            detail = await library.detail(f.user, saved.templateId);
          assert.equal(detail.items.length, 1);
          assert.equal(detail.items[0]!.context, "");
          assert.equal(detail.items[0]!.dayOffset, 1);
          assert.notEqual(detail.items[0]!.id, f.taskId);
          assert.deepEqual(
            Object.keys(detail.items[0]!).sort(),
            [
              "id",
              "title",
              "category",
              "context",
              "priority",
              "dayOffset",
              "deadlineTime",
            ].sort(),
          );
          assert.deepEqual(
            (
              await pool.query(
                "SELECT to_jsonb(t) row FROM public.task t WHERE id=$1",
                [f.taskId],
              )
            ).rows,
            sourceBefore,
          );
          assert.equal(
            (await library.list(f.user)).templates[0]!.id,
            saved.templateId,
          );
          assert.deepEqual((await library.list(f.other)).templates, []);
          for (const id of [saved.templateId, randomUUID()])
            await assert.rejects(
              library.detail(f.other, id),
              denied("NOT_FOUND"),
            );
          const select = {
            templateId: saved.templateId,
            templateVersion: 1,
            itemIds: detail.items.map((i) => i.id),
            language: "en",
          };
          await assert.rejects(
            engine.preview(f.other, f.eventId, select),
            denied("NOT_FOUND"),
          );
          await assert.rejects(
            engine.apply(f.other, f.eventId, randomUUID(), {
              ...select,
              expectedEventVersion: 1,
              reviewRevision: "a".repeat(64),
              confirmed: true,
            }),
            denied("FORBIDDEN"),
          );
        },
      );
      await t.test(
        "source Member/foreign/inactive and save restrictions; browser owner spoof rejected",
        async () => {
          const f = await fixture(),
            body = await command(f);
          await assert.rejects(
            library.source(f.other, f.eventId),
            denied("FORBIDDEN"),
          );
          await assert.rejects(
            library.save(f.other, f.eventId, randomUUID(), body),
            denied("FORBIDDEN"),
          );
          await assert.rejects(
            library.save(f.user, f.foreignEventId, randomUUID(), body),
            denied("NOT_FOUND"),
          );
          await assert.rejects(
            library.save(f.user, f.eventId, randomUUID(), {
              ...body,
              ownerUserId: f.memberUser,
            }),
            denied("INVALID_TEMPLATE_COMMAND"),
          );
          await pool.query(
            "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE id=$1",
            [f.organizerId],
          );
          await assert.rejects(
            library.save(f.user, f.eventId, randomUUID(), body),
            denied("NOT_FOUND"),
          );
          await pool.query(
            'UPDATE public."user" SET active=FALSE WHERE id=$1',
            [f.organizerUser],
          );
          await assert.rejects(library.list(f.user));
        },
      );
      await t.test(
        "stale Task and Event reviews, foreign Tasks, invalid dates, bounds and explicit context approval",
        async () => {
          const f = await fixture(),
            body = await command(f);
          const before = await snapshot();
          await assert.rejects(
            library.save(f.user, f.eventId, randomUUID(), {
              ...body,
              items: [{ ...body.items[0], expectedTaskVersion: 2 }],
            }),
            denied("SOURCE_TASK_VERSION_CONFLICT"),
          );
          await assert.rejects(
            library.save(f.user, f.eventId, randomUUID(), {
              ...body,
              expectedEventVersion: 2,
            }),
            denied("EVENT_VERSION_CONFLICT"),
          );
          await assert.rejects(
            library.save(f.user, f.eventId, randomUUID(), {
              ...body,
              items: [{ ...body.items[0], sourceTaskId: f.foreignTaskId }],
            }),
            denied("SOURCE_TASK_VERSION_CONFLICT"),
          );
          await assert.rejects(
            library.save(f.user, f.eventId, randomUUID(), {
              ...body,
              items: [{ ...body.items[0], context: "unreviewed" }],
            }),
            denied("INVALID_TEMPLATE_COMMAND"),
          );
          assert.deepEqual(await snapshot(), before);
          const approved = {
            ...body,
            items: [
              {
                ...body.items[0],
                context: "Reviewed generic logistics",
                contextReviewed: true,
              },
            ],
          };
          const result = await library.save(
            f.user,
            f.eventId,
            randomUUID(),
            approved,
          );
          assert.equal(
            (await library.detail(f.user, result.templateId)).items[0]!.context,
            "Reviewed generic logistics",
          );
          for (const [start, due, offset] of [
            ["2024-02-28", "2024-03-01", 2],
            ["2023-12-31", "2024-01-01", 1],
            ["2026-03-28", "2026-03-30", 2],
            ["2026-10-24", "2026-10-26", 2],
            ["0099-12-31", "0100-01-01", 1],
          ] as const) {
            assert.equal(calendarOffset(start, due), offset);
            assert.equal(resolveBlueprintDate(start, offset), due);
          }
          for (const pair of [
            ["2026-02-30", "2026-03-01"],
            ["0000-01-01", "2026-01-01"],
            ["2000-01-01", "2026-01-01"],
          ])
            assert.throws(() => calendarOffset(pair[0]!, pair[1]!));
          assert.throws(() => parseSaveCommand({ ...body, items: [] }));
        },
      );
      for (const table of [
        "personal_template",
        "personal_template_version",
        "personal_template_item",
        "personal_template_save_receipt",
      ])
        await t.test(
          "real SQL failure at " + table + " rolls back the entire Save",
          async () => {
            const f = await fixture(),
              body = await command(f),
              key = randomUUID(),
              before = await snapshot(),
              trigger = "t3_fail_" + randomUUID().replaceAll("-", "");
            await pool.query(
              `CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated T3 failure' USING ERRCODE='23514'; END $$`,
            );
            await pool.query(
              `CREATE TRIGGER ${trigger} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${trigger}()`,
            );
            try {
              await assert.rejects(
                library.save(f.user, f.eventId, key, body),
                (e: unknown) =>
                  !!e &&
                  typeof e === "object" &&
                  "code" in e &&
                  e.code === "23514",
              );
              assert.deepEqual(await snapshot(), before);
            } finally {
              await pool.query(`DROP TRIGGER ${trigger} ON public.${table}`);
              await pool.query(`DROP FUNCTION public.${trigger}()`);
            }
            assert.equal(
              (await library.save(f.user, f.eventId, key, body)).itemCount,
              1,
            );
          },
        );
      await t.test(
        "eight concurrent same-key Saves, exact replay, changed-payload rejection and new process persistence",
        async () => {
          const f = await fixture(),
            body = await command(f),
            key = randomUUID();
          const results = await Promise.all(
            Array.from({ length: 8 }, () =>
              library.save(f.user, f.eventId, key, body),
            ),
          );
          assert.ok(
            results.every(
              (r) => JSON.stringify(r) === JSON.stringify(results[0]),
            ),
          );
          const saved = results[0]!;
          assert.equal((await library.list(f.user)).templates.length, 1);
          await assert.rejects(
            library.save(f.user, f.eventId, key, {
              ...body,
              name: "different",
            }),
            denied("IDEMPOTENCY_KEY_REUSED"),
          );
          const child = await promisify(execFile)(process.execPath, [
            fileURLToPath(
              new URL("./helpers/personal-template-replay.ts", import.meta.url),
            ),
            f.user.id,
            saved.templateId,
            f.eventId,
            key,
            JSON.stringify(body),
          ]);
          const recovered = JSON.parse(child.stdout);
          assert.deepEqual(recovered.replay, saved);
          assert.deepEqual(
            recovered.detail,
            await library.detail(f.user, saved.templateId),
          );
          await pool.query(
            "UPDATE public.task SET title=$2,version=version+1 WHERE id=$1",
            [f.taskId, "Source changed"],
          );
          assert.deepEqual(
            await library.save(f.user, f.eventId, key, body),
            saved,
          );
          assert.notEqual(
            (await library.detail(f.user, saved.templateId)).items[0]!.title,
            "Source changed",
          );
          await pool.query(
            "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
            [f.eventId],
          );
          await assert.rejects(
            library.save(f.user, f.eventId, key, body),
            denied("EVENT_ARCHIVED"),
          );
          assert.equal(
            (await library.detail(f.user, saved.templateId)).id,
            saved.templateId,
          );
        },
      );
      await t.test(
        "saved template uses real T2 transaction; destination authority, concurrency, dates, History and initial state",
        async () => {
          const f = await fixture();
          await pool.query(
            `UPDATE public.event SET start_date='2024-02-28',end_date='2024-03-01' WHERE id=$1`,
            [f.eventId],
          );
          await pool.query(
            `UPDATE public.task SET deadline='2024-03-01',deadline_time='15:00' WHERE id=$1`,
            [f.taskId],
          );
          const body = await command(f),
            saved = await library.save(f.user, f.eventId, randomUUID(), body),
            detail = await library.detail(f.user, saved.templateId);
          const selection = {
            templateId: detail.id,
            templateVersion: detail.version,
            itemIds: detail.items.map((i) => i.id),
            language: "bg",
          };
          assert.equal(detail.items[0]!.dayOffset, 2);
          await assert.rejects(
            engine.preview(f.user, f.foreignEventId, selection),
            denied("NOT_FOUND"),
          );
          await pool.query(
            `INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role,active) VALUES($1,$2,$3,'ORGANIZER','Organizer',TRUE)`,
            [randomUUID(), f.foreignEventId, f.user.id],
          );
          await pool.query(
            `UPDATE public.event SET start_date='2026-10-24',end_date='2026-10-28' WHERE id=$1`,
            [f.foreignEventId],
          );
          const review = await engine.preview(
            f.user,
            f.foreignEventId,
            selection,
          );
          assert.equal(review.items[0]!.deadline, "2026-10-26");
          assert.equal(review.items[0]!.deadlineTime, "15:00");
          const apply = {
              ...selection,
              expectedEventVersion: review.event.version,
              reviewRevision: review.reviewRevision,
              confirmed: true,
            },
            key = randomUUID();
          const outcomes = await Promise.all(
            Array.from({ length: 8 }, () =>
              engine.apply(f.user, f.foreignEventId, key, apply),
            ),
          );
          for (const outcome of outcomes)
            assert.deepEqual(outcome, outcomes[0]);
          const result = outcomes[0]!;
          assert.equal(result.createdCount, 1);
          assert.notEqual(result.taskIds[0], f.taskId);
          const task = (
            await pool.query(
              `SELECT status,assigned_member_id,accepted_by_member_id,version,to_char(deadline,'YYYY-MM-DD') deadline,to_char(deadline_time,'HH24:MI') time FROM public.task WHERE id=$1`,
              [result.taskIds[0]],
            )
          ).rows[0];
          assert.deepEqual(task, {
            status: "not-started",
            assigned_member_id: null,
            accepted_by_member_id: null,
            version: 1,
            deadline: "2026-10-26",
            time: "15:00",
          });
          assert.equal(
            (
              await pool.query(
                "SELECT FROM public.task_reminder WHERE task_id=$1",
                [result.taskIds[0]],
              )
            ).rows.length,
            0,
          );
          const entries = (
            await pool.query(
              `SELECT payload FROM public.activity_entry WHERE payload->'templateApplication'->>'operationId'=$1`,
              [key],
            )
          ).rows;
          assert.equal(entries.length, 2);
          assert.equal(
            templateHistoryOrigin(entries[0]!.payload.templateApplication)!
              .templateId,
            "private-template",
          );
          await assert.rejects(
            engine.apply(f.user, f.foreignEventId, key, {
              ...apply,
              language: "en",
            }),
            denied("IDEMPOTENCY_KEY_REUSED"),
          );
          await pool.query(
            "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
            [f.foreignEventId],
          );
          await assert.rejects(
            engine.apply(f.user, f.foreignEventId, key, apply),
            denied("EVENT_ARCHIVED"),
          );
        },
      );
      await t.test(
        "another Organizer cannot infer or apply a private blueprint; saved Apply SQL failure rolls back",
        async () => {
          const f = await fixture(),
            body = await command(f),
            saved = await library.save(f.user, f.eventId, randomUUID(), body);
          const detail = await library.detail(f.user, saved.templateId),
            selection = {
              templateId: saved.templateId,
              templateVersion: 1,
              itemIds: detail.items.map((i) => i.id),
              language: "en",
            };
          await pool.query(
            "UPDATE public.event_member SET access_role='ORGANIZER' WHERE id=$1",
            [f.memberId],
          );
          const input = {
            ...selection,
            expectedEventVersion: 1,
            reviewRevision: "a".repeat(64),
            confirmed: true,
          };
          for (const id of [saved.templateId, randomUUID()]) {
            await assert.rejects(
              engine.preview(f.other, f.eventId, {
                ...selection,
                templateId: id,
              }),
              denied("NOT_FOUND"),
            );
            await assert.rejects(
              engine.apply(f.other, f.eventId, randomUUID(), {
                ...input,
                templateId: id,
              }),
              denied("NOT_FOUND"),
            );
          }
          const review = await engine.preview(f.user, f.eventId, selection),
            apply = {
              ...selection,
              expectedEventVersion: 1,
              reviewRevision: review.reviewRevision,
              confirmed: true,
            },
            key = randomUUID(),
            before = await snapshot(),
            name = "t3_apply_fail_" + randomUUID().replaceAll("-", "");
          await pool.query(
            `CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Owned T3 failure' USING ERRCODE='23514'; END $$`,
          );
          await pool.query(
            `CREATE TRIGGER ${name} BEFORE INSERT ON public.template_application_receipt FOR EACH ROW EXECUTE FUNCTION public.${name}()`,
          );
          try {
            await assert.rejects(engine.apply(f.user, f.eventId, key, apply));
            assert.deepEqual(await snapshot(), before);
          } finally {
            await pool.query(
              `DROP TRIGGER ${name} ON public.template_application_receipt`,
            );
            await pool.query(`DROP FUNCTION public.${name}()`);
          }
          assert.equal(
            (await engine.apply(f.user, f.eventId, key, apply)).createdCount,
            1,
          );
          for (const table of [
            "personal_template",
            "personal_template_version",
            "personal_template_item",
            "personal_template_save_receipt",
          ]) {
            await assert.rejects(
              pool
                .query(
                  `UPDATE public.${table} SET template_id=template_id WHERE FALSE`,
                )
                .catch((e) => {
                  if (e.code === "42703")
                    return pool.query(
                      `UPDATE public.${table} SET id=id WHERE FALSE`,
                    );
                  throw e;
                }),
              (e: unknown) =>
                !!e &&
                typeof e === "object" &&
                "code" in e &&
                e.code === "55000",
            );
          }
        },
      );
      await t.test(
        "private HTTP routes: sessions, trusted origin, Fetch Metadata, strict fields, no-store and non-disclosure",
        async () => {
          const f = await fixture(),
            body = await command(f);
          let signedIn = true;
          const app = createApp({
            checkDatabase: async () => {},
            personalTemplates: library,
            templates: engine,
            authentication: {
              baseURL: "http://localhost:3001",
              taskMutationOrigins: ["http://localhost:5173"],
              auth: {
                handler: async () => new Response(),
                api: {
                  getSession: async () =>
                    signedIn ? { user: { ...f.user, active: true } } : null,
                },
              },
            },
          });
          try {
            const url = `/api/events/${f.eventId}/templates/save`,
              headers = {
                origin: "http://localhost:5173",
                "idempotency-key": randomUUID(),
              };
            signedIn = false;
            assert.equal(
              (await app.inject({ url: "/api/templates/mine" })).statusCode,
              401,
            );
            signedIn = true;
            for (const h of [
              {},
              { ...headers, origin: "https://foreign.invalid" },
              { ...headers, "sec-fetch-site": "cross-site" },
            ])
              assert.equal(
                (
                  await app.inject({
                    method: "POST",
                    url,
                    headers: h,
                    payload: body,
                  })
                ).statusCode,
                403,
              );
            assert.equal(
              (
                await app.inject({
                  method: "POST",
                  url,
                  headers,
                  payload: { ...body, ownerUserId: "forged" },
                })
              ).statusCode,
              400,
            );
            const response = await app.inject({
              method: "POST",
              url,
              headers,
              payload: body,
            });
            assert.equal(response.statusCode, 201);
            assert.equal(response.headers["cache-control"], "no-store");
            for (const path of [
              "/api/templates/mine",
              "/api/templates/mine/" + response.json().templateId,
              `/api/events/${f.eventId}/templates/source`,
            ]) {
              const r = await app.inject({ url: path });
              assert.equal(r.statusCode, 200);
              assert.equal(r.headers["cache-control"], "no-store");
            }
          } finally {
            await app.close();
          }
        },
      );
    } finally {
      await pool.end();
    }
  },
);
