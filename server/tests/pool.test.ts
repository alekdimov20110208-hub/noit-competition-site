import assert from "node:assert/strict";
import test from "node:test";
import { createDatabasePool } from "../src/db/pool.ts";
import { readDatabaseEnv } from "../src/config/env.ts";

test("pool is lazy and forwards idle failures without the raw error or credentials", async () => {
  const notifications: unknown[][] = [];
  const pool = createDatabasePool(
    readDatabaseEnv({
      DATABASE_URL: "postgresql://127.0.0.1/SYNTHETIC_DATABASE",
    }),
    (...args: unknown[]) => notifications.push(args),
  );
  try {
    assert.equal(pool.totalCount, 0);
    pool.emit("error", new Error("SYNTHETIC_SECRET"));
    assert.deepEqual(notifications, [[]]);
  } finally {
    await pool.end();
  }
});
