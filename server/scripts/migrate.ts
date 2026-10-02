import { fileURLToPath } from "node:url";
import { EnvironmentError, readServerEnv } from "../src/config/env.ts";
import { MigrationError, runMigrations } from "../src/db/migrations.ts";
import { createDatabasePool } from "../src/db/pool.ts";

// Source lives in server/scripts; emitted JS lives in server/dist/scripts.
const migrationDirectory = fileURLToPath(
  new URL(
    import.meta.url.endsWith(".ts") ? "../migrations/" : "../../migrations/",
    import.meta.url,
  ),
);

async function migrate(): Promise<void> {
  let pool: ReturnType<typeof createDatabasePool> | undefined;
  let failed = false;
  try {
    const config = readServerEnv();
    pool = createDatabasePool(config, () => {
      console.error("Migration database connection error; details omitted.");
    });
    const result = await runMigrations(pool, migrationDirectory);
    console.info(
      `Migrations complete: ${result.applied} applied, ${result.alreadyApplied} already applied.`,
    );
  } catch (error) {
    failed = true;
    console.error(
      error instanceof EnvironmentError || error instanceof MigrationError
        ? error.message
        : "Migration command failed; details omitted.",
    );
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch {
        failed = true;
        console.error(
          "Could not close migration database pool; details omitted.",
        );
      }
    }
  }
  if (failed) process.exitCode = 1;
}

await migrate();
