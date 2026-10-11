import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createEventService } from "../src/events/service.ts";
import { EventCommandError } from "../src/events/model.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { createChangeService } from "../src/changes/service.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";

test(
  "PostgreSQL Event history preserves canonical records, actors, references and scoped cursors (rollback-only)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    const db = await pool.connect();
    let destroy = false;
    db.on("error", () => {
      destroy = true;
    });
    try {
      await db.query("BEGIN");
      await db.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
      await db.query("SET LOCAL DateStyle = 'SQL, DMY'");
      const f = await createPostgresFixture(db);
      const boundary = {
        ...rollbackCommandPool(db),
        query: (sql: string, values: unknown[]) => db.query(sql, values),
      };
      const events = createEventService(boundary),
        tasks = createTaskService(boundary),
        changes = createChangeService(boundary);
      const organizer = {
          id: f.organizerUser,
          name: "Fixture",
          email: "fixture@example.invalid",
        },
        member = { ...organizer, id: f.memberUser };
      const denied = (status: number) => (e: unknown) =>
        e instanceof EventCommandError && e.statusCode === status;
      const snapshot = async () =>
        (
          await db.query(
            "SELECT * FROM public.activity_entry WHERE event_id=$1 ORDER BY created_at,id",
            [f.eventId],
          )
        ).rows;
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
      task = await tasks.updateDetails(organizer, f.eventId, task.id, {
        title: "Recorded edited task",
        expectedVersion: task.version,
      });
      const change = await changes.create(organizer, f.eventId, {
        title: "Recorded change",
        affectedTaskIds: [task.id],
        decision: "Original decision",
        response: "Original response",
      });
      await changes.update(organizer, f.eventId, change.id, {
        expectedVersion: change.version,
        decision: null,
        response: "Changed response",
      });
      await t.test(
        "Organizer and Member see real Task/Change records and original version/actor semantics",
        async () => {
          const original = await snapshot(),
            page = await events.history(member, f.eventId);
          assert.equal(page.entries.length, original.length);
          assert.deepEqual(page, await events.history(organizer, f.eventId));
          for (const entry of page.entries) {
            const record = original.find((row) => row.id === entry.id)!;
            assert.equal(entry.actor.userId, record.actor_user_id);
            assert.equal(entry.actor.memberId, record.actor_member_id);
            assert.equal(entry.action, record.action_type);
            assert.equal(entry.target.id, record.target_id);
            assert.equal(
              entry.version,
              record.payload.taskVersion ?? record.payload.changeVersion,
            );
            assert.equal(
              entry.createdAt.slice(0, 23),
              record.created_at.toISOString().slice(0, 23),
            );
            assert.equal(entry.target.available, true);
          }
          assert.equal(
            page.entries.find((e) => e.action === "task.accepted")?.actor
              .memberId,
            f.memberId,
          );
          assert.deepEqual(
            page.entries.find((e) => e.action === "CHANGE_UPDATED")
              ?.changedFields,
            ["decision", "response"],
          );
          assert.deepEqual(
            page.entries.find((e) => e.action === "CHANGE_UPDATED")
              ?.stateChanges,
            [
              { field: "decision", before: "present", after: "absent" },
              { field: "response", before: "present", after: "present" },
            ],
          );
          assert.deepEqual(
            page.entries.find((e) => e.action === "task.updated")
              ?.changedFields,
            ["title"],
          );
          assert.doesNotMatch(
            JSON.stringify(page),
            /Original decision|Original response|Changed response|email|password/,
          );
          assert.deepEqual(await snapshot(), original);
        },
      );
      await t.test(
        "foreign/inactive identities, deactivated membership, malformed IDs and foreign cursors fail closed",
        async () => {
          for (const id of [f.foreignUser, f.inactiveUser])
            await assert.rejects(
              events.history({ ...organizer, id }, f.eventId),
              denied(404),
            );
          await assert.rejects(
            events.history(member, f.foreignEventId),
            denied(404),
          );
          await assert.rejects(
            events.history(member, f.eventId, randomUUID()),
            denied(400),
          );
          await assert.rejects(events.history(member, "bad"), denied(400));
          await db.query(
            "INSERT INTO public.activity_entry (id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id) VALUES ($1,$2,$3,$4,'EVENT_CREATED','event',$2)",
            [
              f.foreignTaskId,
              f.foreignEventId,
              f.foreignUser,
              f.foreignMemberId,
            ],
          );
          await assert.rejects(
            events.history(member, f.eventId, f.foreignTaskId),
            denied(400),
          );
          await db.query(
            "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE id=$1",
            [f.memberId],
          );
          await assert.rejects(events.history(member, f.eventId), denied(404));
        },
      );
      await t.test(
        "50-record keyset pages use full microseconds and UUID tie-breaks without omissions/duplicates",
        async () => {
          // Explicitly synthetic records owned by this rollback-only fixture.
          for (let i = 0; i < 61; i++)
            await db.query(
              "INSERT INTO public.activity_entry (id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,created_at) VALUES ($1,$2,$3,$4,'fixture.recorded','event',$2,$5::TIMESTAMPTZ)",
              [
                randomUUID(),
                f.eventId,
                f.organizerUser,
                f.organizerId,
                i < 59
                  ? "2040-01-01T00:00:00.123456Z"
                  : `2040-01-01T00:00:00.12345${i - 52}Z`,
              ],
            );
          const before = await snapshot();
          const first = await events.history(organizer, f.eventId);
          assert.equal(first.entries.length, 50);
          assert.ok(first.nextCursor);
          const second = await events.history(
            organizer,
            f.eventId,
            first.nextCursor,
          );
          assert.equal(second.nextCursor, null);
          const expected = (
            await db.query(
              "SELECT id FROM public.activity_entry WHERE event_id=$1 ORDER BY created_at DESC,id DESC",
              [f.eventId],
            )
          ).rows.map((r) => r.id);
          assert.deepEqual(
            [...first.entries, ...second.entries].map((e) => e.id),
            expected,
          );
          assert.equal(
            first.entries[0]!.createdAt,
            "2040-01-01T00:00:00.123458Z",
          );
          assert.deepEqual(await snapshot(), before);
        },
      );
      await t.test(
        "archived Event remains readable; current actor/title changes do not rewrite historical records",
        async () => {
          const before = await snapshot();
          await db.query(
            "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
            [f.eventId],
          );
          await db.query('UPDATE public."user" SET name=$2 WHERE id=$1', [
            f.organizerUser,
            "Current fixture name",
          ]);
          const page = await events.history(organizer, f.eventId);
          assert.ok(
            page.entries.every((e) => e.actor.name === "Current fixture name"),
          );
          assert.deepEqual(await snapshot(), before);
        },
      );
      await db.query("ROLLBACK");
      await t.test(
        "owned identities, memberships, Event, Task/Change and history fixtures are absent after rollback",
        async () => {
          for (const table of [
            "event",
            "event_member",
            "task",
            "event_change",
            "activity_entry",
          ]) {
            const key = table === "event" ? "id" : "event_id";
            assert.equal(
              (
                await db.query(
                  `SELECT count(*)::INT AS count FROM public.${table} WHERE ${key}=ANY($1::UUID[])`,
                  [[f.eventId, f.foreignEventId]],
                )
              ).rows[0].count,
              0,
            );
          }
          assert.equal(
            (
              await db.query(
                'SELECT count(*)::INT AS count FROM public."user" WHERE id LIKE $1',
                [`${f.prefix}%`],
              )
            ).rows[0].count,
            0,
          );
        },
      );
    } catch {
      throw new Error(
        "Event history PostgreSQL verification failed; see named subtest, private details omitted.",
      );
    } finally {
      try {
        await db.query("ROLLBACK");
      } catch {
        destroy = true;
      }
      db.release(destroy);
      await pool.end();
    }
  },
);
