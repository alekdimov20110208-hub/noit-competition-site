import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createChangeService } from "../src/changes/service.ts";
import { ChangeCommandError } from "../src/changes/model.ts";
import { createTaskService } from "../src/tasks/service.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";

test(
  "PostgreSQL P3B authored response, authority, independence and atomic history (rollback-only)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const f = await createPostgresFixture(db),
        boundary = rollbackCommandPool(db);
      const changes = createChangeService(boundary),
        tasks = createTaskService(boundary);
      const organizer = {
        id: f.organizerUser,
        name: "Fixture",
        email: "fixture@example.invalid",
      };
      const member = { ...organizer, id: f.memberUser },
        foreign = { ...organizer, id: f.foreignUser };
      const denied = (status: number) => (e: unknown) =>
        e instanceof ChangeCommandError && e.statusCode === status;
      const history = async (id: string) =>
        (
          await db.query(
            "SELECT * FROM public.activity_entry WHERE event_id=$1 AND target_id=$2 ORDER BY created_at,id",
            [f.eventId, id],
          )
        ).rows;
      const read = async (id: string) =>
        (await changes.read(organizer, f.eventId, id))[0]!;
      const legacyId = randomUUID();
      await db.query(
        "INSERT INTO public.event_change (id,event_id,title,created_by,response_owner_member_id) VALUES ($1,$2,'Existing P3A',$3,$4)",
        [legacyId, f.eventId, f.organizerId, f.memberId],
      );
      await db.query("INSERT INTO public.change_task VALUES ($1,$2,$3)", [
        f.eventId,
        legacyId,
        f.taskId,
      ]);
      let change = await read(legacyId);
      await t.test(
        "P3A row remains readable with empty response state, existing owner and Task links",
        async () => {
          assert.equal(change.decision, null);
          assert.equal(change.response, null);
          assert.equal(change.planB, null);
          assert.equal(change.responseOwner!.id, f.memberId);
          assert.equal(change.affectedTasks[0]!.id, f.taskId);
          assert.equal(change.version, 1);
          const partial = await changes.create(organizer, f.eventId, {
            title: "Response only",
            response: "Driver contacted",
          });
          assert.equal(partial.decision, null);
          assert.equal(partial.response, "Driver contacted");
          assert.equal(partial.planB, null);
        },
      );
      await t.test(
        "response-owner MEMBER reads but cannot author any field; inactive and foreign scope denied",
        async () => {
          for (const field of ["decision", "response", "planB"])
            await assert.rejects(
              changes.update(member, f.eventId, change.id, {
                expectedVersion: change.version,
                [field]: "Denied",
              }),
              denied(403),
            );
          assert.deepEqual(
            (await changes.read(member, f.eventId, change.id))[0],
            change,
          );
          for (const user of [foreign, { ...organizer, id: f.inactiveUser }]) {
            await assert.rejects(
              changes.read(user, f.eventId, change.id),
              denied(404),
            );
            await assert.rejects(
              changes.update(user, f.eventId, change.id, {
                expectedVersion: 1,
                decision: "Denied",
              }),
              denied(404),
            );
          }
          await assert.rejects(
            changes.update(foreign, f.foreignEventId, change.id, {
              expectedVersion: 1,
              planB: "Denied",
            }),
            denied(404),
          );
          await assert.rejects(
            changes.update(organizer, f.foreignEventId, change.id, {
              expectedVersion: 1,
              response: "Denied",
            }),
            denied(404),
          );
          assert.equal((await history(change.id)).length, 0);
        },
      );
      await t.test(
        "each field added/changed/cleared increments once, writes one presence-only entry, and leaves every Task unchanged",
        async () => {
          const originalTasks = await tasks.read(organizer, f.eventId);
          for (const field of ["decision", "response", "planB"] as const) {
            for (const value of [
              "Primary coordination",
              "Revised coordination",
              null,
            ]) {
              const before = change,
                count = (await history(change.id)).length;
              change = await changes.update(organizer, f.eventId, change.id, {
                expectedVersion: before.version,
                [field]: value,
              });
              assert.equal(change.version, before.version + 1);
              assert.equal(
                field === "decision"
                  ? (change.decision?.text ?? null)
                  : change[field],
                value,
              );
              const entries = await history(change.id);
              assert.equal(entries.length, count + 1);
              assert.equal(entries.at(-1).action_type, "CHANGE_UPDATED");
              assert.equal(entries.at(-1).actor_member_id, f.organizerId);
              assert.deepEqual(entries.at(-1).payload.changes[field], {
                before: value === "Primary coordination" ? "absent" : "present",
                after: value === null ? "absent" : "present",
              });
              assert.ok(
                !JSON.stringify(entries.at(-1).payload).includes(
                  "coordination",
                ),
              );
              if (field === "decision" && value !== null) {
                assert.equal(change.decision!.authoredBy.id, f.organizerId);
                assert.ok(
                  Number.isFinite(Date.parse(change.decision!.createdAt)),
                );
                assert.ok(
                  Date.parse(change.decision!.updatedAt) >=
                    Date.parse(change.decision!.createdAt),
                );
                if (before.decision)
                  assert.equal(
                    change.decision!.createdAt,
                    before.decision.createdAt,
                  );
              }
              assert.deepEqual(
                await tasks.read(organizer, f.eventId),
                originalTasks,
              );
            }
          }
        },
      );
      await t.test(
        "whole authored response state is one version boundary; omission and current no-op preserve metadata/history",
        async () => {
          const previousVersion = change.version;
          change = await changes.update(organizer, f.eventId, change.id, {
            expectedVersion: previousVersion,
            decision: "Move pickup",
            response: "Driver informed",
            planB: "Airport hotel if cancelled",
          });
          assert.equal(change.version, previousVersion + 1);
          const before = change,
            count = (await history(change.id)).length;
          assert.deepEqual(
            await changes.update(organizer, f.eventId, change.id, {
              expectedVersion: change.version,
              decision: " Move pickup ",
              response: "Driver informed",
              planB: "Airport hotel if cancelled",
            }),
            before,
          );
          assert.equal((await history(change.id)).length, count);
          await assert.rejects(
            changes.update(organizer, f.eventId, change.id, {
              expectedVersion: previousVersion,
              decision: "Stale",
              response: null,
              planB: null,
              responseOwnerMemberId: null,
              affectedTaskIds: [],
            }),
            denied(409),
          );
          await assert.rejects(
            changes.update(organizer, f.eventId, change.id, {
              expectedVersion: previousVersion,
              decision: change.decision!.text,
            }),
            denied(409),
          );
          assert.deepEqual(await read(change.id), before);
          assert.equal((await history(change.id)).length, count);
          change = await changes.update(organizer, f.eventId, change.id, {
            expectedVersion: change.version,
            responseOwnerMemberId: f.organizerId,
          });
          assert.deepEqual(change.decision, before.decision);
          assert.equal(change.response, before.response);
          assert.equal(change.planB, before.planB);
        },
      );
      await t.test(
        "live Task deadline/reassignment/status do not touch response owner, authored state, Change version or history",
        async () => {
          const before = change,
            count = (await history(change.id)).length;
          let task = (await tasks.read(organizer, f.eventId, f.taskId))[0]!;
          task = await tasks.updateDetails(organizer, f.eventId, task.id, {
            expectedVersion: task.version,
            deadline: "2026-12-01",
          });
          task = await tasks.mutate(
            organizer,
            f.eventId,
            task.id,
            "assignment",
            { expectedVersion: task.version, assignedMemberId: f.memberId },
          );
          await tasks.mutate(member, f.eventId, task.id, "status", {
            expectedVersion: task.version,
            status: "in-progress",
          });
          change = await read(change.id);
          assert.equal(change.affectedTasks[0]!.deadline, "2026-12-01");
          assert.equal(change.affectedTasks[0]!.assignedMember!.id, f.memberId);
          assert.equal(change.affectedTasks[0]!.status, "in-progress");
          for (const key of [
            "version",
            "updatedAt",
            "responseOwner",
            "decision",
            "response",
            "planB",
          ] as const)
            assert.deepEqual(change[key], before[key]);
          assert.equal((await history(change.id)).length, count);
        },
      );
      await t.test(
        "history failure rolls back all response state, decision provenance, links, owner and version",
        async () => {
          const before = change,
            count = (await history(change.id)).length;
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
            failing.update(organizer, f.eventId, change.id, {
              expectedVersion: change.version,
              decision: "Must roll back",
              response: null,
              planB: null,
              responseOwnerMemberId: null,
              affectedTaskIds: [],
            }),
          );
          assert.deepEqual(await read(change.id), before);
          assert.equal((await history(change.id)).length, count);
          const rows = (
            await db.query(
              "SELECT count(*)::int AS n FROM public.event_change WHERE event_id=$1",
              [f.eventId],
            )
          ).rows[0].n;
          await assert.rejects(
            failing.create(organizer, f.eventId, {
              title: "Rollback create",
              decision: "Decision",
              response: "Response",
              planB: "Fallback",
            }),
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM public.event_change WHERE event_id=$1",
                [f.eventId],
              )
            ).rows[0].n,
            rows,
          );
        },
      );
      await t.test(
        "server rejects forged actor/role/time, blank/unbounded state; malicious prose stays parameterized",
        async () => {
          const before = change,
            count = (await history(change.id)).length;
          for (const field of [
            "eventId",
            "actorId",
            "actorMemberId",
            "accessRole",
            "decisionAuthorMemberId",
            "decisionCreatedAt",
            "updatedAt",
            "history",
          ])
            await assert.rejects(
              changes.update(organizer, f.eventId, change.id, {
                expectedVersion: change.version,
                [field]: "forged",
              }),
              denied(400),
            );
          for (const field of ["decision", "response", "planB"])
            await assert.rejects(
              changes.update(organizer, f.eventId, change.id, {
                expectedVersion: change.version,
                [field]: " \t\n",
              }),
              denied(400),
            );
          assert.deepEqual(await read(change.id), before);
          assert.equal((await history(change.id)).length, count);
          const malicious =
            "'; DROP TABLE public.task; -- <script>alert(1)</script>";
          change = await changes.update(organizer, f.eventId, change.id, {
            expectedVersion: change.version,
            decision: malicious,
            response: malicious,
            planB: malicious,
          });
          assert.equal(change.decision!.text, malicious);
          assert.equal(change.response, malicious);
          assert.equal(change.planB, malicious);
          assert.equal((await tasks.read(organizer, f.eventId)).length, 1);
        },
      );
      await t.test(
        "SQL bounds/completeness/scoped Decision author reject invalid state",
        async () => {
          for (const [set, values] of [
            ["decision_author_member_id=$2", [f.foreignMemberId]],
            ["decision_created_at=NULL", []],
            ["decision_updated_at='infinity'", []],
            ["decision_text=NULL", []],
            ["response_text=$2", [" "]],
            ["plan_b_text=$2", ["x".repeat(5001)]],
          ] as const) {
            await db.query("SAVEPOINT p3b_constraint");
            let code;
            try {
              await db.query(
                `UPDATE public.event_change SET ${set} WHERE id=$1`,
                [change.id, ...values],
              );
            } catch (e) {
              code = (e as { code: string }).code;
            }
            await db.query("ROLLBACK TO SAVEPOINT p3b_constraint");
            await db.query("RELEASE SAVEPOINT p3b_constraint");
            assert.ok(code === "23503" || code === "23514");
          }
        },
      );
      await t.test(
        "Decision revision author is the current authorized Organizer; other edits preserve its provenance",
        async () => {
          await db.query(
            "UPDATE public.event_member SET access_role='ORGANIZER' WHERE id=$1",
            [f.memberId],
          );
          const previous = change.decision!;
          change = await changes.update(member, f.eventId, change.id, {
            expectedVersion: change.version,
            decision: "Another Organizer's agreed revision",
          });
          assert.equal(change.decision!.authoredBy.id, f.memberId);
          assert.equal(change.decision!.createdAt, previous.createdAt);
          assert.ok(
            Date.parse(change.decision!.updatedAt) >
              Date.parse(previous.updatedAt),
          );
          const revised = change.decision;
          change = await changes.update(organizer, f.eventId, change.id, {
            expectedVersion: change.version,
            response: "Updated coordination",
          });
          assert.deepEqual(change.decision, revised);
          await db.query(
            "UPDATE public.event_member SET access_role='MEMBER' WHERE id=$1",
            [f.memberId],
          );
          assert.equal(
            (await changes.read(member, f.eventId, change.id))[0]!.decision!
              .authoredBy.id,
            f.memberId,
          );
          await assert.rejects(
            changes.update(member, f.eventId, change.id, {
              expectedVersion: change.version,
              decision: "Denied now",
            }),
            denied(403),
          );
        },
      );
    } finally {
      await db.query("ROLLBACK").catch(() => {});
      db.release();
      await pool.end();
    }
  },
);

test(
  "PostgreSQL P3B two independent connections: Decision versus Plan B has one winner and one atomic 409",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 60000 },
  async () => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    try {
      const seed = await pool.connect();
      let f;
      try {
        await seed.query("BEGIN");
        f = await createPostgresFixture(seed);
        await seed.query("COMMIT");
      } finally {
        seed.release();
      }
      const user = {
        id: f.organizerUser,
        name: "Synthetic editor",
        email: "editor@example.invalid",
      };
      const service = createChangeService(pool);
      const change = await service.create(user, f.eventId, {
        title: "Retained synthetic P3B concurrency",
        affectedTaskIds: [f.taskId],
      });
      const a = await pool.connect(),
        b = await pool.connect();
      try {
        assert.notEqual(
          (await a.query("SELECT pg_backend_pid() AS pid")).rows[0].pid,
          (await b.query("SELECT pg_backend_pid() AS pid")).rows[0].pid,
        );
        const pinned = (client: typeof a) => ({
          async connect() {
            return {
              query: (sql: string, values?: unknown[]) =>
                client.query(sql, values),
              on: (event: "error", listener: () => void) =>
                client.on(event, listener),
              removeListener: (event: "error", listener: () => void) =>
                client.removeListener(event, listener),
              release: () => {},
            };
          },
        });
        const results = await Promise.allSettled([
          createChangeService(pinned(a)).update(user, f.eventId, change.id, {
            expectedVersion: 1,
            decision: "Editor A decision",
          }),
          createChangeService(pinned(b)).update(user, f.eventId, change.id, {
            expectedVersion: 1,
            planB: "Editor B fallback",
            response: "Editor B response",
          }),
        ]);
        const wins = results.filter((r) => r.status === "fulfilled"),
          losses = results.filter((r) => r.status === "rejected");
        assert.equal(wins.length, 1);
        assert.equal(losses.length, 1);
        assert.ok(
          losses[0]?.status === "rejected" &&
            losses[0].reason instanceof ChangeCommandError &&
            losses[0].reason.statusCode === 409,
        );
        const winner = wins[0];
        assert.ok(winner?.status === "fulfilled");
        const current = (await service.read(user, f.eventId, change.id))[0]!;
        assert.deepEqual(current, winner.value);
        assert.equal(current.version, 2);
        if (current.decision) {
          assert.equal(current.planB, null);
          assert.equal(current.response, null);
        } else {
          assert.equal(current.planB, "Editor B fallback");
          assert.equal(current.response, "Editor B response");
        }
        const entries = (
          await pool.query(
            "SELECT payload FROM public.activity_entry WHERE event_id=$1 AND target_id=$2 ORDER BY created_at,id",
            [f.eventId, change.id],
          )
        ).rows;
        assert.equal(entries.length, 2);
        assert.equal(entries[1].payload.changeVersion, 2);
      } finally {
        a.release();
        b.release();
      }
    } finally {
      await pool.end();
    }
  },
);
