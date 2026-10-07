import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { createEventService } from "../src/events/service.ts";
import { TaskCommandError } from "../src/tasks/model.ts";
import {
  rollbackCommandPool,
  createPostgresFixture,
} from "./postgres-fixture.ts";

test(
  "PostgreSQL task authoring and responsibility separation (rollback-only)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      const database = client;
      await database.query("BEGIN");
      await database.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
      await database.query("SET LOCAL DateStyle = 'SQL, DMY'");
      const f = await createPostgresFixture(database);
      const boundary = rollbackCommandPool(database),
        service = createTaskService(boundary);
      const organizer = {
        id: f.organizerUser,
        name: "Fixture",
        email: "organizer@example.invalid",
      };
      const member = { ...organizer, id: f.memberUser },
        foreign = { ...organizer, id: f.foreignUser };
      const fields = {
        title: "Disposable authored 🥋",
        category: "Venue",
        context: "Preparation",
        deadline: "2026-09-30",
        deadlineTime: null,
        priority: "important",
      };
      const denied = (status: number) => (error: unknown) =>
        error instanceof TaskCommandError && error.statusCode === status;
      const count = async (table: "task" | "activity_entry") =>
        (
          await database.query(
            `SELECT COUNT(*)::INT AS count FROM public.${table} WHERE event_id=$1`,
            [f.eventId],
          )
        ).rows[0].count;
      const history = async (id: string) =>
        (
          await database.query(
            "SELECT * FROM public.activity_entry WHERE event_id=$1 AND target_id=$2 ORDER BY created_at,id",
            [f.eventId, id],
          )
        ).rows;
      const created = await service.create(organizer, f.eventId, {
        ...fields,
        assignedMemberId: f.memberId,
      });
      await t.test(
        "create persists correct scope, actor, DATE, version, defaults and exactly one activity",
        async () => {
          const row = (
            await database.query(
              "SELECT *,to_char(deadline,'YYYY-MM-DD') AS day FROM public.task WHERE id=$1",
              [created.id],
            )
          ).rows[0];
          assert.equal(row.event_id, f.eventId);
          assert.equal(row.created_by, f.organizerId);
          assert.equal(row.updated_by, f.organizerId);
          assert.equal(row.version, 1);
          assert.equal(row.day, fields.deadline);
          assert.equal(row.priority, "important");
          assert.equal(row.assigned_member_id, f.memberId);
          assert.equal(row.status, "not-started");
          assert.equal(row.accepted_at, null);
          assert.equal(row.accepted_by_member_id, null);
          assert.ok(row.created_at instanceof Date);
          const entries = await history(created.id);
          assert.equal(entries.length, 1);
          assert.equal(entries[0].action_type, "task.created");
          assert.equal(entries[0].actor_user_id, organizer.id);
          assert.equal(entries[0].actor_member_id, f.organizerId);
          assert.equal(entries[0].payload.assignedMemberId, f.memberId);
        },
      );
      await t.test(
        "fresh Event zero-to-task without bootstrap, unassigned defaults and cross-Event reads",
        async () => {
          const events = createEventService({
            ...boundary,
            query: (sql, values) => database.query(sql, values),
          });
          const fresh = await events.create(member, {
            name: "Disposable fresh P2B",
            startDate: "2026-10-04",
            endDate: "2026-10-05",
            timezone: "Pacific/Honolulu",
          });
          assert.equal((await service.read(member, fresh.id)).length, 0);
          const task = await service.create(member, fresh.id, fields);
          assert.equal(task.assignedMemberId, null);
          assert.equal(task.accepted, false);
          assert.equal((await service.read(member, fresh.id)).length, 1);
          assert.ok(
            !(await service.read(organizer, f.eventId)).some(
              (value) => value.id === task.id,
            ),
          );
          await assert.rejects(
            service.read(organizer, fresh.id, task.id),
            denied(404),
          );
        },
      );
      await t.test(
        "foreign/inactive assignees, inactive identities, Member, guessed Event/task and archive fail closed",
        async () => {
          for (const assignedMemberId of [
            f.foreignMemberId,
            f.inactiveId,
            f.inactiveUserMemberId,
          ])
            await assert.rejects(
              service.create(organizer, f.eventId, {
                ...fields,
                assignedMemberId,
              }),
              denied(400),
            );
          await assert.rejects(
            service.create(member, f.eventId, fields),
            denied(403),
          );
          await assert.rejects(
            service.updateDetails(member, f.eventId, created.id, {
              title: "Denied",
              expectedVersion: 1,
            }),
            denied(403),
          );
          await assert.rejects(
            service.create(foreign, f.eventId, fields),
            denied(404),
          );
          await assert.rejects(
            service.create(organizer, f.foreignEventId, fields),
            denied(404),
          );
          await assert.rejects(
            service.updateDetails(organizer, f.eventId, f.foreignTaskId, {
              title: "Denied",
              expectedVersion: 1,
            }),
            denied(404),
          );
          await database.query(
            "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
            [f.eventId],
          );
          await assert.rejects(
            service.create(organizer, f.eventId, fields),
            denied(403),
          );
          await database.query(
            "UPDATE public.event SET archived_at=NULL WHERE id=$1",
            [f.eventId],
          );
        },
      );
      await t.test(
        "detail updates preserve acceptance/status, DATE and changed-field-only history",
        async () => {
          const accepted = await service.mutate(
            member,
            f.eventId,
            created.id,
            "acceptance",
            { accepted: true, expectedVersion: 1 },
          );
          const after = await service.updateDetails(
            organizer,
            f.eventId,
            created.id,
            {
              title: "Edited",
              category: "Logistics",
              context: "Changed",
              deadline: "2026-11-01",
              deadlineTime: null,
              priority: "critical",
              expectedVersion: accepted.version,
            },
          );
          assert.equal(after.version, 3);
          assert.equal(after.acceptedAt, accepted.acceptedAt);
          assert.equal(after.acceptedByMemberId, f.memberId);
          assert.equal(after.status, accepted.status);
          assert.equal(after.deadline, "2026-11-01");
          const entries = await history(created.id);
          const entry = entries.at(-1)!;
          assert.equal(entry.action_type, "task.updated");
          assert.deepEqual(Object.keys(entry.payload.changes).sort(), [
            "category",
            "context",
            "deadline",
            "priority",
            "title",
          ]);
          const one = await service.updateDetails(
            organizer,
            f.eventId,
            created.id,
            { title: "Only title", expectedVersion: 3 },
          );
          assert.deepEqual(
            (await history(created.id)).at(-1)!.payload.changes,
            { title: { before: "Edited", after: "Only title" } },
          );
          assert.equal(one.acceptedAt, accepted.acceptedAt);
        },
      );
      await t.test(
        "no-op preserves all metadata/history; stale no-op and stale write conflict",
        async () => {
          const before = (
            await service.read(organizer, f.eventId, created.id)
          )[0]!;
          const entries = await history(created.id);
          const noop = await service.updateDetails(
            organizer,
            f.eventId,
            created.id,
            { title: before.title, expectedVersion: before.version },
          );
          assert.deepEqual(noop, before);
          assert.equal((await history(created.id)).length, entries.length);
          for (const title of [before.title, "Stale overwrite"])
            await assert.rejects(
              service.updateDetails(organizer, f.eventId, created.id, {
                title,
                expectedVersion: before.version - 1,
              }),
              denied(409),
            );
        },
      );
      await t.test(
        "real constraint failures roll back task create/edit and history atomically",
        async () => {
          const taskCount = await count("task"),
            activityCount = await count("activity_entry"),
            before = (await service.read(organizer, f.eventId, created.id))[0]!;
          const failing = createTaskService({
            async connect() {
              const connection = await boundary.connect();
              return {
                ...connection,
                async query(sql: string, values?: unknown[]) {
                  if (sql.startsWith("INSERT INTO public.activity_entry"))
                    return connection.query(
                      "INSERT INTO public.activity_entry (id,event_id,actor_user_id,action_type,target_type,target_id) VALUES ($1,$2,$3,'','task',$4)",
                      [values![0], f.eventId, organizer.id, created.id],
                    );
                  return connection.query(sql, values);
                },
              };
            },
          });
          await assert.rejects(failing.create(organizer, f.eventId, fields));
          await assert.rejects(
            failing.updateDetails(organizer, f.eventId, created.id, {
              title: "Must roll back",
              expectedVersion: before.version,
            }),
          );
          assert.equal(await count("task"), taskCount);
          assert.equal(await count("activity_entry"), activityCount);
          assert.deepEqual(
            (await service.read(organizer, f.eventId, created.id))[0],
            before,
          );
        },
      );
      await t.test(
        "existing status/reassignment/assign-back/explicit reacceptance remain independent",
        async () => {
          let task = (await service.read(organizer, f.eventId, created.id))[0]!;
          task = await service.mutate(member, f.eventId, task.id, "status", {
            status: "in-progress",
            expectedVersion: task.version,
          });
          assert.equal(task.accepted, true);
          task = await service.mutate(
            organizer,
            f.eventId,
            task.id,
            "assignment",
            { assignedMemberId: null, expectedVersion: task.version },
          );
          assert.equal(task.accepted, false);
          task = await service.mutate(
            organizer,
            f.eventId,
            task.id,
            "assignment",
            { assignedMemberId: f.memberId, expectedVersion: task.version },
          );
          assert.equal(task.accepted, false);
          task = await service.mutate(
            member,
            f.eventId,
            task.id,
            "acceptance",
            { accepted: true, expectedVersion: task.version },
          );
          assert.equal(task.accepted, true);
        },
      );
      await database.query("ROLLBACK");
      assert.equal(
        (
          await database.query("SELECT id FROM public.task WHERE id=$1", [
            created.id,
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
