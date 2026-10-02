import pg from "pg";
import type { ServerConfig } from "../config/env.ts";

// All Pool construction goes through this boundary. pg connects lazily.
export function createDatabasePool(
  config: Pick<ServerConfig, "databaseUrl">,
  onIdleError: () => void,
): pg.Pool {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  // pg errors may contain connection details. Never pass them to a logger.
  pool.on("error", () => onIdleError());
  return pool;
}
