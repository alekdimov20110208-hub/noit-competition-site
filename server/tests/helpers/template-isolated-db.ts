import { Pool } from "pg";

// Does not read .env, DATABASE_URL, Supabase config or the shared integration flag.
export function validateTemplateTestDatabase(
  url: string,
  confirmation: string,
) {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
    !/^budograph_t2_isolated_[a-z0-9_]+$/.test(name) ||
    confirmation !== `${name}:DISPOSABLE` ||
    parsed.search
  )
    throw new Error(
      "T2 SQL tests require an explicitly confirmed disposable loopback database.",
    );
  return name;
}
export async function templateIsolatedPool() {
  const url = process.env.BUDOGRAPH_T2_ISOLATED_DATABASE_URL ?? "";
  const expected = validateTemplateTestDatabase(
    url,
    process.env.BUDOGRAPH_T2_ISOLATED_DB_CONFIRM ?? "",
  );
  const pool = new Pool({
    connectionString: url,
    ssl: false,
    max: 8,
    connectionTimeoutMillis: 4000,
    application_name: "budograph-t2-isolated-tests",
  });
  try {
    const { rows } = await pool.query(
      "SELECT current_database() AS name, pg_catalog.host(inet_server_addr()) AS host",
    );
    if (
      rows[0]?.name !== expected ||
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(String(rows[0]?.host))
    )
      throw new Error(
        "T2 SQL database identity verification failed; no writes authorized.",
      );
    return pool;
  } catch (error) {
    await pool.end();
    throw error;
  }
}
