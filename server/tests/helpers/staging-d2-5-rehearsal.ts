// D2.5 boundary only. Called exclusively by the loopback disposable harness.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Pool } from "pg";
import {
  inspectStaging,
  activateStaging,
  pinnedMigrations,
} from "../../src/staging/activation.ts";
import { STAGING } from "../../src/staging/target.ts";
import { createDatabasePool } from "../../src/db/pool.ts";
import { verifyProductionDatabaseIdentity } from "../../src/db/identity.ts";

export async function runD25Rehearsal({
  admin,
  root,
  port,
  clean,
}: {
  admin: Pool;
  root: string;
  port: number;
  clean: NodeJS.ProcessEnv;
}) {
  const checks: { name: string; status: "PASS" }[] = [];
  const check = async (
    name: string,
    work: () => unknown | Promise<unknown>,
  ) => {
    await work();
    checks.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  };
  const db = await admin.connect();
  const password = randomBytes(32).toString("hex");
  const validUntil = new Date(Date.now() + 30 * 86400000).toISOString();
  let runtime: Pool | undefined;
  try {
    const initial = await inspectStaging(db);
    await check(
      "Exact fingerprint refusal before advisory lock, DDL or password activation",
      async () => {
        const observed: string[] = [];
        const traced = {
          query: async (sql: string, values?: unknown[]) => {
            observed.push(sql);
            return db.query(sql, values);
          },
        };
        await assert.rejects(
          activateStaging(
            traced as typeof db,
            "0".repeat(64),
            password,
            validUntil,
          ),
          /drift/,
        );
        assert.ok(
          !observed.some((sql) =>
            /pg_advisory_lock|^BEGIN$|CREATE ROLE|ALTER ROLE|INSERT INTO/i.test(
              sql,
            ),
          ),
        );
        assert.equal(
          (await inspectStaging(db)).fingerprint,
          initial.fingerprint,
        );
      },
    );
    await check(
      "Real pinned CLI denies Production target and invalid UUID before any socket",
      () => {
        const block =
          "data:text/javascript," +
          encodeURIComponent(
            "import net from 'node:net';import tls from 'node:tls';const stop=()=>{process.stderr.write('UNEXPECTED_NETWORK');process.exit(91)};net.Socket.prototype.connect=stop;tls.connect=stop;globalThis.fetch=stop;",
          );
        const base = {
          ...clean,
          STAGING_OWNER_APPROVAL: `apply:${STAGING.projectRef}:${STAGING.databaseId}`,
          EXPECTED_SUPABASE_PROJECT_REF: STAGING.projectRef,
          EXPECTED_DATABASE_ID: STAGING.databaseId,
          EXPECTED_DATABASE_HOST: STAGING.directHost,
          STAGING_MIGRATOR_URL: `postgresql://postgres:SYNTHETIC@${STAGING.directHost}/postgres`,
        };
        for (const override of [
          { EXPECTED_DATABASE_ID: "00000000-0000-4000-8000-000000000001" },
          { EXPECTED_SUPABASE_PROJECT_REF: STAGING.productionRef },
          {
            STAGING_MIGRATOR_URL: `postgresql://postgres:SYNTHETIC@db.${STAGING.productionRef}.supabase.co/postgres`,
          },
        ]) {
          const result = spawnSync(
            process.execPath,
            ["--import", block, "server/scripts/staging-database.ts", "apply"],
            {
              env: { ...base, ...override },
              encoding: "utf8",
              windowsHide: true,
              timeout: 15000,
            },
          );
          assert.equal(result.status, 1);
          assert.doesNotMatch(
            result.stdout + result.stderr,
            /UNEXPECTED_NETWORK|SYNTHETIC|postgresql:\/\//,
          );
        }
      },
    );
    await check(
      "Existing activation engine applies exactly 16 pins and staging overlay",
      async () => {
        const result = await activateStaging(
          db,
          initial.fingerprint,
          password,
          validUntil,
        );
        assert.deepEqual(result.migrations, { applied: 16, alreadyApplied: 0 });
        assert.equal(result.initialFingerprint, initial.fingerprint);
        assert.equal(result.verified.history.length, 16);
        const pins = await pinnedMigrations();
        assert.deepEqual(
          result.verified.history,
          pins.map(({ version, name, checksum }) => ({
            version,
            name,
            checksum,
          })),
        );
        assert.equal(
          result.verified.catalogSha256,
          "0063e7b4d0029b835b78b99abf13f1b8631d6684edc18e132159cb86b523dfaf",
        );
        assert.equal(result.verified.tables, 23);
        assert.equal(result.verified.policies, 54);
        assert.equal(result.verified.functions, 14);
        assert.equal(result.usersCreated, 0);
      },
    );
    runtime = createDatabasePool(
      {
        nodeEnv: "production",
        databaseUrl: `postgresql://budograph_runtime:${password}@127.0.0.1:${port}/postgres`,
        databaseTls: { mode: "verify-full", caFile: join(root, "ca.pem") },
      },
      () => {},
      { max: 1 },
    );
    await check(
      "Disposable runtime password authenticates; identity and least privilege pass",
      async () => {
        const client = await runtime!.connect();
        try {
          await verifyProductionDatabaseIdentity(client, {
            databaseId: STAGING.databaseId,
            projectRef: STAGING.projectRef,
            environment: "staging",
          });
          assert.equal(
            (await client.query('SELECT count(*)::int n FROM public."user"'))
              .rows[0].n,
            0,
          );
        } finally {
          client.release(true);
        }
        assert.equal(
          new Date(
            (
              await db.query(
                "SELECT rolvaliduntil FROM pg_roles WHERE rolname='budograph_runtime'",
              )
            ).rows[0].rolvaliduntil,
          ).toISOString(),
          validUntil,
        );
      },
    );
  } finally {
    await runtime?.end();
    db.release(true);
  }
  return checks;
}
