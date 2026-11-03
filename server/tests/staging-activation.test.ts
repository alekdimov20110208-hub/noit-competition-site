import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  STAGING,
  assertStagingIdentity,
  stagingOwnerTarget,
} from "../src/staging/target.ts";
import { pinnedMigrations } from "../src/staging/activation.ts";

test("D2.3 pins one unique UUIDv4/project and all 16 immutable checksums", async () => {
  assert.match(
    STAGING.databaseId,
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
  assert.notEqual(STAGING.projectRef, STAGING.productionRef);
  assert.equal((await pinnedMigrations()).length, 16);
  assertStagingIdentity(STAGING.projectRef, STAGING.databaseId);
  for (const id of [
    "00000000-0000-4000-8000-000000000001",
    "5d6d11b5-a836-46ac-9b99-069f9af60418",
    "3ffd42da-c299-495a-81c8-1c5c96e7f915",
  ])
    assert.throws(() => assertStagingIdentity(STAGING.projectRef, id));
});

test("Owner URL direct/session allowlist excludes Production and override aliases", () => {
  const session = "aws-0-eu-central-1.pooler.supabase.com";
  stagingOwnerTarget(
    `postgresql://postgres.${STAGING.projectRef}:test@${session}/postgres`,
    session,
  );
  for (const url of [
    `postgresql://postgres.${STAGING.productionRef}:test@${session}/postgres`,
    `postgresql://postgres%2E${STAGING.productionRef}:test@${session}/postgres`,
    `postgresql://postgres:test@db.${STAGING.productionRef}.supabase.co/postgres`,
    `postgresql://postgres.${STAGING.projectRef}:test@${session}:6543/postgres`,
    `postgresql://postgres.${STAGING.projectRef}:test@${session}/postgres?sslmode=disable`,
  ])
    assert.throws(() => stagingOwnerTarget(url, session));
});

test("Real staging CLI refuses missing approval, Production target/ref/UUID, ambient credentials before network", () => {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([k]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
        k,
      ),
    ),
  );
  const blocked =
    "data:text/javascript," +
    encodeURIComponent(
      `import net from 'node:net';import tls from 'node:tls';const stop=()=>{process.stderr.write('UNEXPECTED_NETWORK');process.exit(91);};net.Socket.prototype.connect=stop;tls.connect=stop;globalThis.fetch=stop;`,
    );
  const base = {
    ...clean,
    STAGING_OWNER_APPROVAL: `apply:${STAGING.projectRef}:${STAGING.databaseId}`,
    EXPECTED_SUPABASE_PROJECT_REF: STAGING.projectRef,
    EXPECTED_DATABASE_ID: STAGING.databaseId,
    EXPECTED_DATABASE_HOST: STAGING.directHost,
    STAGING_MIGRATOR_URL: `postgresql://postgres:test@${STAGING.directHost}/postgres`,
  };
  for (const override of [
    { STAGING_OWNER_APPROVAL: "" },
    { EXPECTED_SUPABASE_PROJECT_REF: STAGING.productionRef },
    { EXPECTED_DATABASE_ID: "00000000-0000-4000-8000-000000000001" },
    {
      STAGING_MIGRATOR_URL: `postgresql://postgres:test@db.${STAGING.productionRef}.supabase.co/postgres`,
    },
    {
      STAGING_MIGRATOR_URL: `postgresql://postgres%2E${STAGING.productionRef}:test@aws-0-eu-central-1.pooler.supabase.com/postgres`,
    },
    { DATABASE_URL: "ambient-refused" },
    { PGOPTIONS: "-c role=postgres" },
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--import", blocked, "server/scripts/staging-database.ts", "apply"],
      {
        env: { ...base, ...override },
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
      },
    );
    assert.equal(result.status, 1);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /UNEXPECTED_NETWORK|postgresql:\/\//,
    );
  }
});
