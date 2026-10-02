// A narrow pg transaction boundary shared by task commands and explicit setup.
// pg.Pool and pg.PoolClient satisfy these interfaces without an ORM/adapter.
export interface TransactionClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  on(event: "error", listener: () => void): unknown;
  removeListener(event: "error", listener: () => void): unknown;
  release(destroy?: boolean): void;
}

export interface TransactionPool {
  connect(): Promise<TransactionClient>;
}

export interface TransactionDatabase {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export async function inTransaction<T>(
  pool: TransactionPool,
  work: (database: TransactionDatabase) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let disconnected = false;
  let open = false;
  const onError = () => {
    disconnected = true;
  };
  client.on("error", onError);
  const database: TransactionDatabase = {
    async query(text, values) {
      if (disconnected) throw new Error("Database connection failed.");
      const result = await client.query(text, values);
      if (disconnected) throw new Error("Database connection failed.");
      return result;
    },
  };
  try {
    await database.query("BEGIN");
    open = true;
    await database.query("SET LOCAL statement_timeout = '10s'");
    await database.query("SET LOCAL lock_timeout = '3s'");
    // pg parses TIMESTAMPTZ as instants; its parser expects ISO date output.
    // This local setting also makes commands independent of a role's DateStyle.
    await database.query("SET LOCAL DateStyle = 'ISO, YMD'");
    const result = await work(database);
    await database.query("COMMIT");
    open = false;
    return result;
  } catch (error) {
    if (open && !disconnected) {
      try {
        await client.query("ROLLBACK");
      } catch {
        disconnected = true;
      }
    }
    throw error;
  } finally {
    client.release(disconnected);
    client.removeListener("error", onError);
  }
}
