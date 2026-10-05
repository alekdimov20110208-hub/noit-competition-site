import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import { createChangeService } from "../src/changes/service.ts";
import { ChangeCommandError } from "../src/changes/model.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";

// Independent connections need committed visibility. These synthetic development
// fixtures are intentionally retained, unlike the rollback-only constraint suite.
// No existing records are edited and no cleanup deletes business/history rows.
test(
  "PostgreSQL concurrent Change editors serialize one winner and one stale 409 (retained synthetic fixture)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 60000 },
  async () => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {});
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const fixture = await createPostgresFixture(client);
      await client.query("COMMIT");
      client.release();
      client = undefined;
      const service = createChangeService(pool);
      const user = {
        id: fixture.organizerUser,
        name: "Synthetic concurrent editor",
        email: "concurrent@example.invalid",
      };
      const change = await service.create(user, fixture.eventId, {
        title: "Synthetic concurrent arrival change",
        affectedTaskIds: [fixture.taskId],
      });
      const results = await Promise.allSettled([
        service.update(user, fixture.eventId, change.id, {
          expectedVersion: 1,
          title: "Editor A",
          responseOwnerMemberId: fixture.memberId,
          affectedTaskIds: [],
        }),
        service.update(user, fixture.eventId, change.id, {
          expectedVersion: 1,
          title: "Editor B",
          responseOwnerMemberId: fixture.organizerId,
          affectedTaskIds: [fixture.taskId],
        }),
      ]);
      const winners = results.filter((result) => result.status === "fulfilled"),
        losers = results.filter((result) => result.status === "rejected");
      assert.equal(winners.length, 1);
      assert.equal(losers.length, 1);
      const rejected = losers[0];
      assert.ok(
        rejected?.status === "rejected" &&
          rejected.reason instanceof ChangeCommandError &&
          rejected.reason.statusCode === 409,
      );
      const winner = winners[0];
      assert.ok(winner?.status === "fulfilled");
      assert.equal(winner.value.version, 2);
      assert.deepEqual(
        (await service.read(user, fixture.eventId, change.id))[0],
        winner.value,
      );
      const activity = await pool.query(
        "SELECT action_type,payload FROM public.activity_entry WHERE event_id=$1 AND target_id=$2 ORDER BY created_at,id",
        [fixture.eventId, change.id],
      );
      assert.equal(activity.rows.length, 2);
      assert.deepEqual(
        activity.rows.map((row) => row.action_type),
        ["CHANGE_CREATED", "CHANGE_UPDATED"],
      );
      assert.equal(activity.rows[1].payload.changeVersion, 2);
    } finally {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
        client.release();
      }
      await pool.end();
    }
  },
);
