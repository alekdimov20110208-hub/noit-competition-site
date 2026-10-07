import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { TaskCommandError } from "../src/tasks/model.ts";
import { createChangeService } from "../src/changes/service.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";

test(
  "PostgreSQL optional Task due time and live Change impact (rollback-only)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
      await db.query("SET LOCAL DateStyle = 'SQL, DMY'");
      await t.test(
        "immutable additive migration preserves pre-existing calendar dates with NULL times",
        async () => {
          await db.query(
            "CREATE TEMP TABLE task_due_time_upgrade (id INT PRIMARY KEY, deadline DATE NOT NULL)",
          );
          await db.query(
            "INSERT INTO task_due_time_upgrade VALUES (1, DATE '2026-11-10'), (2, DATE '2026-10-04')",
          );
          const migration = await readFile(
            new URL(
              "../migrations/0006_task_deadline_time.sql",
              import.meta.url,
            ),
            "utf8",
          );
          await db.query(
            migration.replace("public.task", "pg_temp.task_due_time_upgrade"),
          );
          assert.deepEqual(
            (
              await db.query(
                "SELECT id, to_char(deadline, 'YYYY-MM-DD') AS deadline, deadline_time FROM task_due_time_upgrade ORDER BY id",
              )
            ).rows,
            [
              { id: 1, deadline: "2026-11-10", deadline_time: null },
              { id: 2, deadline: "2026-10-04", deadline_time: null },
            ],
          );
          const columns = (
            await db.query(
              "SELECT column_name, data_type, is_nullable, datetime_precision FROM information_schema.columns WHERE table_schema='public' AND table_name='task' AND column_name IN ('deadline','deadline_time') ORDER BY column_name",
            )
          ).rows;
          assert.deepEqual(columns, [
            {
              column_name: "deadline",
              data_type: "date",
              is_nullable: "NO",
              datetime_precision: 0,
            },
            {
              column_name: "deadline_time",
              data_type: "time without time zone",
              is_nullable: "YES",
              datetime_precision: 0,
            },
          ]);
        },
      );
      const f = await createPostgresFixture(db),
        boundary = rollbackCommandPool(db);
      const tasks = createTaskService(boundary),
        changes = createChangeService(boundary);
      const organizer = {
        id: f.organizerUser,
        name: "Fixture",
        email: "organizer@example.invalid",
      };
      const member = { ...organizer, id: f.memberUser },
        foreign = { ...organizer, id: f.foreignUser };
      const denied = (status: number) => (error: unknown) =>
        error instanceof TaskCommandError && error.statusCode === status;
      const history = async (id: string) =>
        (
          await db.query(
            "SELECT action_type,payload FROM public.activity_entry WHERE target_id=$1 ORDER BY created_at,id",
            [id],
          )
        ).rows;
      const fields = {
        title: "Optional due time",
        category: "",
        context: "",
        deadline: "2026-11-10",
        priority: "normal",
      };
      let task = await tasks.create(organizer, f.eventId, {
        ...fields,
        assignedMemberId: f.memberId,
      });
      await t.test(
        "NULL/default and all valid minute boundaries persist without timezone conversion",
        async () => {
          assert.equal(task.deadlineTime, null);
          assert.equal(
            (await tasks.read(organizer, f.eventId, f.taskId))[0]!.deadlineTime,
            null,
          );
          for (const deadlineTime of [
            "00:00",
            "00:01",
            "08:00",
            "12:30",
            "23:59",
          ]) {
            const timed = await tasks.create(organizer, f.eventId, {
              ...fields,
              deadlineTime,
            });
            assert.equal(timed.deadlineTime, deadlineTime);
            assert.equal(
              (await tasks.read(organizer, f.eventId, timed.id))[0]!
                .deadlineTime,
              deadlineTime,
            );
            assert.equal(
              (
                await db.query(
                  "SELECT deadline_time::TEXT AS time FROM public.task WHERE id=$1",
                  [timed.id],
                )
              ).rows[0].time,
              `${deadlineTime}:00`,
            );
          }
        },
      );
      task = await tasks.mutate(member, f.eventId, task.id, "acceptance", {
        accepted: true,
        expectedVersion: task.version,
      });
      const accepted = task;
      const change = await changes.create(organizer, f.eventId, {
        title: "Current affected work",
        context: "",
        responseOwnerMemberId: null,
        affectedTaskIds: [task.id],
      });
      const changeHistory = await history(change.id);
      await t.test(
        "add/change/remove and atomic date+time edits retain one version/history entry and acceptance",
        async () => {
          for (const edit of [
            { deadlineTime: "16:00" },
            { deadlineTime: "18:30" },
            { deadlineTime: null },
            { deadlineTime: "23:59", deadline: "2026-11-11" },
            { deadline: "2026-11-10" },
          ]) {
            const before = task,
              count = (await history(task.id)).length;
            task = await tasks.updateDetails(organizer, f.eventId, task.id, {
              ...edit,
              expectedVersion: task.version,
            });
            assert.equal(task.version, before.version + 1);
            assert.equal(
              task.deadlineTime,
              "deadlineTime" in edit ? edit.deadlineTime : before.deadlineTime,
            );
            assert.equal(task.acceptedAt, accepted.acceptedAt);
            assert.equal(task.acceptedByMemberId, accepted.acceptedByMemberId);
            assert.equal(task.assignedMemberId, accepted.assignedMemberId);
            assert.equal(task.status, accepted.status);
            const entries = await history(task.id);
            assert.equal(entries.length, count + 1);
            assert.equal(entries.at(-1)!.action_type, "task.updated");
            assert.deepEqual(
              Object.keys(entries.at(-1)!.payload.changes).sort(),
              Object.keys(edit).sort(),
            );
            const live = (
              await changes.read(organizer, f.eventId, change.id)
            )[0]!;
            assert.equal(
              live.affectedTasks[0]!.deadlineTime,
              task.deadlineTime,
            );
            assert.equal(live.affectedTasks[0]!.deadline, task.deadline);
            assert.equal(live.version, change.version);
            assert.equal(live.updatedAt, change.updatedAt);
            assert.deepEqual(await history(change.id), changeHistory);
          }
        },
      );
      await t.test(
        "current no-op retains metadata/history; stale two-reader edit conflicts",
        async () => {
          const original = task,
            entries = await history(task.id);
          assert.deepEqual(
            await tasks.updateDetails(organizer, f.eventId, task.id, {
              deadlineTime: task.deadlineTime,
              expectedVersion: task.version,
            }),
            task,
          );
          assert.deepEqual(await history(task.id), entries);
          task = await tasks.updateDetails(organizer, f.eventId, task.id, {
            deadlineTime: "08:00",
            expectedVersion: original.version,
          });
          for (const deadlineTime of ["18:30", task.deadlineTime])
            await assert.rejects(
              tasks.updateDetails(organizer, f.eventId, task.id, {
                deadlineTime,
                expectedVersion: original.version,
              }),
              denied(409),
            );
          assert.deepEqual(
            (await tasks.read(organizer, f.eventId, task.id))[0],
            task,
          );
        },
      );
      await t.test(
        "invalid inputs, missing date, authorization and Event isolation fail before persistence",
        async () => {
          const entries = await history(task.id);
          for (const deadlineTime of [
            "25:00",
            "12:75",
            "abc",
            "9pm",
            "24:00",
            "08:00:00",
            "8:00",
            "",
          ]) {
            await assert.rejects(
              tasks.create(organizer, f.eventId, { ...fields, deadlineTime }),
              denied(400),
            );
            await assert.rejects(
              tasks.updateDetails(organizer, f.eventId, task.id, {
                deadlineTime,
                expectedVersion: task.version,
              }),
              denied(400),
            );
          }
          await assert.rejects(
            tasks.create(organizer, f.eventId, {
              ...fields,
              deadline: null,
              deadlineTime: "08:00",
            }),
            denied(400),
          );
          await assert.rejects(
            tasks.updateDetails(member, f.eventId, task.id, {
              deadlineTime: "16:00",
              expectedVersion: task.version,
            }),
            denied(403),
          );
          await assert.rejects(
            tasks.updateDetails(foreign, f.eventId, task.id, {
              deadlineTime: "16:00",
              expectedVersion: task.version,
            }),
            denied(404),
          );
          await assert.rejects(
            tasks.updateDetails(organizer, f.eventId, f.foreignTaskId, {
              deadlineTime: "16:00",
              expectedVersion: 1,
            }),
            denied(404),
          );
          assert.deepEqual(await history(task.id), entries);
          assert.deepEqual(
            (await tasks.read(organizer, f.eventId, task.id))[0],
            task,
          );
          for (const time of ["24:00", "08:00:30", "25:00"]) {
            await db.query("SAVEPOINT invalid_time");
            try {
              await assert.rejects(
                db.query(
                  "UPDATE public.task SET deadline_time=$2::TIME WHERE id=$1",
                  [task.id, time],
                ),
              );
            } finally {
              await db.query("ROLLBACK TO SAVEPOINT invalid_time");
              await db.query("RELEASE SAVEPOINT invalid_time");
            }
          }
        },
      );
    } finally {
      await db.query("ROLLBACK").catch(() => {});
      db.release();
      await pool.end();
    }
  },
);
