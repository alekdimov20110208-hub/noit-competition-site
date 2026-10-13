import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { parseArchiveOperation, archiveEvent } from "../src/events/archive.ts";
import { EventCommandError } from "../src/events/model.ts";
const source = randomUUID(),
  key = randomUUID();
const actor = { id: "actor", name: "Actor", email: "actor@example.invalid" };
const input = { expectedVersion: 1, confirmationName: "Exact Event" };
const denied = (code: string) => (e: unknown) =>
  e instanceof EventCommandError && e.code === code;
test("Archive canonical identity normalizes UUIDs and field order, never typed names", () => {
  const a = parseArchiveOperation(actor, source, key, input);
  assert.deepEqual(
    a,
    parseArchiveOperation(actor, source.toUpperCase(), key.toUpperCase(), {
      confirmationName: input.confirmationName,
      expectedVersion: 1,
    }),
  );
  for (const confirmationName of [
    "exact Event",
    " Exact Event",
    "Exact Event ",
  ])
    assert.notEqual(
      a.digest,
      parseArchiveOperation(actor, source, key, { ...input, confirmationName })
        .digest,
    );
  assert.notEqual(
    a.digest,
    parseArchiveOperation(actor, source, key, { ...input, expectedVersion: 2 })
      .digest,
  );
});
test("Archive strictly validates fields, version, UUIDs and Unicode before database access", async () => {
  for (const extra of [
    "ownerUserId",
    "accessRole",
    "actorId",
    "archivedAt",
    "tasks",
  ])
    assert.throws(
      () =>
        parseArchiveOperation(actor, source, key, {
          ...input,
          [extra]: "forged",
        }),
      denied("INVALID_ARCHIVE_COMMAND"),
    );
  for (const expectedVersion of [0, -1, 1.5, "1", 2147483648])
    assert.throws(
      () =>
        parseArchiveOperation(actor, source, key, {
          ...input,
          expectedVersion,
        }),
      denied("INVALID_ARCHIVE_COMMAND"),
    );
  for (const confirmationName of [
    "",
    null,
    "x".repeat(201),
    "\u0000",
    "\ud800",
  ])
    assert.throws(
      () =>
        parseArchiveOperation(actor, source, key, {
          ...input,
          confirmationName,
        }),
      denied("INVALID_ARCHIVE_COMMAND"),
    );
  for (const invalidKey of [undefined, "bad", [key]])
    await assert.rejects(
      archiveEvent(
        {
          connect: async () => {
            throw Error("unexpected connection");
          },
        },
        actor,
        source,
        invalidKey,
        input,
      ),
      denied("INVALID_IDEMPOTENCY_KEY"),
    );
  assert.equal(
    parseArchiveOperation(actor, source, key, {
      ...input,
      expectedVersion: 2147483647,
    }).fields.expectedVersion,
    2147483647,
  );
});
test("Archive source Organizer authorization precedes receipt lookup and denial rolls back", async () => {
  for (const role of ["MEMBER", null]) {
    const calls: string[] = [];
    const pool = {
      connect: async () => ({
        query: async (sql: string) => {
          calls.push(sql);
          return {
            rows: sql.includes("FROM public.event WHERE")
              ? [{ version: 1 }]
              : sql.includes('JOIN public."user"')
                ? role
                  ? [{ id: "member", access_role: role }]
                  : []
                : [],
          };
        },
        on() {},
        removeListener() {},
        release() {},
      }),
    };
    await assert.rejects(
      archiveEvent(pool, actor, source, key, input),
      denied(role ? "FORBIDDEN" : "NOT_FOUND"),
    );
    assert.ok(calls.some((s) => s.includes("FOR UPDATE")));
    assert.ok(
      !calls.some((s) => s.includes("FROM public.event_command_receipt")),
    );
    assert.ok(calls.includes("ROLLBACK"));
    assert.ok(!calls.includes("COMMIT"));
  }
});
