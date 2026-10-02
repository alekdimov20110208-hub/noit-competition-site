import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createTaskService } from "../src/tasks/service.ts";
import { TaskCommandError } from "../src/tasks/model.ts";
import { bootstrapDevelopmentEvent } from "../src/development/bootstrap.ts";
import {
  rollbackCommandPool,
  createPostgresFixture,
} from "./postgres-fixture.ts";

const enabled = process.env.RUN_DATABASE_INTEGRATION === "1";
const denied = (status: number) => (error: unknown) =>
  error instanceof TaskCommandError && error.statusCode === status;

test(
  "real PostgreSQL responsibility commands (rollback-only fixtures)",
  { skip: !enabled, timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    let client: PoolClient | undefined;
    let open = false,
      destroy = false;
    try {
      client = await pool.connect();
      client.on("error", () => {
        destroy = true;
      });
      const database = client;
      await database.query("BEGIN");
      open = true;
      await database.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
      await database.query("SET LOCAL DateStyle = 'SQL, DMY'");
      const f = await createPostgresFixture(database);
      const commandPool = rollbackCommandPool(database);
      const service = createTaskService(commandPool);
      const organizer = {
        id: f.organizerUser,
        name: "Fixture organizer",
        email: "organizer@example.invalid",
      };
      const member = {
        id: f.memberUser,
        name: "Fixture member",
        email: "member@example.invalid",
      };
      const foreign = {
        id: f.foreignUser,
        name: "Fixture foreign",
        email: "foreign@example.invalid",
      };
      let version = 1;
      const change = async (
        user: typeof organizer,
        kind: "assignment" | "acceptance" | "status",
        fields: object,
      ) => {
        const task = await service.mutate(user, f.eventId, f.taskId, kind, {
          ...fields,
          expectedVersion: version,
        });
        version = task.version;
        return task;
      };
      const stored = async () =>
        (
          await database.query(
            "SELECT version, assigned_member_id, accepted_by_member_id, accepted_at, status, updated_by FROM public.task WHERE event_id = $1 AND id = $2",
            [f.eventId, f.taskId],
          )
        ).rows[0];
      const activities = async () =>
        (
          await database.query(
            "SELECT action_type, actor_user_id, actor_member_id, payload, created_at FROM public.activity_entry WHERE event_id = $1 AND target_id = $2 ORDER BY (payload->>'taskVersion')::INTEGER",
            [f.eventId, f.taskId],
          )
        ).rows;

      await t.test(
        "assignment, acceptance, independent status and server actors persist",
        async () => {
          const assigned = await change(organizer, "assignment", {
            assignedMemberId: f.memberId,
          });
          assert.equal(assigned.version, 2);
          assert.equal((await stored()).assigned_member_id, f.memberId);
          const [seen] = await service.read(member, f.eventId, f.taskId);
          assert.equal(seen?.assignedMemberId, f.memberId);
          assert.equal(seen?.deadline, "2026-10-04");
          await assert.rejects(
            change(organizer, "acceptance", { accepted: true }),
            denied(403),
          );
          const accepted = await change(member, "acceptance", {
            accepted: true,
          });
          assert.equal(accepted.acceptedByMemberId, f.memberId);
          assert.ok(accepted.acceptedAt);
          const updated = await change(member, "status", {
            status: "in-progress",
          });
          assert.equal(updated.acceptedAt, accepted.acceptedAt);
          assert.equal((await stored()).updated_by, f.memberId);
          const entries = await activities();
          assert.deepEqual(
            entries.map((row) => row.action_type),
            ["task.assigned", "task.accepted", "task.status_changed"],
          );
          assert.equal(entries[1]?.actor_user_id, member.id);
          assert.equal(entries[1]?.actor_member_id, f.memberId);
          assert.equal(entries[1]?.payload.acceptedAt, accepted.acceptedAt);
          assert.ok(entries[1]?.created_at instanceof Date);
        },
      );
      await t.test(
        "stale commands including retries cannot bypass version checking",
        async () => {
          const count = (await activities()).length;
          for (const [kind, body] of [
            ["assignment", { assignedMemberId: f.memberId }],
            ["acceptance", { accepted: true }],
            ["status", { status: "in-progress" }],
          ] as const) {
            await assert.rejects(
              service.mutate(
                kind === "acceptance" ? member : organizer,
                f.eventId,
                f.taskId,
                kind,
                { ...body, expectedVersion: 1 },
              ),
              denied(409),
            );
          }
          assert.equal((await stored()).version, version);
          assert.equal((await activities()).length, count);
        },
      );
      await t.test(
        "withdrawal and organizer impersonation denial; explicit reacceptance",
        async () => {
          await assert.rejects(
            change(organizer, "acceptance", { accepted: false }),
            denied(403),
          );
          const withdrawn = await change(member, "acceptance", {
            accepted: false,
          });
          assert.equal(withdrawn.acceptedAt, null);
          assert.equal((await stored()).accepted_by_member_id, null);
          assert.equal(
            (await activities()).at(-1)?.action_type,
            "task.acceptance_withdrawn",
          );
          await change(member, "acceptance", { accepted: true });
        },
      );
      await t.test(
        "reassign/unassign clear acceptance and preserve immutable acceptance history",
        async () => {
          await change(organizer, "assignment", {
            assignedMemberId: f.organizerId,
          });
          const row = await stored();
          assert.equal(row.assigned_member_id, f.organizerId);
          assert.equal(row.accepted_by_member_id, null);
          assert.equal(row.accepted_at, null);
          const activity = (await activities()).at(-1);
          assert.equal(activity?.payload.acceptanceCleared, true);
          assert.equal(
            activity?.payload.previousAcceptedByMemberId,
            f.memberId,
          );
          await assert.rejects(
            change(member, "status", { status: "completed" }),
            denied(403),
          );
          await change(organizer, "acceptance", { accepted: true });
          await change(organizer, "assignment", { assignedMemberId: null });
          assert.equal((await stored()).assigned_member_id, null);
          assert.equal((await stored()).accepted_at, null);
          await change(organizer, "assignment", {
            assignedMemberId: f.memberId,
          });
          assert.equal((await stored()).accepted_by_member_id, null);
          assert.ok(
            (await activities()).filter(
              (entry) => entry.action_type === "task.accepted",
            ).length >= 3,
          );
        },
      );
      await t.test(
        "foreign Event/task/member and inactive User/member are denied",
        async () => {
          for (const actor of [organizer, member]) {
            await assert.rejects(
              service.read(actor, f.foreignEventId, f.foreignTaskId),
              denied(404),
            );
            await assert.rejects(
              service.read(actor, f.eventId, f.foreignTaskId),
              denied(404),
            );
            await assert.rejects(
              service.mutate(
                actor,
                f.foreignEventId,
                f.foreignTaskId,
                "status",
                { status: "blocked", expectedVersion: 1 },
              ),
              denied(404),
            );
          }
          await assert.rejects(
            service.mutate(organizer, f.eventId, f.foreignTaskId, "status", {
              status: "blocked",
              expectedVersion: 1,
            }),
            denied(404),
          );
          for (const id of [
            f.foreignMemberId,
            f.inactiveId,
            f.inactiveUserMemberId,
          ])
            await assert.rejects(
              change(organizer, "assignment", { assignedMemberId: id }),
              denied(404),
            );
          await assert.rejects(service.read(foreign, f.eventId), denied(404));
          await assert.rejects(
            service.read({ ...member, id: f.inactiveUser }, f.eventId),
            denied(404),
          );
          await assert.rejects(
            change(member, "assignment", { assignedMemberId: f.organizerId }),
            denied(403),
          );
        },
      );
      await t.test(
        "actual mutation/activity constraint failures roll back task and history together",
        async () => {
          for (const failAt of [
            "UPDATE public.task",
            "INSERT INTO public.activity_entry",
          ]) {
            const before = await stored(),
              count = (await activities()).length;
            const failing = createTaskService({
              async connect() {
                const connection = await commandPool.connect();
                return {
                  ...connection,
                  async query(sql, values) {
                    if (sql.startsWith(failAt))
                      return connection.query(
                        "UPDATE public.task SET status = 'INVALID_FIXTURE_STATUS' WHERE event_id=$1 AND id=$2",
                        [f.eventId, f.taskId],
                      );
                    return connection.query(sql, values);
                  },
                };
              },
            });
            await assert.rejects(
              failing.mutate(member, f.eventId, f.taskId, "status", {
                status: "blocked",
                expectedVersion: version,
              }),
            );
            assert.deepEqual(await stored(), before);
            assert.equal((await activities()).length, count);
          }
        },
      );
      await t.test(
        "soft-deleted tasks disappear from list/read/mutation; archived writes denied",
        async () => {
          await database.query("SAVEPOINT p1c_visibility");
          try {
            await database.query(
              "UPDATE public.task SET deleted_at=clock_timestamp(), deleted_by=$3 WHERE event_id=$1 AND id=$2",
              [f.eventId, f.taskId, f.organizerId],
            );
            assert.deepEqual(await service.read(member, f.eventId), []);
            await assert.rejects(
              service.read(organizer, f.eventId, f.taskId),
              denied(404),
            );
            await assert.rejects(
              change(organizer, "status", { status: "blocked" }),
              denied(404),
            );
          } finally {
            await database.query("ROLLBACK TO SAVEPOINT p1c_visibility");
          }
          await database.query(
            "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
            [f.eventId],
          );
          await assert.rejects(
            change(organizer, "status", { status: "blocked" }),
            denied(403),
          );
          await database.query(
            "UPDATE public.event SET archived_at=NULL WHERE id=$1",
            [f.eventId],
          );
        },
      );
      await t.test(
        "explicit bootstrap is repeatable, owner is active organizer, and never resets task state",
        async () => {
          const setup = {
            nodeEnv: "development" as const,
            organizerEmail: `${f.organizerUser}@example.invalid`,
            memberEmail: `${f.memberUser}@example.invalid`,
          };
          const first = await bootstrapDevelopmentEvent(commandPool, setup);
          assert.ok(
            first.results.every((result) => result.result === "created"),
          );
          const second = await bootstrapDevelopmentEvent(commandPool, setup);
          assert.ok(
            second.results.every(
              (result) => result.result === "already-exists",
            ),
          );
          assert.equal(second.eventId, first.eventId);
          assert.equal(second.taskId, first.taskId);
          const task = await service.mutate(
            organizer,
            first.eventId,
            first.taskId,
            "assignment",
            { assignedMemberId: first.memberId, expectedVersion: 1 },
          );
          await bootstrapDevelopmentEvent(commandPool, setup);
          assert.equal(
            (await service.read(organizer, first.eventId, first.taskId))[0]
              ?.version,
            task.version,
          );
        },
      );
      await database.query("ROLLBACK");
      open = false;
      await t.test(
        "no synthetic users, events, tasks or activity remain after rollback",
        async () => {
          for (const [sql, values] of [
            [
              'SELECT COUNT(*)::INT AS count FROM public."user" WHERE id LIKE $1',
              [`${f.prefix}%`],
            ],
            [
              "SELECT COUNT(*)::INT AS count FROM public.event WHERE owner_user_id LIKE $1",
              [`${f.prefix}%`],
            ],
            [
              "SELECT COUNT(*)::INT AS count FROM public.task WHERE id=ANY($1::UUID[])",
              [[f.taskId, f.foreignTaskId]],
            ],
            [
              "SELECT COUNT(*)::INT AS count FROM public.activity_entry WHERE actor_user_id LIKE $1",
              [`${f.prefix}%`],
            ],
          ] as const)
            assert.equal(
              (await database.query(sql, [...values])).rows[0]?.count,
              0,
            );
        },
      );
    } catch {
      // pg details and assertion row dumps can contain identity/connection data.
      throw new Error(
        "PostgreSQL responsibility integration failed; details omitted. See subtest result.",
      );
    } finally {
      if (client) {
        try {
          if (open) await client.query("ROLLBACK");
        } catch {
          destroy = true;
        }
        client.release(destroy);
      }
      await pool.end();
    }
  },
);
