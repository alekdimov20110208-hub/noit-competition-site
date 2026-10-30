import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import test from "node:test";
import pg from "pg";
import { createDatabasePool } from "../src/db/pool.ts";
import {
  guardProductionDatabasePool,
  readProductionDatabaseIdentity,
  verifyProductionDatabaseIdentity,
} from "../src/db/identity.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";
import { createEventService } from "../src/events/service.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { createChangeService } from "../src/changes/service.ts";
import { createNotificationService } from "../src/notifications/service.ts";
import { createPersonalTemplateService } from "../src/templates/library.ts";
import { createTemplateApplicationService } from "../src/templates/service.ts";
import { SEMINAR_BLUEPRINT } from "../src/templates/catalog.ts";
import { createAuth } from "../src/auth/auth.ts";
import { createApp } from "../src/app.ts";
import { createApplicationServices } from "../src/runtime.ts";
import { hashInvitationToken } from "../src/invitations/model.ts";
import {
  discoverMigrations,
  validateAppliedMigrations,
} from "../src/db/migrations.ts";

test(
  "V1-C2 real non-owner runtime: independently confirmed disposable LOCAL cluster",
  { skip: !process.env.V1C_OWNER_FILE, timeout: 180000 },
  async (t) => {
    // This suite accepts only the fresh harness manifest, never DATABASE_URL/.env.
    const owner = JSON.parse(readFileSync(process.env.V1C_OWNER_FILE!, "utf8"));
    assert.equal(owner.purpose, "V1-C2 disposable local cluster");
    assert.equal(owner.nonce, process.env.V1C_NONCE);
    assert.equal(
      resolve(dirname(process.env.V1C_OWNER_FILE!)),
      resolve(owner.root),
    );
    assert.ok(owner.root.includes(`BudoGraph-V1C-PostgreSQL17-${owner.nonce}`));
    assert.equal(owner.database, "postgres");
    function checkedUrl(key: string, role: string, raw = process.env[key]!) {
      const url = new URL(raw);
      assert.equal(url.protocol, "postgresql:");
      assert.equal(url.hostname, "127.0.0.1");
      assert.equal(Number(url.port), owner.port);
      assert.equal(url.pathname, `/${owner.database}`);
      assert.equal(url.username, role);
      assert.equal(url.search, "");
      assert.equal(url.hash, "");
      return raw;
    }
    await t.test(
      "target guard rejects remote hosts, unknown databases/ports/roles and URL overrides before connecting",
      () => {
        const accepted = process.env.V1C_RUNTIME_URL!;
        for (const mutate of [
          (url: URL) => {
            url.hostname = "remote.invalid";
          },
          (url: URL) => {
            url.pathname = "/wrong_database";
          },
          (url: URL) => {
            url.port = String(owner.port === 5432 ? 5433 : 5432);
          },
          (url: URL) => {
            url.username = "unknown_role";
          },
          (url: URL) => {
            url.search = "?host=remote.invalid";
          },
          (url: URL) => {
            url.hash = "#unknown";
          },
        ]) {
          const url = new URL(accepted);
          mutate(url);
          assert.throws(() =>
            checkedUrl("V1C_RUNTIME_URL", "budograph_runtime", url.href),
          );
        }
      },
    );
    const expected = readProductionDatabaseIdentity();
    assert.equal(expected.databaseId, owner.databaseId);
    assert.equal(expected.projectRef, owner.projectRef);
    const ssl = {
      ca: readFileSync(process.env.V1C_CA_FILE!, "utf8"),
      rejectUnauthorized: true,
    };
    const migrator = new pg.Pool({
      connectionString: checkedUrl("V1C_MIGRATOR_URL", "postgres"),
      ssl,
      options: "-c role=budograph_migrator",
      max: 2,
    });
    const runtime = createDatabasePool(
      {
        nodeEnv: "production",
        databaseUrl: checkedUrl("V1C_RUNTIME_URL", "budograph_runtime"),
        databaseTls: { mode: "verify-full", caFile: process.env.V1C_CA_FILE! },
      },
      () => {},
      { max: process.env.V1C_TEST_POOL_MAX === "1" ? 1 : 2 },
    );
    guardProductionDatabasePool(runtime, expected);
    const pools = [runtime, migrator];
    try {
      const witness = (
        await migrator.query(
          "SELECT current_database() AS db,host(inet_server_addr()) AS host,inet_server_port() AS port,current_user AS role",
        )
      ).rows[0];
      assert.deepEqual(witness, {
        db: owner.database,
        host: "127.0.0.1",
        port: owner.port,
        role: "budograph_migrator",
      });
      const client = await migrator.connect();
      const f = await createPostgresFixture(client).finally(() =>
        client.release(),
      );
      const org = {
        id: f.organizerUser,
        name: "Synthetic local owner",
        email: `${f.organizerUser}@example.invalid`,
      };
      const member = { ...org, id: f.memberUser },
        foreign = { ...org, id: f.foreignUser };
      const events = createEventService(runtime),
        tasks = createTaskService(runtime),
        changes = createChangeService(runtime),
        notifications = createNotificationService(runtime);
      const library = createPersonalTemplateService(runtime),
        templates = createTemplateApplicationService(runtime);
      const denied = async (
        pool: Pick<pg.Pool, "query">,
        sql: string,
        values?: unknown[],
        code = "42501",
      ) => {
        let actual;
        try {
          await pool.query(sql, values);
        } catch (error) {
          actual = (error as { code?: string }).code;
        }
        assert.equal(
          actual,
          code,
          `Expected SQLSTATE ${code} for ${sql.split(/\s+/).slice(0, 4).join(" ")}`,
        );
      };
      await t.test(
        "runtime is a real LOGIN, non-owner, non-superuser, no role memberships; verified TLS and checksums",
        async () => {
          const r = (
            await runtime.query(
              "SELECT current_user AS role,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls,(SELECT count(*)::int FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owned",
            )
          ).rows[0];
          assert.deepEqual(r, {
            role: "budograph_runtime",
            tls: true,
            owned: 0,
          });
          const files = await discoverMigrations(resolve("server/migrations"));
          assert.equal(
            validateAppliedMigrations(
              files,
              (
                await runtime.query(
                  "SELECT version,name,checksum FROM public.schema_migrations ORDER BY version",
                )
              ).rows,
            ).length,
            0,
          );
          await denied(
            runtime,
            "SELECT applied_at FROM public.schema_migrations",
          );
          await denied(
            runtime,
            "UPDATE public.schema_migrations SET checksum=repeat('0',64)",
          );
        },
      );
      await t.test(
        "anon, authenticated and an independent PUBLIC-only LOGIN cannot read/write any application/operational table or execute application functions",
        async () => {
          const relations = (
            await migrator.query(
              "SELECT tablename,(SELECT attname FROM pg_attribute WHERE attrelid=(quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum LIMIT 1) AS column FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
            )
          ).rows;
          assert.equal(relations.length, 20);
          for (const [key, role] of [
            ["V1C_ANON_URL", "anon"],
            ["V1C_AUTHENTICATED_URL", "authenticated"],
            ["V1C_PUBLIC_URL", "public_probe"],
          ]) {
            const p = new pg.Pool({
              connectionString: checkedUrl(key!, role!),
              ssl,
              max: 1,
            });
            pools.push(p);
            for (const { tablename, column } of relations) {
              await denied(p, `SELECT * FROM public."${tablename}"`);
              await denied(p, `DELETE FROM public."${tablename}"`);
              await denied(
                p,
                `INSERT INTO public."${tablename}" DEFAULT VALUES`,
              );
              await denied(
                p,
                `UPDATE public."${tablename}" SET "${column}"="${column}"`,
              );
            }
            await denied(
              p,
              "SELECT * FROM budograph_private.environment_identity",
            );
            await denied(p, 'SELECT email FROM public."user"');
            await denied(
              p,
              "SELECT public.is_valid_event_timezone('Europe/Sofia')",
            );
          }
        },
      );
      await t.test(
        "R2 inherited PUBLIC TEMP is preserved, but direct runtime TEMP grants fail identity verification",
        async () => {
          assert.equal(
            (
              await runtime.query(
                "SELECT has_database_privilege(current_user,current_database(),'TEMP') AS inherited",
              )
            ).rows[0].inherited,
            true,
          );
          const owner = await migrator.connect();
          try {
            // RESET ROLE restores the connection's startup role option, which
            // is budograph_migrator. Select the owned fixture session explicitly.
            await owner.query("SET ROLE postgres");
            assert.equal(
              (await owner.query("SELECT current_user AS role")).rows[0].role,
              "postgres",
            );
            await owner.query(
              "GRANT TEMP ON DATABASE postgres TO budograph_runtime",
            );
            await assert.rejects(
              runtime.query("SELECT 1"),
              /identity verification failed/,
            );
          } finally {
            await owner.query(
              "REVOKE TEMP ON DATABASE postgres FROM budograph_runtime",
            );
            await owner.query("SET ROLE budograph_migrator");
            owner.release();
          }
          assert.equal((await runtime.query("SELECT 1 AS ok")).rows[0].ok, 1);
        },
      );
      await t.test(
        "Permanent DDL, ownership, SET ROLE, role escalation, trigger disable and policy changes fail",
        async () => {
          for (const sql of [
            "CREATE TABLE public.v1c_denied(id int)",
            "CREATE SCHEMA v1c_denied",
            "ALTER TABLE public.task DISABLE TRIGGER ALL",
            "ALTER TABLE public.task DISABLE ROW LEVEL SECURITY",
            "ALTER TABLE public.task OWNER TO budograph_runtime",
            "DROP TABLE public.task",
            "CREATE ROLE v1c_denied",
            "SET ROLE budograph_migrator",
            "ALTER ROLE budograph_runtime SUPERUSER",
            "DROP POLICY budograph_runtime_select ON public.task",
            "CREATE FUNCTION public.v1c_denied() RETURNS int LANGUAGE sql AS 'SELECT 1'",
          ])
            await denied(runtime, sql);
          for (const sql of [
            'UPDATE public."user" SET id=id',
            'UPDATE public."user" SET active=false',
            "UPDATE public.\"user\" SET email='forged@example.invalid'",
            "UPDATE public.event_member SET access_role='ORGANIZER'",
            "UPDATE public.event_member SET user_id='forged'",
            "UPDATE public.event_invitation SET invited_email='forged@example.invalid'",
            "UPDATE public.task SET event_id=gen_random_uuid()",
            "UPDATE public.notification SET recipient_user_id='forged'",
          ])
            await denied(runtime, sql);
        },
      );
      await t.test(
        "new migration-owner objects do not inherit PUBLIC/browser/runtime grants",
        async () => {
          await migrator.query(
            "CREATE TABLE public.v1c_default_probe(id int); CREATE FUNCTION public.v1c_default_probe() RETURNS int LANGUAGE sql AS 'SELECT 1'",
          );
          for (const p of pools.filter((p) => p !== migrator)) {
            await denied(p, "SELECT * FROM public.v1c_default_probe");
            await denied(p, "SELECT public.v1c_default_probe()");
          }
          // These are exclusively this test's new objects in its disposable cluster.
          await migrator.query(
            "DROP TABLE public.v1c_default_probe; DROP FUNCTION public.v1c_default_probe()",
          );
        },
      );
      await t.test(
        "membership FOR SHARE/UPDATE locks real rows but even a no-op version UPDATE fails RLS",
        async () => {
          const lock = await runtime.connect(),
            contender = await migrator.connect();
          try {
            await lock.query("BEGIN");
            assert.equal(
              (
                await lock.query(
                  "SELECT id FROM public.event_member WHERE id=$1 FOR SHARE",
                  [f.memberId],
                )
              ).rowCount,
              1,
            );
            await contender.query("SET lock_timeout='150ms'");
            let code;
            try {
              await contender.query(
                "UPDATE public.event_member SET active=false,deactivated_at=clock_timestamp() WHERE id=$1",
                [f.memberId],
              );
            } catch (e) {
              code = (e as { code?: string }).code;
            }
            assert.equal(
              code,
              "55P03",
              "Concurrent membership mutation must block on real row lock",
            );
            await lock.query("ROLLBACK");
            await denied(
              lock,
              "UPDATE public.event_member SET version=version WHERE id=$1",
              [f.memberId],
            );
            await lock.query("BEGIN");
            assert.equal(
              (
                await lock.query(
                  "SELECT id FROM public.event_member WHERE id=$1 FOR UPDATE",
                  [f.memberId],
                )
              ).rowCount,
              1,
            );
            await lock.query("ROLLBACK");
          } finally {
            await lock.query("ROLLBACK");
            await contender.query("RESET lock_timeout");
            lock.release();
            contender.release();
          }
        },
      );
      const fields = {
        title: "Runtime task",
        category: "Venue",
        context: "Synthetic",
        deadline: "2026-10-04",
        deadlineTime: "12:00",
        priority: "important",
        assignedMemberId: f.memberId,
        reminderOffsets: [60],
      };
      let task: Awaited<ReturnType<typeof tasks.create>>;
      await t.test(
        "Event create/update/list, Task create/assignment/acceptance/status/details, notifications and Event-scoped denials use runtime",
        async () => {
          const fresh = await events.create(org, {
            name: "Runtime event",
            startDate: "2026-10-03",
            endDate: "2026-10-04",
            timezone: "Europe/Sofia",
          });
          const updated = await events.update(org, fresh.id, {
            name: "Runtime edited",
            startDate: "2026-10-03",
            endDate: "2026-10-04",
            timezone: "Europe/London",
            expectedVersion: 1,
          });
          assert.equal(updated.version, 2);
          assert.ok((await events.list(org)).some((e) => e.id === fresh.id));
          task = await tasks.create(org, f.eventId, fields);
          assert.equal(task.version, 1);
          task = await tasks.mutate(member, f.eventId, task.id, "acceptance", {
            accepted: true,
            expectedVersion: task.version,
          });
          task = await tasks.mutate(member, f.eventId, task.id, "status", {
            status: "in-progress",
            expectedVersion: task.version,
          });
          task = await tasks.updateDetails(org, f.eventId, task.id, {
            title: "Edited runtime task",
            deadline: "2026-10-05",
            deadlineTime: "13:30",
            expectedVersion: task.version,
          });
          assert.equal(task.accepted, true);
          const list = await notifications.list(member, f.eventId);
          assert.ok(list.unreadCount > 0);
          await notifications.markRead(
            member,
            f.eventId,
            list.notifications[0]!.id,
          );
          await notifications.markAllRead(member, f.eventId);
          assert.equal(
            (await notifications.list(member, f.eventId)).unreadCount,
            0,
          );
          for (const user of [foreign, { ...org, id: f.inactiveUser }])
            await assert.rejects(tasks.read(user, f.eventId));
          await assert.rejects(tasks.create(member, f.eventId, fields));
          await assert.rejects(tasks.create(org, f.foreignEventId, fields));
          await assert.rejects(
            tasks.mutate(org, f.eventId, f.foreignTaskId, "status", {
              status: "completed",
              expectedVersion: 1,
            }),
          );
          await assert.rejects(
            tasks.create(org, f.eventId, {
              ...fields,
              assignedMemberId: f.inactiveId,
            }),
          );
        },
      );
      await t.test(
        "reminder trigger functions execute as invoker despite revoked direct EXECUTE, reschedule and delete correctly",
        async () => {
          assert.equal(
            (
              await runtime.query(
                "SELECT count(*)::int AS n FROM public.task_reminder WHERE task_id=$1",
                [task.id],
              )
            ).rows[0].n,
            1,
          );
          const before = (
            await runtime.query(
              "SELECT due_at FROM public.task_reminder WHERE task_id=$1",
              [task.id],
            )
          ).rows[0].due_at;
          await events.update(org, f.eventId, {
            name: "Disposable P1C fixture",
            startDate: "2026-10-03",
            endDate: "2026-10-04",
            timezone: "Europe/London",
            expectedVersion: 1,
          });
          const after = (
            await runtime.query(
              "SELECT due_at FROM public.task_reminder WHERE task_id=$1",
              [task.id],
            )
          ).rows[0].due_at;
          assert.notEqual(before.getTime(), after.getTime());
          for (const name of [
            "schedule_task_reminder",
            "reschedule_task_reminders",
            "reschedule_event_reminders",
            "reject_activity_entry_mutation",
            "reject_event_command_receipt_mutation",
          ])
            await denied(runtime, `SELECT public.${name}()`);
          assert.equal(
            (
              await runtime.query(
                "SELECT public.is_valid_event_timezone('Europe/Sofia') AS valid",
              )
            ).rows[0].valid,
            true,
          );
          task = await tasks.updateDetails(org, f.eventId, task.id, {
            deadlineTime: null,
            reminderOffsets: [],
            expectedVersion: task.version,
          });
          assert.equal(
            (
              await runtime.query(
                "SELECT count(*)::int AS n FROM public.task_reminder WHERE task_id=$1",
                [task.id],
              )
            ).rows[0].n,
            0,
          );
        },
      );
      await t.test(
        "Change create/update/link delete/response and History remain compatible",
        async () => {
          let change = await changes.create(org, f.eventId, {
            title: "Runtime change",
            context: "Synthetic",
            responseOwnerMemberId: f.memberId,
            affectedTaskIds: [task.id],
          });
          change = await changes.update(org, f.eventId, change.id, {
            title: "Edited runtime change",
            affectedTaskIds: [f.taskId],
            expectedVersion: change.version,
          });
          change = await changes.update(org, f.eventId, change.id, {
            decision: "Synthetic decision",
            response: "Synthetic response",
            planB: "Synthetic fallback",
            expectedVersion: change.version,
          });
          assert.equal(change.decision!.authoredBy.id, f.organizerId);
          assert.equal(
            (await changes.read(member, f.eventId, change.id))[0]!.title,
            "Edited runtime change",
          );
          await assert.rejects(
            changes.create(member, f.eventId, { title: "Denied" }),
          );
          await assert.rejects(changes.read(foreign, f.eventId));
          assert.ok((await events.history(org, f.eventId)).entries.length > 0);
        },
      );
      await t.test(
        "personal template Save/List/Detail, Apply/replay, Duplicate/Clear/Archive receipts",
        async () => {
          const source = await library.source(org, f.eventId);
          const body = {
            name: "Runtime reusable",
            description: "Synthetic",
            expectedEventVersion: source.eventVersion,
            items: source.items.map((i) => ({
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
          const key = randomUUID(),
            saved = await library.save(org, f.eventId, key, body);
          assert.deepEqual(
            await library.save(org, f.eventId, key, body),
            saved,
          );
          const detail = await library.detail(org, saved.templateId);
          assert.ok(
            (await library.list(org)).templates.some(
              (i) => i.id === saved.templateId,
            ),
          );
          await assert.rejects(library.detail(member, saved.templateId));
          const selection = {
            templateId: saved.templateId,
            templateVersion: 1,
            itemIds: detail.items.map((i) => i.id),
            language: "en",
          };
          const preview = await templates.preview(org, f.eventId, selection);
          const applyBody = {
              ...selection,
              expectedEventVersion: preview.event.version,
              reviewRevision: preview.reviewRevision,
              confirmed: true,
            },
            applyKey = randomUUID();
          const applied = await templates.apply(
            org,
            f.eventId,
            applyKey,
            applyBody,
          );
          assert.deepEqual(
            await templates.apply(org, f.eventId, applyKey, applyBody),
            applied,
          );
          const curatedSelection = {
            templateId: SEMINAR_BLUEPRINT.id,
            templateVersion: 1,
            language: "bg",
            itemIds: SEMINAR_BLUEPRINT.items.map((i) => i.id),
          };
          const curatedPreview = await templates.preview(
            org,
            f.eventId,
            curatedSelection,
          );
          assert.equal(
            (
              await templates.apply(org, f.eventId, randomUUID(), {
                ...curatedSelection,
                expectedEventVersion: curatedPreview.event.version,
                reviewRevision: curatedPreview.reviewRevision,
                confirmed: true,
              })
            ).createdCount,
            4,
          );
          const event = (await events.list(org)).find(
            (e) => e.id === f.eventId,
          )!;
          const duplicate = await events.duplicate(
            org,
            f.eventId,
            randomUUID(),
            {
              name: "Runtime duplicate",
              startDate: "2026-10-03",
              endDate: "2026-10-04",
              timezone: "Europe/Sofia",
              expectedVersion: event.version,
            },
          );
          assert.ok(duplicate.id);
          const review = await events.clearPreview(org, f.eventId);
          const clearKey = randomUUID(),
            clearBody = {
              expectedVersion: review.event.version,
              confirmationName: review.event.name,
              scopeRevision: review.scopeRevision,
            };
          const cleared = await events.clearTasks(
            org,
            f.eventId,
            clearKey,
            clearBody,
          );
          assert.deepEqual(
            await events.clearTasks(org, f.eventId, clearKey, clearBody),
            cleared,
          );
          const archiveKey = randomUUID(),
            archiveBody = {
              expectedVersion: cleared.event.version,
              confirmationName: cleared.event.name,
            };
          const archived = await events.archive(
            org,
            f.eventId,
            archiveKey,
            archiveBody,
          );
          assert.deepEqual(
            await events.archive(org, f.eventId, archiveKey, archiveBody),
            archived,
          );
          await assert.rejects(tasks.create(org, f.eventId, fields));
        },
      );
      await t.test(
        "all seven immutable tables reject UPDATE/DELETE/TRUNCATE; existing triggers remain enabled",
        async () => {
          for (const table of [
            "activity_entry",
            "event_command_receipt",
            "template_application_receipt",
            "personal_template",
            "personal_template_version",
            "personal_template_item",
            "personal_template_save_receipt",
          ]) {
            const column = table.includes("receipt")
              ? "actor_user_id"
              : table.startsWith("personal_template_")
                ? "template_id"
                : "id";
            await denied(
              runtime,
              `UPDATE public.${table} SET ${column}=${column}`,
            );
            await denied(runtime, `DELETE FROM public.${table}`);
            await denied(runtime, `TRUNCATE public.${table}`);
          }
          assert.equal(
            (
              await migrator.query(
                "SELECT count(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O'",
              )
            ).rows[0].n,
            10,
          );
        },
      );
      await t.test(
        "real Better Auth verification/private invitation registration/login/profile/password/reset/session flows; public signup stays closed",
        async () => {
          const origin = "https://www.budograph.com",
            messages: { to: string; html: string; text: string }[] = [];
          t.mock.method(
            globalThis,
            "fetch",
            async (url: string | URL | Request, init?: RequestInit) => {
              assert.equal(
                String(url),
                "https://api.resend.com/emails",
                "All outbound HTTP is intercepted; unexpected request forbidden",
              );
              messages.push(JSON.parse(init!.body as string));
              return new Response(JSON.stringify({ id: randomUUID() }), {
                status: 200,
              });
            },
          );
          const config = {
            // Legacy C1/C2 auth lifecycle fixture; pool remains production-guarded.
            // C4 production outbox/limiter composition is exercised separately.
            nodeEnv: "test" as const,
            host: "127.0.0.1",
            port: 1,
            databaseUrl: process.env.V1C_RUNTIME_URL!,
            databaseTls: {
              mode: "verify-full" as const,
              caFile: process.env.V1C_CA_FILE!,
            },
            betterAuthSecret: randomBytes(32).toString("hex"),
            betterAuthUrl: origin,
            publicAppUrl: origin,
            emailMode: "resend" as const,
            emailFrom: "no-reply@example.invalid",
            resendApiKey: "re_" + randomBytes(20).toString("hex"),
          };
          const services = createApplicationServices(
            runtime,
            config,
            { submit: (work) => work() },
            () => {},
          );
          const app = createApp({ ...services, production: true });
          try {
            const registration = createAuth(runtime, config, {
              invitationRegistration: true,
              email: services.email,
              emailTasks: { submit: (work) => work() },
            });
            const password = randomBytes(24).toString("hex"),
              next = randomBytes(24).toString("hex"),
              final = randomBytes(24).toString("hex");
            const email = `v1c-${randomUUID()}@example.invalid`;
            const created = await registration.api.signUpEmail({
              body: {
                name: "Synthetic local test account",
                email,
                password,
                callbackURL: `${origin}/verify-email?lang=en`,
              },
            });
            const user = {
              id: created.user.id,
              name: created.user.name,
              email,
            };
            let peer = 10;
            const post = (
              path: string,
              payload: Record<string, unknown>,
              cookie = "",
            ) =>
              app.inject({
                method: "POST",
                url: `/api/auth/${path}`,
                remoteAddress: `127.0.0.${peer++}`,
                headers: { origin, cookie },
                payload,
              });
            const cookieOf = (r: { headers: Record<string, unknown> }) =>
              [r.headers["set-cookie"]]
                .flat()
                .filter((v): v is string => typeof v === "string")
                .map((v) => v.split(";")[0])
                .join("; ");
            const link = (to: string) => {
              const message = messages
                .filter((m) =>
                  Array.isArray(m.to) ? m.to.includes(to) : m.to === to,
                )
                .at(-1)!;
              const raw = (message.text ?? message.html)
                .match(/https:\/\/www\.budograph\.com\/[^\s<>"']+/)![0]
                .replaceAll("&amp;", "&");
              return new URL(raw);
            };
            assert.equal(
              (await post("sign-in/email", { email, password })).statusCode,
              403,
            );
            const verify = link(email);
            assert.ok(
              [200, 302].includes(
                (await app.inject({ url: verify.pathname + verify.search }))
                  .statusCode,
              ),
            );
            const signed = await post("sign-in/email", { email, password });
            assert.equal(signed.statusCode, 200);
            const cookie = cookieOf(signed);
            assert.ok(cookie.includes("__Secure-"));
            assert.equal(
              (await post("sign-up/email", { name: "Denied", email, password }))
                .statusCode,
              404,
            );
            assert.equal(
              (
                await post(
                  "update-user",
                  { name: "Changed synthetic name" },
                  cookie,
                )
              ).statusCode,
              200,
            );
            assert.equal(
              (
                await post(
                  "change-password",
                  {
                    currentPassword: password,
                    newPassword: next,
                    revokeOtherSessions: true,
                  },
                  cookie,
                )
              ).statusCode,
              200,
            );
            const event = await services.events!.create!(user, {
              name: "Synthetic invitation event",
              startDate: "2026-10-03",
              endDate: "2026-10-04",
              timezone: "Europe/Sofia",
            });
            const recipient = `v1c-recipient-${randomUUID()}@example.invalid`;
            const invitation = await services.invitations!.create(
              user,
              event.id,
              { email: recipient },
            );
            assert.equal(
              (
                await runtime.query(
                  "SELECT token_hash FROM public.event_invitation WHERE id=$1",
                  [invitation.invitation.id],
                )
              ).rows[0].token_hash,
              hashInvitationToken(invitation.token),
            );
            await services.invitations!.register(
              invitation.token,
              { name: "Invited synthetic account", password },
              "en",
              true,
            );
            assert.equal(
              (
                await runtime.query(
                  "SELECT accepted_at FROM public.event_invitation WHERE id=$1",
                  [invitation.invitation.id],
                )
              ).rows[0].accepted_at,
              null,
            );
            const recipientLink = link(recipient);
            assert.ok(
              [200, 302].includes(
                (
                  await app.inject({
                    url: recipientLink.pathname + recipientLink.search,
                  })
                ).statusCode,
              ),
            );
            const recipientLogin = await post("sign-in/email", {
              email: recipient,
              password,
            });
            assert.equal(recipientLogin.statusCode, 200);
            const recipientUser = (
              await runtime.query(
                'SELECT id,name,email FROM public."user" WHERE email=$1',
                [recipient],
              )
            ).rows[0];
            await services.invitations!.accept(
              recipientUser,
              invitation.token,
              {},
            );
            assert.equal(
              (
                await runtime.query(
                  "SELECT access_role FROM public.event_member WHERE event_id=$1 AND user_id=$2",
                  [event.id, recipientUser.id],
                )
              ).rows[0].access_role,
              "MEMBER",
            );
            await assert.rejects(
              services.invitations!.accept(user, invitation.token, {}),
            );
            const disposableInvite = await services.invitations!.create(
              user,
              event.id,
              { email: `unused-${randomUUID()}@example.invalid` },
            );
            const resent = await services.invitations!.resend(
              user,
              event.id,
              disposableInvite.invitation.id,
            );
            assert.notEqual(resent.token, disposableInvite.token);
            await assert.rejects(
              services.invitations!.lookup(disposableInvite.token),
            );
            await services.invitations!.revoke(
              user,
              event.id,
              resent.invitation.id,
              {},
            );
            assert.equal(
              (await services.invitations!.lookup(resent.token)).state,
              "revoked",
            );
            const reset = await post("request-password-reset", {
              email,
              redirectTo: `${origin}/reset-password`,
            });
            assert.equal(reset.statusCode, 200);
            const resetLink = link(email),
              token = resetLink.pathname.split("/").at(-1)!;
            const resetResponse = await post("reset-password", {
              token,
              newPassword: final,
            });
            assert.equal(resetResponse.statusCode, 200);
            assert.equal(
              (await post("reset-password", { token, newPassword: next }))
                .statusCode,
              400,
            );
            assert.equal(
              (await post("sign-in/email", { email, password: next }))
                .statusCode,
              401,
            );
            const lastLogin = await post("sign-in/email", {
              email,
              password: final,
            });
            assert.equal(lastLogin.statusCode, 200);
            assert.equal(
              (await post("sign-out", {}, cookieOf(lastLogin))).statusCode,
              200,
            );
            assert.equal(
              (
                await app.inject({
                  url: "/api/me",
                  headers: { cookie: cookieOf(lastLogin) },
                })
              ).statusCode,
              401,
            );
            assert.ok(messages.length >= 3);
          } finally {
            await app.close();
          }
        },
      );
      await t.test(
        "identity missing/mismatch/owner rejection is fail-closed on warm checkouts; runtime cannot alter marker",
        async () => {
          await denied(
            runtime,
            "UPDATE budograph_private.environment_identity SET project_ref='forged'",
          );
          await denied(
            runtime,
            "DELETE FROM budograph_private.environment_identity",
          );
          await denied(
            runtime,
            "INSERT INTO budograph_private.environment_identity(database_id,environment,project_ref) VALUES(gen_random_uuid(),'production','forged')",
          );
          await assert.rejects(
            verifyProductionDatabaseIdentity(migrator, expected),
            /identity verification failed/,
          );
          for (const fields of [
            { databaseId: randomUUID() },
            { projectRef: "wrong-project" },
          ])
            await assert.rejects(
              verifyProductionDatabaseIdentity(runtime, {
                ...expected,
                ...fields,
              }),
              /identity verification failed/,
            );
          await migrator.query(
            "UPDATE budograph_private.environment_identity SET project_ref='changed-target'",
          );
          await assert.rejects(
            runtime.query("UPDATE public.event SET name='must never execute'"),
            /identity verification failed/,
          );
          await migrator.query(
            "UPDATE budograph_private.environment_identity SET project_ref=$1",
            [expected.projectRef],
          );
          await migrator.query(
            "DELETE FROM budograph_private.environment_identity",
          );
          await assert.rejects(
            runtime.connect(),
            /identity verification failed/,
          );
          await migrator.query(
            "INSERT INTO budograph_private.environment_identity(database_id,environment,project_ref) VALUES($1,'production',$2)",
            [expected.databaseId, expected.projectRef],
          );
          assert.equal((await runtime.query("SELECT 1 AS n")).rows[0].n, 1);
        },
      );
    } finally {
      await Promise.all(pools.map((p) => p.end()));
    }
  },
);
