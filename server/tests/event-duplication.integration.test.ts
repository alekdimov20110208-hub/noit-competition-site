import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createEventService } from "../src/events/service.ts";
import { EventCommandError } from "../src/events/model.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";

const enabled = process.env.RUN_DATABASE_INTEGRATION === "1";
const input = {
  name: "Reviewed independent Event",
  startDate: "2026-11-01",
  endDate: "2026-11-02",
  timezone: "UTC",
  expectedVersion: 1,
};
const user = (id: string) => ({
  id,
  name: "Synthetic duplicator",
  email: "duplicator@example.invalid",
});
const denied = (status: number, code?: string) => (e: unknown) =>
  e instanceof EventCommandError &&
  e.statusCode === status &&
  (!code || e.code === code);

test(
  "PostgreSQL metadata-only duplication, complete source preservation and access boundaries (rollback-only)",
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
      const change = randomUUID();
      await client.query(
        "UPDATE public.task SET assigned_member_id=$2,accepted_by_member_id=$2,accepted_at=clock_timestamp(),deadline_time='10:00' WHERE id=$1",
        [f.taskId, f.memberId],
      );
      await client.query(
        "INSERT INTO public.task_reminder(id,task_id,offset_minutes,due_at,trigger_at) VALUES($1,$2,15,clock_timestamp(),clock_timestamp())",
        [randomUUID(), f.taskId],
      );
      await client.query(
        "INSERT INTO public.event_invitation(id,event_id,invited_email,inviter_user_id,token_hash,expires_at) VALUES($1,$2,'synthetic@example.invalid',$3,$4,clock_timestamp()+interval '1 day')",
        [randomUUID(), f.eventId, actor.id, "a".repeat(64)],
      );
      await client.query(
        "INSERT INTO public.event_change(id,event_id,title,created_by,decision_text,decision_author_member_id,decision_created_at,decision_updated_at,response_text,plan_b_text) VALUES($1,$2,'Retained source Change',$3,'Decision',$3,clock_timestamp(),clock_timestamp(),'Response','Plan B')",
        [change, f.eventId, f.organizerId],
      );
      await client.query(
        "INSERT INTO public.change_task(event_id,change_id,task_id) VALUES($1,$2,$3)",
        [f.eventId, change, f.taskId],
      );
      await client.query(
        "INSERT INTO public.activity_entry(id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload) VALUES($1,$2,$3,$4,'TASK_CREATED','task',$5,'{}')",
        [randomUUID(), f.eventId, actor.id, f.organizerId, f.taskId],
      );
      await client.query(
        "INSERT INTO public.notification(id,event_id,recipient_user_id,kind,task_id,actor_user_id,task_title,deadline,timezone,task_version) VALUES($1,$2,$3,'TASK_ASSIGNED',$4,$5,'Retained notification','2026-10-04','Europe/Sofia',1)",
        [randomUUID(), f.eventId, member.id, f.taskId, actor.id],
      );
      const commandPool = rollbackCommandPool(client),
        service = createEventService({
          ...commandPool,
          query: client.query.bind(client),
        });
      const sourceSnapshot = async () => {
        const snapshots: unknown[] = [];
        for (const table of [
          "event",
          "event_member",
          "task",
          "event_invitation",
          "event_change",
          "change_task",
          "activity_entry",
          "notification",
          "task_reminder",
        ]) {
          const where =
            table === "event"
              ? "r.id=$1"
              : table === "task_reminder"
                ? "r.task_id IN(SELECT id FROM public.task WHERE event_id=$1)"
                : "r.event_id=$1";
          snapshots.push([
            table,
            (
              await client.query(
                `SELECT to_jsonb(r) AS data FROM public.${table} r WHERE ${where} ORDER BY to_jsonb(r)::TEXT`,
                [f.eventId],
              )
            ).rows,
          ]);
        }
        return snapshots;
      };
      const before = await sourceSnapshot(),
        key = randomUUID();
      const created = await service.duplicate(actor, f.eventId, key, input);
      await t.test(
        "Only reviewed four basics, fresh active identity/version/timestamps and requesting Organizer ownership are created",
        async () => {
          assert.notEqual(created.id, f.eventId);
          assert.notEqual(created.membership.id, f.organizerId);
          assert.deepEqual(
            {
              name: created.name,
              startDate: created.startDate,
              endDate: created.endDate,
              timezone: created.timezone,
            },
            {
              name: input.name,
              startDate: input.startDate,
              endDate: input.endDate,
              timezone: input.timezone,
            },
          );
          const row = (
            await client.query(
              "SELECT owner_user_id,version,archived_at FROM public.event WHERE id=$1",
              [created.id],
            )
          ).rows[0];
          assert.deepEqual(row, {
            owner_user_id: actor.id,
            version: 1,
            archived_at: null,
          });
          const members = (
            await client.query(
              "SELECT id,user_id,access_role,operational_role,active,deactivated_at FROM public.event_member WHERE event_id=$1",
              [created.id],
            )
          ).rows;
          assert.deepEqual(members, [
            {
              id: created.membership.id,
              user_id: actor.id,
              access_role: "ORGANIZER",
              operational_role: "",
              active: true,
              deactivated_at: null,
            },
          ]);
          const activity = (
            await client.query(
              "SELECT action_type,actor_user_id,actor_member_id,payload FROM public.activity_entry WHERE event_id=$1",
              [created.id],
            )
          ).rows;
          assert.equal(activity.length, 1);
          assert.equal(activity[0].action_type, "EVENT_CREATED");
          assert.equal(activity[0].actor_user_id, actor.id);
          assert.equal(activity[0].actor_member_id, created.membership.id);
          assert.deepEqual(activity[0].payload, {
            name: input.name,
            startDate: input.startDate,
            endDate: input.endDate,
            timezone: input.timezone,
            version: 1,
            duplication: {
              sourceEventId: f.eventId,
              sourceVersion: 1,
              operationId: key,
            },
          });
        },
      );
      await t.test(
        "No operational relationships copied; all seeded source metadata, roster, Tasks, Changes, text, notifications, reminders and history unchanged",
        async () => {
          for (const table of [
            "task",
            "event_invitation",
            "event_change",
            "change_task",
            "notification",
          ])
            assert.equal(
              (
                await client.query(
                  `SELECT count(*)::INT AS n FROM public.${table} WHERE event_id=$1`,
                  [created.id],
                )
              ).rows[0].n,
              0,
              table,
            );
          assert.equal(
            (
              await client.query(
                "SELECT count(*)::INT AS n FROM public.task_reminder r JOIN public.task t ON t.id=r.task_id WHERE t.event_id=$1",
                [created.id],
              )
            ).rows[0].n,
            0,
          );
          assert.deepEqual(await sourceSnapshot(), before);
          assert.deepEqual(
            await service.duplicate(actor, f.eventId, key, input),
            created,
          );
          assert.deepEqual(await sourceSnapshot(), before);
        },
      );
      await t.test(
        "Member, foreign, revoked and inactive authority, invalid IDs and forged relationship/lifecycle fields fail",
        async () => {
          for (const [identity, source, status] of [
            [member, f.eventId, 403],
            [user(f.foreignUser), f.eventId, 404],
            [user(f.inactiveUser), f.eventId, 404],
            [actor, f.foreignEventId, 404],
          ] as const)
            await assert.rejects(
              service.duplicate(identity, source, key, input),
              denied(status),
            );
          await assert.rejects(
            service.duplicate(actor, "bad", key, input),
            denied(400, "INVALID_ID"),
          );
          for (const field of [
            "ownerUserId",
            "actorUserId",
            "accessRole",
            "members",
            "tasks",
            "invitations",
            "archived",
            "version",
            "sourceEventId",
          ])
            await assert.rejects(
              service.duplicate(actor, f.eventId, randomUUID(), {
                ...input,
                [field]: "forged",
              }),
              denied(400),
            );
          assert.deepEqual(await sourceSnapshot(), before);
        },
      );
      await t.test(
        "Authorized different scope/same-key conflicts; requesting non-owner Organizer owns duplicate; archived source remains archived and unchanged",
        async () => {
          await client.query(
            "UPDATE public.event_member SET access_role='ORGANIZER' WHERE id=$1",
            [f.memberId],
          );
          const other = await service.duplicate(member, f.eventId, key, input);
          assert.notEqual(other.id, created.id); // Same UUID belongs to a different authenticated actor.
          assert.equal(
            (
              await client.query(
                "SELECT owner_user_id FROM public.event WHERE id=$1",
                [other.id],
              )
            ).rows[0].owner_user_id,
            member.id,
          );
          await assert.rejects(
            service.duplicate(actor, created.id, key, input),
            denied(409, "IDEMPOTENCY_KEY_REUSED"),
          );
          await client.query(
            "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
            [f.eventId],
          );
          const archivedBefore = await sourceSnapshot();
          const archivedCopy = await service.duplicate(
            actor,
            f.eventId,
            randomUUID(),
            input,
          );
          assert.equal(archivedCopy.archived, false);
          assert.deepEqual(await sourceSnapshot(), archivedBefore);
        },
      );
      await t.test(
        "Terminal source INTEGER version remains duplicable without incrementing or mutating it",
        async () => {
          await client.query(
            "UPDATE public.event SET version=2147483647 WHERE id=$1",
            [created.id],
          );
          const beforeTerminal = (
            await client.query(
              "SELECT to_jsonb(e) AS data FROM public.event e WHERE id=$1",
              [created.id],
            )
          ).rows;
          const terminalCopy = await service.duplicate(
            actor,
            created.id,
            randomUUID(),
            { ...input, expectedVersion: 2147483647 },
          );
          assert.equal(terminalCopy.version, 1);
          assert.deepEqual(
            (
              await client.query(
                "SELECT to_jsonb(e) AS data FROM public.event e WHERE id=$1",
                [created.id],
              )
            ).rows,
            beforeTerminal,
          );
        },
      );
      await t.test(
        "Receipt failure rolls back Event, membership, activity and receipt, then same key safely retries",
        async () => {
          const faultKey = randomUUID();
          const counts = async () =>
            (
              await client.query(
                "SELECT (SELECT count(*) FROM public.event) AS events,(SELECT count(*) FROM public.event_member) AS members,(SELECT count(*) FROM public.activity_entry) AS history,(SELECT count(*) FROM public.event_command_receipt) AS receipts",
              )
            ).rows[0];
          const countsBefore = await counts();
          const faultPool = {
            async connect() {
              const c = await commandPool.connect();
              return {
                ...c,
                query: async (sql: string, values?: unknown[]) => {
                  if (sql.includes("INSERT INTO public.event_command_receipt"))
                    throw new Error("injected receipt fault");
                  return c.query(sql, values);
                },
              };
            },
          };
          const faulty = createEventService({
            ...faultPool,
            query: client.query.bind(client),
          });
          await assert.rejects(
            faulty.duplicate(actor, f.eventId, faultKey, input),
            /injected receipt fault/,
          );
          assert.deepEqual(await counts(), countsBefore);
          const recovered = await service.duplicate(
            actor,
            f.eventId,
            faultKey,
            input,
          );
          assert.deepEqual(
            await service.duplicate(actor, f.eventId, faultKey, input),
            recovered,
          );
        },
      );
      await t.test(
        "Receipt table denies mutation and direct browser policies; revoked destination/source blocks accepted replay",
        async () => {
          const relation = (
            await client.query(
              "SELECT relrowsecurity FROM pg_class WHERE oid='public.event_command_receipt'::REGCLASS",
            )
          ).rows[0];
          assert.equal(relation.relrowsecurity, true);
          assert.equal(
            (
              await client.query(
                "SELECT count(*)::INT AS n FROM pg_policies WHERE schemaname='public' AND tablename='event_command_receipt'",
              )
            ).rows[0].n,
            0,
          );
          for (const sql of [
            "UPDATE public.event_command_receipt SET request_digest=request_digest WHERE actor_user_id=$1",
          ]) {
            await client.query("SAVEPOINT receipt_guard");
            let code;
            try {
              await client.query(sql, [actor.id]);
            } catch (e) {
              code = (e as { code?: string }).code;
            }
            await client.query("ROLLBACK TO SAVEPOINT receipt_guard");
            await client.query("RELEASE SAVEPOINT receipt_guard");
            assert.equal(code, "55000");
          }
          const guard = (
            await client.query(
              "SELECT tgenabled,tgtype FROM pg_trigger WHERE tgrelid='public.event_command_receipt'::REGCLASS AND tgname='event_command_receipt_immutable'",
            )
          ).rows[0];
          assert.equal(guard.tgenabled, "O");
          for (const bit of [2, 8, 16, 32])
            assert.equal(guard.tgtype & bit, bit); // BEFORE, DELETE, UPDATE, TRUNCATE; inspected without destructive statements.
          await client.query(
            "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE id=$1",
            [created.membership.id],
          );
          await assert.rejects(
            service.duplicate(actor, f.eventId, key, input),
            denied(404),
          );
          await client.query(
            "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE id=$1",
            [f.organizerId],
          );
          await assert.rejects(
            service.duplicate(actor, f.eventId, key, input),
            denied(404),
          );
        },
      );
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
      await pool.end();
    }
  },
);

test(
  "PostgreSQL Duplicate uses independent backend instances/connections; source edit serializes and identity revocation wins safely (retained synthetic fixture)",
  { skip: !enabled, timeout: 180000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    try {
      const setup = await pool.connect();
      let f;
      try {
        await setup.query("BEGIN");
        f = await createPostgresFixture(setup);
        await setup.query("COMMIT");
      } catch (e) {
        await setup.query("ROLLBACK");
        throw e;
      } finally {
        setup.release();
      }
      const actor = user(f.organizerUser),
        a = createEventService(pool),
        b = createEventService(pool),
        key = randomUUID();
      await t.test(
        "Independent service instances return one Event and one activity/receipt for concurrent accepted requests",
        async () => {
          const results = await Promise.all([
            a.duplicate(actor, f.eventId, key, input),
            b.duplicate(actor, f.eventId, key, input),
          ]);
          assert.deepEqual(results[0], results[1]);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT AS n FROM public.event_command_receipt WHERE actor_user_id=$1 AND command_id=$2",
                [actor.id, key],
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT AS n FROM public.activity_entry WHERE event_id=$1",
                [results[0].id],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "Source edit lock rejects stale fresh duplicate without partial destination, accepted replay remains stable",
        async () => {
          const held = await pool.connect();
          const staleKey = randomUUID();
          try {
            await held.query("BEGIN");
            await held.query(
              "UPDATE public.event SET name='Synthetic edited source',version=2 WHERE id=$1",
              [f.eventId],
            );
            const pending = b.duplicate(actor, f.eventId, staleKey, input);
            await held.query("COMMIT");
            await assert.rejects(
              pending,
              denied(409, "EVENT_VERSION_CONFLICT"),
            );
          } finally {
            await held.query("ROLLBACK").catch(() => {});
            held.release();
          }
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT AS n FROM public.event_command_receipt WHERE actor_user_id=$1 AND command_id=$2",
                [actor.id, staleKey],
              )
            ).rows[0].n,
            0,
          );
          const retry = await a.duplicate(actor, f.eventId, staleKey, {
            ...input,
            expectedVersion: 2,
          });
          assert.equal(retry.version, 1);
          assert.equal(
            (await a.duplicate(actor, f.eventId, key, input)).version,
            1,
          );
        },
      );
      await t.test(
        "Identity deactivation while authorization waits prevents effects and receipt",
        async () => {
          const held = await pool.connect(),
            revokedKey = randomUUID();
          try {
            await held.query("BEGIN");
            await held.query(
              'UPDATE public."user" SET active=FALSE WHERE id=$1',
              [actor.id],
            );
            const pending = b.duplicate(actor, f.eventId, revokedKey, {
              ...input,
              expectedVersion: 2,
            });
            await held.query("COMMIT");
            await assert.rejects(pending, denied(404));
          } finally {
            await held.query("ROLLBACK").catch(() => {});
            held.release();
          }
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT AS n FROM public.event_command_receipt WHERE actor_user_id=$1 AND command_id=$2",
                [actor.id, revokedKey],
              )
            ).rows[0].n,
            0,
          );
          await assert.rejects(
            a.duplicate(actor, f.eventId, key, input),
            denied(404),
          );
        },
      );
    } finally {
      await pool.end();
    }
  },
);
