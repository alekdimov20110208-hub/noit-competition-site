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

export class TransactionOutcomeUnknownError extends Error {
  constructor() {
    super(
      "Transaction commit outcome is unknown; automatic retry is forbidden.",
    );
    this.name = "TransactionOutcomeUnknownError";
  }
}

export async function inTransaction<T>(
  pool: TransactionPool,
  work: (database: TransactionDatabase) => Promise<T>,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  options.signal?.throwIfAborted();
  const client = await pool.connect();
  let disconnected = false;
  let open = false;
  let phase: "begin" | "work" | "commit" | "done" = "begin";
  let released = false;
  let rejectUnavailable!: (error: Error) => void;
  const unavailable = new Promise<never>((_resolve, reject) => {
    rejectUnavailable = reject;
  });
  void unavailable.catch(() => {});
  const release = (destroy: boolean) => {
    if (released) return;
    released = true;
    client.release(destroy);
  };
  const onError = () => {
    disconnected = true;
    rejectUnavailable(new Error("Database connection failed."));
  };
  client.on("error", onError);
  const abort = () => {
    disconnected = true;
    release(true);
    rejectUnavailable(new Error("Database transaction cancelled."));
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const database: TransactionDatabase = {
    async query(text, values) {
      if (disconnected || released || phase === "done")
        throw new Error("Database transaction unavailable.");
      let result: { rows: unknown[] };
      try {
        result = await Promise.race([client.query(text, values), unavailable]);
      } catch (error) {
        // A SQLSTATE denotes a server reply; other query failures may leave a
        // command running or a broken protocol stream. Never recycle that lease.
        const failure = error as
          { code?: string; message?: string } | undefined;
        if (
          failure?.message === "Query read timeout" ||
          failure?.code?.startsWith("08")
        )
          disconnected = true;
        throw error;
      }
      if (disconnected) throw new Error("Database connection failed.");
      return result;
    },
  };
  try {
    await database.query("BEGIN");
    open = true;
    phase = "work";
    await database.query("SET LOCAL statement_timeout = '10s'");
    await database.query("SET LOCAL lock_timeout = '3s'");
    await database.query(
      "SET LOCAL idle_in_transaction_session_timeout = '15s'",
    );
    // pg parses TIMESTAMPTZ as instants; its parser expects ISO date output.
    // This local setting also makes commands independent of a role's DateStyle.
    await database.query("SET LOCAL DateStyle = 'ISO, YMD'");
    const result = await Promise.race([work(database), unavailable]);
    phase = "commit";
    await database.query("COMMIT");
    open = false;
    phase = "done";
    return result;
  } catch (error) {
    if (phase === "commit") {
      disconnected = true;
      throw new TransactionOutcomeUnknownError();
    }
    if (phase === "begin") disconnected = true;
    if (open && !disconnected) {
      try {
        await client.query("ROLLBACK");
      } catch {
        disconnected = true;
      }
    }
    throw error;
  } finally {
    phase = "done";
    options.signal?.removeEventListener("abort", abort);
    release(disconnected);
    client.removeListener("error", onError);
  }
}
