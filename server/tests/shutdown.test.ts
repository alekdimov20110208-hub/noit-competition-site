import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createShutdown } from "../src/shutdown.ts";

test("shutdown closes HTTP before database and shares one operation", async () => {
  const order: string[] = [];
  const shutdown = createShutdown({
    closeApp: async () => {
      order.push("http");
    },
    closeDatabase: async () => {
      order.push("database");
    },
    onFailure: () => assert.fail("shutdown should succeed"),
  });

  const first = shutdown();
  const second = shutdown();
  assert.equal(first, second);
  assert.equal(await first, true);
  assert.equal(await shutdown(), true);
  assert.deepEqual(order, ["http", "database"]);
});

test("startup/shutdown cleanup still closes the pool after HTTP failure", async () => {
  const order: string[] = [];
  const failures: string[] = [];
  const shutdown = createShutdown({
    closeApp: async () => {
      order.push("http");
      throw new Error("SYNTHETIC_CLOSE_ERROR");
    },
    closeDatabase: async () => {
      order.push("database");
    },
    onFailure: (stage) => failures.push(stage),
  });

  assert.equal(await shutdown(), false);
  assert.equal(await shutdown(), false);
  assert.deepEqual(order, ["http", "database"]);
  assert.deepEqual(failures, ["http"]);
});

test("shutdown reports only the database failure phase without raw errors", async () => {
  const failures: string[] = [];
  const shutdown = createShutdown({
    closeApp: async () => {},
    closeDatabase: async () => {
      throw new Error("SYNTHETIC_DATABASE_CLOSE_ERROR");
    },
    onFailure: (stage) => failures.push(stage),
  });

  assert.equal(await shutdown(), false);
  assert.deepEqual(failures, ["database"]);
});

test("cleanup does not depend on the failure reporter succeeding", async () => {
  let poolClosed = false;
  const shutdown = createShutdown({
    closeApp: async () => {
      throw new Error("SYNTHETIC_CLOSE_ERROR");
    },
    closeDatabase: async () => {
      poolClosed = true;
    },
    onFailure: () => {
      throw new Error("SYNTHETIC_LOG_ERROR");
    },
  });

  assert.equal(await shutdown(), false);
  assert.equal(poolClosed, true);
});

test("the runtime fails safely on invalid configuration", () => {
  const sentinel = "SYNTHETIC_STARTUP_SENTINEL";
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../src/main.ts", import.meta.url))],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "invalid-port",
        DATABASE_URL: `postgresql://user:${sentinel}@localhost/test`,
      },
      encoding: "utf8",
      timeout: 10_000,
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PORT/);
  assert.equal(`${result.stdout}${result.stderr}`.includes(sentinel), false);
});
