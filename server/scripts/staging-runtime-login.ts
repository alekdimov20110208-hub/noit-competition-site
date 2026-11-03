// D3 only: one runtime login and read-only identity check; no activation imports.
import { open, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { TLSSocket, checkServerIdentity } from "node:tls";
import type { PoolClient } from "pg";
import { createDatabasePool } from "../src/db/pool.ts";
import {
  validateRuntimeConnection,
  verifyProductionDatabaseIdentity,
} from "../src/db/identity.ts";
import {
  classifyConnectionFailure,
  safeSqlstate,
} from "../src/staging/diagnostics.ts";
import { STAGING } from "../src/staging/target.ts";

const host = "aws-1-eu-central-1.pooler.supabase.com";
const caHash =
  "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7";
const expected = {
  projectRef: STAGING.projectRef,
  databaseId: STAGING.databaseId,
  environment: "staging" as const,
  databaseHost: host,
};
export const runtimeLoginState = () => ({
  mode: "runtime-read-only-login",
  projectRef: STAGING.projectRef,
  status: "STOP" as "PASS" | "STOP",
  phase: "preflight",
  failurePhase: null as string | null,
  errorCode: "NONE",
  sqlstate: null as string | null,
  connectionAttempts: 0,
  tlsVerified: false,
  identityVerified: false,
  rollbackStatus: "not_attempted",
  closeStatus: "unknown",
  elapsedMs: 0,
  automaticRetry: false,
});
type State = ReturnType<typeof runtimeLoginState>;
function fail(state: State, code: string, error?: unknown) {
  if (state.failurePhase !== null) return;
  state.failurePhase = state.phase;
  state.errorCode = code;
  state.sqlstate = safeSqlstate(error);
}

export async function checkRuntimeIdentity(db: PoolClient, state: State) {
  let begun = false;
  try {
    state.phase = "tls";
    const ssl = db.ssl as unknown as {
      rejectUnauthorized?: unknown;
      checkServerIdentity?: unknown;
      ca?: unknown;
    };
    const stream = db.connection.stream;
    if (
      db.host !== host ||
      db.port !== 5432 ||
      db.database !== "postgres" ||
      db.user !== `budograph_runtime.${STAGING.projectRef}` ||
      !ssl ||
      ssl.rejectUnauthorized !== true ||
      ssl.checkServerIdentity !== checkServerIdentity ||
      !Array.isArray(ssl.ca) ||
      !ssl.ca.length ||
      !(stream instanceof TLSSocket) ||
      stream.encrypted !== true ||
      stream.authorized !== true ||
      stream.authorizationError != null ||
      !["TLSv1.2", "TLSv1.3"].includes(stream.getProtocol() ?? "") ||
      checkServerIdentity(host, stream.getPeerCertificate()) !== undefined
    )
      throw Error();
    state.tlsVerified = true;
    state.phase = "begin_read_only";
    const begin = await db.query("BEGIN READ ONLY");
    begun = true;
    if (begin.command !== "BEGIN") throw Error();
    state.phase = "runtime_identity";
    await verifyProductionDatabaseIdentity(db, expected);
    state.identityVerified = true;
  } catch (error) {
    fail(
      state,
      state.phase === "tls" ? "TLS_FAILURE" : "RUNTIME_IDENTITY_FAILED",
      error,
    );
  } finally {
    if (begun) {
      state.phase = "rollback";
      try {
        state.rollbackStatus = "unknown";
        const result = await db.query("ROLLBACK");
        if (result.command !== "ROLLBACK") throw Error();
        state.rollbackStatus = "confirmed";
      } catch (error) {
        state.rollbackStatus = "failed";
        fail(state, "ROLLBACK_FAILED", error);
      }
    }
  }
}

async function main() {
  const state = runtimeLoginState(),
    start = Date.now();
  let pool: ReturnType<typeof createDatabasePool> | undefined,
    db: PoolClient | undefined;
  let output: Awaited<ReturnType<typeof open>> | undefined;
  let ended = false,
    poolEnded = false;
  try {
    if (
      process.argv.length !== 2 ||
      process.env.D3_RUNTIME_LOGIN_APPROVAL !==
        `runtime-login:${STAGING.projectRef}` ||
      Object.keys(process.env).some((k) =>
        /^(PG|NODE_OPTIONS$|NODE_TLS_REJECT_UNAUTHORIZED$|STAGING_)/.test(k),
      )
    )
      throw Error();
    const url = process.env.DATABASE_URL ?? "";
    validateRuntimeConnection(url, expected);
    if (
      new URL(url).hostname !== host ||
      process.env.DATABASE_TLS_MODE !== "verify-full" ||
      process.env.DATABASE_TLS_CA_FILE !== "D:\\prod-ca-2021.crt"
    )
      throw Error();
    if (
      createHash("sha256")
        .update(await readFile(process.env.DATABASE_TLS_CA_FILE))
        .digest("hex") !== caHash
    )
      throw Error();
    const file = resolve("tmp/d3/D3_RUNTIME_LOGIN_1.json");
    if (process.env.D3_RUNTIME_REPORT_FILE !== file) throw Error();
    output = await open(file, "wx");
    pool = createDatabasePool(
      {
        nodeEnv: "production",
        databaseUrl: url,
        databaseTls: {
          mode: "verify-full",
          caFile: process.env.DATABASE_TLS_CA_FILE,
        },
      },
      () => {},
      { max: 1 },
    );
    state.phase = "connect";
    state.connectionAttempts = 1;
    db = await pool.connect();
    db.once("end", () => {
      ended = true;
    });
    await checkRuntimeIdentity(db, state);
  } catch (error) {
    fail(
      state,
      state.phase === "connect"
        ? classifyConnectionFailure(error).errorCode
        : "PREFLIGHT_REFUSED",
      error,
    );
  } finally {
    state.phase = "close";
    try {
      db?.release(true);
      await pool?.end();
      poolEnded = Boolean(pool);
      if (db && !ended)
        await new Promise<void>((done) => {
          const timer = setTimeout(done, 1000);
          db!.once("end", () => {
            clearTimeout(timer);
            done();
          });
        });
      state.closeStatus =
        poolEnded && (!db || ended)
          ? db
            ? "confirmed"
            : "pool_closed_no_client"
          : "unknown";
    } catch (error) {
      state.closeStatus = "failed";
      fail(state, "CONNECTION_CLOSE_FAILED", error);
    }
    if (
      !state.failurePhase &&
      (!state.identityVerified ||
        state.rollbackStatus !== "confirmed" ||
        state.closeStatus !== "confirmed")
    )
      fail(state, "UNCONFIRMED_OUTCOME");
    if (!state.failurePhase) {
      state.status = "PASS";
      state.phase = "complete";
    }
    state.elapsedMs = Date.now() - start;
    try {
      await output?.writeFile(JSON.stringify(state, null, 2) + "\n");
      await output?.close();
    } catch {
      state.status = "STOP";
      fail(state, "REPORT_IO_FAILED");
    }
    process.stdout.write(JSON.stringify(state) + "\n");
    process.exitCode = state.status === "PASS" ? 0 : 1;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
