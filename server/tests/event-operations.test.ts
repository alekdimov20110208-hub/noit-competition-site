import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEventOperation,
  runEventOperation,
} from "../src/events/operations.ts";
import {
  EventCommandError,
  type AccessibleEvent,
} from "../src/events/model.ts";
import { OperationalError } from "../src/operations/limits.ts";

const source = "11111111-1111-4111-8111-111111111111",
  key = "22222222-2222-4222-8222-222222222222";
const user = { id: "actor", name: "Actor", email: "actor@example.invalid" };
const input = {
  name: "Copy",
  startDate: "2026-11-01",
  endDate: "2026-11-02",
  timezone: "Europe/Sofia",
  expectedVersion: 1,
};
const outcome: AccessibleEvent = {
  ...input,
  id: "33333333-3333-4333-8333-333333333333",
  archived: false,
  version: 1,
  createdAt: "2026-10-12T00:00:00.000Z",
  updatedAt: "2026-10-12T00:00:00.000Z",
  membership: {
    id: "44444444-4444-4444-8444-444444444444",
    accessRole: "ORGANIZER",
  },
};
const denied = (code: string) => (error: unknown) =>
  error instanceof EventCommandError && error.code === code;

test("Event operation canonical identity ignores object order/name padding and normalizes UUID case", () => {
  const a = parseEventOperation(user, source, key, input);
  const b = parseEventOperation(user, source.toUpperCase(), key.toUpperCase(), {
    timezone: input.timezone,
    endDate: input.endDate,
    name: " Copy ",
    expectedVersion: 1,
    startDate: input.startDate,
  });
  assert.deepEqual(a, b);
  assert.equal(
    parseEventOperation(user, source, key, {
      ...input,
      expectedVersion: 2147483647,
    }).fields.expectedVersion,
    2147483647,
  );
  for (const change of [
    { name: "Other" },
    { expectedVersion: 2 },
    { timezone: "UTC" },
  ])
    assert.notEqual(
      parseEventOperation(user, source, key, { ...input, ...change }).digest,
      a.digest,
    );
});

test("Event operation rejects missing/malformed identity and forged fields before acquiring a database connection", async () => {
  const pool = {
    async connect(): Promise<never> {
      throw new Error("must not connect");
    },
  };
  for (const badKey of [undefined, "", "bad", [key], `${key},${key}`])
    await assert.rejects(
      runEventOperation(pool, user, source, badKey, input, async () => outcome),
      denied("INVALID_IDEMPOTENCY_KEY"),
    );
  for (const field of [
    "ownerUserId",
    "members",
    "tasks",
    "archived",
    "commandId",
  ])
    assert.throws(
      () =>
        parseEventOperation(user, source, key, { ...input, [field]: "forged" }),
      denied("INVALID_EVENT_COMMAND"),
    );
  assert.throws(
    () => parseEventOperation(user, "bad", key, input),
    denied("INVALID_ID"),
  );
});

function fixture(
  options: {
    role?: string;
    absent?: boolean;
    receipt?: boolean;
    mismatch?: boolean;
    revokedDestination?: boolean;
    failReceipt?: boolean;
  } = {},
) {
  const calls: string[] = [];
  let effect = 0;
  const receipt = {
    command_type: "EVENT_DUPLICATE",
    source_event_id: source,
    result_event_id: outcome.id,
    request_digest: options.mismatch
      ? "different"
      : parseEventOperation(user, source, key, input).digest,
    outcome,
  };
  const pool = {
    async connect() {
      return {
        async query(sql: string) {
          calls.push(sql);
          if (
            sql.startsWith("SELECT") &&
            sql.includes("FROM public.event WHERE")
          )
            return {
              rows: [
                {
                  id: source,
                  version: options.receipt ? 2 : 1,
                  archived_at: null,
                },
              ],
            };
          if (sql.includes('JOIN public."user"'))
            return {
              rows: options.absent
                ? []
                : [{ id: "member", access_role: options.role ?? "ORGANIZER" }],
            };
          if (sql.includes("FROM public.event_command_receipt"))
            return { rows: options.receipt ? [receipt] : [] };
          if (sql.includes("SELECT id FROM public.event_member"))
            return {
              rows: options.revokedDestination
                ? []
                : [{ id: "destination-member" }],
            };
          if (
            sql.includes("INSERT INTO public.event_command_receipt") &&
            options.failReceipt
          )
            throw new Error("receipt fault");
          return { rows: [] };
        },
        on() {},
        removeListener() {},
        release() {},
      };
    },
  };
  return {
    calls,
    pool,
    async work() {
      effect++;
      return outcome;
    },
    effects: () => effect,
  };
}

test("Event operation writes receipt within the business transaction and exact replay bypasses source version", async () => {
  const f = fixture();
  assert.deepEqual(
    await runEventOperation(f.pool, user, source, key, input, f.work),
    outcome,
  );
  assert.equal(f.effects(), 1);
  assert.ok(
    f.calls.findIndex((s) =>
      s.includes("INSERT INTO public.event_command_receipt"),
    ) < f.calls.indexOf("COMMIT"),
  );
  const replay = fixture({ receipt: true });
  assert.deepEqual(
    await runEventOperation(replay.pool, user, source, key, input, replay.work),
    outcome,
  );
  assert.equal(replay.effects(), 0);
});

test("quota denial permits only authorized exact receipts and never a new business effect", async () => {
  const rejection = new OperationalError(429, "RATE_LIMITED", 60);
  const replay = fixture({ receipt: true });
  assert.deepEqual(
    await runEventOperation(
      replay.pool,
      user,
      source,
      key,
      input,
      replay.work,
      rejection,
    ),
    outcome,
  );
  assert.equal(replay.effects(), 0);
  for (const options of [
    {},
    { receipt: true, mismatch: true },
    { receipt: true, role: "MEMBER" },
    { receipt: true, absent: true },
    { receipt: true, revokedDestination: true },
  ]) {
    const f = fixture(options);
    await assert.rejects(
      runEventOperation(f.pool, user, source, key, input, f.work, rejection),
      (error: unknown) =>
        options.mismatch
          ? denied("IDEMPOTENCY_KEY_REUSED")(error)
          : options.role
            ? denied("FORBIDDEN")(error)
            : options.absent || options.revokedDestination
              ? denied("NOT_FOUND")(error)
              : error === rejection,
    );
    assert.equal(f.effects(), 0);
    assert.ok(!f.calls.some((sql) => sql.startsWith("INSERT")));
  }
});

test("Current source authority precedes receipt lookup, conflict/revocation never run effects", async () => {
  for (const [options, code] of [
    [{ absent: true, receipt: true }, "NOT_FOUND"],
    [{ role: "MEMBER", receipt: true }, "FORBIDDEN"],
    [{ receipt: true, mismatch: true }, "IDEMPOTENCY_KEY_REUSED"],
    [{ receipt: true, revokedDestination: true }, "NOT_FOUND"],
  ] as const) {
    const f = fixture(options);
    await assert.rejects(
      runEventOperation(f.pool, user, source, key, input, f.work),
      denied(code),
    );
    assert.equal(f.effects(), 0);
    assert.ok(f.calls.includes("ROLLBACK"));
    if (options.absent || options.role)
      assert.ok(
        !f.calls.some((s) => s.includes("FROM public.event_command_receipt")),
      );
  }
});

test("Receipt failure rolls back effects and never commits", async () => {
  const f = fixture({ failReceipt: true });
  await assert.rejects(
    runEventOperation(f.pool, user, source, key, input, f.work),
    /receipt fault/,
  );
  assert.equal(f.effects(), 1);
  assert.ok(f.calls.includes("ROLLBACK"));
  assert.ok(!f.calls.includes("COMMIT"));
});
