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
import { createInvitationService } from "../src/invitations/service.ts";
import { createReminderWorker } from "../src/notifications/worker.ts";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "../src/invitations/model.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";
import type { TransactionPool } from "../src/db/transaction.ts";
const enabled = process.env.RUN_DATABASE_INTEGRATION === "1";
const user = (id: string) => ({
  id,
  name: "Synthetic race actor",
  email: "race@example.invalid",
});
const input = {
  expectedVersion: 1,
  confirmationName: "Disposable P1C fixture",
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function wait(promise: Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(Error("Race barrier was not reached")),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function wrapped(
  pool: TransactionPool,
  hook: (
    sql: string,
    run: () => Promise<{ rows: unknown[] }>,
  ) => Promise<{ rows: unknown[] }>,
): TransactionPool {
  return {
    connect: async () => {
      const client = await pool.connect();
      return {
        on: client.on.bind(client),
        removeListener: client.removeListener.bind(client),
        release: client.release.bind(client),
        query: (sql, values) => hook(sql, () => client.query(sql, values)),
      };
    },
  };
}
test(
  "PostgreSQL Archive holds Event through commit: competing Edit, Task, Change, invitation join and Duplicate serialize (retained synthetic fixtures)",
  { skip: !enabled, timeout: 90000 },
  async () => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {}),
      client = await pool.connect();
    const gate = deferred(),
      release = deferred();
    try {
      await client.query("BEGIN");
      const f = await createPostgresFixture(client),
        token = generateInvitationToken();
      await client.query(
        "INSERT INTO public.event_invitation(id,event_id,invited_email,inviter_user_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '1 day')",
        [
          randomUUID(),
          f.eventId,
          `${f.memberUser}@example.invalid`,
          f.organizerUser,
          hashInvitationToken(token),
        ],
      );
      await client.query("COMMIT");
      const held = wrapped(pool, async (sql, run) => {
        if (sql === "COMMIT") {
          gate.resolve();
          await release.promise;
        }
        return run();
      });
      const key = randomUUID(),
        archive = createEventService({
          ...held,
          query: pool.query.bind(pool),
        }).archive(user(f.organizerUser), f.eventId, key, input);
      await wait(gate.promise);
      let started = 0;
      const allStarted = deferred();
      const racing = wrapped(pool, async (sql, run) => {
        if (
          sql.startsWith("SELECT") &&
          sql.includes("FROM public.event WHERE")
        ) {
          if (++started === 6) allStarted.resolve();
        }
        return run();
      });
      const db = { ...racing, query: pool.query.bind(pool) },
        events = createEventService(db),
        tasks = createTaskService(db);
      const commands = [
        events.update(user(f.organizerUser), f.eventId, {
          name: input.confirmationName,
          startDate: "2026-10-03",
          endDate: "2026-10-04",
          timezone: "UTC",
          expectedVersion: 1,
        }),
        tasks.create(user(f.organizerUser), f.eventId, {
          title: "Must not appear",
          deadline: "2026-10-04",
          priority: "normal",
        }),
        tasks.mutate(user(f.organizerUser), f.eventId, f.taskId, "status", {
          status: "completed",
          expectedVersion: 1,
        }),
        createChangeService(db).create(user(f.organizerUser), f.eventId, {
          title: "Must not appear",
        }),
        createInvitationService(db).accept(user(f.memberUser), token, {}),
        events.duplicate(user(f.organizerUser), f.eventId, randomUUID(), {
          name: "Stale copy",
          startDate: "2026-11-01",
          endDate: "2026-11-02",
          timezone: "UTC",
          expectedVersion: 1,
        }),
      ];
      const settled = Promise.allSettled(commands);
      await wait(allStarted.promise);
      release.resolve();
      await archive;
      const results = await settled;
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 0);
      for (const result of results) {
        assert.ok(result.status === "rejected");
        assert.ok(
          [
            "EVENT_ARCHIVED",
            "INVITATION_UNAVAILABLE",
            "EVENT_VERSION_CONFLICT",
          ].includes(result.reason.code),
        );
      }
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::INT AS n FROM public.task WHERE event_id=$1",
            [f.eventId],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::INT AS n FROM public.event_change WHERE event_id=$1",
            [f.eventId],
          )
        ).rows[0].n,
        0,
      );
      // Fresh independent process can only return the persisted outcome because its
      // original version is now stale. No memory is shared with this test process.
      const replay = await promisify(execFile)(
        process.execPath,
        [
          "server/tests/helpers/archive-replay.ts",
          f.organizerUser,
          f.eventId,
          key,
        ],
        { env: process.env, timeout: 30000 },
      );
      assert.deepEqual(JSON.parse(replay.stdout), {
        id: f.eventId,
        version: 2,
        archived: true,
      });
    } finally {
      release.resolve();
      client.release();
      await pool.end();
    }
  },
);

test(
  "PostgreSQL writes committed before Archive remain history; Event edit invalidates the reviewed archive version (independent connections)",
  { skip: !enabled, timeout: 120000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    try {
      for (const kind of ["task", "change", "invitation", "edit"] as const)
        await t.test(kind, async () => {
          const client = await pool.connect();
          let f: Awaited<ReturnType<typeof createPostgresFixture>>;
          try {
            await client.query("BEGIN");
            f = await createPostgresFixture(client);
            await client.query("COMMIT");
          } finally {
            client.release();
          }
          const gate = deferred(),
            release = deferred(),
            attempted = deferred();
          const writer = wrapped(pool, async (sql, run) => {
              if (sql === "COMMIT") {
                gate.resolve();
                await release.promise;
              }
              return run();
            }),
            db = { ...writer, query: pool.query.bind(pool) },
            actor = user(f.organizerUser);
          const write =
            kind === "task"
              ? createTaskService(db).mutate(
                  actor,
                  f.eventId,
                  f.taskId,
                  "status",
                  { status: "completed", expectedVersion: 1 },
                )
              : kind === "change"
                ? createChangeService(db).create(actor, f.eventId, {
                    title: "Before archive",
                  })
                : kind === "invitation"
                  ? createInvitationService(db).create(actor, f.eventId, {
                      email: `race-${randomUUID()}@example.invalid`,
                    })
                  : createEventService(db).update(actor, f.eventId, {
                      name: "Changed before archive",
                      startDate: "2026-10-03",
                      endDate: "2026-10-04",
                      timezone: "UTC",
                      expectedVersion: 1,
                    });
          try {
            await wait(gate.promise);
            const archiver = wrapped(pool, async (sql, run) => {
              if (sql.includes("FROM public.event WHERE")) attempted.resolve();
              return run();
            });
            const archive = createEventService({
              ...archiver,
              query: pool.query.bind(pool),
            }).archive(actor, f.eventId, randomUUID(), input);
            const outcome = Promise.allSettled([archive]);
            await wait(attempted.promise);
            release.resolve();
            await write;
            const result = (await outcome)[0]!;
            if (kind === "edit") {
              assert.ok(result.status === "rejected");
              assert.equal(result.reason.code, "EVENT_VERSION_CONFLICT");
            } else {
              assert.ok(result.status === "fulfilled");
              assert.equal(result.value.archived, true);
              const history = (
                await createEventService(pool).history(actor, f.eventId)
              ).entries;
              assert.equal(history[0]!.action, "EVENT_ARCHIVED");
              assert.ok(history.length >= 2);
            }
          } finally {
            release.resolve();
          }
        });
    } finally {
      await pool.end();
    }
  },
);

test(
  "PostgreSQL stale worker candidate cannot deliver after Archive; in-flight worker delivery completes before lifecycle commit",
  { skip: !enabled, timeout: 90000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    try {
      for (const phase of ["scan", "delivery"] as const)
        await t.test(phase, async () => {
          const client = await pool.connect();
          let f: Awaited<ReturnType<typeof createPostgresFixture>>;
          try {
            await client.query("BEGIN");
            f = await createPostgresFixture(client);
            await client.query(
              "UPDATE public.event SET timezone='UTC' WHERE id=$1",
              [f.eventId],
            );
            await client.query(
              "UPDATE public.task SET assigned_member_id=$2,deadline='2040-10-04',deadline_time='10:00' WHERE id=$1",
              [f.taskId, f.memberId],
            );
            await client.query(
              "INSERT INTO public.task_reminder(id,task_id,offset_minutes,due_at,trigger_at) VALUES($1,$2,15,'2040-10-04T10:00Z','2040-10-04T09:45Z')",
              [randomUUID(), f.taskId],
            );
            await client.query("COMMIT");
          } finally {
            client.release();
          }
          const gate = deferred(),
            release = deferred();
          let commits = 0;
          const workerPool = wrapped(pool, async (sql, run) => {
            if (phase === "scan" && sql.includes("SELECT r.id,t.id")) {
              const result = await run();
              gate.resolve();
              await release.promise;
              return result;
            }
            if (phase === "delivery" && sql === "COMMIT" && ++commits === 2) {
              gate.resolve();
              await release.promise;
            }
            return run();
          });
          const worker = createReminderWorker(
              workerPool,
              () => new Date("2040-10-04T09:50Z"),
            ),
            delivery = worker.run();
          try {
            await wait(gate.promise);
            const actor = user(f.organizerUser);
            if (phase === "scan") {
              await createEventService(pool).archive(
                actor,
                f.eventId,
                randomUUID(),
                input,
              );
              release.resolve();
              assert.equal(await delivery, 0);
            } else {
              const attempted = deferred(),
                archiver = wrapped(pool, async (sql, run) => {
                  if (sql.includes("FROM public.event WHERE"))
                    attempted.resolve();
                  return run();
                });
              const archive = createEventService({
                ...archiver,
                query: pool.query.bind(pool),
              }).archive(actor, f.eventId, randomUUID(), input);
              await wait(attempted.promise);
              release.resolve();
              assert.equal(await delivery, 1);
              await archive;
            }
            const count = (
              await pool.query(
                "SELECT count(*)::INT AS n FROM public.notification WHERE event_id=$1 AND kind='TASK_DUE_REMINDER'",
                [f.eventId],
              )
            ).rows[0].n;
            assert.equal(count, phase === "scan" ? 0 : 1);
            assert.equal(
              await createReminderWorker(
                pool,
                () => new Date("2040-10-04T09:50Z"),
              ).run(),
              0,
            );
            assert.equal(
              (
                await pool.query(
                  "SELECT count(*)::INT AS n FROM public.notification WHERE event_id=$1 AND kind='TASK_DUE_REMINDER'",
                  [f.eventId],
                )
              ).rows[0].n,
              count,
            );
          } finally {
            release.resolve();
          }
        });
    } finally {
      await pool.end();
    }
  },
);
