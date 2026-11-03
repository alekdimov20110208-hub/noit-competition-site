import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import {
  discoverMigrations,
  runMigrations,
  validateAppliedMigrations,
} from "../db/migrations.ts";
import { verifyProductionDatabaseIdentity } from "../db/identity.ts";
import {
  applicationCatalog,
  digest,
  initialSnapshot,
  serverWitness,
} from "./catalog.ts";
import { STAGING } from "./target.ts";
import {
  recordFailure,
  safeErrorCode,
  safeSqlstate,
  type DiagnosticPhase,
  type StagingDiagnostics,
} from "./diagnostics.ts";

const root = fileURLToPath(
  new URL(
    import.meta.url.endsWith(".ts") ? "../../staging/" : "../../../staging/",
    import.meta.url,
  ),
);
export const migrationsDirectory = fileURLToPath(
  new URL(
    import.meta.url.endsWith(".ts")
      ? "../../migrations/"
      : "../../../migrations/",
    import.meta.url,
  ),
);
export async function stagingFile(name: string) {
  const pins = JSON.parse(
    await readFile(`${root}package-manifest.json`, "utf8"),
  ).sha256;
  const bytes = await readFile(`${root}${name}`);
  if (
    typeof pins[name] !== "string" ||
    createHash("sha256").update(bytes).digest("hex") !== pins[name]
  )
    throw Error("Staging package checksum mismatch; STOP.");
  return bytes.toString("utf8");
}

export async function pinnedMigrations(directory = migrationsDirectory) {
  const files = await discoverMigrations(directory);
  const pins = JSON.parse(
    await readFile(`${migrationsDirectory}production-manifest.json`, "utf8"),
  ).pins;
  if (
    files.length !== 16 ||
    pins.length !== 16 ||
    validateAppliedMigrations(files, pins).length
  )
    throw Error("Original 16 migration checksums required; STOP.");
  return files;
}

export async function inspectStaging(
  db: PoolClient,
  diagnostics?: StagingDiagnostics,
) {
  if (diagnostics) diagnostics.phase = "package_verification";
  await pinnedMigrations();
  for (const name of [
    "bootstrap.sql",
    "identity-overlay.sql",
    "catalog-reference.json",
  ])
    await stagingFile(name);
  if (diagnostics) {
    diagnostics.phase = "transaction_begin";
    diagnostics.observations.transactionStarted = "unknown";
  }
  const begin = await db.query(
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  if (diagnostics && begin.command === "BEGIN")
    diagnostics.observations.transactionStarted = true;
  let operationFailed = false;
  try {
    if (diagnostics) diagnostics.phase = "server_witness";
    const witness = await serverWitness(db, diagnostics);
    if (diagnostics) {
      diagnostics.observations.serverWitnessVerified = true;
      diagnostics.phase = "catalog";
    }
    const catalog = await initialSnapshot(db, diagnostics);
    if (diagnostics) diagnostics.observations.initialCatalogVerified = true;
    return {
      projectRef: STAGING.projectRef,
      databaseId: STAGING.databaseId,
      witness,
      catalog,
      fingerprint: digest({ witness, catalog }),
    };
  } catch (error) {
    operationFailed = true;
    if (diagnostics)
      recordFailure(
        diagnostics,
        error,
        undefined,
        diagnostics.catalogOperation ?? undefined,
      );
    throw error;
  } finally {
    if (diagnostics) {
      diagnostics.phase = "rollback";
      diagnostics.rollbackStatus = "unknown";
      diagnostics.rollbackErrorCode = "NONE";
      diagnostics.rollbackSqlstate = null;
    }
    try {
      const rollback = await db.query("ROLLBACK");
      if (diagnostics && rollback.command === "ROLLBACK")
        diagnostics.rollbackStatus = "confirmed";
    } catch (error) {
      if (diagnostics) {
        diagnostics.rollbackStatus = "failed";
        diagnostics.rollbackErrorCode = "ROLLBACK_FAILED";
        diagnostics.rollbackSqlstate = safeSqlstate(error);
        recordFailure(diagnostics, error, "ROLLBACK_FAILED");
      }
      if (!operationFailed) throw error;
    }
  }
}

export async function verifyStaging(
  db: PoolClient,
  phase: "original" | "staging",
  diagnostics?: StagingDiagnostics,
) {
  const files = await pinnedMigrations();
  const history = (
    await db.query(
      "SELECT version,name,checksum FROM public.schema_migrations ORDER BY version",
    )
  ).rows;
  if (history.length !== 16 || validateAppliedMigrations(files, history).length)
    throw Error("Staging history drift; STOP.");
  if (
    (
      await db.query(
        "SELECT to_regclass('supabase_migrations.schema_migrations') history",
      )
    ).rows[0].history &&
    (
      await db.query(
        "SELECT count(*)::int n FROM supabase_migrations.schema_migrations",
      )
    ).rows[0].n !== 0
  )
    throw Error("Unexpected Supabase migration metadata; STOP.");
  const catalog = await applicationCatalog(db, diagnostics);
  const reference = JSON.parse(await stagingFile("catalog-reference.json"))[
    phase
  ];
  if (digest(catalog) !== digest(reference))
    throw Error(
      "Staging catalog/RLS/policies/functions/grants differ from disposable reference; STOP.",
    );
  for (const table of [
    '"user"',
    "session",
    "account",
    "verification",
    "event",
    "event_member",
    "task",
    "activity_entry",
    "event_invitation",
    "event_change",
    "change_task",
    "task_reminder",
    "notification",
    "event_command_receipt",
    "template_application_receipt",
    "personal_template",
    "personal_template_version",
    "personal_template_item",
    "personal_template_save_receipt",
  ]) {
    if (
      (await db.query(`SELECT count(*)::int n FROM public.${table}`)).rows[0].n
    )
      throw Error("Unexpected application data; STOP.");
  }
  for (const table of ["email_outbox", "rate_counter"]) {
    if (
      (await db.query(`SELECT count(*)::int n FROM budograph_private.${table}`))
        .rows[0].n
    )
      throw Error("Unexpected operational data; STOP.");
  }
  if (phase === "staging") {
    await db.query("RESET ROLE");
    const runtime = (
      await db.query(
        "SELECT rolconnlimit FROM pg_roles WHERE rolname='budograph_runtime'",
      )
    ).rows[0];
    if (runtime?.rolconnlimit !== 4)
      throw Error("Runtime connection limit mismatch; STOP.");
    await db.query("SET ROLE budograph_runtime");
    try {
      await verifyProductionDatabaseIdentity(db, {
        databaseId: STAGING.databaseId,
        projectRef: STAGING.projectRef,
        environment: "staging",
      });
    } catch (error) {
      if (diagnostics) recordFailure(diagnostics, error);
      throw error;
    } finally {
      await db.query("RESET ROLE");
    }
  }
  return {
    history,
    catalogSha256: digest(catalog),
    tables: catalog.tables!.length,
    policies: catalog.policies!.length,
    functions: catalog.functions!.length,
  };
}

// Only the CLI may acquire a remote connection, after exact target validation.
// The tested core accepts an already witnessed session, never a URL.
async function activationRollback(
  db: PoolClient,
  diagnostics?: StagingDiagnostics,
) {
  if (diagnostics) {
    diagnostics.rollbackStatus = "unknown";
    diagnostics.rollbackErrorCode = "NONE";
    diagnostics.rollbackSqlstate = null;
  }
  try {
    const result = await db.query("ROLLBACK");
    if (diagnostics && result.command === "ROLLBACK")
      diagnostics.rollbackStatus = "confirmed";
    return result;
  } catch (error) {
    if (diagnostics) {
      diagnostics.rollbackStatus = "failed";
      diagnostics.rollbackErrorCode = "ROLLBACK_FAILED";
      diagnostics.rollbackSqlstate = safeSqlstate(error);
      recordFailure(diagnostics, error, "ROLLBACK_FAILED");
    }
    throw error;
  }
}

export async function activateStaging(
  db: PoolClient,
  approvedFingerprint: string,
  runtimePassword: string,
  runtimeValidUntil: string,
  diagnostics?: StagingDiagnostics,
) {
  const phase = (value: DiagnosticPhase) => {
    if (diagnostics) diagnostics.phase = value;
  };
  if (
    !/^[a-f0-9]{64}$/.test(runtimePassword) ||
    !Number.isFinite(Date.parse(runtimeValidUntil)) ||
    Date.parse(runtimeValidUntil) <= Date.now() ||
    Date.parse(runtimeValidUntil) > Date.now() + 90 * 86400000
  )
    throw Error(
      "Independent 32-byte hex runtime password and future validity within 90 days required.",
    );
  const initial = await inspectStaging(db, diagnostics);
  phase("snapshot_fingerprint");
  if (
    !/^[a-f0-9]{64}$/.test(approvedFingerprint) ||
    initial.fingerprint !== approvedFingerprint
  )
    throw Error(
      "Unapproved snapshot/provider/server drift; STOP before mutation.",
    );
  phase("activation_lock");
  await db.query("SELECT pg_advisory_lock(1112884303,1196573008)");
  let operationFailed = false;
  try {
    // Re-read under the package lock; original runner takes its own session lock.
    const locked = await inspectStaging(db, diagnostics);
    phase("snapshot_fingerprint");
    if (locked.fingerprint !== approvedFingerprint)
      throw Error("Pre-bootstrap drift; STOP.");
    phase("bootstrap");
    await db.query("BEGIN");
    try {
      await db.query(
        "SELECT set_config('budograph.verified_project_ref',$1,true)",
        [STAGING.projectRef],
      );
      await db.query(await stagingFile("bootstrap.sql"));
      phase("bootstrap_runtime_role");
      await db.query("SET LOCAL ROLE budograph_runtime");
      phase("bootstrap_runtime_permissions");
      const unsafe = (
        await db.query(
          `SELECT has_database_privilege(current_user,current_database(),'CREATE') OR EXISTS(SELECT 1 FROM pg_namespace WHERE has_schema_privilege(current_user,oid,'CREATE')) unsafe`,
        )
      ).rows[0].unsafe;
      if (unsafe) throw Error("Unexpected inherited runtime CREATE; STOP.");
      await db.query("COMMIT");
    } catch (error) {
      if (diagnostics) recordFailure(diagnostics, error);
      try {
        await activationRollback(db, diagnostics);
      } catch {
        /* Primary failure already recorded. */
      }
      throw error;
    }
    phase("migrations");
    await db.query("SET ROLE budograph_migrator");
    // Adapter retains this very same verified session. No alternative runner.
    const result = await runMigrations(
      {
        connect: async () => ({
          query: async (sql: string, values?: unknown[]) => {
            try {
              return sql === "ROLLBACK"
                ? await activationRollback(db, diagnostics)
                : await db.query(sql, values);
            } catch (error) {
              // Capture SQLSTATE before the original runner sanitizes its Error.
              if (diagnostics) recordFailure(diagnostics, error);
              throw error;
            }
          },
          on: db.on.bind(db),
          removeListener: db.removeListener.bind(db),
          release: () => {},
        }),
      },
      migrationsDirectory,
    );
    if (result.applied !== 16 || result.alreadyApplied !== 0)
      throw Error("Unexpected runner result; STOP.");
    phase("original_verification");
    await verifyStaging(db, "original", diagnostics);
    phase("identity_overlay");
    await db.query("BEGIN");
    try {
      await db.query(
        "SELECT set_config('budograph.verified_project_ref',$1,true),set_config('budograph.staging_database_id',$2,true)",
        [STAGING.projectRef, STAGING.databaseId],
      );
      await db.query(await stagingFile("identity-overlay.sql"));
      // Overlay + verification are atomic. Password remains unusable until all checks pass.
      const catalog = await applicationCatalog(db, diagnostics);
      const reference = JSON.parse(
        await stagingFile("catalog-reference.json"),
      ).staging;
      if (digest(catalog) !== digest(reference))
        throw Error("Overlay catalog mismatch; STOP.");
      await db.query("COMMIT");
    } catch (error) {
      if (diagnostics) recordFailure(diagnostics, error);
      try {
        await activationRollback(db, diagnostics);
      } catch {
        /* Primary failure already recorded. */
      }
      throw error;
    }
    phase("staging_verification");
    await db.query("RESET ROLE");
    const verified = await verifyStaging(db, "staging", diagnostics);
    phase("runtime_password");
    // pg utility statements cannot parameterize PASSWORD; quote using server format.
    // Never log/return this SQL, password, or driver errors.
    const command = (
      await db.query(
        "SELECT format('ALTER ROLE budograph_runtime PASSWORD %L VALID UNTIL %L',$1::text,$2::text) sql",
        [runtimePassword, runtimeValidUntil],
      )
    ).rows[0].sql;
    await db.query(command);
    return {
      status: "STAGING_DATABASE_ACTIVATED",
      projectRef: STAGING.projectRef,
      databaseId: STAGING.databaseId,
      initialFingerprint: initial.fingerprint,
      migrations: result,
      verified,
      usersCreated: 0,
      supabaseMetadataWrites: 0,
    };
  } catch (error) {
    operationFailed = true;
    if (diagnostics) recordFailure(diagnostics, error);
    throw error;
  } finally {
    phase("activation_cleanup");
    let cleanup = diagnostics?.activationCleanup.resetRole;
    try {
      if (cleanup) cleanup.status = "unknown";
      await db.query("RESET ROLE");
      if (cleanup) cleanup.status = "confirmed";
      cleanup = diagnostics?.activationCleanup.advisoryUnlock;
      if (cleanup) cleanup.status = "unknown";
      await db.query("SELECT pg_advisory_unlock(1112884303,1196573008)");
      if (cleanup) cleanup.status = "confirmed";
    } catch (error) {
      if (cleanup) {
        cleanup.status = "failed";
        cleanup.errorCode = safeErrorCode(error);
        cleanup.sqlstate = safeSqlstate(error);
      }
      if (diagnostics) recordFailure(diagnostics, error);
      if (!operationFailed) throw error;
    }
  }
}
