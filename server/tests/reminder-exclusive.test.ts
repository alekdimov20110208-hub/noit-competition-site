import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { exclusiveReminderWorker } from "../src/notifications/exclusive.ts";

test("reminder lock skips a competing worker and releases the pinned client", async () => {
  let called = false,
    released = false;
  const pool = {
    connect: async () => ({
      query: async () => ({ rows: [{ locked: false }] }),
      on() {},
      removeListener() {},
      release() {
        released = true;
      },
    }),
  } as unknown as Pool;
  assert.equal(
    await exclusiveReminderWorker(pool, {
      run: async () => {
        called = true;
        return 1;
      },
    }).run(),
    0,
  );
  assert.equal(called, false);
  assert.equal(released, true);

  let destroyed = false;
  const uncertain = {
    connect: async () => ({
      query: async () => {
        throw Error("synthetic timeout");
      },
      on() {},
      removeListener() {},
      release(destroy: boolean) {
        destroyed = destroy;
      },
    }),
  } as unknown as Pool;
  await assert.rejects(
    exclusiveReminderWorker(uncertain, { run: async () => 0 }).run(),
    /Reminder lock acquisition failed/,
  );
  assert.equal(destroyed, true);
});

test("reminder pass failure still unlocks; unlock failure destroys the connection", async () => {
  for (const unlockFails of [false, true]) {
    let calls = 0,
      destroyed: boolean | undefined;
    const pool = {
      connect: async () => ({
        query: async () => {
          if (++calls === 2 && unlockFails) throw Error("synthetic");
          return { rows: [{ locked: true }] };
        },
        on() {},
        removeListener() {},
        release(destroy: boolean) {
          destroyed = destroy;
        },
      }),
    } as unknown as Pool;
    await assert.rejects(
      exclusiveReminderWorker(pool, {
        run: async () => {
          throw Error("worker failed");
        },
      }).run(),
      /worker failed/,
    );
    assert.equal(calls, 2);
    assert.equal(destroyed, unlockFails);
  }
});
