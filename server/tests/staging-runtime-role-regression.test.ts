import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import { activateStaging, inspectStaging } from "../src/staging/activation.ts";
import { createDiagnostics } from "../src/staging/diagnostics.ts";
import { STAGING } from "../src/staging/target.ts";
import { verifyStagingClientTls } from "../src/staging/client-tls.ts";
import { offlineRuntimeMembership } from "./helpers/offline-runtime-membership.ts";

const blocked = () => {
  throw Error("Network forbidden in role regression tests.");
};
const originals = {
  net: net.Socket.prototype.connect,
  tls: tls.connect,
  dns: dns.lookup,
  fetch: globalThis.fetch,
};
test.before(() => {
  net.Socket.prototype.connect = blocked as typeof net.Socket.prototype.connect;
  tls.connect = blocked as typeof tls.connect;
  dns.lookup = blocked as unknown as typeof dns.lookup;
  globalThis.fetch = blocked as typeof globalThis.fetch;
});
test.after(() => {
  net.Socket.prototype.connect = originals.net;
  tls.connect = originals.tls;
  dns.lookup = originals.dns;
  globalThis.fetch = originals.fetch;
});
const password = "a".repeat(64);
const until = () => new Date(Date.now() + 86400000).toISOString();

test("PG17 missing SET reproduces 42501 before bootstrap COMMIT or migrations, retaining its SQL phase", async () => {
  for (const cleanupFailure of [false, true]) {
    const f = offlineRuntimeMembership({
      omitRuntimeSet: true,
      cleanupFailure,
    });
    try {
      verifyStagingClientTls(f.db, f.target);
      const initial = await inspectStaging(f.db);
      const d = createDiagnostics(false);
      await assert.rejects(
        activateStaging(f.db, initial.fingerprint, password, until(), d),
        { code: "42501" },
      );
      assert.equal(d.errorCode, "DATABASE_PERMISSION_DENIED");
      assert.equal(d.failurePhase, "bootstrap_runtime_role");
      assert.equal(f.state.roleChecks, 1);
      assert.equal(f.state.commits, 0);
      assert.equal(f.state.roles.size, 0);
      assert.ok(!f.calls.includes("SET ROLE budograph_migrator"));
      assert.ok(
        !f.calls.some((sql) =>
          /INSERT INTO public.schema_migrations|ALTER ROLE budograph_runtime PASSWORD/.test(
            sql,
          ),
        ),
      );
      assert.doesNotMatch(JSON.stringify(d), /SYNTHETIC_|postgresql:\/\//);
    } finally {
      f.stream.destroy();
    }
  }
});

test("Corrected bootstrap permits SET without inheritance and preserves ADMIN and runtime restrictions", async () => {
  const f = offlineRuntimeMembership();
  try {
    verifyStagingClientTls(f.db, f.target);
    const initial = await inspectStaging(f.db);
    await assert.rejects(
      activateStaging(f.db, initial.fingerprint, password, until()),
      (error) => error === f.afterBootstrap,
    );
    assert.deepEqual(f.state.runtimeMembership, {
      admin: true,
      inherit: false,
      set: true,
    });
    assert.equal(f.state.roleChecks, 1);
    assert.equal(f.state.commits, 1);
    for (const restriction of [
      "NOINHERIT",
      "NOSUPERUSER",
      "NOBYPASSRLS",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "CONNECTION LIMIT 4",
      "PASSWORD NULL",
      "VALID UNTIL '1970-01-01'",
    ])
      assert.ok(f.state.runtimeDefinition.includes(restriction));
    const manifest = JSON.parse(
      readFileSync("server/staging/package-manifest.json", "utf8"),
    );
    assert.equal(
      createHash("sha256")
        .update(readFileSync("server/staging/bootstrap.sql"))
        .digest("hex"),
      manifest.sha256["bootstrap.sql"],
    );
  } finally {
    f.stream.destroy();
  }
});

mkdirSync("tmp", { recursive: true });
const fixtures = mkdtempSync(resolve("tmp/d2-5-role-regression-"));
const poolUrl = pathToFileURL(resolve("server/src/db/pool.ts")).href;
const fixtureUrl = pathToFileURL(
  resolve("server/tests/helpers/offline-staging-client.ts"),
).href;
const activationUrl = pathToFileURL(
  resolve("server/src/staging/activation.ts"),
).href;
const script = resolve("server/scripts/staging-database.ts");
function cliCase(scenario: string, mode: "apply" | "verify" | "inspect") {
  const dir = join(fixtures, scenario);
  mkdirSync(join(dir, "tmp/d2-3"), { recursive: true });
  const ca = join(dir, "ca.txt");
  writeFileSync(ca, "SYNTHETIC_PUBLIC_CA");
  const report = join(dir, "tmp/d2-3/result.json");
  const preload = join(dir, "offline.mjs");
  const fakePool = `export function createDatabasePool(){return {connect:async()=>globalThis.__roleDb,end:async()=>{}};}`;
  writeFileSync(
    preload,
    `
import {registerHooks} from 'node:module';
import net from 'node:net';import tls from 'node:tls';import dns from 'node:dns';
const blocked=()=>{throw Error('Unexpected network')};net.Socket.prototype.connect=blocked;tls.connect=blocked;dns.lookup=blocked;globalThis.fetch=blocked;
import {offlineStagingClient} from ${JSON.stringify(fixtureUrl)};
import {inspectStaging} from ${JSON.stringify(activationUrl)};
const {db,stream}=offlineStagingClient(),read=db.query.bind(db),scenario=${JSON.stringify(scenario)};
process.env.STAGING_APPROVED_SNAPSHOT_SHA256=(await inspectStaging(db)).fingerprint;
const denied=()=>Object.assign(new Error('SYNTHETIC_SECRET_NOT_FOR_REPORT'),{code:'42501',detail:'SYNTHETIC_SECRET_NOT_FOR_REPORT'});
db.query=async(sql,values)=>{if(sql==='SET LOCAL ROLE budograph_runtime'||(scenario==='verify-permission'&&sql.startsWith('SELECT version,name,checksum')))throw denied();return read(sql,values)};
db.release=()=>{stream.destroy();queueMicrotask(()=>db.emit('end'));if(scenario==='permission-and-close'||scenario==='close-only')throw new Error('SYNTHETIC_SECRET_NOT_FOR_REPORT')};
globalThis.__roleDb=db;
registerHooks({load(url,context,next){if(url===${JSON.stringify(poolUrl)})return {format:'module',shortCircuit:true,source:${JSON.stringify(fakePool)}};return next(url,context)}});
`,
  );
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
        key,
      ),
    ),
  );
  const result = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(preload).href, script, mode],
    {
      cwd: dir,
      windowsHide: true,
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...clean,
        STAGING_OWNER_APPROVAL: `${mode}:${STAGING.projectRef}:${STAGING.databaseId}`,
        EXPECTED_SUPABASE_PROJECT_REF: STAGING.projectRef,
        EXPECTED_DATABASE_ID: STAGING.databaseId,
        EXPECTED_DATABASE_HOST: "aws-1-eu-central-1.pooler.supabase.com",
        STAGING_MIGRATOR_URL: `postgresql://postgres.${STAGING.projectRef}:SYNTHETIC_SECRET_NOT_FOR_REPORT@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
        DATABASE_TLS_MODE: "verify-full",
        DATABASE_TLS_CA_FILE: ca,
        STAGING_CA_SHA256: createHash("sha256")
          .update(readFileSync(ca))
          .digest("hex"),
        STAGING_REPORT_FILE: report,
        STAGING_RUNTIME_PASSWORD: password,
        STAGING_RUNTIME_VALID_UNTIL: until(),
      },
    },
  );
  assert.equal(result.status, 1);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /SYNTHETIC_SECRET_NOT_FOR_REPORT|postgresql:\/\//,
  );
  const saved = JSON.parse(readFileSync(report, "utf8"));
  const stdout = JSON.parse(result.stdout.trim());
  assert.equal(saved.failurePhase, stdout.failurePhase);
  assert.doesNotMatch(
    JSON.stringify(saved),
    /SYNTHETIC_SECRET_NOT_FOR_REPORT|"stack"|"detail"/,
  );
  return saved;
}
test("Actual apply CLI reports bootstrap_runtime_role 42501 with confirmed connection close", () => {
  const d = cliCase("permission", "apply");
  assert.equal(d.failurePhase, "bootstrap_runtime_role");
  assert.equal(d.errorCode, "DATABASE_PERMISSION_DENIED");
  assert.equal(d.connectionCloseStatus, "confirmed");
  assert.equal(d.connectionCloseErrorCode, "NONE");
});
test("Actual apply CLI keeps primary SQL denial when release also fails", () => {
  const d = cliCase("permission-and-close", "apply");
  assert.equal(d.failurePhase, "bootstrap_runtime_role");
  assert.equal(d.errorCode, "DATABASE_PERMISSION_DENIED");
  assert.equal(d.connectionCloseStatus, "failed");
  assert.equal(d.connectionCloseErrorCode, "CONNECTION_CLOSE_FAILED");
});
test("CLI records a SQL failure before its finally, including operations without engine diagnostics", () => {
  const d = cliCase("verify-permission", "verify");
  assert.equal(d.failurePhase, "operation");
  assert.equal(d.errorCode, "DATABASE_PERMISSION_DENIED");
  assert.equal(d.connectionCloseStatus, "confirmed");
});
test("An actual release-only failure is still correctly labelled connection_close", () => {
  const d = cliCase("close-only", "inspect");
  assert.equal(d.failurePhase, "connection_close");
  assert.equal(d.errorCode, "CONNECTION_CLOSE_FAILED");
});
