import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { TextDecoder } from "node:util";

const migrationFilename = /^(\d{4})_[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.sql$/;
const migrationLock = [0x4255444f, 0x47524150];
const createMetadataTable = `
  CREATE TABLE public.schema_migrations (
    version TEXT PRIMARY KEY CHECK (version ~ '^[0-9]{4}$' AND version <> '0000'),
    name TEXT NOT NULL UNIQUE,
    checksum TEXT NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
}

// A checked-out pg client pins the advisory lock and transactions to one session.
export interface MigrationClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  on(event: "error", listener: () => void): unknown;
  removeListener(event: "error", listener: () => void): unknown;
  release(destroy?: boolean): void;
}

export interface MigrationPool {
  connect(): Promise<MigrationClient>;
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

export function migrationChecksum(sql: Uint8Array): string {
  return createHash("sha256").update(sql).digest("hex");
}

export async function discoverMigrations(
  directory: string,
): Promise<MigrationFile[]> {
  try {
    const files = await readdir(directory, { withFileTypes: true });
    const versions = new Set<string>();
    const migrations: MigrationFile[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".sql")) continue;
      const version = migrationFilename.exec(file.name)?.[1];
      if (!file.isFile() || !version || version === "0000") {
        throw new MigrationError(
          "Invalid SQL migration entry; use regular files named 0001_description.sql with lowercase snake_case names.",
        );
      }
      if (versions.has(version)) {
        throw new MigrationError(`Duplicate migration version ${version}.`);
      }
      versions.add(version);
      const bytes = await readFile(join(directory, file.name));
      const sql = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      migrations.push({
        version,
        name: file.name,
        sql,
        checksum: migrationChecksum(bytes),
      });
    }
    return migrations.sort((left, right) =>
      left.version < right.version ? -1 : 1,
    );
  } catch (error) {
    if (error instanceof MigrationError) throw error;
    throw new MigrationError(
      "Could not read SQL migrations; check the directory and UTF-8 file encoding.",
    );
  }
}

function readAppliedMigration(row: unknown): AppliedMigration {
  if (
    typeof row !== "object" ||
    row === null ||
    !("version" in row) ||
    !("name" in row) ||
    !("checksum" in row) ||
    typeof row.version !== "string" ||
    !/^(?!0000)\d{4}$/.test(row.version) ||
    typeof row.name !== "string" ||
    !migrationFilename.test(row.name) ||
    typeof row.checksum !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.checksum)
  ) {
    throw new MigrationError(
      "Migration metadata is invalid; manual investigation is required.",
    );
  }
  return { version: row.version, name: row.name, checksum: row.checksum };
}

export function validateAppliedMigrations(
  migrations: MigrationFile[],
  appliedRows: unknown[],
): MigrationFile[] {
  const byVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );
  const appliedVersions = new Set<string>();
  let latestVersion = "0000";
  for (const row of appliedRows) {
    const applied = readAppliedMigration(row);
    if (appliedVersions.has(applied.version)) {
      throw new MigrationError(
        "Migration metadata contains duplicate versions.",
      );
    }
    appliedVersions.add(applied.version);
    const file = byVersion.get(applied.version);
    if (!file) {
      throw new MigrationError(
        `Applied migration ${applied.version} is missing from the migration directory.`,
      );
    }
    if (file.name !== applied.name) {
      throw new MigrationError(
        `Applied migration ${applied.version} has been renamed; add a new migration instead.`,
      );
    }
    if (file.checksum !== applied.checksum) {
      throw new MigrationError(
        `Applied migration ${applied.version} has a checksum mismatch; add a new migration instead.`,
      );
    }
    if (applied.version > latestVersion) latestVersion = applied.version;
  }
  const pending = migrations.filter(
    (migration) => !appliedVersions.has(migration.version),
  );
  if (pending.some((migration) => migration.version < latestVersion)) {
    throw new MigrationError(
      "A pending migration precedes applied history; add a newer migration version.",
    );
  }
  return pending;
}

export async function runMigrations(
  pool: MigrationPool,
  directory: string,
): Promise<{ applied: number; alreadyApplied: number }> {
  const migrations = await discoverMigrations(directory);
  let client: MigrationClient;
  try {
    client = await pool.connect();
  } catch {
    throw new MigrationError(
      "Could not connect for migrations; database details omitted.",
    );
  }
  let lockHeld = false;
  let transactionOpen = false;
  let destroyClient = false;
  let failure: MigrationError | undefined;
  let applied = 0;
  let alreadyApplied = 0;
  const onClientError = (): void => {
    destroyClient = true;
    failure ??= new MigrationError(
      "Migration database connection failed; database details omitted.",
    );
  };
  // pg-pool removes its idle error listener while this client is checked out.
  client.on("error", onClientError);
  const checkedQuery = async (
    text: string,
    values?: unknown[],
  ): Promise<{ rows: unknown[] }> => {
    if (failure) throw failure;
    const result = await client.query(text, values);
    if (failure) throw failure;
    return result;
  };
  try {
    await checkedQuery(
      "SELECT pg_catalog.pg_advisory_lock($1, $2)",
      migrationLock,
    );
    lockHeld = true;
    const metadata = await checkedQuery(
      "SELECT pg_catalog.to_regclass('public.schema_migrations') AS metadata_table",
    );
    const firstRow = metadata.rows[0];
    if (
      typeof firstRow !== "object" ||
      firstRow === null ||
      !("metadata_table" in firstRow)
    ) {
      throw new MigrationError("Could not inspect migration metadata.");
    }
    let history: unknown[] = [];
    if (firstRow.metadata_table === null) {
      await checkedQuery(createMetadataTable);
    } else {
      const result = await checkedQuery(
        "SELECT version, name, checksum FROM public.schema_migrations ORDER BY version",
      );
      history = result.rows;
    }
    // Validate every historical file before starting any pending migration.
    const pending = validateAppliedMigrations(migrations, history);
    alreadyApplied = history.length;
    for (const migration of pending) {
      await checkedQuery("BEGIN");
      transactionOpen = true;
      await checkedQuery(migration.sql);
      await checkedQuery(
        "INSERT INTO public.schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
        [migration.version, migration.name, migration.checksum],
      );
      await checkedQuery("COMMIT");
      transactionOpen = false;
      applied += 1;
    }
  } catch (error) {
    failure ??=
      error instanceof MigrationError
        ? error
        : new MigrationError(
            "Migration database operation failed; database details omitted.",
          );
    if (transactionOpen && !destroyClient) {
      try {
        await client.query("ROLLBACK");
      } catch {
        destroyClient = true;
      }
    }
  } finally {
    if (lockHeld && !destroyClient) {
      try {
        await client.query(
          "SELECT pg_catalog.pg_advisory_unlock($1, $2)",
          migrationLock,
        );
      } catch {
        destroyClient = true;
        failure ??= new MigrationError(
          "Could not release the migration lock; database details omitted.",
        );
      }
    }
    // Release restores pg-pool's idle listener before ours is removed.
    client.release(destroyClient);
    client.removeListener("error", onClientError);
  }
  if (failure) throw failure;
  return { applied, alreadyApplied };
}
