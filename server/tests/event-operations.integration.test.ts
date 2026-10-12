import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { runEventOperation } from "../src/events/operations.ts";
import {
  EventCommandError,
  eventColumns,
  eventDto,
  type EventRow,
} from "../src/events/model.ts";
import type { TransactionDatabase } from "../src/db/transaction.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";

// Independent connections/processes require committed visibility. Retain only
// owned synthetic records, following the established concurrency fixture policy.
test(
  "PostgreSQL durable Event operations: concurrency, rollback, authorization and process replay (retained synthetic fixture)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 180000 },
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
      } catch (error) {
        await setup.query("ROLLBACK");
        throw error;
      } finally {
        setup.release();
      }
      const user = (id: string) => ({
        id,
        name: "Synthetic operation",
        email: "operation@example.invalid",
      });
      const organizer = user(f.organizerUser);
      const input = {
        name: `Synthetic receipt ${randomUUID()}`,
        startDate: "2026-11-01",
        endDate: "2026-11-02",
        timezone: "UTC",
        expectedVersion: 1,
      };
      const key = randomUUID();
      let effects = 0;
      async function work(db: TransactionDatabase) {
        effects++;
        const id = randomUUID(),
          memberId = randomUUID();
        const inserted = await db.query(
          `INSERT INTO public.event (id,name,start_date,end_date,timezone,owner_user_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${eventColumns}`,
          [
            id,
            input.name,
            input.startDate,
            input.endDate,
            input.timezone,
            organizer.id,
          ],
        );
        await db.query(
          "INSERT INTO public.event_member (id,event_id,user_id,access_role,operational_role,active) VALUES ($1,$2,$3,'ORGANIZER','',TRUE)",
          [memberId, id, organizer.id],
        );
        await db.query(
          "INSERT INTO public.activity_entry (id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload) VALUES ($1,$2,$3,$4,'EVENT_CREATED','event',$2,'{}')",
          [randomUUID(), id, organizer.id, memberId],
        );
        return eventDto(inserted.rows[0] as EventRow, {
          id: memberId,
          accessRole: "ORGANIZER",
        });
      }
      const execute = (
        operationKey = key,
        actor = organizer,
        source = f.eventId,
        fields = input,
      ) => runEventOperation(pool, actor, source, operationKey, fields, work);
      const count = async (table: string) =>
        (
          await pool.query(
            `SELECT count(*)::INT AS n FROM public.${table} WHERE ${table === "event_command_receipt" ? "actor_user_id = $1" : table === "event" ? "name = $1" : "event_id = $1"}`,
            [
              table === "event_command_receipt"
                ? organizer.id
                : table === "event"
                  ? input.name
                  : accepted.id,
            ],
          )
        ).rows[0].n;
      const accepted = await execute();
      await t.test(
        "Initial commit, exact retry, canonical retry and lost-response retry preserve one effect/activity/receipt",
        async () => {
          assert.deepEqual(await execute(), accepted);
          assert.deepEqual(
            await execute(key, organizer, f.eventId, {
              ...input,
              name: ` ${input.name} `,
            }),
            accepted,
          );
          assert.equal(effects, 1);
          assert.equal(await count("event"), 1);
          assert.equal(await count("activity_entry"), 1);
          assert.equal(await count("event_command_receipt"), 1);
        },
      );
      await t.test(
        "Concurrent identical requests on independent connections accept exactly one result",
        async () => {
          const concurrentKey = randomUUID();
          const results = await Promise.all(
            Array.from({ length: 4 }, () => execute(concurrentKey)),
          );
          assert.ok(results.every((result) => result.id === results[0]!.id));
          assert.equal(effects, 2);
          assert.equal(await count("event"), 2);
          assert.equal(await count("event_command_receipt"), 2);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::INT AS n FROM public.activity_entry WHERE event_id=$1",
                [results[0]!.id],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "Payload conflict, foreign/member/inactive scope and actor reuse cannot expose receipts or run effects",
        async () => {
          const before = effects;
          for (const [actor, source, fields, status] of [
            [organizer, f.eventId, { ...input, name: "Changed" }, 409],
            [user(f.memberUser), f.eventId, input, 403],
            [user(f.foreignUser), f.eventId, input, 404],
            [user(f.inactiveUser), f.eventId, input, 404],
            [organizer, f.foreignEventId, input, 404],
          ] as const)
            await assert.rejects(
              execute(key, actor, source, fields),
              (e: unknown) =>
                e instanceof EventCommandError && e.statusCode === status,
            );
          assert.equal(effects, before);
        },
      );
      await t.test(
        "Business/audit and receipt faults roll back all effects; the same key can retry safely",
        async () => {
          for (const fault of ["business", "receipt"] as const) {
            const faultKey = randomUUID();
            const faultPool = {
              async connect() {
                const c = await pool.connect();
                return {
                  query: async (sql: string, values?: unknown[]) => {
                    if (
                      fault === "receipt" &&
                      sql.includes("INSERT INTO public.event_command_receipt")
                    )
                      throw new Error("injected receipt fault");
                    return c.query(sql, values);
                  },
                  on: c.on.bind(c),
                  removeListener: c.removeListener.bind(c),
                  release: c.release.bind(c),
                };
              },
            };
            const before = await count("event");
            await assert.rejects(
              runEventOperation(
                faultPool,
                organizer,
                f.eventId,
                faultKey,
                input,
                async (db) => {
                  const result = await work(db);
                  if (fault === "business")
                    throw new Error("injected business fault");
                  return result;
                },
              ),
              /injected/,
            );
            assert.equal(await count("event"), before);
            assert.equal(
              (
                await pool.query(
                  "SELECT count(*)::INT AS n FROM public.event_command_receipt WHERE actor_user_id=$1 AND command_id=$2",
                  [organizer.id, faultKey],
                )
              ).rows[0].n,
              0,
            );
            const recovered = await execute(faultKey);
            assert.deepEqual(await execute(faultKey), recovered);
          }
        },
      );
      await t.test(
        "Fresh independent Node process replays durable receipt without executing effects",
        async () => {
          const child = await promisify(execFile)(
            process.execPath,
            [
              "server/tests/helpers/event-operation-replay.ts",
              organizer.id,
              f.eventId,
              key,
              JSON.stringify(input),
            ],
            { cwd: process.cwd(), env: process.env },
          );
          assert.deepEqual(JSON.parse(child.stdout), { id: accepted.id });
          assert.equal(child.stderr, "");
        },
      );
      await t.test(
        "Source version change permits accepted replay but rejects a fresh stale command; revoked source blocks replay",
        async () => {
          await pool.query(
            "UPDATE public.event SET version=version+1 WHERE id=$1",
            [f.eventId],
          );
          assert.deepEqual(await execute(), accepted);
          await assert.rejects(
            execute(randomUUID()),
            (e: unknown) =>
              e instanceof EventCommandError &&
              e.code === "EVENT_VERSION_CONFLICT",
          );
          await pool.query(
            "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE id=$1",
            [f.organizerId],
          );
          await assert.rejects(
            execute(),
            (e: unknown) =>
              e instanceof EventCommandError && e.statusCode === 404,
          );
        },
      );
    } finally {
      await pool.end();
    }
  },
);
