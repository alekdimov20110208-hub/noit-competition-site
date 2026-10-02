import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  discoverMigrations,
  migrationChecksum,
  MigrationError,
  runMigrations,
  validateAppliedMigrations,
  type AppliedMigration,
  type MigrationClient,
  type MigrationPool,
} from "../src/db/migrations.ts";

async function withMigrationFiles(
  files: Record<string, string>,
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "budograph-migrations-"));
  try {
    await Promise.all(
      Object.entries(files).map(([name, sql]) =>
        writeFile(join(directory, name), sql),
      ),
    );
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

// Explicit mock: this models runner commands only, never a PostgreSQL engine.
class MockMigrationClient extends EventEmitter implements MigrationClient {
  commands: { text: string; values: unknown[] | undefined }[] = [];
  history: AppliedMigration[] = [];
  metadataExists = true;
  released = false;
  destroyed = false;
  locked = false;
  failWhen: (text: string) => boolean = () => false;
  private staged: AppliedMigration[] = [];

  async query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    this.commands.push({ text, values });
    if (this.failWhen(text)) {
      throw new Error(
        "Mock database error containing a credential-like sentinel that must be omitted.",
      );
    }
    if (text.includes("pg_advisory_lock(")) {
      this.locked = true;
    } else if (text.includes("pg_advisory_unlock(")) {
      this.locked = false;
    } else if (text.includes("to_regclass(")) {
      return {
        rows: [
          {
            metadata_table: this.metadataExists
              ? "public.schema_migrations"
              : null,
          },
        ],
      };
    } else if (text.includes("CREATE TABLE public.schema_migrations")) {
      this.metadataExists = true;
    } else if (text.startsWith("SELECT version")) {
      return { rows: this.history };
    } else if (text === "BEGIN" || text === "ROLLBACK") {
      this.staged = [];
    } else if (text.startsWith("INSERT INTO public.schema_migrations")) {
      const [version, name, checksum] = values ?? [];
      assert.equal(typeof version, "string");
      assert.equal(typeof name, "string");
      assert.equal(typeof checksum, "string");
      this.staged.push({
        version: String(version),
        name: String(name),
        checksum: String(checksum),
      });
    } else if (text === "COMMIT") {
      this.history.push(...this.staged);
      this.staged = [];
    }
    return { rows: [] };
  }

  release(destroy = false): void {
    this.released = true;
    this.destroyed = destroy;
    if (destroy) this.locked = false;
  }
}

function mockPool(client: MockMigrationClient): MigrationPool {
  return { connect: () => Promise.resolve(client) };
}

test("migration discovery orders valid four-digit SQL files and ignores non-SQL files", async () => {
  await withMigrationFiles(
    {
      "0010_tenth.sql": "SELECT 10;\n",
      "0002_second.sql": "SELECT 2;\n",
      "0001_first.sql": "SELECT 1;\n",
      "README.md": "No migrations yet.",
    },
    async (directory) => {
      const files = await discoverMigrations(directory);
      assert.deepEqual(
        files.map(({ version }) => version),
        ["0001", "0002", "0010"],
      );
      assert.equal(files[0]?.name, "0001_first.sql");
      assert.equal(files[0]?.sql, "SELECT 1;\n");
    },
  );
});

test("invalid SQL filenames and duplicate versions are rejected", async () => {
  for (const name of [
    "1_short.sql",
    "0000_zero.sql",
    "0001_Upper.sql",
    "0001_two-words.sql",
  ]) {
    await withMigrationFiles({ [name]: "SELECT 1;" }, async (directory) => {
      await assert.rejects(discoverMigrations(directory), MigrationError);
    });
  }
  await withMigrationFiles(
    { "0001_first.sql": "SELECT 1;", "0001_duplicate.sql": "SELECT 2;" },
    async (directory) => {
      await assert.rejects(
        discoverMigrations(directory),
        /Duplicate migration version 0001/,
      );
    },
  );
});

test("migration SHA-256 is stable and includes exact bytes and line endings", () => {
  const sql = Buffer.from("SELECT 1;\n");
  assert.equal(
    migrationChecksum(sql),
    "b4e0497804e46e0a0b0b8c31975b062152d551bac49c3c2e80932567b4085dcd",
  );
  assert.equal(
    migrationChecksum(sql),
    migrationChecksum(Buffer.from("SELECT 1;\n")),
  );
  assert.match(migrationChecksum(sql), /^[a-f0-9]{64}$/);
  assert.notEqual(
    migrationChecksum(sql),
    migrationChecksum(Buffer.from("SELECT 2;\n")),
  );
  assert.notEqual(
    migrationChecksum(sql),
    migrationChecksum(Buffer.from("SELECT 1;\r\n")),
  );
});

test("non-UTF-8 SQL fails with a safe filesystem error", async () => {
  await withMigrationFiles({}, async (directory) => {
    await writeFile(
      join(directory, "0001_invalid_encoding.sql"),
      Buffer.from([0xff]),
    );
    await assert.rejects(
      discoverMigrations(directory),
      /check the directory and UTF-8 file encoding/,
    );
  });
});

test("applied migrations cannot be changed, renamed or deleted", async () => {
  await withMigrationFiles(
    { "0001_first.sql": "SELECT 1;" },
    async (directory) => {
      const files = await discoverMigrations(directory);
      const first = files[0];
      assert.ok(first);
      const applied: AppliedMigration = { ...first };
      assert.deepEqual(validateAppliedMigrations(files, [applied]), []);
      assert.throws(
        () =>
          validateAppliedMigrations(files, [
            { ...applied, checksum: "0".repeat(64) },
          ]),
        /checksum mismatch/,
      );
      assert.throws(
        () =>
          validateAppliedMigrations(files, [
            { ...applied, name: "0001_old_name.sql" },
          ]),
        /renamed/,
      );
      assert.throws(() => validateAppliedMigrations([], [applied]), /missing/);
    },
  );
});

test("history validation rejects duplicate metadata and pending versions before applied history", async () => {
  await withMigrationFiles(
    { "0001_first.sql": "SELECT 1;", "0002_second.sql": "SELECT 2;" },
    async (directory) => {
      const files = await discoverMigrations(directory);
      const first = files[0];
      const second = files[1];
      assert.ok(first);
      assert.ok(second);
      assert.throws(
        () => validateAppliedMigrations(files, [first, first]),
        /duplicate versions/,
      );
      assert.throws(
        () => validateAppliedMigrations(files, [second]),
        /precedes applied history/,
      );
      assert.throws(
        () =>
          validateAppliedMigrations(files, [{ version: "sensitive value" }]),
        /metadata is invalid/,
      );
    },
  );
});

test("mocked runner locks a pinned client, commits SQL and parameterized metadata, then is idempotent", async () => {
  await withMigrationFiles(
    { "0001_first.sql": "SELECT 1;\n", "0002_second.sql": "SELECT 2;\n" },
    async (directory) => {
      const client = new MockMigrationClient();
      let connections = 0;
      const pool: MigrationPool = {
        connect: () => {
          connections += 1;
          return Promise.resolve(client);
        },
      };
      assert.deepEqual(await runMigrations(pool, directory), {
        applied: 2,
        alreadyApplied: 0,
      });
      assert.equal(connections, 1);
      assert.equal(client.released, true);
      assert.equal(client.locked, false);
      const inserts = client.commands.filter(({ text }) =>
        text.startsWith("INSERT INTO public.schema_migrations"),
      );
      assert.equal(inserts.length, 2);
      assert.ok(
        inserts.every(
          ({ text, values }) =>
            text.includes("VALUES ($1, $2, $3)") && values?.length === 3,
        ),
      );
      const transactions = client.commands.filter(({ text }) =>
        ["BEGIN", "COMMIT", "ROLLBACK"].includes(text),
      );
      assert.deepEqual(
        transactions.map(({ text }) => text),
        ["BEGIN", "COMMIT", "BEGIN", "COMMIT"],
      );
      client.commands = [];
      assert.deepEqual(await runMigrations(pool, directory), {
        applied: 0,
        alreadyApplied: 2,
      });
      assert.equal(
        client.commands.some(({ text }) => text === "BEGIN"),
        false,
      );
    },
  );
});

test("mocked runner creates only its metadata table for an empty migration directory", async () => {
  await withMigrationFiles(
    { "README.md": "No business SQL." },
    async (directory) => {
      const client = new MockMigrationClient();
      client.metadataExists = false;
      assert.deepEqual(await runMigrations(mockPool(client), directory), {
        applied: 0,
        alreadyApplied: 0,
      });
      const creates = client.commands.filter(({ text }) =>
        text.includes("CREATE TABLE"),
      );
      assert.equal(creates.length, 1);
      assert.ok(
        creates[0]?.text.includes("CREATE TABLE public.schema_migrations"),
      );
      assert.ok(creates[0]?.text.includes("DEFAULT CURRENT_TIMESTAMP"));
      assert.equal(client.released, true);
    },
  );
});

test("concurrent runners serialize through an explicitly simulated advisory lock", async () => {
  await withMigrationFiles(
    { "0001_first.sql": "SELECT 1;" },
    async (directory) => {
      const history: AppliedMigration[] = [];
      const lockTails = new Map<string, Promise<void>>();
      class ConcurrentMockClient extends MockMigrationClient {
        private releaseLock: (() => void) | undefined;

        override async query(
          text: string,
          values?: unknown[],
        ): Promise<{ rows: unknown[] }> {
          if (text.includes("pg_advisory_lock(")) {
            assert.equal(values?.length, 2);
            const key = values?.join(":") ?? "";
            const priorLock = lockTails.get(key) ?? Promise.resolve();
            const lock = new Promise<void>((resolve) => {
              this.releaseLock = resolve;
            });
            lockTails.set(key, lock);
            await priorLock;
          }
          const result = await super.query(text, values);
          if (text.includes("pg_advisory_unlock(")) this.releaseLock?.();
          return result;
        }
      }
      const clients = [new ConcurrentMockClient(), new ConcurrentMockClient()];
      for (const client of clients) client.history = history;
      let nextClient = 0;
      const pool: MigrationPool = {
        connect: () => {
          const client = clients[nextClient++];
          assert.ok(client);
          return Promise.resolve(client);
        },
      };
      const results = await Promise.all([
        runMigrations(pool, directory),
        runMigrations(pool, directory),
      ]);
      assert.deepEqual(results.map(({ applied }) => applied).sort(), [0, 1]);
      assert.equal(history.length, 1);
      assert.equal(lockTails.size, 1);
      assert.ok(clients.every((client) => client.released && !client.locked));
      assert.equal(
        clients
          .flatMap(({ commands }) => commands)
          .filter(({ text }) => text === "SELECT 1;").length,
        1,
      );
    },
  );
});

test("mocked runner validates all history before pending SQL writes", async () => {
  await withMigrationFiles(
    { "0001_first.sql": "SELECT 1;", "0002_second.sql": "SELECT 2;" },
    async (directory) => {
      const client = new MockMigrationClient();
      const first = (await discoverMigrations(directory))[0];
      assert.ok(first);
      client.history = [{ ...first, checksum: "0".repeat(64) }];
      await assert.rejects(
        runMigrations(mockPool(client), directory),
        /checksum mismatch/,
      );
      assert.equal(
        client.commands.some(
          ({ text }) => text === "BEGIN" || text.includes("CREATE TABLE"),
        ),
        false,
      );
      assert.equal(client.history.length, 1);
      assert.equal(client.locked, false);
      assert.equal(client.released, true);
    },
  );
});

test("mocked failed SQL rolls back only its file, stops later files and omits raw errors", async () => {
  await withMigrationFiles(
    {
      "0001_first.sql": "SELECT 1;",
      "0002_failed.sql": "SELECT 2;",
      "0003_later.sql": "SELECT 3;",
    },
    async (directory) => {
      const client = new MockMigrationClient();
      client.failWhen = (text) => text === "SELECT 2;";
      await assert.rejects(
        runMigrations(mockPool(client), directory),
        (error: unknown) => {
          assert.ok(error instanceof MigrationError);
          assert.equal(error.message.includes("sentinel"), false);
          assert.equal(error.cause, undefined);
          return true;
        },
      );
      assert.deepEqual(
        client.history.map(({ version }) => version),
        ["0001"],
      );
      assert.ok(client.commands.some(({ text }) => text === "ROLLBACK"));
      assert.equal(
        client.commands.some(({ text }) => text === "SELECT 3;"),
        false,
      );
      assert.equal(client.released, true);
      assert.equal(client.locked, false);
    },
  );
});

test("mocked metadata failure rolls back SQL and does not mark its migration as applied", async () => {
  await withMigrationFiles(
    { "0001_first.sql": "SELECT 1;" },
    async (directory) => {
      const client = new MockMigrationClient();
      client.failWhen = (text) =>
        text.startsWith("INSERT INTO public.schema_migrations");
      await assert.rejects(
        runMigrations(mockPool(client), directory),
        MigrationError,
      );
      assert.deepEqual(client.history, []);
      assert.ok(client.commands.some(({ text }) => text === "ROLLBACK"));
      assert.equal(
        client.commands.some(({ text }) => text === "COMMIT"),
        false,
      );
      assert.equal(client.released, true);
    },
  );
});

test("mocked rollback or unlock failures destroy the checked-out client", async () => {
  await withMigrationFiles(
    { "0001_first.sql": "SELECT 1;" },
    async (directory) => {
      const rollbackClient = new MockMigrationClient();
      rollbackClient.failWhen = (text) =>
        text === "SELECT 1;" || text === "ROLLBACK";
      await assert.rejects(
        runMigrations(mockPool(rollbackClient), directory),
        MigrationError,
      );
      assert.equal(rollbackClient.destroyed, true);
      assert.equal(rollbackClient.locked, false);
      const unlockClient = new MockMigrationClient();
      unlockClient.failWhen = (text) => text.includes("pg_advisory_unlock(");
      await assert.rejects(
        runMigrations(mockPool(unlockClient), directory),
        /release the migration lock/,
      );
      assert.equal(unlockClient.destroyed, true);
      assert.equal(unlockClient.released, true);
    },
  );
});

test("mocked connection and lock acquisition failures surface safe errors", async () => {
  await withMigrationFiles({}, async (directory) => {
    const pool: MigrationPool = {
      connect: () => Promise.reject(new Error("Mock credential sentinel")),
    };
    await assert.rejects(
      runMigrations(pool, directory),
      /Could not connect for migrations; database details omitted/,
    );
    const client = new MockMigrationClient();
    client.failWhen = (text) => text.includes("pg_advisory_lock(");
    await assert.rejects(
      runMigrations(mockPool(client), directory),
      MigrationError,
    );
    assert.equal(client.released, true);
  });
});

test("checked-out client error events during SQL fail safely and destroy the session", async () => {
  await withMigrationFiles(
    { "0001_first.sql": "SELECT 1;", "0002_later.sql": "SELECT 2;" },
    async (directory) => {
      const sentinel = "MOCK_CONNECTION_DETAIL_MUST_NOT_ESCAPE";
      class DisconnectingMockClient extends MockMigrationClient {
        override async query(
          text: string,
          values?: unknown[],
        ): Promise<{ rows: unknown[] }> {
          const result = await super.query(text, values);
          if (text === "SELECT 1;") this.emit("error", new Error(sentinel));
          return result;
        }
      }
      const client = new DisconnectingMockClient();
      await assert.rejects(
        runMigrations(mockPool(client), directory),
        (error: unknown) => {
          assert.ok(error instanceof MigrationError);
          assert.match(error.message, /database connection failed/);
          assert.equal(error.message.includes(sentinel), false);
          assert.equal(error.cause, undefined);
          return true;
        },
      );
      assert.deepEqual(client.history, []);
      assert.equal(
        client.commands.some(({ text }) => text.startsWith("INSERT INTO")),
        false,
      );
      assert.equal(
        client.commands.some(({ text }) => text === "SELECT 2;"),
        false,
      );
      assert.equal(client.released, true);
      assert.equal(client.destroyed, true);
      assert.equal(client.locked, false);
      assert.equal(client.listenerCount("error"), 0);
    },
  );
});

test("client errors between queries stop pending work and fail even with no migrations", async () => {
  const fixtures: Record<string, string>[] = [
    {},
    { "0001_first.sql": "SELECT 1;" },
  ];
  for (const files of fixtures) {
    await withMigrationFiles(files, async (directory) => {
      const sentinel = "MOCK_IDLE_CONNECTION_DETAIL_MUST_NOT_ESCAPE";
      class IdleDisconnectMockClient extends MockMigrationClient {
        override async query(
          text: string,
          values?: unknown[],
        ): Promise<{ rows: unknown[] }> {
          const result = await super.query(text, values);
          if (!text.startsWith("SELECT version")) return result;
          const emitDisconnect = (): void => {
            this.emit("error", new Error(sentinel));
          };
          return {
            // Simulate a disconnect after the query resolves, while its result
            // is consumed. No rejected query promise delivers this event.
            get rows(): unknown[] {
              emitDisconnect();
              return result.rows;
            },
          };
        }
      }
      const client = new IdleDisconnectMockClient();
      await assert.rejects(
        runMigrations(mockPool(client), directory),
        (error: unknown) => {
          assert.ok(error instanceof MigrationError);
          assert.equal(error.message.includes(sentinel), false);
          assert.equal(error.cause, undefined);
          return true;
        },
      );
      assert.equal(
        client.commands.some(({ text }) => text === "BEGIN"),
        false,
      );
      assert.equal(
        client.commands.some(({ text }) =>
          text.includes("pg_advisory_unlock("),
        ),
        false,
      );
      assert.equal(client.destroyed, true);
      assert.equal(client.released, true);
      assert.equal(client.locked, false);
    });
  }
});

test("checked-out error listener remains until release hands control back to the pool", async () => {
  await withMigrationFiles({}, async (directory) => {
    let idleErrorHandled = false;
    class HandoffMockClient extends MockMigrationClient {
      override release(destroy = false): void {
        assert.equal(this.listenerCount("error"), 1);
        // Model pg-pool synchronously restoring its own idle error listener.
        this.on("error", () => {
          idleErrorHandled = true;
        });
        super.release(destroy);
      }
    }
    const client = new HandoffMockClient();
    assert.deepEqual(await runMigrations(mockPool(client), directory), {
      applied: 0,
      alreadyApplied: 0,
    });
    assert.equal(client.listenerCount("error"), 1);
    client.emit("error", new Error("MOCK_POOL_HANDOFF_DETAIL"));
    assert.equal(idleErrorHandled, true);
    assert.equal(client.destroyed, false);
  });
});
