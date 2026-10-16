import pg from "pg";
import { readDatabaseEnv, type DatabaseConfig } from "../config/env.ts";
import { databaseSslOptions } from "./tls.ts";

// All Pool construction goes through this boundary. pg connects lazily.
export function createDatabasePool(
  config: Pick<DatabaseConfig, "databaseUrl" | "databaseTls" | "nodeEnv">,
  onIdleError: () => void,
): pg.Pool {
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
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  // pg errors may contain connection details. Never pass them to a logger.
  pool.on("error", () => onIdleError());
  return pool;
}
