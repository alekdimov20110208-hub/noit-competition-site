// One connection, verified client TLS, no SQL. Importing this file does not run it.
import { createHash } from "node:crypto";
import { access, open, readFile, type FileHandle } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";
import { createDatabasePool } from "../src/db/pool.ts";
import { verifyStagingClientTls } from "../src/staging/client-tls.ts";
import { classifyConnectionFailure } from "../src/staging/diagnostics.ts";
import { stagingOwnerTarget, STAGING } from "../src/staging/target.ts";

export const PROBE = Object.freeze({
  projectRef: "jlladwdqdillryyfvndo",
  host: "aws-1-eu-central-1.pooler.supabase.com",
  username: "postgres.jlladwdqdillryyfvndo",
  port: 5432,
  database: "postgres",
  caFile: "D:\\prod-ca-2021.crt",
  caSha256: "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7",
  claim:
    "C:\\Users\\Lenovo\\AppData\\Local\\BudoGraph\\D2.5-ConnectionProbe\\D2.5-connection-probe.claim",
  report:
    "C:\\NOIT\\noit-competition-site\\tmp\\d2-3\\D2_5_CONNECTION_PROBE.json",
});
type Category =
  "NONE" | "TIMEOUT" | "TLS" | "AUTH" | "NETWORK" | "DNS" | "UNKNOWN";
type ProbePool = Pick<ReturnType<typeof createDatabasePool>, "connect" | "end">;

export function probeTarget(env: NodeJS.ProcessEnv) {
  if (
    env.STAGING_OWNER_APPROVAL !== `connect-only:${PROBE.projectRef}` ||
    env.EXPECTED_SUPABASE_PROJECT_REF !== PROBE.projectRef ||
    env.EXPECTED_DATABASE_HOST !== PROBE.host ||
    env.DATABASE_TLS_MODE !== "verify-full" ||
    env.DATABASE_TLS_CA_FILE !== PROBE.caFile ||
    env.STAGING_CA_SHA256 !== PROBE.caSha256 ||
    Object.keys(env).some(
      (k) =>
        /^PG/.test(k) ||
        [
          "DATABASE_URL",
          "NODE_OPTIONS",
          "NODE_TLS_REJECT_UNAUTHORIZED",
          "STAGING_RUNTIME_PASSWORD",
        ].includes(k),
    )
  )
    throw Error("Probe preflight refused.");
  const target = stagingOwnerTarget(env.STAGING_MIGRATOR_URL ?? "", PROBE.host);
  if (
    STAGING.projectRef !== PROBE.projectRef ||
    target.hostname !== PROBE.host ||
    decodeURIComponent(target.username) !== PROBE.username ||
    target.port !== "5432" ||
    target.pathname !== "/postgres"
  )
    throw Error("Probe target refused.");
  return target;
}

// Exposed only to exercise CreateNew behavior with disposable local files.
export async function reserveProbeFiles(claim: string, report: string) {
  const exists = await access(report).then(
    () => true,
    (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    },
  );
  if (exists) throw Error("Existing probe report; no retry.");
  const handle = await open(claim, "wx", 0o600);
  try {
    await handle.writeFile(
      `ONE CONNECTION-ONLY PROBE ${PROBE.projectRef} ${new Date().toISOString()}\n`,
    );
    await handle.sync();
  } finally {
    await handle.close();
  }
  return open(report, "wx", 0o600);
}

export async function connectOnly(pool: ProbePool, target: URL) {
  let db: PoolClient | undefined;
  let endEvent: Promise<void> | undefined;
  let ended = false;
  let clientError = false;
  const result = {
    connectionOutcome: "FAILED" as "CONNECTED" | "FAILED",
    elapsedMilliseconds: 0,
    errorCode: "NONE" as Category,
    clientTls: "unknown" as "verified" | "failed" | "unknown",
    closeStatus: "UNKNOWN" as
      "CONFIRMED" | "POOL_CLOSED_NO_CLIENT" | "FAILED" | "UNKNOWN",
    poolEndResolved: false,
  };
  const started = performance.now();
  try {
    // Exactly one call; never pool.query, client.query, inspect, or apply.
    db = await pool.connect();
    result.elapsedMilliseconds = Math.round(performance.now() - started);
    result.connectionOutcome = "CONNECTED";
    endEvent = new Promise<void>((done) =>
      db!.once("end", () => {
        ended = true;
        done();
      }),
    );
    db.once("error", () => {
      clientError = true;
    });
    try {
      verifyStagingClientTls(db, target);
      result.clientTls = "verified";
    } catch {
      result.clientTls = "failed";
      result.errorCode = "TLS";
    }
  } catch (error) {
    result.elapsedMilliseconds = Math.round(performance.now() - started);
    const { reason } = classifyConnectionFailure(error);
    result.errorCode =
      reason === "timeout"
        ? "TIMEOUT"
        : reason === "tls"
          ? "TLS"
          : ["authentication", "permission"].includes(reason)
            ? "AUTH"
            : reason === "dns"
              ? "DNS"
              : [
                    "network_unreachable",
                    "refused",
                    "reset",
                    "protocol",
                  ].includes(reason)
                ? "NETWORK"
                : "UNKNOWN";
  } finally {
    try {
      db?.release(true);
    } catch {
      result.closeStatus = "FAILED";
    }
    try {
      await pool.end();
      result.poolEndResolved = true;
    } catch {
      result.closeStatus = "FAILED";
    }
    if (endEvent && !ended) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          endEvent,
          new Promise<void>((done) => {
            timer = setTimeout(done, 1000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    if (result.closeStatus !== "FAILED" && result.poolEndResolved)
      result.closeStatus = db
        ? ended
          ? "CONFIRMED"
          : "UNKNOWN"
        : "POOL_CLOSED_NO_CLIENT";
    if (
      (clientError || (db && result.closeStatus !== "CONFIRMED")) &&
      result.errorCode === "NONE"
    )
      result.errorCode = "UNKNOWN";
  }
  return result;
}

async function main() {
  let output: FileHandle | undefined;
  let result: Awaited<ReturnType<typeof connectOnly>> | undefined;
  let phase = "preflight";
  let attempted = false;
  let claimed = false;
  let status = "BLOCKED";
  let errorCode: Category = "UNKNOWN";
  try {
    if (
      process.argv.length !== 2 ||
      resolve(process.cwd()).toLowerCase() !== "c:\\noit\\noit-competition-site"
    )
      throw Error();
    const target = probeTarget(process.env);
    if (
      createHash("sha256")
        .update(await readFile(PROBE.caFile))
        .digest("hex") !== PROBE.caSha256
    )
      throw Error();
    phase = "reserve_files";
    output = await reserveProbeFiles(PROBE.claim, PROBE.report);
    claimed = true;
    phase = "pool_create";
    const pool = createDatabasePool(
      {
        nodeEnv: "production",
        databaseUrl: target.href,
        databaseTls: { mode: "verify-full", caFile: PROBE.caFile },
      },
      () => {},
      { max: 1 },
    );
    if (
      pool.options.connectionTimeoutMillis !== 5000 ||
      pool.options.max !== 1
    ) {
      await pool.end();
      throw Error();
    }
    phase = "connect_only";
    attempted = true;
    result = await connectOnly(pool, target);
    errorCode = result.errorCode;
    status =
      result.connectionOutcome === "CONNECTED" &&
      result.clientTls === "verified" &&
      result.closeStatus === "CONFIRMED" &&
      result.errorCode === "NONE"
        ? "PASS"
        : "STOP";
    phase = "complete";
  } catch {
    status = claimed ? "STOP" : "BLOCKED";
  }
  const report = {
    schemaVersion: 1,
    mode: "connection-only",
    timestampUtc: new Date().toISOString(),
    status,
    phase,
    projectRef: PROBE.projectRef,
    host: PROBE.host,
    port: PROBE.port,
    database: PROBE.database,
    caSha256: PROBE.caSha256,
    timeoutMilliseconds: 5000,
    connectionAttempted: attempted,
    connectionAttempts: attempted ? 1 : 0,
    ...(result ?? {
      connectionOutcome: "NOT_ATTEMPTED",
      elapsedMilliseconds: null,
      errorCode,
      clientTls: "unknown",
      closeStatus: "NOT_OPENED",
      poolEndResolved: false,
    }),
    sqlStatementsExecuted: 0,
    automaticRetry: false,
  };
  let reportSaved = false;
  try {
    if (output) {
      await output.writeFile(JSON.stringify(report, null, 2) + "\n");
      await output.sync();
      reportSaved = true;
    }
  } catch {
    report.status = "STOP";
  } finally {
    try {
      await output?.close();
    } catch {
      report.status = "STOP";
      reportSaved = false;
    }
  }
  process.stdout.write(JSON.stringify({ ...report, reportSaved }) + "\n");
  process.exitCode = report.status === "PASS" && reportSaved ? 0 : 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
