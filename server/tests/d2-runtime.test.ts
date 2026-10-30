import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyProductionSchema } from "../src/db/production-schema.ts";
import { validateRuntimeConnection } from "../src/db/identity.ts";
import { registerEmailWorker } from "../src/email/worker.ts";
import { createApp } from "../src/app.ts";

const directory = resolve("server/migrations");
test("D2 startup recognizes exactly 16 immutable migrations with SELECT only; drift and pending history fail closed", async (t) => {
  const { pins } = JSON.parse(
    await readFile(join(directory, "production-manifest.json"), "utf8"),
  );
  const queries: string[] = [];
  const database = {
    query: async ({ text }: { text: string }) => {
      queries.push(text);
      return { rows: pins };
    },
  };
  assert.deepEqual(await verifyProductionSchema(database, directory), {
    recognized: 16,
    applied: 16,
  });
  assert.deepEqual(queries, [
    "SELECT version, name, checksum FROM public.schema_migrations ORDER BY version",
  ]);
  await assert.rejects(
    verifyProductionSchema(
      { query: async () => ({ rows: pins.slice(0, 15) }) },
      directory,
    ),
    /incomplete/,
  );
  await assert.rejects(
    verifyProductionSchema(
      {
        query: async () => ({
          rows: pins.map((p: object, i: number) =>
            i === 15 ? { ...p, checksum: "0".repeat(64) } : p,
          ),
        }),
      },
      directory,
    ),
    /checksum mismatch/,
  );
  const root = await mkdtemp(join(tmpdir(), "budograph-d2-migrations-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(directory, root, { recursive: true });
  const path = join(root, pins[15].name);
  await writeFile(
    path,
    Buffer.concat([await readFile(path), Buffer.from("\n")]),
  );
  queries.length = 0;
  await assert.rejects(
    verifyProductionSchema(database, root),
    /checksum mismatch/,
  );
  assert.equal(
    queries.length,
    0,
    "File integrity is checked before database I/O",
  );
});

test("D2 rejects owner/migrator/missing-password/transaction-pool runtime URLs before connecting", () => {
  const expected = {
    databaseId: "00000000-0000-4000-8000-000000000001",
    projectRef: "local-test",
  };
  validateRuntimeConnection(
    "postgresql://budograph_runtime:synthetic@127.0.0.1:5432/postgres",
    expected,
  );
  validateRuntimeConnection(
    "postgresql://budograph_runtime.local-test:synthetic@pool.invalid:5432/postgres",
    expected,
  );
  for (const url of [
    "postgresql://postgres:synthetic@db.invalid/postgres",
    "postgresql://budograph_migrator:synthetic@db.invalid/postgres",
    "postgresql://budograph_runtime@db.invalid/postgres",
    "postgresql://budograph_runtime:synthetic@db.invalid:6543/postgres",
  ])
    assert.throws(
      () => validateRuntimeConnection(url, expected),
      /runtime credentials/,
    );
});

test("email worker starts at readiness, prevents overlap and drains an in-flight dispatch before close", async () => {
  let release!: () => void, started!: () => void;
  const blocked = new Promise<void>((r) => {
      release = r;
    }),
    entered = new Promise<void>((r) => {
      started = r;
    });
  let active = 0,
    peak = 0,
    passes = 0,
    cleaned = 0;
  const app = createApp({ checkDatabase: async () => {} });
  registerEmailWorker(
    app,
    {
      dispatch: async () => {
        passes++;
        peak = Math.max(peak, ++active);
        started();
        await blocked;
        active--;
      },
      cleanup: async () => {
        cleaned++;
      },
    },
    1,
  );
  await app.ready();
  await entered;
  let closed = false;
  const closing = app.close().then(() => {
    closed = true;
  });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(closed, false);
  assert.equal(passes, 1);
  assert.equal(peak, 1);
  release();
  await closing;
  assert.equal(active, 0);
  assert.equal(cleaned, 1);
});
