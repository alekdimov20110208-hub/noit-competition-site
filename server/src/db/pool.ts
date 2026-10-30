import pg from "pg";
import { readDatabaseEnv, type DatabaseConfig } from "../config/env.ts";
import { databaseSslOptions } from "./tls.ts";
import { boundDatabaseQueue } from "./lease.ts";

// All Pool construction goes through this boundary. pg connects lazily.
export function createDatabasePool(
  config: Pick<DatabaseConfig, "databaseUrl" | "databaseTls" | "nodeEnv">,
  onIdleError: () => void,
  limits: { max: number; allowExitOnIdle?: boolean; maxWaiting?: number } = {
    max: config.nodeEnv === "production" ? 4 : 10,
  },
): pg.Pool {
  if (!Number.isInteger(limits.max) || limits.max < 1 || limits.max > 10)
    throw new Error("Database pool maximum must be between 1 and 10.");
  const maxWaiting = limits.maxWaiting ?? 64;
  if (!Number.isInteger(maxWaiting) || maxWaiting < 1 || maxWaiting > 64)
    throw new Error("Database queue maximum must be between 1 and 64.");
  // Recheck policy even for hand-constructed configurations. URL options must
  // never overwrite verified ssl options during pg's connection-string merge.
  const checked = readDatabaseEnv({
    NODE_ENV: config.nodeEnv,
    DATABASE_URL: config.databaseUrl,
    DATABASE_TLS_MODE: config.databaseTls.mode,
    ...(config.databaseTls.mode === "verify-full"
      ? { DATABASE_TLS_CA_FILE: config.databaseTls.caFile }
      : {}),
  });
  const pool = new pg.Pool({
    connectionString: checked.databaseUrl,
    ssl: databaseSslOptions(checked.databaseTls),
    max: limits.max,
    allowExitOnIdle: limits.allowExitOnIdle ?? false,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
    query_timeout: 12_000,
    idle_in_transaction_session_timeout: 15_000,
  });
  // pg errors may contain connection details. Never pass them to a logger.
  pool.on("error", () => onIdleError());
  boundDatabaseQueue(pool, maxWaiting);
  return pool;
}
