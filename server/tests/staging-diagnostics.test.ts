import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { safeErrorCode } from "../src/staging/diagnostics.ts";
import { STAGING } from "../src/staging/target.ts";

const secret = "SYNTHETIC_DIAGNOSTIC_SECRET";
const root = resolve("tmp");
mkdirSync(root, { recursive: true });
const fixtures = mkdtempSync(join(root, "d2-4-1-cli-"));
const script = resolve("server/scripts/staging-database.ts");
const poolUrl = pathToFileURL(resolve("server/src/db/pool.ts")).href;
const offlineClientUrl = pathToFileURL(
  resolve("server/tests/helpers/offline-staging-client.ts"),
).href;

function runCase(scenario: string, override: Record<string, string> = {}) {
  const dir = join(fixtures, scenario);
  mkdirSync(join(dir, "tmp/d2-3"), { recursive: true });
  const ca = join(dir, "synthetic-ca.txt");
  writeFileSync(ca, "SYNTHETIC PUBLIC CA FIXTURE");
  const report = join(dir, "tmp/d2-3/report.json");
  const source = `
    import {offlineStagingClient} from ${JSON.stringify(offlineClientUrl)};
    export function createDatabasePool() {
      const scenario=${JSON.stringify(scenario)};
      const error=code=>Object.assign(new Error(${JSON.stringify(secret)}),{code,detail:${JSON.stringify(secret)},stack:${JSON.stringify(secret)}});
      const {db,stream}=offlineStagingClient();
      db.query=async sql=>{
        if (sql==='ROLLBACK') {
          if(scenario==='rollback'||scenario==='catalog-rollback')throw error('SYNTHETIC_UNKNOWN');
          return {command:scenario==='rollback-unacknowledged'?'UNKNOWN':'ROLLBACK',rows:[]};
        }
        if(sql.startsWith('BEGIN'))return {command:'BEGIN',rows:[]};
        if(sql.includes('pg_control_system')) {
          if(scenario==='permission')throw error('42501');
          return {rows:[{database:'postgres',session_user:'postgres',current_user:'postgres',version:'170011',cluster:'fixture',system_id:'123',ssl:true,tls_protocol:'TLSv1.3',tls_cipher:'fixture'}]};
        }
        if(sql.includes("current_setting('search_path')"))return {rows:[{path:'public'}]};
        if(sql.includes("SELECT to_regclass("))return {rows:[{history:null}]};
        if((scenario==='catalog'||scenario==='catalog-rollback') && sql.includes("SELECT rolname FROM pg_roles"))return {rows:[{rolname:'budograph_unexpected'}]};
        if(scenario==='catalog-query' && sql.includes("SELECT rolname FROM pg_roles"))throw error('SYNTHETIC_UNKNOWN');
        return {rows:[]};
      };
      db.release=()=>{if(scenario!=='close-unobserved')queueMicrotask(()=>db.emit('end'));};
      return {
        connect:async()=>{
          if(scenario==='tls')throw error('SELF_SIGNED_CERT_IN_CHAIN');
          if(scenario==='auth')throw error('28P01');
          if(scenario==='connection')throw error('ECONNREFUSED');
          if(scenario==='ambiguous')throw error('SYNTHETIC_UNKNOWN');
          return db;
        },
        end:async()=>{stream.destroy();if(scenario==='close-failed')throw error('SYNTHETIC_UNKNOWN');}
      };
    }
  `;
  const preload = join(dir, "offline.mjs");
  writeFileSync(
    preload,
    `
    import {registerHooks} from 'node:module';
    import net from 'node:net';import tls from 'node:tls';import dns from 'node:dns';
    const blocked=()=>{process.stderr.write('UNEXPECTED_NETWORK');process.exit(91);};
    net.Socket.prototype.connect=blocked;tls.connect=blocked;dns.lookup=blocked;globalThis.fetch=blocked;
    registerHooks({load(url,context,next){
      if(url===${JSON.stringify(poolUrl)})return {format:'module',shortCircuit:true,source:${JSON.stringify(source)}};
      return next(url,context);
    }});
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
    ["--import", pathToFileURL(preload).href, script, "inspect"],
    {
      cwd: dir,
      windowsHide: true,
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...clean,
        STAGING_OWNER_APPROVAL: `inspect:${STAGING.projectRef}:${STAGING.databaseId}`,
        EXPECTED_SUPABASE_PROJECT_REF: STAGING.projectRef,
        EXPECTED_DATABASE_ID: STAGING.databaseId,
        EXPECTED_DATABASE_HOST: "aws-1-eu-central-1.pooler.supabase.com",
        STAGING_MIGRATOR_URL: `postgresql://postgres.${STAGING.projectRef}:${secret}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
        DATABASE_TLS_MODE: "verify-full",
        DATABASE_TLS_CA_FILE: ca,
        STAGING_CA_SHA256: createHash("sha256")
          .update(readFileSync(ca))
          .digest("hex"),
        STAGING_REPORT_FILE: report,
        ...override,
      },
    },
  );
  const output = result.stdout + result.stderr;
  assert.doesNotMatch(
    output,
    /UNEXPECTED_NETWORK|SYNTHETIC_DIAGNOSTIC_SECRET|postgresql:\/\//,
  );
  const diagnostic = JSON.parse(result.stdout.trim());
  let saved: typeof diagnostic | undefined;
  try {
    saved = JSON.parse(readFileSync(report, "utf8"));
  } catch {
    /* report-open refusal */
  }
  if (saved)
    assert.doesNotMatch(
      JSON.stringify(saved),
      /SYNTHETIC_DIAGNOSTIC_SECRET|postgresql:\/\/|"stack"|"detail"|"parameters"/,
    );
  return { result, diagnostic, saved };
}

for (const [scenario, code, phase] of [
  ["tls", "TLS_FAILURE", "connect"],
  ["auth", "AUTHENTICATION_FAILED", "connect"],
  ["connection", "CONNECTION_FAILED", "connect"],
  ["ambiguous", "UNKNOWN", "connect"],
  ["permission", "DATABASE_PERMISSION_DENIED", "server_witness"],
  ["catalog", "CATALOG_VERIFICATION_FAILED", "catalog"],
  ["catalog-query", "UNKNOWN", "catalog"],
  ["rollback", "ROLLBACK_FAILED", "rollback"],
  ["close-failed", "CONNECTION_CLOSE_FAILED", "connection_close"],
  ["close-unobserved", "CONNECTION_CLOSE_UNCONFIRMED", "connection_close"],
] as const) {
  test(`Offline CLI: ${scenario}; no secrets or network`, () => {
    const { result, diagnostic, saved } = runCase(scenario);
    assert.equal(result.status, 1);
    assert.equal(diagnostic.errorCode, code);
    assert.equal(diagnostic.failurePhase, phase);
    assert.equal(saved.errorCode, code);
    assert.equal(
      diagnostic.status,
      code === "UNKNOWN" ? "FAILED_OR_UNKNOWN" : "STOP",
    );
    if (phase === "connect") {
      assert.equal(diagnostic.connectionEstablished, "unknown");
      assert.equal(diagnostic.rollbackStatus, "not_attempted");
    } else {
      assert.equal(diagnostic.connectionEstablished, true);
      assert.equal(
        diagnostic.rollbackStatus,
        scenario === "rollback" ? "failed" : "confirmed",
      );
    }
    if (scenario === "close-unobserved")
      assert.equal(diagnostic.connectionCloseStatus, "unknown");
  });
}
test("Offline CLI: success requires command acknowledgements and observed client end", () => {
  const { result, diagnostic, saved } = runCase("success");
  assert.equal(result.status, 0);
  assert.equal(saved.status, "PASS");
  assert.equal(diagnostic.rollbackStatus, "confirmed");
  assert.equal(diagnostic.connectionCloseStatus, "confirmed");
  assert.equal(diagnostic.observations.clientEndObserved, true);
  assert.match(saved.report.fingerprint, /^[a-f0-9]{64}$/);
});
test("Offline CLI: resolved ROLLBACK without command tag is not confirmation", () => {
  const { result, diagnostic } = runCase("rollback-unacknowledged");
  assert.equal(result.status, 1);
  assert.equal(diagnostic.rollbackStatus, "unknown");
  assert.equal(diagnostic.status, "FAILED_OR_UNKNOWN");
});
test("Offline CLI: Production is refused before any pool creation", () => {
  const { result, diagnostic, saved } = runCase("production-guard", {
    EXPECTED_SUPABASE_PROJECT_REF: STAGING.productionRef,
  });
  assert.equal(result.status, 1);
  assert.equal(diagnostic.failurePhase, "identity");
  assert.equal(diagnostic.connectionEstablished, false);
  assert.equal(saved, undefined);
});
test("Classifier does not guess from error messages or serialize hostile getters", () => {
  assert.equal(
    safeErrorCode(new Error("password authentication failed TLS certificate")),
    "UNKNOWN",
  );
  assert.equal(
    safeErrorCode({
      get code() {
        throw Error(secret);
      },
    }),
    "UNKNOWN",
  );
});

test("Offline CLI: rollback failure retains the original catalog failure", () => {
  const { diagnostic } = runCase("catalog-rollback");
  assert.equal(diagnostic.failurePhase, "catalog");
  assert.equal(diagnostic.errorCode, "CATALOG_VERIFICATION_FAILED");
  assert.equal(diagnostic.rollbackStatus, "failed");
  assert.equal(diagnostic.rollbackErrorCode, "ROLLBACK_FAILED");
});
