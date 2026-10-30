import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverMigrations, validateAppliedMigrations } from "./migrations.ts";
import { EnvironmentError } from "../config/env.ts";

// Startup has a SELECT-only contract. It never calls the migration runner.
export async function verifyProductionSchema(
  database: {
    query(query: {
      text: string;
      query_timeout: number;
    }): Promise<{ rows: unknown[] }>;
  },
  directory: string,
) {
  const files = await discoverMigrations(directory);
  const manifest = JSON.parse(
    await readFile(join(directory, "production-manifest.json"), "utf8"),
  );
  if (
    files.length !== 16 ||
    !Array.isArray(manifest.pins) ||
    manifest.pins.length !== 16
  )
    throw new EnvironmentError(
      "Production requires the pinned 16-migration R2 schema.",
    );
  if (validateAppliedMigrations(files, manifest.pins).length)
    throw new EnvironmentError(
      "Production migration file manifest is incomplete.",
    );
  const history = await database.query({
    text: "SELECT version, name, checksum FROM public.schema_migrations ORDER BY version",
    query_timeout: 5000,
  });
  if (validateAppliedMigrations(files, history.rows).length)
    throw new EnvironmentError(
      "Production schema is incomplete; startup never applies migrations.",
    );
  return { recognized: files.length, applied: history.rows.length };
}
