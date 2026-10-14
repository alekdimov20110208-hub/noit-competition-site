import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createEventService } from "../src/events/service.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { createChangeService } from "../src/changes/service.ts";
import { createReminderWorker } from "../src/notifications/worker.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";
import type { TransactionPool } from "../src/db/transaction.ts";
const enabled = process.env.RUN_DATABASE_INTEGRATION === "1";
const user = (id: string) => ({
  id,
  name: "Synthetic race",
  email: "race@example.invalid",
});
function deferred() {
  let resolve!: () => void;
  return {
    promise: new Promise<void>((r) => (resolve = r)),
    resolve: () => resolve(),
  };
}
function barrier(pool: TransactionPool, match: (sql: string) => boolean) {
  const entered = deferred(),
    release = deferred();
  let pid = 0,
    held = false;
  const wrapped: TransactionPool = {
    connect: async () => {
      const client = await pool.connect();
      pid = (
        (await client.query("SELECT pg_backend_pid() AS pid")).rows[0] as {
          pid: number;
        }
      ).pid;
      return {
        on: client.on.bind(client),
        removeListener: client.removeListener.bind(client),
        release: client.release.bind(client),
        query: async (sql, values) => {
          const result = await client.query(sql, values);
          if (!held && match(sql)) {
            held = true;
            entered.resolve();
            await release.promise;
          }
          return result;
        },
      };
    },
  };
  return {
    pool: wrapped,
    entered: entered.promise,
    release: release.resolve,
    pid: () => pid,
  };
}
test(
  "PostgreSQL Clear races across independent connections, two backend processes and worker delivery (retained synthetic fixtures)",
  { skip: !enabled, timeout: 240000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    const events = createEventService(pool),
      actor = (f: Awaited<ReturnType<typeof createPostgresFixture>>) =>
        user(f.organizerUser);
    async function fixture() {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const f = await createPostgresFixture(c);
        await c.query(
          "UPDATE public.task SET assigned_member_id=$2,deadline_time='10:00' WHERE id=$1",
          [f.taskId, f.memberId],
        );
        await c.query("COMMIT");
        return f;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    async function input(f: Awaited<ReturnType<typeof fixture>>) {
      const p = await events.clearPreview(actor(f), f.eventId);
      return {
        expectedVersion: p.event.version,
        confirmationName: p.event.name,
        scopeRevision: p.scopeRevision,
      };
    }
    try {
      for (const kind of [
        "create",
        "edit",
        "assignment",
        "acceptance",
        "status",
        "change",
        "reminder",
      ] as const)
        await t.test(
          `${kind} commits before Clear: reviewed scope rejects safely`,
          async () => {
            const f = await fixture(),
              body = await input(f),
              held = barrier(
                pool,
                (sql) =>
                  sql.includes("FROM public.event WHERE id =") &&
                  sql.includes("FOR SHARE"),
              );
            const tasks = createTaskService({ ...held.pool }),
              changes = createChangeService({ ...held.pool });
            const writing =
              kind === "create"
                ? tasks.create(actor(f), f.eventId, {
                    title: "Added concurrently",
                    deadline: "2026-10-04",
                    priority: "normal",
                  })
                : kind === "edit"
                  ? tasks.updateDetails(actor(f), f.eventId, f.taskId, {
                      title: "Concurrent edit",
                      expectedVersion: 1,
                    })
                  : kind === "reminder"
                    ? tasks.updateDetails(actor(f), f.eventId, f.taskId, {
                        reminderOffsets: [15],
                        expectedVersion: 1,
                      })
                    : kind === "change"
                      ? changes.create(actor(f), f.eventId, {
                          title: "New linked Change",
                          affectedTaskIds: [f.taskId],
                        })
                      : tasks.mutate(
                          kind === "acceptance" ? user(f.memberUser) : actor(f),
                          f.eventId,
                          f.taskId,
                          kind,
                          {
                            expectedVersion: 1,
                            ...(kind === "assignment"
                              ? { assignedMemberId: f.organizerId }
                              : kind === "acceptance"
                                ? { accepted: true }
                                : { status: "completed" }),
                          },
                        );
            await held.entered;
            const clearing = events.clearTasks(
              actor(f),
              f.eventId,
              randomUUID(),
              body,
            );
            const observed = clearing.then(
              (v) => ({ v }),
              (e) => ({ e }),
            );
            held.release();
            await writing;
            const outcome = await observed;
            assert.ok("e" in outcome);
            assert.equal(outcome.e.code, "TASK_SET_CONFLICT");
            assert.equal(
              (
                await pool.query(
                  "SELECT count(*)::INT n FROM public.task WHERE event_id=$1 AND deleted_at IS NOT NULL",
                  [f.eventId],
                )
              ).rows[0].n,
              0,
            );
          },
        );
      await t.test(
        "Clear holds exclusive Event lock: concurrent Task writers cannot mutate removed Tasks; new Task survives",
        async () => {
          const f = await fixture(),
            body = await input(f),
            held = barrier(pool, (sql) =>
              sql.includes("FROM public.event WHERE id=$1 FOR UPDATE"),
            );
          const clearing = createEventService({
            ...held.pool,
            query: pool.query.bind(pool),
          }).clearTasks(actor(f), f.eventId, randomUUID(), body);
          await held.entered;
          const tasks = createTaskService(pool);
          const edits = [
            tasks.updateDetails(actor(f), f.eventId, f.taskId, {
              title: "Too late",
              expectedVersion: 1,
            }),
            tasks.mutate(actor(f), f.eventId, f.taskId, "assignment", {
              assignedMemberId: f.organizerId,
              expectedVersion: 1,
            }),
            tasks.mutate(
              user(f.memberUser),
              f.eventId,
              f.taskId,
              "acceptance",
              { accepted: true, expectedVersion: 1 },
            ),
            tasks.mutate(actor(f), f.eventId, f.taskId, "status", {
              status: "completed",
              expectedVersion: 1,
            }),
            createChangeService(pool).create(actor(f), f.eventId, {
              title: "Stale links",
              affectedTaskIds: [f.taskId],
            }),
            tasks.create(actor(f), f.eventId, {
              title: "After clear",
              deadline: "2026-10-04",
              priority: "normal",
            }),
          ];
          const settled = Promise.allSettled(edits);
          held.release();
          await clearing;
          const results = await settled;
          for (const result of results.slice(0, 5)) {
            assert.equal(result.status, "rejected");
          }
          assert.equal(results[5]!.status, "fulfilled");
          const current = await tasks.read(actor(f), f.eventId);
          assert.equal(current.length, 1);
          assert.equal(current[0]!.title, "After clear");
        },
      );
      await t.test(
        "Two same-key connections coalesce; new process replays original outcome after a new Task",
        async () => {
          const f = await fixture(),
            body = await input(f),
            key = randomUUID();
          const [a, b] = await Promise.all([
            events.clearTasks(actor(f), f.eventId, key, body),
            createEventService(pool).clearTasks(actor(f), f.eventId, key, body),
          ]);
          assert.deepEqual(a, b);
          await createTaskService(pool).create(actor(f), f.eventId, {
            title: "After first accepted operation",
            deadline: "2026-10-04",
            priority: "normal",
          });
          const replay = await promisify(execFile)(
            process.execPath,
            [
              "server/tests/helpers/clear-replay.ts",
              f.organizerUser,
              f.eventId,
              key,
              JSON.stringify(body),
            ],
            { env: process.env, timeout: 30000 },
          );
          assert.deepEqual(JSON.parse(replay.stdout), a);
          assert.equal(
            (await createTaskService(pool).read(actor(f), f.eventId)).length,
            1,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT n FROM public.activity_entry WHERE event_id=$1 AND action_type='EVENT_TASKS_CLEARED'",
                [f.eventId],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "Independent Node processes submit the same accepted Clear once",
        async () => {
          const f = await fixture(),
            body = await input(f),
            key = randomUUID();
          const run = () =>
            promisify(execFile)(
              process.execPath,
              [
                "server/tests/helpers/clear-replay.ts",
                f.organizerUser,
                f.eventId,
                key,
                JSON.stringify(body),
              ],
              { env: process.env, timeout: 30000 },
            );
          const [a, b] = await Promise.all([run(), run()]);
          assert.deepEqual(JSON.parse(a.stdout), JSON.parse(b.stdout));
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT n FROM public.event_command_receipt WHERE source_event_id=$1 AND command_id=$2",
                [f.eventId, key],
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT n FROM public.activity_entry WHERE event_id=$1 AND action_type='EVENT_TASKS_CLEARED'",
                [f.eventId],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "Different keys, Archive and Duplicate using one reviewed version yield one lifecycle winner",
        async () => {
          for (const kind of ["clear", "archive", "duplicate"] as const) {
            const f = await fixture(),
              body = await input(f);
            const held = barrier(pool, (sql) =>
              sql.includes("FROM public.event WHERE id=$1 FOR UPDATE"),
            );
            const first = createEventService({
              ...held.pool,
              query: pool.query.bind(pool),
            }).clearTasks(actor(f), f.eventId, randomUUID(), body);
            await held.entered;
            const second =
              kind === "clear"
                ? events.clearTasks(actor(f), f.eventId, randomUUID(), body)
                : kind === "archive"
                  ? events.archive(actor(f), f.eventId, randomUUID(), {
                      expectedVersion: 1,
                      confirmationName: body.confirmationName,
                    })
                  : events.duplicate(actor(f), f.eventId, randomUUID(), {
                      expectedVersion: 1,
                      name: "Race copy",
                      startDate: "2026-11-01",
                      endDate: "2026-11-02",
                      timezone: "UTC",
                    });
            const observed = second.then(
              (v) => ({ v }),
              (e) => ({ e }),
            );
            held.release();
            await first;
            const outcome = await observed;
            assert.ok("e" in outcome);
            assert.equal(outcome.e.code, "EVENT_VERSION_CONFLICT");
          }
          const f = await fixture(),
            body = await input(f);
          await events.archive(actor(f), f.eventId, randomUUID(), {
            expectedVersion: 1,
            confirmationName: body.confirmationName,
          });
          await assert.rejects(
            events.clearTasks(actor(f), f.eventId, randomUUID(), body),
            (e) =>
              typeof e === "object" &&
              e !== null &&
              "code" in e &&
              e.code === "EVENT_ARCHIVED",
          );
        },
      );
      await t.test(
        "Worker delivery before Clear is retained; a stale candidate cannot deliver after Clear",
        async () => {
          const f = await fixture();
          await pool.query(
            "INSERT INTO public.task_reminder(id,task_id,offset_minutes,due_at,trigger_at) VALUES($1,$2,15,'2026-10-04T07:00Z','2026-10-04T06:45Z')",
            [randomUUID(), f.taskId],
          );
          const now = new Date("2026-10-04T06:50:00Z");
          const ownedWorkerPool = (eventId: string): TransactionPool => ({
            connect: async () => {
              const c = await pool.connect();
              return {
                on: c.on.bind(c),
                removeListener: c.removeListener.bind(c),
                release: c.release.bind(c),
                query: async (sql, values) => {
                  const r = await c.query(sql, values);
                  return sql.includes("SELECT r.id,t.id AS task_id")
                    ? {
                        rows: r.rows.filter(
                          (v) =>
                            (v as { event_id: string }).event_id === eventId,
                        ),
                      }
                    : r;
                },
              };
            },
          });
          const worker = createReminderWorker(
            ownedWorkerPool(f.eventId),
            () => now,
          );
          await worker.run();
          const before = (
            await pool.query(
              "SELECT to_jsonb(n) AS row FROM public.notification n WHERE event_id=$1 ORDER BY id",
              [f.eventId],
            )
          ).rows;
          assert.equal(before.length, 1);
          const body = await input(f);
          await events.clearTasks(actor(f), f.eventId, randomUUID(), body);
          await worker.run();
          assert.deepEqual(
            (
              await pool.query(
                "SELECT to_jsonb(n) AS row FROM public.notification n WHERE event_id=$1 ORDER BY id",
                [f.eventId],
              )
            ).rows,
            before,
          );
          const fresh = await fixture();
          await pool.query(
            "INSERT INTO public.task_reminder(id,task_id,offset_minutes,due_at,trigger_at) VALUES($1,$2,15,'2026-10-04T07:00Z','2026-10-04T06:45Z')",
            [randomUUID(), fresh.taskId],
          );
          const held = barrier(ownedWorkerPool(fresh.eventId), (sql) =>
            sql.includes("SELECT r.id,t.id AS task_id"),
          );
          const running = createReminderWorker(held.pool, () => now).run();
          await held.entered;
          await events.clearTasks(
            actor(fresh),
            fresh.eventId,
            randomUUID(),
            await input(fresh),
          );
          held.release();
          await running;
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT n FROM public.notification WHERE event_id=$1",
                [fresh.eventId],
              )
            ).rows[0].n,
            0,
          );
        },
      );
    } finally {
      await pool.end();
    }
  },
);
