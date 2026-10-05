import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createChangeService } from "../src/changes/service.ts";
import { ChangeCommandError } from "../src/changes/model.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { createEventService } from "../src/events/service.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";

test(
  "PostgreSQL Change impact, isolation, transactions and Task interactions (rollback-only)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      const db = client;
      await db.query("BEGIN");
      await db.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
      await db.query("SET LOCAL DateStyle = 'SQL, DMY'");
      const f = await createPostgresFixture(db),
        boundary = rollbackCommandPool(db);
      const changes = createChangeService(boundary),
        tasks = createTaskService(boundary);
      const organizer = {
          id: f.organizerUser,
          name: "Fixture",
          email: "organizer@example.invalid",
        },
        member = { ...organizer, id: f.memberUser },
        foreign = { ...organizer, id: f.foreignUser },
        inactiveUser = { ...organizer, id: f.inactiveUser };
      const denied = (status: number) => (e: unknown) =>
        e instanceof ChangeCommandError && e.statusCode === status;
      const read = async (id: string) =>
        (await changes.read(organizer, f.eventId, id))[0]!;
      const history = async (id: string) =>
        (
          await db.query(
            "SELECT * FROM public.activity_entry WHERE event_id=$1 AND target_id=$2 ORDER BY created_at,id",
            [f.eventId, id],
          )
        ).rows;
      const counts = async () =>
        (
          await db.query(
            "SELECT (SELECT count(*)::int FROM public.event_change WHERE event_id=$1) AS changes, (SELECT count(*)::int FROM public.change_task WHERE event_id=$1) AS links, (SELECT count(*)::int FROM public.activity_entry WHERE event_id=$1) AS history",
            [f.eventId],
          )
        ).rows[0];
      let task = await tasks.mutate(
        organizer,
        f.eventId,
        f.taskId,
        "assignment",
        { assignedMemberId: f.memberId, expectedVersion: 1 },
      );
      task = await tasks.mutate(member, f.eventId, task.id, "acceptance", {
        accepted: true,
        expectedVersion: task.version,
      });
      const second = await tasks.create(organizer, f.eventId, {
        title: "Hotel",
        category: "",
        context: "",
        deadline: "2026-10-06",
        priority: "normal",
        assignedMemberId: f.memberId,
      });
      let change = await changes.create(organizer, f.eventId, {
        title: "Instructor arrival delayed",
        context: "Operational detail",
        responseOwnerMemberId: f.organizerId,
        affectedTaskIds: [task.id, second.id, task.id.toUpperCase()],
      });
      await t.test(
        "Organizer creation persists canonical scope, actor, version, links and atomic business history",
        async () => {
          assert.equal(change.version, 1);
          assert.equal(change.eventId, f.eventId);
          assert.equal(change.reporter.id, f.organizerId);
          assert.equal(change.responseOwner!.id, f.organizerId);
          assert.equal(change.impact.taskCount, 2);
          assert.deepEqual(
            change.impact.people.map((p) => p.id),
            [f.memberId],
          );
          assert.deepEqual(change.impact.deadlines, [
            "2026-10-04",
            "2026-10-06",
          ]);
          const row = (
            await db.query("SELECT * FROM public.event_change WHERE id=$1", [
              change.id,
            ])
          ).rows[0];
          assert.equal(row.created_by, f.organizerId);
          assert.ok(row.created_at instanceof Date);
          assert.ok(row.updated_at instanceof Date);
          const activity = await history(change.id);
          assert.equal(activity.length, 1);
          assert.equal(activity[0].action_type, "CHANGE_CREATED");
          assert.equal(activity[0].actor_user_id, f.organizerUser);
          assert.equal(activity[0].actor_member_id, f.organizerId);
          assert.equal(activity[0].payload.affectedTaskIds.length, 2);
          const another = await changes.create(organizer, f.eventId, {
            title: "Venue access also delayed",
            affectedTaskIds: [task.id],
          });
          assert.notEqual(another.id, change.id);
          assert.equal(another.impact.taskCount, 1);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM public.change_task WHERE event_id=$1 AND task_id=$2",
                [f.eventId, task.id],
              )
            ).rows[0].n,
            2,
            "One Task may be affected by multiple independent Changes",
          );
        },
      );
      await t.test(
        "Member reads only; inactive identities/memberships and cross-Event Change IDOR denied",
        async () => {
          assert.equal(
            (await changes.read(member, f.eventId, change.id))[0]!.id,
            change.id,
          );
          await assert.rejects(
            changes.create(member, f.eventId, { title: "Denied" }),
            denied(403),
          );
          await assert.rejects(
            changes.update(member, f.eventId, change.id, {
              expectedVersion: 1,
              responseOwnerMemberId: f.memberId,
            }),
            denied(403),
          );
          for (const user of [foreign, inactiveUser])
            await assert.rejects(
              changes.read(user, f.eventId, change.id),
              denied(404),
            );
          await assert.rejects(
            changes.read(organizer, f.foreignEventId, change.id),
            denied(404),
          );
          await assert.rejects(
            changes.update(organizer, f.foreignEventId, change.id, {
              expectedVersion: 1,
              title: "Denied",
            }),
            denied(404),
          );
          await assert.rejects(
            changes.read(foreign, f.foreignEventId, change.id),
            denied(404),
          );
          await assert.rejects(
            changes.update(foreign, f.foreignEventId, change.id, {
              expectedVersion: 1,
              title: "Denied",
            }),
            denied(404),
          );
          await assert.rejects(
            changes.read(organizer, f.eventId, randomUUID()),
            denied(404),
          );
        },
      );
      await t.test(
        "foreign/inactive response owner and foreign/missing/deleted Tasks rejected without partial writes",
        async () => {
          const before = await counts();
          for (const responseOwnerMemberId of [
            f.foreignMemberId,
            f.inactiveId,
            f.inactiveUserMemberId,
            randomUUID(),
          ]) {
            await assert.rejects(
              changes.create(organizer, f.eventId, {
                title: "Denied",
                responseOwnerMemberId,
              }),
              denied(400),
            );
            await assert.rejects(
              changes.update(organizer, f.eventId, change.id, {
                expectedVersion: change.version,
                title: "Must roll back",
                responseOwnerMemberId,
              }),
              denied(400),
            );
          }
          for (const affectedTaskIds of [
            [f.taskId, f.foreignTaskId],
            [randomUUID()],
          ]) {
            await assert.rejects(
              changes.create(organizer, f.eventId, {
                title: "Denied",
                affectedTaskIds,
              }),
              denied(400),
            );
            await assert.rejects(
              changes.update(organizer, f.eventId, change.id, {
                expectedVersion: change.version,
                affectedTaskIds,
              }),
              denied(400),
            );
          }
          await db.query(
            "UPDATE public.task SET deleted_at=clock_timestamp(),deleted_by=$2 WHERE id=$1",
            [second.id, f.organizerId],
          );
          await assert.rejects(
            changes.create(organizer, f.eventId, {
              title: "Denied",
              affectedTaskIds: [second.id],
            }),
            denied(400),
          );
          await db.query(
            "UPDATE public.task SET deleted_at=NULL,deleted_by=NULL WHERE id=$1",
            [second.id],
          );
          assert.deepEqual(await counts(), before);
          assert.deepEqual(await read(change.id), change);
        },
      );
      await t.test(
        "owner edits independent from Task assignment, acceptance, status, version and deadline",
        async () => {
          const beforeTasks = await tasks.read(organizer, f.eventId);
          change = await changes.update(organizer, f.eventId, change.id, {
            expectedVersion: change.version,
            responseOwnerMemberId: f.memberId,
          });
          assert.equal(change.responseOwner!.id, f.memberId);
          assert.equal(change.version, 2);
          assert.deepEqual(await tasks.read(organizer, f.eventId), beforeTasks);
          assert.equal(
            (await history(change.id))[1].payload.changes.responseOwnerMemberId
              .after,
            f.memberId,
          );
        },
      );
      await t.test(
        "authored details/Task-set edit increments once; stale command rolls back fields, links and history",
        async () => {
          const old = change.version;
          change = await changes.update(organizer, f.eventId, change.id, {
            expectedVersion: old,
            title: "Updated arrival",
            context: "New context",
            affectedTaskIds: [task.id],
          });
          assert.equal(change.version, old + 1);
          assert.equal(change.impact.taskCount, 1);
          const before = await counts();
          await assert.rejects(
            changes.update(organizer, f.eventId, change.id, {
              expectedVersion: old,
              title: "Stale",
              responseOwnerMemberId: null,
              affectedTaskIds: [],
            }),
            denied(409),
          );
          assert.deepEqual(await counts(), before);
          assert.deepEqual(await read(change.id), change);
          assert.deepEqual(
            await changes.update(organizer, f.eventId, change.id, {
              expectedVersion: change.version,
              affectedTaskIds: [task.id, task.id],
            }),
            change,
          );
          await assert.rejects(
            changes.update(organizer, f.eventId, change.id, {
              expectedVersion: old,
              title: change.title,
            }),
            denied(409),
          );
          const entry = (await history(change.id)).at(-1)!;
          assert.ok(entry.payload.changes.title);
          assert.ok(entry.payload.changes.context);
          assert.ok(entry.payload.changes.affectedTaskIds);
        },
      );
      await t.test(
        "current Task reassignment, assign-back, date and status project after next read",
        async () => {
          const version = change.version;
          task = await tasks.mutate(
            organizer,
            f.eventId,
            task.id,
            "assignment",
            { assignedMemberId: f.organizerId, expectedVersion: task.version },
          );
          assert.equal(task.accepted, false);
          assert.equal(
            (await read(change.id)).affectedTasks[0]!.assignedMember!.id,
            f.organizerId,
          );
          assert.equal((await read(change.id)).responseOwner!.id, f.memberId);
          task = await tasks.mutate(
            organizer,
            f.eventId,
            task.id,
            "assignment",
            { assignedMemberId: f.memberId, expectedVersion: task.version },
          );
          assert.equal(task.accepted, false);
          task = await tasks.updateDetails(organizer, f.eventId, task.id, {
            expectedVersion: task.version,
            deadline: "2026-11-03",
          });
          task = await tasks.mutate(member, f.eventId, task.id, "status", {
            expectedVersion: task.version,
            status: "blocked",
          });
          const current = await read(change.id);
          assert.equal(current.affectedTasks[0]!.deadline, "2026-11-03");
          assert.equal(current.affectedTasks[0]!.status, "blocked");
          assert.equal(current.version, version);
          task = await tasks.mutate(
            organizer,
            f.eventId,
            task.id,
            "assignment",
            { expectedVersion: task.version, assignedMemberId: null },
          );
          assert.equal((await read(change.id)).impact.people.length, 0);
        },
      );
      await t.test(
        "create/edit roll back Change, links, owner, version and history when activity write fails",
        async () => {
          const before = await read(change.id),
            beforeCounts = await counts();
          const failing = createChangeService({
            async connect() {
              const connection = await boundary.connect();
              return {
                ...connection,
                async query(sql, values) {
                  if (sql.startsWith("INSERT INTO public.activity_entry"))
                    throw new Error("Injected history failure");
                  return connection.query(sql, values);
                },
              };
            },
          });
          await assert.rejects(
            failing.create(organizer, f.eventId, {
              title: "Must roll back",
              affectedTaskIds: [f.taskId],
              responseOwnerMemberId: f.memberId,
            }),
          );
          await assert.rejects(
            failing.update(organizer, f.eventId, change.id, {
              expectedVersion: before.version,
              title: "Must roll back",
              affectedTaskIds: [],
              responseOwnerMemberId: null,
            }),
          );
          assert.deepEqual(await counts(), beforeCounts);
          assert.deepEqual(await read(change.id), before);
        },
      );
      await t.test(
        "fresh zero-Task Event permits zero-impact Change and parameterized authored text",
        async () => {
          const events = createEventService({
            ...boundary,
            query: (sql, values) => db.query(sql, values),
          });
          const fresh = await events.create(member, {
            name: "Disposable P3A",
            startDate: "2026-10-05",
            endDate: "2026-10-06",
            timezone: "Europe/Sofia",
          });
          const title =
            "Arrival '; DROP TABLE public.task; -- <script>alert(1)</script>";
          const empty = await changes.create(member, fresh.id, { title });
          assert.equal(empty.title, title);
          assert.deepEqual(empty.impact, {
            taskCount: 0,
            people: [],
            deadlines: [],
          });
          assert.equal((await tasks.read(organizer, f.eventId)).length, 2);
          await db.query(
            "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
            [fresh.id],
          );
          await assert.rejects(
            changes.update(member, fresh.id, empty.id, {
              expectedVersion: 1,
              title: "Denied",
            }),
            denied(403),
          );
        },
      );
      await t.test(
        "database composite FKs forbid foreign links/owners, duplicates and enforce RLS",
        async () => {
          for (const [sql, args] of [
            [
              "INSERT INTO public.change_task VALUES ($1,$2,$3)",
              [f.eventId, change.id, f.foreignTaskId],
            ],
            [
              "INSERT INTO public.change_task VALUES ($1,$2,$3)",
              [f.foreignEventId, change.id, f.foreignTaskId],
            ],
            [
              "INSERT INTO public.change_task VALUES ($1,$2,$3)",
              [f.eventId, change.id, f.taskId],
            ],
            [
              "UPDATE public.event_change SET response_owner_member_id=$2 WHERE id=$1",
              [change.id, f.foreignMemberId],
            ],
          ] as const) {
            await db.query("SAVEPOINT p3a_constraint");
            let code: unknown;
            try {
              await db.query(sql, [...args]);
            } catch (e) {
              code = (e as { code: string }).code;
            }
            await db.query("ROLLBACK TO SAVEPOINT p3a_constraint");
            await db.query("RELEASE SAVEPOINT p3a_constraint");
            assert.ok(code === "23503" || code === "23505");
          }
          const tables = (
            await db.query(
              "SELECT relname,relrowsecurity FROM pg_class WHERE oid IN ('public.event_change'::regclass,'public.change_task'::regclass)",
            )
          ).rows;
          assert.equal(tables.length, 2);
          assert.ok(tables.every((row) => row.relrowsecurity));
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='public' AND tablename IN ('event_change','change_task')",
              )
            ).rows[0].n,
            0,
          );
        },
      );
      await db.query("ROLLBACK");
      assert.equal(
        (
          await db.query("SELECT id FROM public.event_change WHERE id=$1", [
            change.id,
          ])
        ).rows.length,
        0,
      );
    } finally {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
        client.release();
      }
      await pool.end();
    }
  },
);
