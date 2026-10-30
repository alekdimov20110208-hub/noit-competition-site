import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import {
  guardProductionDatabasePool,
  readProductionDatabaseIdentity,
} from "../src/db/identity.ts";

const environment = {
  EXPECTED_DATABASE_ID: "00000000-0000-4000-8000-000000000001",
  EXPECTED_SUPABASE_PROJECT_REF: "local-test-only",
};
test("production identity configuration fails before database I/O without echoing values", () => {
  const expected = readProductionDatabaseIdentity(environment);
  assert.equal(expected.databaseId, environment.EXPECTED_DATABASE_ID);
  for (const env of [
    {},
    { ...environment, EXPECTED_DATABASE_ID: "private-invalid-input" },
    { ...environment, EXPECTED_SUPABASE_PROJECT_REF: "invalid/target" },
  ]) {
    assert.throws(() => readProductionDatabaseIdentity(env), {
      message:
        "Production requires valid EXPECTED_DATABASE_ID and EXPECTED_SUPABASE_PROJECT_REF.",
    });
  }
});

test("pool guard checks each same-client promise/callback checkout and destroys mismatched clients", async (t) => {
  const pool = new pg.Pool({ max: 2 });
  let checkouts = 0,
    checks = 0,
    mismatch = false;
  const releases: (boolean | undefined)[] = [];
  const client = {
    on: () => {},
    removeListener: () => {},
    query: async () => {
      checks++;
      return {
        rows: [
          {
            database_id: environment.EXPECTED_DATABASE_ID,
            project_ref: mismatch
              ? "wrong-target"
              : environment.EXPECTED_SUPABASE_PROJECT_REF,
            environment: "production",
            runtime_role: "budograph_runtime",
            safe_role: true,
          },
        ],
      };
    },
    release: (destroy?: boolean) => releases.push(destroy),
  } as unknown as pg.PoolClient;
  t.mock.method(pool, "connect", async () => {
    checkouts++;
    return client;
  });
  guardProductionDatabasePool(
    pool,
    readProductionDatabaseIdentity(environment),
  );
  const first = await pool.connect();
  assert.equal(first, client);
  first.release();
  await new Promise<void>((resolve, reject) =>
    pool.connect((error, next, release) => {
      if (error) return reject(error);
      assert.equal(next, client);
      release();
      resolve();
    }),
  );
  mismatch = true;
  await assert.rejects(pool.connect(), /identity verification failed/);
  await new Promise<void>((resolve) =>
    pool.connect((error) => {
      assert.ok(error);
      assert.match(error.message, /identity verification failed/);
      resolve();
    }),
  );
  assert.equal(checkouts, 4);
  assert.equal(checks, 4);
  assert.deepEqual(releases, [undefined, undefined, true, true]);
  assert.equal(pool.totalCount, 0);
  await pool.end();
});
