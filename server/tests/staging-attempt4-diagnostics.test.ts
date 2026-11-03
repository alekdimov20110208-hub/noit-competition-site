// Offline only: actual activation code with in-memory responses; sockets blocked.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import { activateStaging, inspectStaging } from "../src/staging/activation.ts";
import { createDiagnostics } from "../src/staging/diagnostics.ts";
import { verifyStagingClientTls } from "../src/staging/client-tls.ts";
import { offlineStagingClient } from "./helpers/offline-staging-client.ts";

const blocked = () => {
  throw Error("Network forbidden in Attempt 4 regressions.");
};
net.Socket.prototype.connect = blocked as typeof net.Socket.prototype.connect;
tls.connect = blocked as typeof tls.connect;
dns.lookup = blocked as unknown as typeof dns.lookup;
globalThis.fetch = blocked as typeof globalThis.fetch;
const failure = (code: string) =>
  Object.assign(new Error("SYNTHETIC_PRIVATE_ERROR"), { code });

async function fixture(
  kind:
    "bootstrap" | "migration_lock" | "migration_sql" | "falsy" | "locked_drift",
) {
  const f = offlineStagingClient(),
    d = createDiagnostics(false);
  verifyStagingClientTls(f.db, f.target, d);
  const approved = (await inspectStaging(f.db)).fingerprint;
  f.calls.length = 0;
  const read = f.db.query.bind(f.db);
  const primary =
    kind === "falsy"
      ? undefined
      : failure(kind === "migration_lock" ? "57014" : "42501");
  const manifest = JSON.parse(
    readFileSync("server/migrations/production-manifest.json", "utf8"),
  );
  const firstSql = readFileSync(
    "server/migrations/" + manifest.pins[0].name,
    "utf8",
  );
  let failed = false,
    snapshots = 0;
  f.db.query = (async (sql: string, values?: unknown[]) => {
    if (sql.startsWith("BEGIN ISOLATION")) {
      snapshots++;
      if (kind === "locked_drift" && snapshots === 2) f.row.cluster = "changed";
    }
    if (
      ((kind === "bootstrap" || kind === "falsy") &&
        sql === "SET LOCAL ROLE budograph_runtime") ||
      (kind === "migration_lock" &&
        sql === "SELECT pg_catalog.pg_advisory_lock($1, $2)") ||
      (kind === "migration_sql" && sql === firstSql)
    ) {
      failed = true;
      throw primary;
    }
    if (failed && sql === "ROLLBACK") throw failure("08006");
    if (failed && sql === "RESET ROLE" && kind !== "migration_lock")
      throw failure("25P02");
    if (failed && sql === "SELECT pg_advisory_unlock(1112884303,1196573008)")
      throw failure("08006");
    if (sql.startsWith("SELECT has_database_privilege"))
      return { rows: [{ unsafe: false }] };
    if (
      sql ===
      "SELECT pg_catalog.to_regclass('public.schema_migrations') AS metadata_table"
    )
      return { rows: [{ metadata_table: null }] };
    return read(sql, values);
  }) as typeof f.db.query;
  const run = () =>
    activateStaging(
      f.db,
      approved,
      "a".repeat(64),
      new Date(Date.now() + 86400000).toISOString(),
      d,
    );
  return { ...f, d, primary, run };
}

test("Bootstrap primary error survives failed transaction rollback and failed activation cleanup", async () => {
  const f = await fixture("bootstrap");
  try {
    await assert.rejects(f.run(), (e) => e === f.primary);
    assert.equal(f.d.failurePhase, "bootstrap_runtime_role");
    assert.equal(f.d.sqlstate, "42501");
    assert.equal(f.d.failureOperation, null);
    assert.equal(f.d.rollbackStatus, "failed");
    assert.equal(f.d.rollbackSqlstate, "08006");
    assert.equal(f.d.activationCleanup.resetRole.status, "failed");
    assert.equal(f.d.activationCleanup.resetRole.sqlstate, "25P02");
    assert.equal(f.d.activationCleanup.advisoryUnlock.status, "not_attempted");
  } finally {
    f.stream.destroy();
  }
});

test("Migration SQLSTATE is captured before the original runner sanitizes the exception", async () => {
  const f = await fixture("migration_lock");
  try {
    await assert.rejects(f.run());
    assert.equal(f.d.failurePhase, "migrations");
    assert.equal(f.d.sqlstate, "57014");
    assert.equal(f.d.activationCleanup.resetRole.status, "confirmed");
    assert.equal(f.d.activationCleanup.advisoryUnlock.status, "failed");
    assert.equal(f.d.activationCleanup.advisoryUnlock.sqlstate, "08006");
  } finally {
    f.stream.destroy();
  }
});

test("Migration transaction failure and secondary ROLLBACK failure remain separate", async () => {
  const f = await fixture("migration_sql");
  try {
    await assert.rejects(f.run());
    assert.equal(f.d.failurePhase, "migrations");
    assert.equal(f.d.sqlstate, "42501");
    assert.equal(f.d.rollbackStatus, "failed");
    assert.equal(f.d.rollbackSqlstate, "08006");
    assert.doesNotMatch(JSON.stringify(f.d), /SYNTHETIC_PRIVATE_ERROR/);
  } finally {
    f.stream.destroy();
  }
});

test("Falsy primary exception also survives activation cleanup", async () => {
  const f = await fixture("falsy");
  try {
    let caught: unknown = Symbol("uncaught");
    try {
      await f.run();
    } catch (error) {
      caught = error;
    }
    assert.equal(caught, undefined);
    assert.equal(f.d.failurePhase, "bootstrap_runtime_role");
    assert.equal(f.d.sqlstate, null);
  } finally {
    f.stream.destroy();
  }
});

test("Second live snapshot drift stops before bootstrap or any persistent mutation", async () => {
  const f = await fixture("locked_drift");
  try {
    await assert.rejects(f.run());
    assert.equal(f.d.failurePhase, "snapshot_fingerprint");
    assert.ok(
      !f.calls.some(
        (sql) =>
          sql === "BEGIN" || /CREATE ROLE|ALTER ROLE|INSERT INTO/.test(sql),
      ),
    );
    assert.equal(f.d.activationCleanup.resetRole.status, "confirmed");
    assert.equal(f.d.activationCleanup.advisoryUnlock.status, "confirmed");
  } finally {
    f.stream.destroy();
  }
});
