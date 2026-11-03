// No dotenv, no generic migration CLI and no connection before explicit mode gates.
import { open, readFile, type FileHandle } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { PoolClient } from "pg";
import { createDatabasePool } from "../src/db/pool.ts";
import {
  activateStaging,
  inspectStaging,
  verifyStaging,
} from "../src/staging/activation.ts";
import { stagingOwnerTarget, STAGING } from "../src/staging/target.ts";
import { verifyStagingClientTls } from "../src/staging/client-tls.ts";
import { createHash } from "node:crypto";
import {
  classifyConnectionFailure,
  createDiagnostics,
  recordFailure,
  StagingDiagnosticError,
} from "../src/staging/diagnostics.ts";

const argument = process.argv[2] ?? "";
const mode = ["inspect", "apply", "verify"].includes(argument)
  ? argument
  : "unknown";
const diagnostics = createDiagnostics(mode === "inspect");
let pool: ReturnType<typeof createDatabasePool> | undefined;
let db: PoolClient | undefined;
let reportFile: FileHandle | undefined;
let target: URL | undefined;
let report: unknown;
let clientEnd: Promise<void> | undefined;
const refuse = () => {
  throw new StagingDiagnosticError("PREFLIGHT_REFUSED");
};
try {
  if (process.argv.length !== 3 || mode === "unknown") refuse();
  const env = process.env;
  diagnostics.phase = "approval";
  if (
    env.STAGING_OWNER_APPROVAL !==
    `${mode}:${STAGING.projectRef}:${STAGING.databaseId}`
  )
    refuse();
  diagnostics.phase = "environment";
  if (
    [
      "DATABASE_URL",
      "PGHOST",
      "PGPORT",
      "PGUSER",
      "PGPASSWORD",
      "PGDATABASE",
      "PGSERVICE",
      "PGSSLMODE",
      "PGOPTIONS",
      "NODE_OPTIONS",
      "NODE_TLS_REJECT_UNAUTHORIZED",
    ].some((k) => env[k] !== undefined)
  )
    refuse();
  diagnostics.phase = "identity";
  if (
    env.EXPECTED_SUPABASE_PROJECT_REF !== STAGING.projectRef ||
    env.EXPECTED_DATABASE_ID !== STAGING.databaseId
  )
    refuse();
  diagnostics.phase = "target";
  try {
    target = stagingOwnerTarget(
      env.STAGING_MIGRATOR_URL ?? "",
      env.EXPECTED_DATABASE_HOST ?? "",
    );
  } catch {
    throw new StagingDiagnosticError("TARGET_REFUSED");
  }
  diagnostics.phase = "ca_pin";
  const caFile = env.DATABASE_TLS_CA_FILE!;
  if (
    env.DATABASE_TLS_MODE !== "verify-full" ||
    !/^[a-f0-9]{64}$/.test(env.STAGING_CA_SHA256 ?? "") ||
    createHash("sha256")
      .update(await readFile(caFile))
      .digest("hex") !== env.STAGING_CA_SHA256
  )
    throw new StagingDiagnosticError("CA_PIN_REFUSED");
  diagnostics.phase = "report_open";
  const output = resolve(env.STAGING_REPORT_FILE ?? "");
  if (
    !output.startsWith(resolve("tmp/d2-3") + sep) ||
    !output.endsWith(".json")
  )
    refuse();
  // Never open an existing report, including the original D2.4 evidence.
  reportFile = await open(output, "wx");
  diagnostics.phase = "pool_create";
  pool = createDatabasePool(
    {
      nodeEnv: "production",
      databaseUrl: target.href,
      databaseTls: { mode: "verify-full", caFile },
    },
    () => {},
    { max: 1 },
  );
  diagnostics.phase = "connect";
  diagnostics.connectionEstablished = "unknown";
  try {
    db = await pool.connect();
  } catch (error) {
    diagnostics.connectionFailure = classifyConnectionFailure(error);
    recordFailure(diagnostics, error, diagnostics.connectionFailure.errorCode);
    throw error;
  }
  diagnostics.connectionEstablished = true;
  clientEnd = new Promise<void>((resolveEnd) => {
    db!.once("end", () => {
      diagnostics.observations.clientEndObserved = true;
      resolveEnd();
    });
  });
  try {
    diagnostics.phase = "client_tls";
    verifyStagingClientTls(db, target, diagnostics);
    diagnostics.phase = "operation";
    report =
      mode === "inspect"
        ? await inspectStaging(db, diagnostics)
        : mode === "apply"
          ? await activateStaging(
              db,
              env.STAGING_APPROVED_SNAPSHOT_SHA256 ?? "",
              env.STAGING_RUNTIME_PASSWORD ?? "",
              env.STAGING_RUNTIME_VALID_UNTIL ?? "",
              diagnostics,
            )
          : await verifyStaging(db, "staging", diagnostics);
    if (mode === "inspect" && diagnostics.rollbackStatus !== "confirmed")
      recordFailure(diagnostics, undefined);
  } catch (error) {
    // Save the SQL phase before connection cleanup changes the current phase.
    recordFailure(diagnostics, error);
    throw error;
  } finally {
    // Preserve the original release(true) behavior; observe its outcome separately.
    diagnostics.phase = "connection_close";
    try {
      db.release(true);
    } catch (error) {
      recordFailure(diagnostics, error, "CONNECTION_CLOSE_FAILED");
      diagnostics.connectionCloseStatus = "failed";
      diagnostics.connectionCloseErrorCode = "CONNECTION_CLOSE_FAILED";
      throw error;
    }
  }
} catch (error) {
  recordFailure(diagnostics, error);
} finally {
  diagnostics.phase = "connection_close";
  try {
    if (pool) {
      await pool.end();
      diagnostics.observations.poolEndResolved = true;
      if (clientEnd && !diagnostics.observations.clientEndObserved) {
        // A resolved pool.end() alone is not proof of the client end event.
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            clientEnd,
            new Promise<void>((done) => {
              timer = setTimeout(done, 1000);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
      if (
        diagnostics.observations.clientEndObserved &&
        diagnostics.connectionCloseStatus !== "failed"
      )
        diagnostics.connectionCloseStatus = "confirmed";
    }
  } catch (error) {
    diagnostics.connectionCloseStatus = "failed";
    diagnostics.connectionCloseErrorCode = "CONNECTION_CLOSE_FAILED";
    recordFailure(diagnostics, error, "CONNECTION_CLOSE_FAILED");
  }
  if (
    diagnostics.failurePhase === null &&
    diagnostics.connectionCloseStatus !== "confirmed"
  )
    recordFailure(diagnostics, undefined, "CONNECTION_CLOSE_UNCONFIRMED");
  if (
    mode === "inspect" &&
    diagnostics.failurePhase === null &&
    diagnostics.rollbackStatus !== "confirmed"
  )
    recordFailure(diagnostics, undefined);
  if (diagnostics.failurePhase === null) diagnostics.status = "PASS";
  diagnostics.phase = "report_write";
  try {
    if (reportFile) {
      await reportFile.writeFile(
        JSON.stringify(
          {
            mode,
            projectRef: STAGING.projectRef,
            ...(target ? { host: target.hostname } : {}),
            ...(process.env.STAGING_CA_SHA256?.match(/^[a-f0-9]{64}$/)
              ? { caSha256: process.env.STAGING_CA_SHA256 }
              : {}),
            ...diagnostics,
            ...(report !== undefined ? { report } : {}),
            instruction:
              "STOP unless PASS; retain all evidence; no automatic retry/reset/drop.",
          },
          null,
          2,
        ) + "\n",
      );
    }
  } catch (error) {
    recordFailure(diagnostics, error, "REPORT_IO_FAILED");
  } finally {
    try {
      await reportFile?.close();
    } catch (error) {
      recordFailure(diagnostics, error, "REPORT_IO_FAILED");
    }
  }
  if (diagnostics.status === "PASS") diagnostics.phase = "complete";
  // Only this constructed, closed-schema object is emitted; never an Error or env.
  process.stdout.write(
    JSON.stringify({
      mode,
      projectRef: STAGING.projectRef,
      ...diagnostics,
      ...(mode === "inspect" &&
      report &&
      typeof report === "object" &&
      "fingerprint" in report &&
      typeof report.fingerprint === "string" &&
      /^[a-f0-9]{64}$/.test(report.fingerprint)
        ? {
            report: {
              projectRef: STAGING.projectRef,
              databaseId: STAGING.databaseId,
              fingerprint: report.fingerprint,
            },
          }
        : {}),
    }) + "\n",
  );
  process.exitCode = diagnostics.status === "PASS" ? 0 : 1;
}
