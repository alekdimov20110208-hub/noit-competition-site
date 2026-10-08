import assert from "node:assert/strict";
import test from "node:test";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { createNotificationService } from "../src/notifications/service.ts";
import { createReminderWorker } from "../src/notifications/worker.ts";
import { createEventService } from "../src/events/service.ts";
import { createChangeService } from "../src/changes/service.ts";
import { TaskCommandError, parseTaskAuthoring } from "../src/tasks/model.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";

test(
  "PostgreSQL reminder configuration, delivery and personal Event notifications",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {}),
      db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
      const f = await createPostgresFixture(db),
        boundary = rollbackCommandPool(db);
      const tasks = createTaskService(boundary),
        notifications = createNotificationService(boundary);
      const organizer = {
          id: f.organizerUser,
          name: "Fixture",
          email: "fixture@example.invalid",
        },
        member = { ...organizer, id: f.memberUser },
        foreign = { ...organizer, id: f.foreignUser };
      let now = new Date("2098-10-14T13:30:00Z");
      const worker = createReminderWorker(boundary, () => now);
      const denied = (status: number) => (e: unknown) =>
        e instanceof TaskCommandError && e.statusCode === status;
      const fields = {
        title: "Controlled reminders",
        category: "",
        context: "",
        deadline: "2098-10-14",
        deadlineTime: "17:30",
        priority: "normal",
      };
      let task = await tasks.create(organizer, f.eventId, {
        ...fields,
        reminderOffsets: [60, 15],
        assignedMemberId: f.memberId,
      });
      const count = async () =>
        (
          await db.query(
            "SELECT count(*)::INT AS n FROM public.notification WHERE task_id=$1 AND kind='TASK_DUE_REMINDER'",
            [task.id],
          )
        ).rows[0].n;
      await t.test(
        "presets normalized, persisted, and bounded; database rejects invalid/duplicate configuration",
        async () => {
          assert.deepEqual(task.reminderOffsets, [60, 15]);
          assert.deepEqual(
            (await tasks.read(member, f.eventId, task.id))[0]!.reminderOffsets,
            [60, 15],
          );
          for (const offsets of [
            [60, 60],
            [0],
            [1],
            [1440, 60, 15, 5],
            "60",
            ["60"],
          ])
            assert.throws(
              () => parseTaskAuthoring({ ...fields, reminderOffsets: offsets }),
              denied(400),
            );
          await assert.rejects(
            tasks.create(organizer, f.eventId, {
              ...fields,
              deadlineTime: null,
              reminderOffsets: [60],
            }),
            denied(400),
          );
          for (const offset of [60, 12]) {
            await db.query("SAVEPOINT invalid_reminder");
            await assert.rejects(
              db.query(
                "INSERT INTO public.task_reminder(id,task_id,offset_minutes,due_at,trigger_at) VALUES (gen_random_uuid(),$1,$2,now(),now())",
                [task.id, offset],
              ),
            );
            await db.query("ROLLBACK TO SAVEPOINT invalid_reminder");
            await db.query("RELEASE SAVEPOINT invalid_reminder");
          }
          await assert.rejects(
            tasks.updateDetails(member, f.eventId, task.id, {
              expectedVersion: task.version,
              reminderOffsets: [],
            }),
            denied(403),
          );
        },
      );
      await t.test(
        "assignment atomicity, self-noise, recipient/Event isolation, readAt and all-read",
        async () => {
          let snapshot = await notifications.list(member, f.eventId);
          assert.equal(snapshot.unreadCount, 1);
          assert.equal(snapshot.notifications[0]!.kind, "TASK_ASSIGNED");
          const id = snapshot.notifications[0]!.id;
          assert.equal(
            (await notifications.list(organizer, f.eventId)).unreadCount,
            0,
          );
          await assert.rejects(
            notifications.markRead(organizer, f.eventId, id),
            denied(404),
          );
          await assert.rejects(
            notifications.markRead(foreign, f.foreignEventId, id),
            denied(404),
          );
          await assert.rejects(
            notifications.list(member, f.foreignEventId),
            denied(404),
          );
          const marked = await notifications.markRead(member, f.eventId, id);
          assert.ok(marked.notification.readAt);
          assert.equal(
            (await notifications.markRead(member, f.eventId, id)).notification
              .readAt,
            marked.notification.readAt,
          );
          await tasks.create(organizer, f.eventId, {
            ...fields,
            assignedMemberId: f.organizerId,
          });
          assert.equal(
            (await notifications.list(organizer, f.eventId)).unreadCount,
            0,
          );
          await tasks.create(organizer, f.eventId, {
            ...fields,
            assignedMemberId: f.memberId,
          });
          await notifications.markAllRead(member, f.eventId);
          snapshot = await notifications.list(member, f.eventId);
          assert.equal(snapshot.unreadCount, 0);
          await assert.rejects(
            tasks.mutate(organizer, f.eventId, task.id, "assignment", {
              assignedMemberId: f.organizerId,
              expectedVersion: 999,
            }),
            denied(409),
          );
          assert.equal(
            (await notifications.list(organizer, f.eventId)).unreadCount,
            0,
          );
          await db.query(
            "UPDATE public.event_member SET active=FALSE,deactivated_at=now() WHERE id=$1",
            [f.memberId],
          );
          await assert.rejects(
            notifications.list(member, f.eventId),
            denied(404),
          );
          await assert.rejects(
            notifications.markAllRead(member, f.eventId),
            denied(404),
          );
          await db.query(
            "UPDATE public.event_member SET active=TRUE,deactivated_at=NULL WHERE id=$1",
            [f.memberId],
          );
        },
      );
      await t.test(
        "failed notification insert rolls back Task, configuration and ActivityEntry (explicit SQL fault)",
        async () => {
          const counts = async () =>
            (
              await db.query(
                `SELECT (SELECT count(*)::INT FROM public.task WHERE event_id=$1) AS tasks,
        (SELECT count(*)::INT FROM public.activity_entry WHERE event_id=$1) AS history,
        (SELECT count(*)::INT FROM public.notification WHERE event_id=$1) AS notifications,
        (SELECT count(*)::INT FROM public.task_reminder r JOIN public.task t ON t.id=r.task_id WHERE t.event_id=$1) AS reminders`,
                [f.eventId],
              )
            ).rows[0];
          const before = await counts();
          const failing = createTaskService({
            connect: async () => {
              const client = await boundary.connect(),
                query = client.query.bind(client);
              return {
                ...client,
                query: async (sql, values) => {
                  if (sql.startsWith("INSERT INTO public.notification"))
                    throw new Error("Explicit verification SQL failure");
                  return query(sql, values);
                },
              };
            },
          });
          await assert.rejects(
            failing.create(organizer, f.eventId, {
              ...fields,
              assignedMemberId: f.memberId,
              reminderOffsets: [60],
            }),
          );
          assert.deepEqual(await counts(), before);
          await db.query("SAVEPOINT date_only_reminder");
          await assert.rejects(
            db.query(
              "INSERT INTO public.task_reminder(id,task_id,offset_minutes,due_at,trigger_at) VALUES(gen_random_uuid(),$1,1440,now(),now())",
              [f.taskId],
            ),
          );
          await db.query("ROLLBACK TO SAVEPOINT date_only_reminder");
          await db.query("RELEASE SAVEPOINT date_only_reminder");
        },
      );
      await t.test(
        "one version/history update, no-op/stale and acceptance/Change preservation",
        async () => {
          task = await tasks.mutate(member, f.eventId, task.id, "acceptance", {
            accepted: true,
            expectedVersion: task.version,
          });
          const change = await createChangeService(boundary).create(
            organizer,
            f.eventId,
            {
              title: "Controlled Change",
              context: "Unchanged by reminders",
              affectedTaskIds: [task.id],
              responseOwnerMemberId: null,
            },
          );
          const accepted = task.acceptedAt,
            v = task.version;
          task = await tasks.updateDetails(organizer, f.eventId, task.id, {
            expectedVersion: v,
            reminderOffsets: [15, 1440, 60],
          });
          assert.equal(task.version, v + 1);
          assert.equal(task.acceptedAt, accepted);
          assert.equal(task.assignedMemberId, f.memberId);
          assert.equal(task.status, "not-started");
          const history = await db.query(
            "SELECT payload FROM public.activity_entry WHERE target_id=$1 AND action_type='task.updated'",
            [task.id],
          );
          assert.equal(history.rows.length, 1);
          assert.deepEqual(Object.keys(history.rows[0].payload.changes), [
            "reminderOffsets",
          ]);
          const unchanged = await tasks.updateDetails(
            organizer,
            f.eventId,
            task.id,
            { expectedVersion: task.version, reminderOffsets: [60, 15, 1440] },
          );
          assert.equal(unchanged.version, task.version);
          await assert.rejects(
            tasks.updateDetails(organizer, f.eventId, task.id, {
              expectedVersion: v,
              reminderOffsets: task.reminderOffsets,
            }),
            denied(409),
          );
          assert.equal(
            (
              await createChangeService(boundary).read(
                organizer,
                f.eventId,
                change.id,
              )
            )[0]!.version,
            change.version,
          );
        },
      );
      await t.test(
        "Event timezone conversion, delivery boundaries, repeated worker and restart catch-up",
        async () => {
          now = new Date("2098-10-14T12:29:59Z");
          assert.equal(await worker.run(), 1); // day reminder is due
          assert.equal(await count(), 1);
          now = new Date("2098-10-14T13:30:00Z");
          await worker.run();
          assert.equal(await count(), 2);
          await worker.run();
          assert.equal(await count(), 2);
          now = new Date("2098-10-14T14:20:00Z");
          await createReminderWorker(boundary, () => now).run();
          assert.equal(await count(), 3);
          now = new Date("2098-10-14T14:30:00Z");
          await worker.run();
          assert.equal(await count(), 3);
          const rows = await db.query(
            "SELECT due_at FROM public.task_reminder WHERE task_id=$1",
            [task.id],
          );
          assert.equal(
            rows.rows[0].due_at.toISOString(),
            "2098-10-14T14:30:00.000Z",
          );
        },
      );
      await t.test(
        "unassigned catch-up, current reassigned recipient, completed and overdue suppression",
        async () => {
          now = new Date("2098-10-14T13:35:00Z");
          let target = await tasks.create(organizer, f.eventId, {
            ...fields,
            reminderOffsets: [60],
          });
          await worker.run();
          assert.equal(
            (
              await db.query(
                "SELECT id FROM public.notification WHERE task_id=$1",
                [target.id],
              )
            ).rows.length,
            0,
          );
          target = await tasks.mutate(
            organizer,
            f.eventId,
            target.id,
            "assignment",
            { assignedMemberId: f.memberId, expectedVersion: target.version },
          );
          await worker.run();
          target = await tasks.mutate(
            organizer,
            f.eventId,
            target.id,
            "assignment",
            {
              assignedMemberId: f.organizerId,
              expectedVersion: target.version,
            },
          );
          await worker.run();
          const recipients = await db.query(
            "SELECT recipient_user_id FROM public.notification WHERE task_id=$1 AND kind='TASK_DUE_REMINDER'",
            [target.id],
          );
          assert.deepEqual(
            new Set(recipients.rows.map((r) => r.recipient_user_id)),
            new Set([f.memberUser, f.organizerUser]),
          );
          target = await tasks.mutate(
            organizer,
            f.eventId,
            target.id,
            "status",
            { status: "completed", expectedVersion: target.version },
          );
          target = await tasks.updateDetails(organizer, f.eventId, target.id, {
            deadlineTime: "17:40",
            expectedVersion: target.version,
          });
          await worker.run();
          assert.equal(
            (
              await db.query(
                "SELECT id FROM public.notification WHERE task_id=$1 AND kind='TASK_DUE_REMINDER'",
                [target.id],
              )
            ).rows.length,
            2,
          );
          const expired = await tasks.create(organizer, f.eventId, {
            ...fields,
            deadlineTime: "15:00",
            reminderOffsets: [60],
            assignedMemberId: f.memberId,
          });
          await worker.run();
          assert.equal(
            (
              await db.query(
                "SELECT id FROM public.notification WHERE task_id=$1 AND kind='TASK_DUE_REMINDER'",
                [expired.id],
              )
            ).rows.length,
            0,
          );
        },
      );
      await t.test(
        "date/time/timezone rescheduling and removing time clears durable rows atomically",
        async () => {
          task = await tasks.updateDetails(organizer, f.eventId, task.id, {
            expectedVersion: task.version,
            deadline: "2098-10-15",
            deadlineTime: "18:30",
          });
          let due = (
            await db.query(
              "SELECT due_at FROM public.task_reminder WHERE task_id=$1",
              [task.id],
            )
          ).rows[0].due_at;
          assert.equal(due.toISOString(), "2098-10-15T15:30:00.000Z");
          const events = createEventService(
            Object.assign(boundary, {
              query: (sql: string, values: unknown[]) => db.query(sql, values),
            }),
          );
          const event = (await events.list(organizer)).find(
            (e) => e.id === f.eventId,
          )!;
          await events.update(organizer, event.id, {
            name: event.name,
            startDate: event.startDate,
            endDate: event.endDate,
            timezone: "UTC",
            expectedVersion: event.version,
          });
          due = (
            await db.query(
              "SELECT due_at FROM public.task_reminder WHERE task_id=$1",
              [task.id],
            )
          ).rows[0].due_at;
          assert.equal(due.toISOString(), "2098-10-15T18:30:00.000Z");
          task = await tasks.updateDetails(organizer, f.eventId, task.id, {
            expectedVersion: task.version,
            deadlineTime: null,
          });
          assert.deepEqual(task.reminderOffsets, []);
          assert.equal(
            (
              await db.query(
                "SELECT id FROM public.task_reminder WHERE task_id=$1",
                [task.id],
              )
            ).rows.length,
            0,
          );
          assert.ok(task.acceptedAt);
          assert.equal(await count(), 3);
          await assert.rejects(
            tasks.updateDetails(organizer, f.eventId, task.id, {
              expectedVersion: task.version,
              reminderOffsets: [60],
            }),
            denied(400),
          );
        },
      );
      await t.test(
        "DST nonexistent/ambiguous wall time follows PostgreSQL platform semantics",
        async () => {
          await db.query(
            "UPDATE public.event SET timezone='America/New_York' WHERE id=$1",
            [f.eventId],
          );
          for (const [deadline, deadlineTime, expected] of [
            ["2026-03-08", "02:30", "2026-03-08T07:30:00.000Z"],
            ["2026-11-01", "01:30", "2026-11-01T06:30:00.000Z"],
          ]) {
            const target = await tasks.create(organizer, f.eventId, {
              ...fields,
              deadline,
              deadlineTime,
              reminderOffsets: [60],
            });
            const row = (
              await db.query(
                "SELECT due_at,trigger_at FROM public.task_reminder WHERE task_id=$1",
                [target.id],
              )
            ).rows[0];
            assert.equal(row.due_at.toISOString(), expected);
            assert.equal(
              row.due_at.getTime() - row.trigger_at.getTime(),
              3_600_000,
            );
          }
        },
      );
      await t.test(
        "history list capped at fifty; unread count and mark-all include older rows",
        async () => {
          // Explicit synthetic history fixture: one statement avoids remote-DB round trips.
          await db.query(
            `INSERT INTO public.notification (id,event_id,recipient_user_id,kind,task_id,actor_user_id,task_title,deadline,deadline_time,timezone,task_version)
        SELECT gen_random_uuid(),$1,$2,'TASK_ASSIGNED',$3,$4,'Synthetic bounded history','2098-10-14','17:30','America/New_York',100+i FROM generate_series(1,52) i`,
            [f.eventId, f.memberUser, task.id, f.organizerUser],
          );
          const snapshot = await notifications.list(member, f.eventId);
          assert.equal(snapshot.notifications.length, 50);
          assert.ok(snapshot.unreadCount > 50);
          await notifications.markAllRead(member, f.eventId);
          assert.equal(
            (await notifications.list(member, f.eventId)).unreadCount,
            0,
          );
        },
      );
    } finally {
      await db.query("ROLLBACK");
      db.release();
      await pool.end();
    }
  },
);

test(
  "two PostgreSQL workers racing share durable uniqueness (retained synthetic fixture)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120_000 },
  async () => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {}),
      db = await pool.connect();
    try {
      await db.query("BEGIN");
      const f = await createPostgresFixture(db);
      await db.query("COMMIT");
      const tasks = createTaskService(pool),
        organizer = {
          id: f.organizerUser,
          name: "Fixture",
          email: "fixture@example.invalid",
        };
      const task = await tasks.create(organizer, f.eventId, {
        title: "Retained synthetic race",
        deadline: "2099-06-12",
        deadlineTime: "17:00",
        priority: "normal",
        reminderOffsets: [60],
        assignedMemberId: f.memberId,
      });
      const clock = () => new Date("2099-06-12T13:05:00Z");
      await Promise.all([
        createReminderWorker(pool, clock).run(),
        createReminderWorker(pool, clock).run(),
      ]);
      await createReminderWorker(pool, clock).run();
      const rows = await db.query(
        "SELECT id FROM public.notification WHERE task_id=$1 AND kind='TASK_DUE_REMINDER'",
        [task.id],
      );
      assert.equal(rows.rows.length, 1);
    } finally {
      db.release();
      await pool.end();
    }
  },
);
