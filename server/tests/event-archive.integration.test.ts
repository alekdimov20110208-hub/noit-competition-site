import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createEventService } from "../src/events/service.ts";
import { EventCommandError } from "../src/events/model.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { createChangeService } from "../src/changes/service.ts";
import { createInvitationService } from "../src/invitations/service.ts";
import { createNotificationService } from "../src/notifications/service.ts";
import { createReminderWorker } from "../src/notifications/worker.ts";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "../src/invitations/model.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";
import type { TransactionPool } from "../src/db/transaction.ts";
const enabled = process.env.RUN_DATABASE_INTEGRATION === "1";
const user = (id: string) => ({
  id,
  name: "Synthetic Archive actor",
  email: "archive@example.invalid",
});
const denied = (code: string) => (e: unknown) =>
  e instanceof EventCommandError && e.code === code;
const taskFields = {
  title: "Retained task",
  deadline: "2026-10-04",
  category: "",
  context: "",
  priority: "normal",
  assignedMemberId: null,
};

test(
  "PostgreSQL Archive authorization, exact confirmation, atomicity, retention and read-only boundaries (rollback-only)",
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
        events = createEventService(db);
      const input = {
        expectedVersion: 1,
        confirmationName: "Disposable P1C fixture",
      };
      const change = randomUUID(),
        notification = randomUUID(),
        invite = randomUUID(),
        token = generateInvitationToken();
      await client.query(
        "UPDATE public.task SET assigned_member_id=$2,accepted_by_member_id=$2,accepted_at=clock_timestamp(),deadline_time='10:00' WHERE id=$1",
        [f.taskId, f.memberId],
      );
      await client.query(
        "INSERT INTO public.task_reminder(id,task_id,offset_minutes,due_at,trigger_at) VALUES($1,$2,15,'2026-10-04T07:00Z','2026-10-04T06:45Z')",
        [randomUUID(), f.taskId],
      );
      await client.query(
        "INSERT INTO public.event_change(id,event_id,title,created_by,decision_text,decision_author_member_id,decision_created_at,decision_updated_at,response_text,plan_b_text) VALUES($1,$2,'Retained Change',$3,'Decision',$3,clock_timestamp(),clock_timestamp(),'Response','Plan B')",
        [change, f.eventId, f.organizerId],
      );
      await client.query(
        "INSERT INTO public.change_task(event_id,change_id,task_id) VALUES($1,$2,$3)",
        [f.eventId, change, f.taskId],
      );
      await client.query(
        "INSERT INTO public.event_invitation(id,event_id,invited_email,inviter_user_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '1 day')",
        [
          invite,
          f.eventId,
          `${f.memberUser}@example.invalid`,
          actor.id,
          hashInvitationToken(token),
        ],
      );
      await client.query(
        "INSERT INTO public.notification(id,event_id,recipient_user_id,kind,task_id,actor_user_id,task_title,deadline,timezone,task_version) VALUES($1,$2,$3,'TASK_ASSIGNED',$4,$5,'Retained notification','2026-10-04','Europe/Sofia',1)",
        [notification, f.eventId, member.id, f.taskId, actor.id],
      );
      await client.query(
        "INSERT INTO public.activity_entry(id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload) VALUES($1,$2,$3,$4,'task.created','task',$5,'{}')",
        [randomUUID(), f.eventId, actor.id, f.organizerId, f.taskId],
      );
      const snapshot = async () => {
        const result: [string, unknown[]][] = [];
        for (const table of [
          "task",
          "event_member",
          "event_change",
          "change_task",
          "event_invitation",
          "task_reminder",
          "notification",
          "activity_entry",
        ]) {
          const where =
            table === "task_reminder"
              ? "r.task_id IN(SELECT id FROM public.task WHERE event_id=$1)"
              : "r.event_id=$1";
          result.push([
            table,
            (
              await client.query(
                `SELECT to_jsonb(r) AS data FROM public.${table} r WHERE ${where} ORDER BY to_jsonb(r)::TEXT`,
                [f.eventId],
              )
            ).rows,
          ]);
        }
        return result;
      };
      await t.test(
        "Member, foreign, revoked and inactive identities cannot archive; owner fields cannot forge authority",
        async () => {
          for (const id of [f.memberUser, f.foreignUser, f.inactiveUser])
            await assert.rejects(
              events.archive(user(id), f.eventId, randomUUID(), input),
              denied(id === f.memberUser ? "FORBIDDEN" : "NOT_FOUND"),
            );
          await assert.rejects(
            events.archive(actor, f.foreignEventId, randomUUID(), input),
            denied("NOT_FOUND"),
          );
          await assert.rejects(
            events.archive(actor, f.eventId, randomUUID(), {
              ...input,
              ownerUserId: actor.id,
            }),
            denied("INVALID_ARCHIVE_COMMAND"),
          );
        },
      );
      await t.test(
        "Exact case-sensitive untrimmed canonical name and reviewed version are server-enforced",
        async () => {
          for (const confirmationName of [
            input.confirmationName.toLowerCase(),
            " " + input.confirmationName,
            input.confirmationName + " ",
          ])
            await assert.rejects(
              events.archive(actor, f.eventId, randomUUID(), {
                ...input,
                confirmationName,
              }),
              denied("INVALID_ARCHIVE_COMMAND"),
            );
          await assert.rejects(
            events.archive(actor, f.eventId, randomUUID(), {
              ...input,
              expectedVersion: 2,
            }),
            denied("EVENT_VERSION_CONFLICT"),
          );
        },
      );
      await t.test(
        "Receipt and activity insertion faults roll back archive/version/history and permit same-key recovery",
        async () => {
          for (const target of [
            "public.activity_entry",
            "public.event_command_receipt",
          ]) {
            const key = randomUUID();
            const faultPool: TransactionPool = {
              connect: async () => {
                const c = await commandPool.connect();
                return {
                  ...c,
                  query: async (sql, values) => {
                    if (sql.includes("INSERT INTO " + target))
                      throw Error("injected archive fault");
                    return c.query(sql, values);
                  },
                };
              },
            };
            await assert.rejects(
              createEventService({ ...faultPool, query: db.query }).archive(
                actor,
                f.eventId,
                key,
                input,
              ),
              /injected archive fault/,
            );
            assert.deepEqual(
              (
                await client.query(
                  "SELECT archived_at,version FROM public.event WHERE id=$1",
                  [f.eventId],
                )
              ).rows[0],
              { archived_at: null, version: 1 },
            );
            assert.equal(
              (
                await client.query(
                  "SELECT count(*)::INT AS n FROM public.event_command_receipt WHERE command_id=$1",
                  [key],
                )
              ).rows[0].n,
              0,
            );
            assert.equal(
              (
                await client.query(
                  "SELECT count(*)::INT AS n FROM public.activity_entry WHERE event_id=$1 AND action_type='EVENT_ARCHIVED'",
                  [f.eventId],
                )
              ).rows[0].n,
              0,
            );
            await client.query("SAVEPOINT archive_recovery_probe");
            const recovered = await events.archive(
              actor,
              f.eventId,
              key,
              input,
            );
            assert.equal(recovered.archived, true);
            assert.equal(recovered.version, 2);
            assert.deepEqual(
              await events.archive(actor, f.eventId, key, input),
              recovered,
            );
            await client.query("ROLLBACK TO SAVEPOINT archive_recovery_probe");
            await client.query("RELEASE SAVEPOINT archive_recovery_probe");
          }
        },
      );
      const before = await snapshot(),
        key = randomUUID();
      // The actor is deliberately a non-owner Organizer; ownership is separate.
      await client.query(
        "UPDATE public.event_member SET access_role='ORGANIZER' WHERE id=$1",
        [f.memberId],
      );
      const original = await snapshot(),
        archived = await events.archive(member, f.eventId, key, input);
      await t.test(
        "Non-owner Organizer archives one Event; one version and activity, all existing data retained",
        async () => {
          assert.equal(archived.id, f.eventId);
          assert.equal(archived.version, 2);
          assert.equal(archived.archived, true);
          const after = await snapshot();
          for (let i = 0; i < original.length; i++) {
            if (original[i]![0] === "activity_entry")
              assert.equal(
                (after[i]![1] as unknown[]).length,
                (original[i]![1] as unknown[]).length + 1,
              );
            else assert.deepEqual(after[i], original[i]);
          }
          assert.equal(
            (
              await client.query(
                "SELECT owner_user_id FROM public.event WHERE id=$1",
                [f.eventId],
              )
            ).rows[0].owner_user_id,
            actor.id,
          );
          assert.equal((before[0]![1] as unknown[]).length, 1);
        },
      );
      await t.test(
        "Lost-response same-key replay, changed input/key scope conflict and current-version no-op never duplicate history",
        async () => {
          assert.deepEqual(
            await createEventService(db).archive(member, f.eventId, key, input),
            archived,
          );
          await assert.rejects(
            events.archive(member, f.eventId, key, {
              ...input,
              expectedVersion: 2,
            }),
            denied("IDEMPOTENCY_KEY_REUSED"),
          );
          await assert.rejects(
            events.archive(member, f.eventId, randomUUID(), input),
            denied("EVENT_VERSION_CONFLICT"),
          );
          assert.deepEqual(
            await events.archive(member, f.eventId, randomUUID(), {
              ...input,
              expectedVersion: 2,
            }),
            archived,
          );
          assert.equal(
            (
              await client.query(
                "SELECT count(*)::INT AS n FROM public.activity_entry WHERE event_id=$1 AND action_type='EVENT_ARCHIVED'",
                [f.eventId],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "Replay rechecks role, membership and identity before disclosing accepted receipts",
        async () => {
          await client.query(
            "UPDATE public.event_member SET access_role='MEMBER' WHERE id=$1",
            [f.memberId],
          );
          await assert.rejects(
            events.archive(member, f.eventId, key, input),
            denied("FORBIDDEN"),
          );
          await client.query(
            "UPDATE public.event_member SET access_role='ORGANIZER',active=FALSE,deactivated_at=clock_timestamp() WHERE id=$1",
            [f.memberId],
          );
          await assert.rejects(
            events.archive(member, f.eventId, key, input),
            denied("NOT_FOUND"),
          );
          await client.query(
            "UPDATE public.event_member SET active=TRUE,deactivated_at=NULL WHERE id=$1",
            [f.memberId],
          );
          await client.query(
            'UPDATE public."user" SET active=FALSE WHERE id=$1',
            [member.id],
          );
          await assert.rejects(
            events.archive(member, f.eventId, key, input),
            denied("NOT_FOUND"),
          );
          await client.query(
            'UPDATE public."user" SET active=TRUE WHERE id=$1',
            [member.id],
          );
        },
      );
      await t.test(
        "All implemented operational writes fail; historical reads and personal notification read state remain permitted",
        async () => {
          const tasks = createTaskService(db),
            changes = createChangeService(db),
            invitations = createInvitationService(db, async () => {
              throw Error("Archived invitation must never register an account");
            });
          const blocked = (e: unknown) =>
            typeof e === "object" &&
            e !== null &&
            "code" in e &&
            ["EVENT_ARCHIVED", "INVITATION_UNAVAILABLE"].includes(
              String(e.code),
            );
          const writes = [
            () =>
              events.update(actor, f.eventId, {
                name: input.confirmationName,
                startDate: "2026-10-03",
                endDate: "2026-10-04",
                timezone: "Europe/Sofia",
                expectedVersion: 2,
              }),
            () => tasks.create(actor, f.eventId, taskFields),
            () =>
              tasks.updateDetails(actor, f.eventId, f.taskId, {
                title: "Denied",
                expectedVersion: 1,
              }),
            ...(
              [
                [
                  "assignment",
                  { assignedMemberId: f.memberId, expectedVersion: 1 },
                ],
                ["status", { status: "completed", expectedVersion: 1 }],
                ["acceptance", { accepted: true, expectedVersion: 1 }],
              ] as const
            ).map(
              ([kind, body]) =>
                () =>
                  tasks.mutate(member, f.eventId, f.taskId, kind, body),
            ),
            () => changes.create(actor, f.eventId, { title: "Denied" }),
            () =>
              changes.update(actor, f.eventId, change, {
                title: "Denied",
                expectedVersion: 1,
              }),
            () =>
              invitations.create(actor, f.eventId, {
                email: "new@example.invalid",
              }),
            () => invitations.resend(actor, f.eventId, invite),
            () => invitations.revoke(actor, f.eventId, invite, {}),
            () => invitations.accept(member, token, {}),
            () =>
              invitations.register(token, {
                name: "Synthetic Stage 6",
                password: "synthetic-test-only-password",
              }),
          ];
          for (const write of writes) await assert.rejects(write(), blocked);
          assert.equal((await tasks.read(actor, f.eventId)).length, 1);
          assert.equal((await changes.read(member, f.eventId)).length, 1);
          assert.ok(
            (await events.history(member, f.eventId)).entries.some(
              (e) => e.action === "EVENT_ARCHIVED",
            ),
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
          const copy = await events.duplicate(actor, f.eventId, randomUUID(), {
            name: "Archive copy",
            startDate: "2026-11-01",
            endDate: "2026-11-02",
            timezone: "UTC",
            expectedVersion: 2,
          });
          assert.equal(copy.archived, false);
          assert.notEqual(copy.id, f.eventId);
        },
      );
      await t.test(
        "Terminal active version fails safely and command types cannot share an actor/key",
        async () => {
          await client.query(
            "UPDATE public.event SET version=2147483647 WHERE id=$1",
            [f.foreignEventId],
          );
          await assert.rejects(
            events.archive(
              user(f.foreignUser),
              f.foreignEventId,
              randomUUID(),
              { ...input, expectedVersion: 2147483647 },
            ),
            denied("VERSION_LIMIT_REACHED"),
          );
          await assert.rejects(
            events.duplicate(member, f.eventId, key, {
              name: "Conflict",
              startDate: "2026-11-01",
              endDate: "2026-11-02",
              timezone: "UTC",
              expectedVersion: 2,
            }),
            denied("IDEMPOTENCY_KEY_REUSED"),
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

test(
  "PostgreSQL independent archive connections coalesce, survive new service instances and stale worker snapshots (retained synthetic fixture)",
  { skip: !enabled, timeout: 90000 },
  async () => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {}),
      client = await pool.connect();
    try {
      await client.query("BEGIN");
      const f = await createPostgresFixture(client);
      await client.query("COMMIT");
      const actor = user(f.organizerUser),
        input = {
          expectedVersion: 1,
          confirmationName: "Disposable P1C fixture",
        },
        key = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          createEventService(pool).archive(actor, f.eventId, key, input),
        ),
      );
      for (const result of results) assert.deepEqual(result, results[0]);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::INT AS n FROM public.activity_entry WHERE event_id=$1 AND action_type='EVENT_ARCHIVED'",
            [f.eventId],
          )
        ).rows[0].n,
        1,
      );
      assert.deepEqual(
        await createEventService(pool).archive(actor, f.eventId, key, input),
        results[0],
      );
      const worker = createReminderWorker(
        pool,
        () => new Date("2040-10-04T09:50Z"),
      );
      assert.equal(await worker.run(), 0);
    } finally {
      client.release();
      await pool.end();
    }
  },
);
