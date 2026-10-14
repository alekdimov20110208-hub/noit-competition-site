import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createEventService } from "../src/events/service.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { createChangeService } from "../src/changes/service.ts";
import { createNotificationService } from "../src/notifications/service.ts";
import { EventCommandError } from "../src/events/model.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";
import type { TransactionPool } from "../src/db/transaction.ts";
const enabled = process.env.RUN_DATABASE_INTEGRATION === "1";
const user = (id: string) => ({
  id,
  name: "Synthetic Clear",
  email: "clear@example.invalid",
});
const denied = (code: string) => (e: unknown) =>
  e instanceof EventCommandError && e.code === code;
test(
  "PostgreSQL Clear authorization, exact scope, retention, no-op, rollback and durable recovery (rollback-only)",
  { skip: !enabled, timeout: 180000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {}),
      client = await pool.connect();
    try {
      await client.query("BEGIN");
      const f = await createPostgresFixture(client),
        actor = user(f.organizerUser),
        member = user(f.memberUser);
      const commandPool = rollbackCommandPool(client),
        db = { ...commandPool, query: client.query.bind(client) },
        events = createEventService(db),
        tasks = createTaskService(db),
        changes = createChangeService(db);
      const old = randomUUID(),
        completed = randomUUID(),
        change = randomUUID(),
        notification = randomUUID();
      await client.query(
        "INSERT INTO public.task(id,event_id,title,deadline,created_by,updated_by,status,deleted_at,deleted_by) VALUES($1,$2,'Previously removed','2026-10-04',$3,$3,'completed',clock_timestamp(),$3),($4,$2,'Completed Task','2026-10-04',$3,$3,'completed',NULL,NULL)",
        [old, f.eventId, f.organizerId, completed],
      );
      await client.query(
        "UPDATE public.task SET assigned_member_id=$2,accepted_by_member_id=$2,accepted_at=clock_timestamp(),deadline_time='10:00' WHERE id=$1",
        [f.taskId, f.memberId],
      );
      await client.query(
        "INSERT INTO public.task_reminder(id,task_id,offset_minutes,due_at,trigger_at) VALUES($1,$2,15,'2026-10-04T07:00Z','2026-10-04T06:45Z')",
        [randomUUID(), f.taskId],
      );
      await client.query(
        "INSERT INTO public.event_change(id,event_id,title,created_by,response_owner_member_id,decision_text,decision_author_member_id,decision_created_at,decision_updated_at,response_text,plan_b_text) VALUES($1,$2,'Retained Change',$3,$4,'Decision',$3,clock_timestamp(),clock_timestamp(),'Response','Plan B')",
        [change, f.eventId, f.organizerId, f.memberId],
      );
      await client.query(
        "INSERT INTO public.change_task(event_id,change_id,task_id) VALUES($1,$2,$3),($1,$2,$4)",
        [f.eventId, change, f.taskId, old],
      );
      await client.query(
        "INSERT INTO public.notification(id,event_id,recipient_user_id,kind,task_id,actor_user_id,task_title,deadline,timezone,task_version) VALUES($1,$2,$3,'TASK_ASSIGNED',$4,$5,'Snapshot','2026-10-04','Europe/Sofia',1)",
        [notification, f.eventId, member.id, f.taskId, actor.id],
      );
      const preview = () => events.clearPreview(actor, f.eventId);
      const command = async () => {
        const p = await preview();
        return {
          expectedVersion: p.event.version,
          confirmationName: p.event.name,
          scopeRevision: p.scopeRevision,
        };
      };
      const input = await command();
      await t.test(
        "Owner previews canonical live/completed/reminder/Change counts; Member, foreign, revoked and inactive denied",
        async () => {
          const p = await preview();
          assert.equal(p.taskCount, 2);
          assert.equal(p.completedCount, 1);
          assert.equal(p.reminderCount, 1);
          assert.equal(p.affectedChangeCount, 1);
          for (const [id, code] of [
            [f.memberUser, "FORBIDDEN"],
            [f.foreignUser, "NOT_FOUND"],
            [f.inactiveUser, "NOT_FOUND"],
          ]) {
            await assert.rejects(
              events.clearPreview(user(id!), f.eventId),
              denied(code!),
            );
            await assert.rejects(
              events.clearTasks(user(id!), f.eventId, randomUUID(), input),
              denied(code!),
            );
          }
          await assert.rejects(
            events.clearTasks(actor, f.foreignEventId, randomUUID(), input),
            denied("NOT_FOUND"),
          );
          await assert.rejects(
            events.clearTasks(actor, f.eventId, randomUUID(), {
              ...input,
              accessRole: "ORGANIZER",
            }),
            denied("INVALID_CLEAR_COMMAND"),
          );
        },
      );
      await t.test(
        "Name case/whitespace, stale Event and same-count Task edits reject without effects",
        async () => {
          for (const name of [
            input.confirmationName.toLowerCase(),
            " " + input.confirmationName,
            input.confirmationName + " ",
          ])
            await assert.rejects(
              events.clearTasks(actor, f.eventId, randomUUID(), {
                ...input,
                confirmationName: name,
              }),
              denied("INVALID_CLEAR_COMMAND"),
            );
          await assert.rejects(
            events.clearTasks(actor, f.eventId, randomUUID(), {
              ...input,
              expectedVersion: 2,
            }),
            denied("EVENT_VERSION_CONFLICT"),
          );
          await client.query("SAVEPOINT scope_probe");
          await tasks.updateDetails(actor, f.eventId, f.taskId, {
            title: "Edited",
            expectedVersion: 1,
          });
          assert.equal((await preview()).event.version, 1);
          await assert.rejects(
            events.clearTasks(actor, f.eventId, randomUUID(), input),
            denied("TASK_SET_CONFLICT"),
          );
          await client.query("ROLLBACK TO SAVEPOINT scope_probe");
          await client.query("RELEASE SAVEPOINT scope_probe");
        },
      );
      await t.test(
        "New Task, changed reminder and Change scope each invalidate preview",
        async () => {
          for (const edit of [
            () =>
              tasks.create(actor, f.eventId, {
                title: "New",
                deadline: "2026-10-04",
                priority: "normal",
              }),
            () =>
              tasks.updateDetails(actor, f.eventId, f.taskId, {
                reminderOffsets: [15, 60],
                expectedVersion: 1,
              }),
            () =>
              changes.update(actor, f.eventId, change, {
                planB: "Changed plan",
                expectedVersion: 1,
              }),
          ]) {
            await client.query("SAVEPOINT changed_scope");
            await edit();
            await assert.rejects(
              events.clearTasks(actor, f.eventId, randomUUID(), input),
              denied("TASK_SET_CONFLICT"),
            );
            await client.query("ROLLBACK TO SAVEPOINT changed_scope");
            await client.query("RELEASE SAVEPOINT changed_scope");
          }
        },
      );
      await t.test(
        "Task/Event version ceilings and effect/activity/receipt faults roll back every row",
        async () => {
          for (const sql of [
            "UPDATE public.task SET version=2147483647 WHERE id=$1",
            "UPDATE public.event SET version=2147483647 WHERE id=$1",
          ]) {
            await client.query("SAVEPOINT ceiling");
            await client.query(sql, [
              sql.includes("public.task") ? f.taskId : f.eventId,
            ]);
            await assert.rejects(
              events.clearTasks(
                actor,
                f.eventId,
                randomUUID(),
                await command(),
              ),
              denied("VERSION_LIMIT_REACHED"),
            );
            await client.query("ROLLBACK TO SAVEPOINT ceiling");
            await client.query("RELEASE SAVEPOINT ceiling");
          }
          for (const target of [
            "WITH removed AS",
            "INSERT INTO public.activity_entry(id,event_id",
            "INSERT INTO public.event_command_receipt",
          ]) {
            const key = randomUUID();
            const fault: TransactionPool = {
              connect: async () => {
                const c = await commandPool.connect();
                return {
                  ...c,
                  query: async (sql, values) => {
                    if (sql.includes(target))
                      throw Error("injected Clear fault");
                    return c.query(sql, values);
                  },
                };
              },
            };
            await assert.rejects(
              createEventService({ ...fault, query: db.query }).clearTasks(
                actor,
                f.eventId,
                key,
                input,
              ),
              /injected Clear fault/,
            );
            assert.equal((await preview()).taskCount, 2);
            assert.equal((await preview()).event.version, 1);
            assert.equal(
              (
                await client.query(
                  "SELECT count(*)::INT n FROM public.event_command_receipt WHERE command_id=$1",
                  [key],
                )
              ).rows[0].n,
              0,
            );
            assert.equal(
              (
                await client.query(
                  "SELECT count(*)::INT n FROM public.activity_entry WHERE event_id=$1 AND action_type IN('EVENT_TASKS_CLEARED','task.removed')",
                  [f.eventId],
                )
              ).rows[0].n,
              0,
            );
          }
        },
      );
      const beforeTasks = (
        await client.query(
          "SELECT to_jsonb(t) AS row FROM public.task t WHERE event_id=$1 ORDER BY id",
          [f.eventId],
        )
      ).rows;
      const oldRow = beforeTasks.find((x) => x.row.id === old)!.row;
      const preserved = async () => {
        const result: Record<string, unknown> = {};
        for (const table of [
          "event_change",
          "change_task",
          "task_reminder",
          "notification",
        ]) {
          const where =
            table === "task_reminder"
              ? "task_id IN(SELECT id FROM public.task WHERE event_id=$1)"
              : "event_id=$1";
          result[table] = (
            await client.query(
              `SELECT to_jsonb(r) row FROM public.${table} r WHERE ${where} ORDER BY to_jsonb(r)::TEXT`,
              [f.eventId],
            )
          ).rows;
        }
        return result;
      };
      const original = await preserved(),
        foreign = (
          await client.query(
            "SELECT to_jsonb(t) row FROM public.task t WHERE id=$1",
            [f.foreignTaskId],
          )
        ).rows;
      await client.query(
        "UPDATE public.event_member SET access_role='ORGANIZER' WHERE id=$1",
        [f.memberId],
      );
      const key = randomUUID(),
        result = await events.clearTasks(member, f.eventId, key, input);
      await t.test(
        "Non-owner Organizer clears only live Tasks including completed; identity/responsibility/history retained",
        async () => {
          assert.equal(result.clearedCount, 2);
          assert.equal(result.event.version, 2);
          assert.equal(result.event.archived, false);
          assert.equal((await tasks.read(member, f.eventId)).length, 0);
          assert.deepEqual(await preserved(), original);
          assert.deepEqual(
            (
              await client.query(
                "SELECT to_jsonb(t) row FROM public.task t WHERE id=$1",
                [f.foreignTaskId],
              )
            ).rows,
            foreign,
          );
          for (const { row } of (
            await client.query(
              "SELECT to_jsonb(t) AS row FROM public.task t WHERE event_id=$1 ORDER BY id",
              [f.eventId],
            )
          ).rows) {
            if (row.id === old) {
              assert.deepEqual(row, oldRow);
              continue;
            }
            const prior = beforeTasks.find((x) => x.row.id === row.id)!.row;
            assert.equal(row.version, prior.version + 1);
            assert.equal(row.deleted_by, f.memberId);
            assert.equal(row.updated_by, f.memberId);
            assert.equal(row.deleted_at, row.updated_at);
            for (const field of Object.keys(prior).filter(
              (x) =>
                ![
                  "version",
                  "deleted_at",
                  "deleted_by",
                  "updated_at",
                  "updated_by",
                ].includes(x),
            ))
              assert.deepEqual(row[field], prior[field], field);
          }
          const history = await events.history(member, f.eventId);
          const historical = await events.removedTask(
            member,
            f.eventId,
            f.taskId,
          );
          assert.equal(historical.id, f.taskId);
          assert.equal(historical.assigneeName, "Disposable P1C fixture");
          assert.ok(historical.acceptedAt);
          assert.equal(historical.reminderCount, 1);
          await assert.rejects(
            events.removedTask(user(f.foreignUser), f.eventId, f.taskId),
            denied("NOT_FOUND"),
          );
          await assert.rejects(
            tasks.updateDetails(actor, f.eventId, f.taskId, {
              title: "Forbidden retained edit",
              expectedVersion: 2,
            }),
          );
          assert.equal(
            history.entries.filter((e) => e.action === "task.removed").length,
            2,
          );
          assert.equal(
            history.entries.filter((e) => e.action === "EVENT_TASKS_CLEARED")
              .length,
            1,
          );
          assert.equal(
            (
              await client.query(
                "SELECT count(DISTINCT created_at)::INT n FROM public.activity_entry WHERE event_id=$1 AND payload->>'operationId'=$2",
                [f.eventId, key],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "New Task after Clear survives exact receipt replay; altered request and command type conflict",
        async () => {
          const newTask = await tasks.create(actor, f.eventId, {
            title: "After Clear",
            deadline: "2026-10-04",
            priority: "normal",
          });
          assert.deepEqual(
            await createEventService(db).clearTasks(
              member,
              f.eventId,
              key,
              input,
            ),
            result,
          );
          assert.equal((await tasks.read(actor, f.eventId)).length, 1);
          await assert.rejects(
            events.clearTasks(member, f.eventId, key, {
              ...input,
              expectedVersion: 2,
            }),
            denied("IDEMPOTENCY_KEY_REUSED"),
          );
          await assert.rejects(
            events.archive(member, f.eventId, key, {
              expectedVersion: 2,
              confirmationName: input.confirmationName,
            }),
            denied("IDEMPOTENCY_KEY_REUSED"),
          );
          await assert.rejects(
            events.clearTasks(member, f.eventId, randomUUID(), input),
            denied("EVENT_VERSION_CONFLICT"),
          );
          assert.equal((await tasks.read(actor, f.eventId))[0]!.id, newTask.id);
        },
      );
      await t.test(
        "Removed Change links are visible separately and survive later empty-link editing; stale deleted selection fails",
        async () => {
          const retained = (await changes.read(member, f.eventId, change))[0]!;
          assert.equal(retained.affectedTasks.length, 0);
          assert.equal(retained.removedTasks!.length, 2);
          assert.equal(retained.planB, "Plan B");
          await changes.update(actor, f.eventId, change, {
            affectedTaskIds: [],
            response: "Updated response",
            expectedVersion: 1,
          });
          assert.equal(
            (
              await client.query(
                "SELECT count(*)::INT n FROM public.change_task WHERE change_id=$1",
                [change],
              )
            ).rows[0].n,
            2,
          );
          await assert.rejects(
            changes.update(actor, f.eventId, change, {
              affectedTaskIds: [f.taskId],
              expectedVersion: 2,
            }),
          );
          assert.equal(
            (
              await createNotificationService(db).markRead(
                member,
                f.eventId,
                notification,
              )
            ).notification.id,
            notification,
          );
        },
      );
      await t.test(
        "Removed Change projection is bounded to 50 references with full retained count",
        async () => {
          await client.query(
            "INSERT INTO public.task(id,event_id,title,deadline,created_by,updated_by,deleted_at,deleted_by) SELECT gen_random_uuid(),$1,'Retained reference '||g,'2026-10-04',$2,$2,clock_timestamp(),$2 FROM generate_series(1,55) g",
            [f.eventId, f.organizerId],
          );
          await client.query(
            "INSERT INTO public.change_task(event_id,change_id,task_id) SELECT $1,$2,id FROM public.task WHERE event_id=$1 AND title LIKE 'Retained reference %'",
            [f.eventId, change],
          );
          const bounded = (await changes.read(member, f.eventId, change))[0]!;
          assert.equal(bounded.removedTasks!.length, 50);
          assert.equal(bounded.removedTaskCount, 57);
          await changes.update(actor, f.eventId, change, {
            affectedTaskIds: [],
            planB: "Retained later Plan B",
            expectedVersion: 2,
          });
          assert.equal(
            (
              await client.query(
                "SELECT count(*)::INT n FROM public.change_task WHERE change_id=$1",
                [change],
              )
            ).rows[0].n,
            57,
          );
        },
      );
      await t.test(
        "Replay reauthorizes current role, membership, identity and active lifecycle",
        async () => {
          for (const sql of [
            "UPDATE public.event_member SET access_role='MEMBER' WHERE id=$1",
            "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE id=$1",
            'UPDATE public."user" SET active=FALSE WHERE id=$1',
            "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
          ]) {
            await client.query("SAVEPOINT revoke");
            await client.query(sql, [
              sql.includes('public."user"')
                ? member.id
                : sql.includes("public.event SET")
                  ? f.eventId
                  : f.memberId,
            ]);
            await assert.rejects(
              events.clearTasks(member, f.eventId, key, input),
              denied(
                sql.includes("access_role")
                  ? "FORBIDDEN"
                  : sql.includes("archived_at")
                    ? "EVENT_ARCHIVED"
                    : "NOT_FOUND",
              ),
            );
            await client.query("ROLLBACK TO SAVEPOINT revoke");
            await client.query("RELEASE SAVEPOINT revoke");
          }
        },
      );
      await t.test(
        "Current empty scope has durable zero result with no timestamp/version/removal activity change",
        async () => {
          const other = user(f.foreignUser);
          const p = await events.clearPreview(other, f.foreignEventId);
          await events.clearTasks(other, f.foreignEventId, randomUUID(), {
            expectedVersion: 1,
            confirmationName: p.event.name,
            scopeRevision: p.scopeRevision,
          });
          const empty = await events.clearPreview(other, f.foreignEventId),
            k = randomUUID(),
            body = {
              expectedVersion: 2,
              confirmationName: empty.event.name,
              scopeRevision: empty.scopeRevision,
            };
          const outcome = await events.clearTasks(
            other,
            f.foreignEventId,
            k,
            body,
          );
          assert.equal(outcome.clearedCount, 0);
          assert.deepEqual(outcome.event, empty.event);
          assert.deepEqual(
            await events.clearTasks(other, f.foreignEventId, k, body),
            outcome,
          );
          assert.equal(
            (
              await client.query(
                "SELECT count(*)::INT n FROM public.activity_entry WHERE event_id=$1",
                [f.foreignEventId],
              )
            ).rows[0].n,
            2,
          );
        },
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  },
);
