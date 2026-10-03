import assert from "node:assert/strict";
import test from "node:test";
import { createDatabasePool } from "../src/db/pool.ts";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createEventReadService } from "../src/events/service.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { TaskCommandError } from "../src/tasks/model.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";

test(
  "PostgreSQL Event/task read scope and assignment summaries (rollback-only)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    const database = await pool.connect();
    let destroy = false;
    database.on("error", () => {
      destroy = true;
    });
    try {
      await database.query("BEGIN");
      await database.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
      await database.query("SET LOCAL DateStyle = 'SQL, DMY'");
      const fixture = await createPostgresFixture(database);
      const events = createEventReadService(database);
      const tasks = createTaskService(rollbackCommandPool(database));
      const identity = (id: string) => ({
        id,
        name: "Synthetic",
        email: "synthetic@example.invalid",
      });
      await t.test(
        "Organizer and Member discover exactly their shared authorized Event and persisted access roles",
        async () => {
          for (const [user, role] of [
            [fixture.organizerUser, "ORGANIZER"],
            [fixture.memberUser, "MEMBER"],
          ] as const) {
            const list = await events.list(identity(user));
            assert.deepEqual(
              list.map((event) => event.id),
              [fixture.eventId],
            );
            assert.equal(list[0]?.membership.accessRole, role);
            assert.equal(list[0]?.startDate, "2026-10-03");
            assert.equal(list[0]?.endDate, "2026-10-04");
          }
        },
      );
      await t.test(
        "inactive User/membership and foreign Event never leak into Event results",
        async () => {
          assert.deepEqual(
            await events.list(identity(fixture.inactiveUser)),
            [],
          );
          assert.deepEqual(
            (await events.list(identity(fixture.foreignUser))).map(
              (event) => event.id,
            ),
            [fixture.foreignEventId],
          );
          await assert.rejects(
            tasks.readForWorkspace(
              identity(fixture.foreignUser),
              fixture.eventId,
            ),
            (error) =>
              error instanceof TaskCommandError && error.statusCode === 404,
          );
        },
      );
      await database.query(
        "UPDATE public.task SET assigned_member_id = $1, blocked_by = 'Fixture dependency', blocks = 'Fixture consequence' WHERE event_id = $2 AND id = $3",
        [fixture.memberId, fixture.eventId, fixture.taskId],
      );
      await t.test(
        "both roles read identical tasks and scoped assignee names, DATE and relationships",
        async () => {
          const organizer = await tasks.readForWorkspace(
            identity(fixture.organizerUser),
            fixture.eventId,
          );
          const member = await tasks.readForWorkspace(
            identity(fixture.memberUser),
            fixture.eventId,
          );
          assert.deepEqual(organizer, member);
          assert.deepEqual(
            organizer.tasks.map((task) => task.id),
            [fixture.taskId],
          );
          assert.deepEqual(organizer.members, [
            {
              id: fixture.memberId,
              name: "Disposable P1C fixture",
              role: "Organizer",
            },
          ]);
          assert.equal(organizer.tasks[0]?.deadline, "2026-10-04");
          assert.equal(organizer.tasks[0]?.blockedBy, "Fixture dependency");
          assert.equal(organizer.tasks[0]?.blocks, "Fixture consequence");
          assert.equal(organizer.tasks[0]?.version, 1);
          assert.ok(
            !JSON.stringify(organizer).includes(fixture.foreignMemberId),
          );
        },
      );
      await t.test(
        "historical inactive assignee remains named; requester still requires active membership",
        async () => {
          await database.query(
            "UPDATE public.event_member SET active = FALSE, deactivated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [fixture.memberId],
          );
          assert.deepEqual(await events.list(identity(fixture.memberUser)), []);
          const seen = await tasks.readForWorkspace(
            identity(fixture.organizerUser),
            fixture.eventId,
          );
          assert.equal(seen.members[0]?.id, fixture.memberId);
          await assert.rejects(
            tasks.readForWorkspace(
              identity(fixture.memberUser),
              fixture.eventId,
            ),
            (error) =>
              error instanceof TaskCommandError && error.statusCode === 404,
          );
        },
      );
      await t.test(
        "soft-deleted tasks and their sole assignee produce a real empty result",
        async () => {
          await database.query(
            "UPDATE public.task SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE event_id = $2 AND id = $3",
            [fixture.organizerId, fixture.eventId, fixture.taskId],
          );
          assert.deepEqual(
            await tasks.readForWorkspace(
              identity(fixture.organizerUser),
              fixture.eventId,
            ),
            { tasks: [], members: [] },
          );
        },
      );
      await database.query("ROLLBACK");
      const persisted = await database.query(
        "SELECT id FROM public.event WHERE id = $1",
        [fixture.eventId],
      );
      assert.equal(persisted.rows.length, 0);
    } finally {
      try {
        await database.query("ROLLBACK");
      } catch {
        destroy = true;
      }
      database.release(destroy);
      await pool.end();
    }
  },
);
