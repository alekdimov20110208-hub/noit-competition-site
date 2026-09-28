import assert from "node:assert/strict";
import test from "node:test";
import {
  millisecondsUntilLocalMidnight,
  startLocalCalendarClock,
} from "./localCalendarClock.ts";

test("calendar clock refreshes at midnight, rearms after suspension/resume, and cancels on stop", () => {
  let now = new Date(2026, 7, 12, 23, 59, 59, 999);
  let callback = () => {};
  let delay = 0;
  let sequence = 0;
  const canceled: unknown[] = [];
  const changes: Date[] = [];
  const clock = startLocalCalendarClock(
    (value) => changes.push(value),
    () => now,
    (next, wait) => {
      callback = next;
      delay = wait;
      return ++sequence as unknown as ReturnType<typeof setTimeout>;
    },
    (timer) => {
      canceled.push(timer);
    },
  );
  assert.equal(delay, 1);
  assert.deepEqual(changes, [now]);
  now = new Date(2026, 7, 13);
  callback();
  assert.equal(changes.length, 2);
  assert.equal(changes.at(-1), now);
  assert.equal(delay, 86_400_000);
  now = new Date(2026, 7, 16, 10);
  clock.refresh();
  assert.equal(changes.at(-1), now);
  assert.equal(delay, 14 * 60 * 60 * 1000);
  clock.stop();
  assert.deepEqual(canceled, [1, 2, 3]);
});

test("subscription immediately replaces a pre-midnight render sample with the current day", () => {
  let renderedNow = new Date(2026, 7, 12, 23, 59, 59, 999);
  const effectNow = new Date(2026, 7, 13, 0, 0, 0);
  let scheduledDelay = 0;
  const clock = startLocalCalendarClock(
    (now) => {
      renderedNow = now;
    },
    () => effectNow,
    (_callback, delay) => {
      scheduledDelay = delay;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    () => {},
  );
  assert.equal(renderedNow, effectNow);
  assert.equal(scheduledDelay, 86_400_000);
  clock.stop();
});

test("local midnight delay handles 23-hour and 25-hour DST days", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "Europe/Kyiv";
    assert.equal(
      millisecondsUntilLocalMidnight(new Date(2026, 2, 29)),
      23 * 60 * 60 * 1000,
    );
    assert.equal(
      millisecondsUntilLocalMidnight(new Date(2026, 9, 25)),
      25 * 60 * 60 * 1000,
    );
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
