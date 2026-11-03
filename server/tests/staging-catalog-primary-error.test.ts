// Offline only: real catalog/inspect/CLI code, in-memory clients, blocked sockets.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import ts from "typescript";
import { inspectStaging } from "../src/staging/activation.ts";
import { applicationCatalog } from "../src/staging/catalog.ts";
import {
  catalogOperations,
  createDiagnostics,
  safeSqlstate,
  type CatalogOperation,
} from "../src/staging/diagnostics.ts";
import { databaseLease } from "../src/db/lease.ts";
import { verifyStagingClientTls } from "../src/staging/client-tls.ts";
import { STAGING } from "../src/staging/target.ts";
import { offlineStagingClient } from "./helpers/offline-staging-client.ts";

const secret = "SYNTHETIC_CATALOG_SECRET_NOT_FOR_REPORT";
const error = (code: string) =>
  Object.assign(new Error(secret), {
    code,
    detail: secret,
    parameters: [secret],
  });
const originals = {
  net: net.Socket.prototype.connect,
  tls: tls.connect,
  dns: dns.lookup,
  fetch: globalThis.fetch,
};
const blocked = () => {
  throw Error("Network forbidden in catalog regression.");
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

function fixture(
  options: {
    fail?: CatalogOperation;
    primary?: unknown;
    restoreFailure?: unknown;
    rollbackFailure?: unknown;
    leased?: boolean;
    nonempty?: boolean;
  } = {},
) {
  const f = offlineStagingClient(),
    d = createDiagnostics(true);
  const read = f.db.query.bind(f.db),
    seen: (CatalogOperation | null)[] = [];
  const primary = Object.hasOwn(options, "primary")
    ? options.primary
    : error("57014");
  let fired = false,
    releases = 0;
  f.db.query = (async (sql: string, values?: unknown[]) => {
    if (sql === "ROLLBACK") {
      if (options.rollbackFailure) throw options.rollbackFailure;
      return { command: "ROLLBACK", rows: [] };
    }
    if (sql.startsWith("SELECT")) seen.push(d.catalogOperation);
    if (!fired && options.fail === d.catalogOperation) {
      fired = true;
      throw primary;
    }
    if (d.catalogOperation === "search_path_restore" && options.restoreFailure)
      throw options.restoreFailure;
    if (options.nonempty && d.catalogOperation === "application_tables")
      return { rows: [{ relname: "unexpected" }] };
    if (d.catalogOperation === "migration_history_relation")
      return { rows: [{ history: "supabase_migrations.schema_migrations" }] };
    if (d.catalogOperation === "migration_history_count")
      return { rows: [{ n: 0 }] };
    return read(sql, values);
  }) as typeof f.db.query;
  f.db.release = () => {
    releases++;
    f.stream.destroy();
    queueMicrotask(() => f.db.emit("end"));
  };
  const db = options.leased ? databaseLease(f.db) : f.db;
  verifyStagingClientTls(db, f.target, d);
  return { ...f, db, d, seen, primary, releases: () => releases };
}
const noSecrets = (value: unknown) =>
  assert.doesNotMatch(
    JSON.stringify(value),
    /SYNTHETIC_CATALOG_SECRET|postgresql:\/\/|"stack"|"detail"|"parameters"|FROM pg_class/,
  );

test("All 26 catalog SQL statements remain identical and in their original order", () => {
  const source = ts.createSourceFile(
    "catalog.ts",
    readFileSync("server/src/staging/catalog.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const statements: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      /^SELECT\b/.test(node.text)
    )
      statements.push(node.text.replace(/\r\n/g, "\n"));
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(statements.length, 26);
  assert.equal(
    createHash("sha256").update(JSON.stringify(statements)).digest("hex"),
    "c333da8125f75d256ef0f8bcc6839ec96ca0cbde555c1ee0381c72e234a8ec0b",
  );
});
test("Every catalog SQL operation has a fixed ID; successful restoration and rollback are separate", async () => {
  const f = fixture();
  try {
    await inspectStaging(f.db, f.d);
    assert.deepEqual(
      new Set(f.seen),
      new Set(
        catalogOperations.filter((id) => id !== "application_empty_check"),
      ),
    );
    assert.equal(f.d.failureOperation, null);
    assert.equal(f.d.sqlstate, null);
    assert.equal(f.d.searchPathRestorationStatus, "confirmed");
    assert.equal(f.d.rollbackStatus, "confirmed");
  } finally {
    f.stream.destroy();
  }
});
test("An injected SQL error at each of the 26 operations retains its exact exception, ID and SQLSTATE", async () => {
  for (const id of catalogOperations.filter(
    (id) => id !== "application_empty_check",
  )) {
    const f = fixture({ fail: id });
    try {
      await assert.rejects(inspectStaging(f.db, f.d), (e) => e === f.primary);
      assert.equal(f.d.failureOperation, id);
      assert.equal(f.d.sqlstate, "57014");
      assert.equal(
        f.d.failurePhase,
        id === "server_witness" ? "server_witness" : "catalog",
      );
      assert.equal(f.d.rollbackStatus, "confirmed");
      noSecrets(f.d);
    } finally {
      f.stream.destroy();
    }
  }
});
test("Primary 42501 survives both search_path 25P02 and rollback 08006 failures", async () => {
  const f = fixture({
    fail: "application_tables",
    primary: error("42501"),
    restoreFailure: error("25P02"),
    rollbackFailure: error("08006"),
  });
  try {
    await assert.rejects(inspectStaging(f.db, f.d), (e) => e === f.primary);
    assert.equal(f.d.failurePhase, "catalog");
    assert.equal(f.d.failureOperation, "application_tables");
    assert.equal(f.d.errorCode, "DATABASE_PERMISSION_DENIED");
    assert.equal(f.d.sqlstate, "42501");
    assert.equal(f.d.searchPathRestorationStatus, "failed");
    assert.equal(f.d.searchPathRestorationSqlstate, "25P02");
    assert.equal(f.d.rollbackStatus, "failed");
    assert.equal(f.d.rollbackErrorCode, "ROLLBACK_FAILED");
    assert.equal(f.d.rollbackSqlstate, "08006");
    noSecrets(f.d);
  } finally {
    f.stream.destroy();
  }
});
test("Falsy primary exceptions are also preserved through secondary cleanup failures", async () => {
  for (const primary of [undefined, null, false]) {
    const f = fixture({
      fail: "application_tables",
      primary,
      restoreFailure: error("25P02"),
      rollbackFailure: error("08006"),
    });
    try {
      let resolved = false,
        caught: unknown = Symbol("uncaught");
      try {
        await inspectStaging(f.db, f.d);
        resolved = true;
      } catch (e) {
        caught = e;
      }
      assert.equal(resolved, false);
      assert.equal(caught, primary);
      assert.equal(f.d.failureOperation, "application_tables");
      assert.equal(f.d.sqlstate, null);
    } finally {
      f.stream.destroy();
    }
  }
});
test("Preserving the primary exception also works without a diagnostics object", async () => {
  for (const inspect of [false, true]) {
    const primary = error("42501"),
      f = offlineStagingClient();
    const read = f.db.query.bind(f.db);
    f.db.query = (async (sql: string, values?: unknown[]) => {
      if (sql.startsWith("SELECT n.nspname,c.relname,c.relkind")) throw primary;
      if (sql.startsWith("SELECT set_config('search_path',$1"))
        throw error("25P02");
      if (sql === "ROLLBACK") throw error("08006");
      return read(sql, values);
    }) as typeof f.db.query;
    try {
      await assert.rejects(
        inspect ? inspectStaging(f.db) : applicationCatalog(f.db),
        (e) => e === primary,
      );
    } finally {
      f.stream.destroy();
    }
  }
});
test("Client query timeout remains the primary exception after the real lease destroys itself", async () => {
  const primary = new Error("Query read timeout"),
    f = fixture({ fail: "application_tables", primary, leased: true });
  try {
    await assert.rejects(inspectStaging(f.db, f.d), (e) => e === primary);
    assert.equal(f.releases(), 1);
    assert.equal(f.d.failureOperation, "application_tables");
    assert.equal(f.d.sqlstate, null);
    assert.equal(f.d.searchPathRestorationStatus, "failed");
    assert.equal(f.d.rollbackStatus, "failed");
    noSecrets(f.d);
  } finally {
    f.db.release(true);
    f.stream.destroy();
  }
});
test("A sole restoration or rollback failure is still fatal and gets its own phase and SQLSTATE", async () => {
  for (const cleanup of ["restore", "rollback"]) {
    const primary = error("42501"),
      f = fixture(
        cleanup === "restore"
          ? { restoreFailure: primary }
          : { rollbackFailure: primary },
      );
    try {
      await assert.rejects(inspectStaging(f.db, f.d), (e) => e === primary);
      assert.equal(f.d.sqlstate, "42501");
      assert.equal(
        f.d.failurePhase,
        cleanup === "restore" ? "catalog" : "rollback",
      );
      assert.equal(
        f.d.failureOperation,
        cleanup === "restore" ? "search_path_restore" : null,
      );
    } finally {
      f.stream.destroy();
    }
  }
});
test("Catalog validation failures retain a fixed check ID after successful restoration", async () => {
  const f = fixture({ nonempty: true });
  try {
    await assert.rejects(inspectStaging(f.db, f.d));
    assert.equal(f.d.failureOperation, "application_empty_check");
    assert.equal(f.d.errorCode, "CATALOG_VERIFICATION_FAILED");
    assert.equal(f.d.searchPathRestorationStatus, "confirmed");
    assert.equal(f.d.rollbackStatus, "confirmed");
  } finally {
    f.stream.destroy();
  }
});
test("SQLSTATE extraction rejects Node codes, malformed values and getters without leaking error text", () => {
  for (const code of ["42501", "57014", "25P02", "08006", "P0001", "XX000"])
    assert.equal(safeSqlstate(error(code)), code);
  for (const code of [
    "EPIPE",
    "E2BIG",
    "ETIMEDOUT",
    "SECRE",
    secret,
    "42501\n",
  ])
    assert.equal(safeSqlstate(error(code)), null);
  assert.equal(safeSqlstate({ code: "ZZ999", severity: "ERROR" }), "ZZ999");
  let reads = 0;
  assert.equal(
    safeSqlstate({
      get code() {
        reads++;
        throw Error(secret);
      },
    }),
    null,
  );
  assert.equal(reads, 0);
});

mkdirSync("tmp", { recursive: true });
const root = mkdtempSync(resolve("tmp/d2-5-primary-error-tests-"));
function cliCase(scenario: "primary_and_cleanup" | "query_timeout") {
  const dir = join(root, scenario);
  mkdirSync(join(dir, "tmp/d2-3"), { recursive: true });
  const ca = join(dir, "ca.txt"),
    report = join(dir, "tmp/d2-3/report.json"),
    preload = join(dir, "offline.mjs");
  writeFileSync(ca, "SYNTHETIC_PUBLIC_CA");
  const poolUrl = pathToFileURL(resolve("server/src/db/pool.ts")).href;
  const clientUrl = pathToFileURL(
    resolve("server/tests/helpers/offline-staging-client.ts"),
  ).href;
  const leaseUrl = pathToFileURL(resolve("server/src/db/lease.ts")).href;
  const fakePool =
    "export function createDatabasePool(){return {connect:async()=>globalThis.__catalogDb,end:async()=>{}}}";
  writeFileSync(
    preload,
    `
import {registerHooks} from 'node:module';import net from 'node:net';import tls from 'node:tls';import dns from 'node:dns';
const blocked=()=>{throw Error('Forbidden network')};net.Socket.prototype.connect=blocked;tls.connect=blocked;dns.lookup=blocked;globalThis.fetch=blocked;
import {offlineStagingClient} from ${JSON.stringify(clientUrl)};import {databaseLease} from ${JSON.stringify(leaseUrl)};
const {db,stream}=offlineStagingClient(),read=db.query.bind(db),scenario=${JSON.stringify(scenario)};
const e=code=>Object.assign(new Error(${JSON.stringify(secret)}),{code,detail:${JSON.stringify(secret)},parameters:[${JSON.stringify(secret)}]});
db.query=async(sql,values)=>{if(sql.startsWith('SELECT n.nspname,c.relname,c.relkind'))throw scenario==='query_timeout'?new Error('Query read timeout'):e('42501');if(sql.startsWith("SELECT set_config('search_path',$1"))throw e('25P02');if(sql==='ROLLBACK')throw e('08006');return read(sql,values)};
db.release=()=>{stream.destroy();queueMicrotask(()=>db.emit('end'))};globalThis.__catalogDb=databaseLease(db);
registerHooks({load(url,context,next){if(url===${JSON.stringify(poolUrl)})return {format:'module',shortCircuit:true,source:${JSON.stringify(fakePool)}};return next(url,context)}});
`,
  );
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([k]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
        k,
      ),
    ),
  );
  const r = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(preload).href,
      resolve("server/scripts/staging-database.ts"),
      "apply",
    ],
    {
      cwd: dir,
      windowsHide: true,
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...clean,
        STAGING_OWNER_APPROVAL: `apply:${STAGING.projectRef}:${STAGING.databaseId}`,
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
        STAGING_RUNTIME_PASSWORD: "a".repeat(64),
        STAGING_RUNTIME_VALID_UNTIL: new Date(
          Date.now() + 86400000,
        ).toISOString(),
        STAGING_APPROVED_SNAPSHOT_SHA256: "0".repeat(64),
      },
    },
  );
  assert.equal(r.status, 1);
  assert.doesNotMatch(
    r.stdout + r.stderr,
    /SYNTHETIC_CATALOG_SECRET|postgresql:\/\//,
  );
  const saved = JSON.parse(readFileSync(report, "utf8")),
    stdout = JSON.parse(r.stdout.trim());
  assert.equal(saved.failureOperation, stdout.failureOperation);
  assert.equal(saved.sqlstate, stdout.sqlstate);
  noSecrets(saved);
  return saved;
}
test("Actual CLI report retains primary SQLSTATE/operation and both secondary cleanup outcomes", () => {
  const d = cliCase("primary_and_cleanup");
  assert.equal(d.failurePhase, "catalog");
  assert.equal(d.failureOperation, "application_tables");
  assert.equal(d.sqlstate, "42501");
  assert.equal(d.searchPathRestorationStatus, "failed");
  assert.equal(d.searchPathRestorationSqlstate, "25P02");
  assert.equal(d.rollbackStatus, "failed");
  assert.equal(d.rollbackSqlstate, "08006");
  assert.equal(d.connectionCloseStatus, "confirmed");
});
test("Actual CLI report preserves a code-less query timeout without falsely claiming a SQLSTATE", () => {
  const d = cliCase("query_timeout");
  assert.equal(d.failurePhase, "catalog");
  assert.equal(d.failureOperation, "application_tables");
  assert.equal(d.sqlstate, null);
  assert.equal(d.searchPathRestorationStatus, "failed");
  assert.equal(d.rollbackStatus, "failed");
  assert.equal(d.connectionCloseStatus, "confirmed");
});
