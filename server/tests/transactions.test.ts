import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  inTransaction,
  TransactionOutcomeUnknownError,
  type TransactionClient,
} from "../src/db/transaction.ts";
import { databaseLease } from "../src/db/lease.ts";
import type { PoolClient } from "pg";

function fixture(fault?: (sql: string) => void) {
  const emitter = new EventEmitter();
  const queries: string[] = [],
    releases: boolean[] = [];
  const client = Object.assign(emitter, {
    query: async (sql: string) => {
      queries.push(sql);
      fault?.(sql);
      return { rows: [] };
    },
    release: (destroy = false) => {
      releases.push(destroy);
    },
  }) as TransactionClient;
  return { client, queries, releases, pool: { connect: async () => client } };
}
test("transaction owns exactly one release and invalidates escaped database handles", async () => {
  const f = fixture();
  let escaped;
  await inTransaction(f.pool, async (db) => {
    escaped = db;
    await db.query("SELECT fixture");
  });
  assert.deepEqual(f.releases, [false]);
  assert.ok(
    f.queries.includes("SET LOCAL idle_in_transaction_session_timeout = '15s'"),
  );
  await assert.rejects(escaped!.query("SELECT late"), /unavailable/);
});
test("lost COMMIT acknowledgement destroys lease, reports uncertainty and never retries or sends rollback", async () => {
  const f = fixture((sql) => {
    if (sql === "COMMIT") throw Error("synthetic lost acknowledgement");
  });
  let effects = 0;
  await assert.rejects(
    inTransaction(f.pool, async () => {
      effects++;
    }),
    TransactionOutcomeUnknownError,
  );
  assert.equal(effects, 1);
  assert.deepEqual(f.releases, [true]);
  assert.ok(!f.queries.includes("ROLLBACK"));
});
test("cancellation of stalled work releases once, rejects promptly and prevents later SQL", async () => {
  const f = fixture(),
    controller = new AbortController();
  let continueWork!: () => void;
  const gate = new Promise<void>((r) => {
    continueWork = r;
  });
  let started!: () => void;
  const ready = new Promise<void>((r) => {
    started = r;
  });
  const pending = inTransaction(
    f.pool,
    async (db) => {
      started();
      await gate;
      await db.query("SELECT forbidden_late");
    },
    { signal: controller.signal },
  );
  await ready;
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  continueWork();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(f.releases, [true]);
  assert.ok(!f.queries.includes("SELECT forbidden_late"));
});
test("lease destroys timed-out promise/callback queries once and rejects reuse", async () => {
  for (const callback of [false, true]) {
    let releases = 0;
    const raw = Object.assign(new EventEmitter(), {
      query: (...args: unknown[]) => {
        const error = Error("Query read timeout"),
          cb = args.at(-1);
        if (typeof cb === "function") {
          queueMicrotask(() => cb(error));
          return;
        }
        return Promise.reject(error);
      },
      release: (destroy?: boolean) => {
        assert.equal(destroy, true);
        releases++;
      },
    }) as unknown as PoolClient;
    const lease = databaseLease(raw);
    if (callback)
      await new Promise<void>((r) =>
        lease.query("SELECT fixture", (error) => {
          assert.ok(error);
          r();
        }),
      );
    else await assert.rejects(lease.query("SELECT fixture"), /timeout/);
    lease.release();
    lease.release(true);
    assert.equal(releases, 1);
    assert.throws(() => lease.query("SELECT stale"), /lease has ended/);
  }
});
