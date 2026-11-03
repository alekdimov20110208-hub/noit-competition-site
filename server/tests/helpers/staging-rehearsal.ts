import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { fork, type ForkOptions } from "node:child_process";
import { writeFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import type { Pool } from "pg";
import {
  activateStaging,
  inspectStaging,
  pinnedMigrations,
  stagingFile,
  verifyStaging,
} from "../../src/staging/activation.ts";
import { STAGING, stagingOwnerTarget } from "../../src/staging/target.ts";
import { applicationCatalog, digest } from "../../src/staging/catalog.ts";
import { createDatabasePool } from "../../src/db/pool.ts";
import { guardProductionDatabasePool } from "../../src/db/identity.ts";
import { verifyProductionSchema } from "../../src/db/production-schema.ts";

export async function runStagingRehearsal({
  admin,
  root,
  port,
  clean,
}: {
  admin: Pool;
  root: string;
  port: number;
  passwords: Record<string, string>;
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
  const runtimePassword = randomBytes(32).toString("hex");
  let runtime: Pool | undefined;
  try {
    const initial = await inspectStaging(db);
    await check("Read-only empty PostgreSQL 17 catalog and TLS witness", () =>
      assert.equal(initial.witness.ssl, true),
    );
    await check(
      "Production ref/host/encoded usernames and arbitrary targets refused before network",
      () => {
        for (const url of [
          `postgresql://postgres:x@db.${STAGING.productionRef}.supabase.co/postgres`,
          `postgresql://postgres%2E${STAGING.productionRef}:x@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
          `postgresql://postgres:x@${STAGING.directHost}:6543/postgres`,
          `postgresql://postgres:x@${STAGING.directHost}/postgres?host=db.${STAGING.productionRef}.supabase.co`,
          `postgresql://budograph_runtime:x@${STAGING.directHost}/postgres`,
        ])
          assert.throws(() => stagingOwnerTarget(url, STAGING.directHost));
        stagingOwnerTarget(
          `postgresql://postgres:x@${STAGING.directHost}:5432/postgres`,
          STAGING.directHost,
        );
      },
    );
    await check(
      "Unknown table and migration history refuse clean bootstrap",
      async () => {
        for (const table of ["unknown_table", "schema_migrations"]) {
          await db.query(`CREATE TABLE public.${table}(id int)`);
          await assert.rejects(inspectStaging(db));
          await db.query(`DROP TABLE public.${table}`);
        }
      },
    );
    await check(
      "Provider ACL drift changes approved snapshot and stops before roles",
      async () => {
        await db.query("GRANT CREATE ON SCHEMA public TO anon");
        await assert.rejects(
          activateStaging(
            db,
            initial.fingerprint,
            runtimePassword,
            new Date(Date.now() + 86400000).toISOString(),
          ),
          /drift/,
        );
        await db.query("REVOKE CREATE ON SCHEMA public FROM anon");
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM pg_roles WHERE rolname='budograph_migrator'",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await check(
      "Modified SQL checksum refused before database writes",
      async () => {
        const directory = join(root, "modified-migrations");
        await mkdir(directory);
        const pins = await pinnedMigrations();
        for (const pin of pins)
          await copyFile(
            join("server/migrations", pin.name),
            join(directory, pin.name),
          );
        await writeFile(
          join(directory, pins[0]!.name),
          pins[0]!.sql + "\n-- altered locally\n",
        );
        await assert.rejects(pinnedMigrations(directory), /checksum mismatch/);
      },
    );
    await check(
      "Fresh activation uses existing runner: 16 original checksums + atomic staging overlay",
      async () => {
        const result = await activateStaging(
          db,
          initial.fingerprint,
          runtimePassword,
          new Date(Date.now() + 86400000).toISOString(),
        );
        assert.deepEqual(result.migrations, { applied: 16, alreadyApplied: 0 });
        assert.equal(result.verified.history.length, 16);
        assert.equal(result.verified.policies, 54);
      },
    );
    const identity = {
      databaseId: STAGING.databaseId,
      projectRef: STAGING.projectRef,
      environment: "staging" as const,
    };
    runtime = createDatabasePool(
      {
        nodeEnv: "production",
        databaseUrl: `postgresql://budograph_runtime:${runtimePassword}@127.0.0.1:${port}/postgres`,
        databaseTls: { mode: "verify-full", caFile: join(root, "ca.pem") },
      },
      () => {},
      { max: 1 },
    );
    guardProductionDatabasePool(runtime, identity);
    await check(
      "Real runtime LOGIN verifies TLS, identity, all 16 histories and least privilege",
      async () => {
        const schema = await verifyProductionSchema(
          runtime!,
          join(process.cwd(), "server/migrations"),
        );
        assert.deepEqual(schema, { recognized: 16, applied: 16 });
        for (const sql of [
          "CREATE TABLE public.forbidden(id int)",
          "UPDATE budograph_private.environment_identity SET project_ref='forbidden'",
          "SELECT * FROM budograph_private.email_outbox",
          "DELETE FROM public.schema_migrations",
        ])
          await assert.rejects(runtime!.query(sql));
      },
    );
    await check(
      "Overlay refuses replay, wrong project pin and conflicting identity",
      async () => {
        for (const ref of [STAGING.productionRef, STAGING.projectRef]) {
          await db.query("BEGIN");
          try {
            await db.query("SET LOCAL ROLE budograph_migrator");
            await db.query(
              "SELECT set_config('budograph.verified_project_ref',$1,true),set_config('budograph.staging_database_id',$2,true)",
              [ref, STAGING.databaseId],
            );
            await assert.rejects(
              db.query(await stagingFile("identity-overlay.sql")),
            );
          } finally {
            await db.query("ROLLBACK");
          }
        }
      },
    );
    const historyBefore = (
      await db.query("SELECT * FROM public.schema_migrations ORDER BY version")
    ).rows;
    const preload = join(root, "staging-offline.mjs");
    await writeFile(
      preload,
      `import net from 'node:net'; import {syncBuiltinESMExports} from 'node:module';
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(p,h,...rest){
  if(p===5432 && h==='${STAGING.directHost}') return connect.call(this,${port},'127.0.0.1',...rest);
  throw Error('Non-disposable network denied');
};
globalThis.fetch=async()=>{throw Error('Provider HTTP blocked');}; syncBuiltinESMExports();
process.on('message',m=>{if(m==='STOP'){process.emit('SIGTERM');process.disconnect();}});process.channel?.unref();`,
    );
    async function compiled(
      expectReady: boolean,
      override: NodeJS.ProcessEnv = {},
    ) {
      const socket = createServer();
      await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
      const httpPort = (socket.address() as { port: number }).port;
      await new Promise<void>((r) => socket.close(() => r()));
      const env = {
        ...clean,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(httpPort),
        BUDOGRAPH_DEPLOYMENT_ENV: "staging",
        DATABASE_URL: `postgresql://budograph_runtime:${runtimePassword}@${STAGING.directHost}:5432/postgres`,
        DATABASE_TLS_MODE: "verify-full",
        DATABASE_TLS_CA_FILE: join(root, "ca.pem"),
        EXPECTED_DATABASE_ID: STAGING.databaseId,
        EXPECTED_SUPABASE_PROJECT_REF: STAGING.projectRef,
        EXPECTED_DATABASE_HOST: STAGING.directHost,
        BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
        BETTER_AUTH_URL: "https://budograph-d23-disposable.onrender.com",
        PUBLIC_APP_URL: "https://budograph-d23-disposable.onrender.com",
        EMAIL_MODE: "resend",
        EMAIL_FROM: "staging@example.invalid",
        RESEND_API_KEY: "re_" + randomBytes(24).toString("hex"),
        RATE_LIMIT_HMAC_KEY: randomBytes(32).toString("base64"),
        EMAIL_OUTBOX_KEY_ID: "staging",
        EMAIL_OUTBOX_KEYS: JSON.stringify({
          staging: randomBytes(32).toString("base64"),
        }),
        SERVE_FRONTEND: "true",
        WEB_CONCURRENCY: "1",
        REMINDER_WORKER_ENABLED: "false",
        ...override,
      };
      const options: ForkOptions & { windowsHide: boolean } = {
        env,
        execArgv: ["--import", pathToFileURL(preload).href],
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        windowsHide: true,
      };
      const child = fork("server/dist/src/production.js", [], options);
      let output = "";
      child.stdout!.on("data", (b) => (output += b));
      child.stderr!.on("data", (b) => (output += b));
      const exited = new Promise((r) => child.once("exit", r));
      try {
        let ready = false;
        for (let n = 0; n < 120; n++) {
          if (child.exitCode !== null) break;
          try {
            ready =
              (await fetch(`http://127.0.0.1:${httpPort}/api/health/ready`))
                .status === 200;
          } catch {
            /* owned loopback only */
          }
          if (ready) break;
          await delay(100);
        }
        assert.equal(
          ready,
          expectReady,
          "Compiled staging readiness mismatch; secret-safe diagnostics",
        );
        if (expectReady) {
          child.send("STOP");
          assert.equal(
            await Promise.race([exited, delay(10000).then(() => -1)]),
            0,
          );
        } else {
          assert.equal(
            await Promise.race([exited, delay(10000).then(() => -1)]),
            1,
          );
        }
        for (const secret of [
          runtimePassword,
          env.BETTER_AUTH_SECRET,
          env.RESEND_API_KEY,
          env.RATE_LIMIT_HMAC_KEY,
        ])
          assert.equal(output.includes(secret), false);
      } finally {
        if (child.exitCode === null) {
          child.kill();
          await exited;
        }
      }
    }
    await check(
      "Compiled staging startup READY; no migrations or accounts at startup",
      async () => {
        await compiled(true);
        assert.deepEqual(
          (
            await db.query(
              "SELECT * FROM public.schema_migrations ORDER BY version",
            )
          ).rows,
          historyBefore,
        );
        assert.equal(
          (await db.query('SELECT count(*)::int n FROM public."user"')).rows[0]
            .n,
          0,
        );
      },
    );
    await check(
      "Compiled startup refuses Production UUID/config, Production origin and enabled reminders",
      async () => {
        for (const override of [
          { EXPECTED_DATABASE_ID: "00000000-0000-4000-8000-000000000001" },
          { EXPECTED_SUPABASE_PROJECT_REF: STAGING.productionRef },
          {
            BETTER_AUTH_URL: "https://budograph.com",
            PUBLIC_APP_URL: "https://budograph.com",
          },
          { REMINDER_WORKER_ENABLED: "true" },
        ])
          await compiled(false, override);
      },
    );
    await check(
      "Actual database wrong UUID and Production identity reject runtime + compiled startup",
      async () => {
        await db.query(
          "UPDATE budograph_private.environment_identity SET database_id='00000000-0000-4000-8000-000000000001'",
        );
        await assert.rejects(runtime!.query("SELECT 1"));
        await compiled(false);
        await db.query(
          "UPDATE budograph_private.environment_identity SET database_id=$1",
          [STAGING.databaseId],
        );
        await db.query(
          "ALTER TABLE budograph_private.environment_identity DROP CONSTRAINT environment_identity_environment_check; ALTER TABLE budograph_private.environment_identity ADD CHECK(environment='production') NOT VALID; UPDATE budograph_private.environment_identity SET environment='production'",
        );
        await assert.rejects(runtime!.query("SELECT 1"));
        await compiled(false);
        await db.query(
          "ALTER TABLE budograph_private.environment_identity DROP CONSTRAINT environment_identity_environment_check; ALTER TABLE budograph_private.environment_identity ADD CHECK(environment='staging') NOT VALID; UPDATE budograph_private.environment_identity SET environment='staging'; ALTER TABLE budograph_private.environment_identity VALIDATE CONSTRAINT environment_identity_environment_check",
        );
      },
    );
    await check(
      "Unsafe runtime privileges refuse checkout and compiled startup",
      async () => {
        await db.query("GRANT CREATE ON SCHEMA public TO budograph_runtime");
        await assert.rejects(runtime!.query("SELECT 1"));
        await compiled(false);
        await db.query("REVOKE CREATE ON SCHEMA public FROM budograph_runtime");
      },
    );
    await check(
      "Changed applied checksum refuses startup without running migration",
      async () => {
        await db.query(
          "UPDATE public.schema_migrations SET checksum=repeat('0',64) WHERE version='0016'",
        );
        await compiled(false);
        await db.query(
          "UPDATE public.schema_migrations SET checksum=$1 WHERE version='0016'",
          [historyBefore[15].checksum],
        );
      },
    );
    await check(
      "Final 16-checksum/RLS/policy/function/grant catalog and identity report",
      async () => {
        const report = await verifyStaging(db, "staging");
        assert.equal(report.history.length, 16);
        const reference = JSON.parse(
          await stagingFile("catalog-reference.json"),
        ).staging;
        assert.equal(digest(await applicationCatalog(db)), digest(reference));
      },
    );
    return checks;
  } finally {
    await runtime?.end();
    db.release();
  }
}
