import type { Pool, PoolClient } from "pg";

export class DatabaseBusyError extends Error {
  constructor() {
    super("Database queue is full.");
    this.name = "DatabaseBusyError";
  }
}

// A fresh lease proxy per checkout prevents late work from reaching a recycled
// client, and makes destroy/release idempotent across driver error callbacks.
export function databaseLease(client: PoolClient): PoolClient {
  let released = false;
  let broken = false;
  const onError = () => {
    broken = true;
  };
  client.on("error", onError);
  const release = (error?: Error | boolean) => {
    if (released) return;
    released = true;
    try {
      client.release(error || broken);
    } finally {
      client.removeListener("error", onError);
    }
  };
  const failed = (error: unknown) => {
    const value = error as { code?: string; message?: string } | undefined;
    if (
      value?.message === "Query read timeout" ||
      value?.code?.startsWith("08") ||
      ["ECONNRESET", "EPIPE", "57P01", "57P02", "57P03"].includes(
        value?.code ?? "",
      )
    ) {
      broken = true;
      release(true);
    }
  };
  const query = new Proxy(client.query, {
    apply(target, _receiver, args: unknown[]) {
      if (released) throw new Error("Database lease has ended.");
      const last = args.at(-1);
      if (typeof last === "function") {
        args[args.length - 1] = (...values: unknown[]) => {
          if (values[0]) failed(values[0]);
          Reflect.apply(last, undefined, values);
        };
      }
      try {
        const result = Reflect.apply(target, client, args) as unknown;
        if (result && typeof result === "object" && "then" in result)
          return Promise.resolve(result).catch((error) => {
            failed(error);
            throw error;
          });
        return result;
      } catch (error) {
        failed(error);
        throw error;
      }
    },
  });
  return new Proxy(client, {
    get(target, key) {
      if (key === "query") return query;
      if (key === "release") return release;
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function boundDatabaseQueue(pool: Pool, maxWaiting: number) {
  const connect = pool.connect.bind(pool);
  type Callback = (
    error: Error | undefined,
    client?: PoolClient,
    release?: (error?: Error | boolean) => void,
  ) => void;
  const checkout = async () => {
    if (pool.waitingCount >= maxWaiting) throw new DatabaseBusyError();
    return databaseLease(await connect());
  };
  pool.connect = ((callback?: Callback) => {
    const pending = checkout();
    if (!callback) return pending;
    void pending.then(
      (client) => callback(undefined, client, client.release.bind(client)),
      (error) =>
        callback(
          error instanceof DatabaseBusyError
            ? error
            : new Error("Database connection unavailable."),
        ),
    );
  }) as Pool["connect"];
}
