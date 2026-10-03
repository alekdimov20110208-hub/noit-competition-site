import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createEventService } from "../src/events/service.ts";
import { EventCommandError } from "../src/events/model.ts";
import { createTaskService } from "../src/tasks/service.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";

const enabled = process.env.RUN_DATABASE_INTEGRATION === "1";
const denied = (status: number) => (error: unknown) =>
  error instanceof EventCommandError && error.statusCode === status;
const input = {
  name: "Disposable P2A authored Event",
  startDate: "2026-10-06",
  endDate: "2026-10-08",
  timezone: "Europe/Sofia",
};

test(
  "PostgreSQL Event authoring transactions and scoped roles (rollback-only fixtures)",
  { skip: !enabled, timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    let client: PoolClient | undefined,
      open = false,
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
      const boundary = {
        ...commandPool,
        query: (sql: string, values?: unknown[]) => database.query(sql, values),
      };
      const events = createEventService(boundary),
        tasks = createTaskService(commandPool);
      const identity = (id: string) => ({
        id,
        name: "Disposable identity",
        email: "disposable@example.invalid",
      });
      const organizer = identity(f.organizerUser),
        member = identity(f.memberUser),
        foreign = identity(f.foreignUser);
      const created = await events.create(member, input);
      const other = await events.create(organizer, {
        ...input,
        name: "Disposable P2A other Event",
      });
      const event = async () =>
        (
          await database.query(
            "SELECT id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, timezone, owner_user_id, version, created_at, updated_at FROM public.event WHERE id=$1",
            [created.id],
          )
        ).rows[0];
      const activity = async () =>
        (
          await database.query(
            "SELECT action_type, actor_user_id, actor_member_id, target_type, target_id, payload, created_at FROM public.activity_entry WHERE event_id=$1 ORDER BY created_at, id",
            [created.id],
          )
        ).rows;

      await t.test(
        "authenticated Member creates independent owned Event with active Organizer membership and no Tasks",
        async () => {
          const row = await event();
          assert.equal(row.owner_user_id, member.id);
          assert.equal(row.version, 1);
          assert.equal(row.start_date, input.startDate);
          assert.equal(row.end_date, input.endDate);
          assert.equal(created.membership.accessRole, "ORGANIZER");
          const memberships = (
            await database.query(
              "SELECT id, user_id, access_role, active, deactivated_at FROM public.event_member WHERE event_id=$1",
              [created.id],
            )
          ).rows;
          assert.deepEqual(memberships, [
            {
              id: created.membership.id,
              user_id: member.id,
              access_role: "ORGANIZER",
              active: true,
              deactivated_at: null,
            },
          ]);
          assert.deepEqual(await tasks.read(member, created.id), []);
          const team = await tasks.readAssignableMembers(member, created.id);
          assert.equal(team.length, 1);
          assert.equal(team[0]?.id, created.membership.id);
          const [entry] = await activity();
          assert.equal(entry.action_type, "EVENT_CREATED");
          assert.equal(entry.actor_user_id, member.id);
          assert.equal(entry.actor_member_id, created.membership.id);
          assert.equal(entry.target_type, "event");
          assert.equal(entry.target_id, created.id);
          assert.deepEqual(entry.payload, { ...input, version: 1 });
          assert.ok(entry.created_at instanceof Date);
        },
      );

      await t.test(
        "multiple memberships list Member-in-A and Organizer-in-B correctly and exclude foreign Events",
        async () => {
          const list = await events.list(member);
          assert.deepEqual(
            list.map((entry) => entry.id).sort(),
            [f.eventId, created.id].sort(),
          );
          assert.equal(
            list.find((entry) => entry.id === f.eventId)?.membership.accessRole,
            "MEMBER",
          );
          assert.equal(
            list.find((entry) => entry.id === created.id)?.membership
              .accessRole,
            "ORGANIZER",
          );
          assert.ok(list.every((entry) => entry.version === 1));
          assert.ok(
            list.every((entry) => Number.isFinite(Date.parse(entry.createdAt))),
          );
          assert.ok(
            !list.some((entry) =>
              [other.id, f.foreignEventId].includes(entry.id),
            ),
          );
          await assert.rejects(
            events.update(member, f.eventId, { ...input, expectedVersion: 1 }),
            denied(403),
          );
          for (const actor of [organizer, foreign])
            await assert.rejects(
              events.update(actor, created.id, {
                ...input,
                name: "Forbidden",
                expectedVersion: 1,
              }),
              denied(404),
            );
          await assert.rejects(tasks.read(member, other.id));
        },
      );

      await t.test(
        "Organizer edit persists name/dates/timezone, version and changed-fields activity with calendar semantics",
        async () => {
          const edited = {
            ...input,
            name: "Disposable P2A edited Event",
            startDate: "2026-11-01",
            endDate: "2026-11-02",
            timezone: "America/New_York",
            expectedVersion: 1,
          };
          const after = await events.update(member, created.id, edited);
          assert.equal(after.version, 2);
          assert.equal(after.startDate, "2026-11-01");
          assert.equal(after.timezone, "America/New_York");
          const row = await event();
          assert.equal(row.version, 2);
          assert.equal(row.start_date, "2026-11-01");
          assert.equal(row.end_date, "2026-11-02");
          assert.equal(row.owner_user_id, member.id);
          assert.equal(row.name, edited.name);
          const entries = await activity();
          assert.equal(entries.length, 2);
          assert.equal(entries[1].action_type, "EVENT_UPDATED");
          assert.deepEqual(entries[1].payload, {
            before: { ...input, version: 1 },
            after: {
              name: edited.name,
              startDate: edited.startDate,
              endDate: edited.endDate,
              timezone: edited.timezone,
              version: 2,
            },
          });
          const noOp = await events.update(member, created.id, {
            ...edited,
            expectedVersion: 2,
          });
          assert.equal(noOp.version, 2);
          assert.equal((await activity()).length, 2);
          assert.equal(noOp.updatedAt, after.updatedAt);
          await assert.rejects(
            events.update(member, created.id, edited),
            denied(409),
          );
          assert.equal((await event()).version, 2);
          assert.equal((await activity()).length, 2);
        },
      );

      await t.test(
        "NUL and malformed Unicode input produce safe field validation and leave canonical database state/history unchanged",
        async () => {
          const before = await event(),
            count = (await activity()).length;
          for (const name of [
            "Invalid\u0000name",
            "Invalid\uD800name",
            "Invalid\uDC00name",
          ])
            for (const command of [
              () => events.create(member, { ...input, name }),
              () =>
                events.update(member, created.id, {
                  ...input,
                  name,
                  expectedVersion: 2,
                }),
            ])
              await assert.rejects(command(), (error) => {
                assert.ok(error instanceof EventCommandError);
                assert.equal(error.statusCode, 400);
                assert.deepEqual(error.fields, { name: "INVALID_NAME" });
                return true;
              });
          assert.deepEqual(await event(), before);
          assert.equal((await activity()).length, count);
        },
      );

      await t.test(
        "real constraint failure after Event insert rolls back Event/membership/history together",
        async () => {
          for (const failAt of [
            "INSERT INTO public.event_member",
            "INSERT INTO public.activity_entry",
          ]) {
            const beforeCount = (
              await database.query(
                "SELECT COUNT(*)::INT AS count FROM public.event WHERE owner_user_id=$1",
                [member.id],
              )
            ).rows[0].count;
            const failing = createEventService({
              ...boundary,
              async connect() {
                const connection = await commandPool.connect();
                return {
                  ...connection,
                  async query(sql: string, values?: unknown[]) {
                    if (sql.startsWith(failAt))
                      return connection.query(
                        "INSERT INTO public.event_member (id,event_id,user_id,access_role) VALUES ($1,$2,$3,'INVALID_FIXTURE_ROLE')",
                        [values?.[0], values?.[1], member.id],
                      );
                    return connection.query(sql, values);
                  },
                };
              },
            });
            await assert.rejects(
              failing.create(member, {
                ...input,
                name: "Disposable rollback Event",
              }),
            );
            assert.equal(
              (
                await database.query(
                  "SELECT COUNT(*)::INT AS count FROM public.event WHERE owner_user_id=$1",
                  [member.id],
                )
              ).rows[0].count,
              beforeCount,
            );
            assert.equal((await activity()).length, 2);
          }
        },
      );

      await t.test(
        "real update/history failure rolls back Event fields, version and history together",
        async () => {
          for (const failAt of [
            "UPDATE public.event",
            "INSERT INTO public.activity_entry",
          ]) {
            const before = await event(),
              count = (await activity()).length;
            const failing = createEventService({
              ...boundary,
              async connect() {
                const connection = await commandPool.connect();
                return {
                  ...connection,
                  async query(sql: string, values?: unknown[]) {
                    if (sql.startsWith(failAt))
                      return connection.query(
                        "UPDATE public.event SET end_date=start_date - 1 WHERE id=$1",
                        [created.id],
                      );
                    return connection.query(sql, values);
                  },
                };
              },
            });
            await assert.rejects(
              failing.update(member, created.id, {
                ...input,
                name: "Disposable rejected edit",
                expectedVersion: 2,
              }),
            );
            assert.deepEqual(await event(), before);
            assert.equal((await activity()).length, count);
          }
        },
      );

      await t.test(
        "archived Event writes and inactive identities/memberships are denied without changing data",
        async () => {
          await database.query("SAVEPOINT p2a_visibility");
          try {
            await database.query(
              "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
              [created.id],
            );
            await assert.rejects(
              events.update(member, created.id, {
                ...input,
                expectedVersion: 2,
              }),
              denied(403),
            );
            await database.query(
              "UPDATE public.event SET archived_at=NULL WHERE id=$1",
              [created.id],
            );
            await database.query(
              "UPDATE public.event_member SET active=FALSE, deactivated_at=clock_timestamp() WHERE id=$1",
              [created.membership.id],
            );
            await assert.rejects(
              events.update(member, created.id, {
                ...input,
                expectedVersion: 2,
              }),
              denied(404),
            );
            assert.ok(
              !(await events.list(member)).some(
                (entry) => entry.id === created.id,
              ),
            );
            await database.query(
              'UPDATE public."user" SET active=FALSE WHERE id=$1',
              [member.id],
            );
            await assert.rejects(events.create(member, input));
            assert.deepEqual(await events.list(member), []);
          } finally {
            await database.query("ROLLBACK TO SAVEPOINT p2a_visibility");
          }
        },
      );

      await database.query("ROLLBACK");
      open = false;
      await t.test(
        "all disposable authored Events, memberships, identity and history disappear after outer rollback",
        async () => {
          for (const [sql, values] of [
            [
              "SELECT COUNT(*)::INT AS count FROM public.event WHERE id=ANY($1::UUID[])",
              [[created.id, other.id]],
            ],
            [
              "SELECT COUNT(*)::INT AS count FROM public.event_member WHERE event_id=ANY($1::UUID[])",
              [[created.id, other.id]],
            ],
            [
              "SELECT COUNT(*)::INT AS count FROM public.activity_entry WHERE event_id=ANY($1::UUID[])",
              [[created.id, other.id]],
            ],
            [
              'SELECT COUNT(*)::INT AS count FROM public."user" WHERE id LIKE $1',
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
      throw new Error(
        "PostgreSQL Event authoring integration failed; details omitted. See subtest result.",
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
