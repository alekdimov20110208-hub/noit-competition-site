import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  parseChangeCommand,
  ChangeCommandError,
  deriveImpact,
  type ChangeDto,
} from "../src/changes/model.ts";
import { createApp } from "../src/app.ts";

const eventId = randomUUID(),
  taskId = randomUUID(),
  memberId = randomUUID();
const denied = (status: number) => (error: unknown) =>
  error instanceof ChangeCommandError && error.statusCode === status;
test("Change whitelist, bounded Unicode, owner and canonical unique Task set", () => {
  assert.deepEqual(parseChangeCommand({ title: "  Arrival 🥋  " }), {
    title: "Arrival 🥋",
    context: "",
    responseOwnerMemberId: null,
    affectedTaskIds: [],
  });
  assert.deepEqual(
    parseChangeCommand({
      title: "Arrival",
      affectedTaskIds: [taskId, taskId.toUpperCase()],
    }).affectedTaskIds,
    [taskId],
  );
  assert.deepEqual(parseChangeCommand({ expectedVersion: 4 }, true), {
    expectedVersion: 4,
  });
  for (const key of [
    "id",
    "eventId",
    "actorId",
    "createdBy",
    "createdAt",
    "updatedAt",
    "accessRole",
    "operationalRole",
    "version",
    "severity",
    "status",
    "planB",
  ])
    assert.throws(
      () => parseChangeCommand({ title: "Arrival", [key]: "forged" }),
      denied(400),
    );
  for (const title of [
    "",
    " ",
    null,
    4,
    "x".repeat(201),
    "bad\u0000",
    "\ud800",
  ])
    assert.throws(() => parseChangeCommand({ title }), denied(400));
  for (const context of [null, 3, "x".repeat(5001), "\ud800"])
    assert.throws(
      () => parseChangeCommand({ title: "Arrival", context }),
      denied(400),
    );
  for (const affectedTaskIds of [
    null,
    ["invalid"],
    "invalid",
    [1],
    Array(1001).fill(taskId),
  ])
    assert.throws(
      () => parseChangeCommand({ title: "Arrival", affectedTaskIds }),
      denied(400),
    );
  for (const responseOwnerMemberId of ["invalid", 3, {}])
    assert.throws(
      () => parseChangeCommand({ title: "Arrival", responseOwnerMemberId }),
      denied(400),
    );
  for (const expectedVersion of [undefined, "1", 0, -1, 1.2, 2147483647])
    assert.throws(
      () => parseChangeCommand({ expectedVersion }, true),
      denied(400),
    );
  assert.throws(
    () => parseChangeCommand({ title: "Arrival", expectedVersion: 1 }),
    denied(400),
  );
});
test("current assignees deduplicate and optional deadlines remain date-only", () => {
  const person = { id: memberId, name: "Member", role: "Organizer" };
  assert.deepEqual(
    deriveImpact([
      {
        id: taskId,
        title: "Pickup",
        status: "not-started",
        assignedMember: person,
        deadline: "2026-10-05",
      },
      {
        id: randomUUID(),
        title: "Hotel",
        status: "completed",
        assignedMember: person,
        deadline: "2026-10-05",
      },
      {
        id: randomUUID(),
        title: "Welcome",
        status: "blocked",
        assignedMember: null,
        deadline: null,
      },
    ]),
    { taskCount: 3, people: [person], deadlines: ["2026-10-05"] },
  );
  assert.deepEqual(deriveImpact([]), {
    taskCount: 0,
    people: [],
    deadlines: [],
  });
});
test("Change HTTP authentication, trusted origin, envelope, no-store and no delete", async () => {
  let signedIn = true,
    fail = false;
  const calls: string[] = [];
  const change: ChangeDto = {
    id: randomUUID(),
    eventId,
    title: "Arrival",
    context: "",
    reporter: { id: memberId, name: "Author", role: "" },
    responseOwner: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    affectedTasks: [],
    impact: deriveImpact([]),
  };
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      auth: {
        api: {
          getSession: async () =>
            signedIn
              ? {
                  user: {
                    id: "author",
                    name: "Author",
                    email: "author@example.invalid",
                    active: true,
                  },
                }
              : null,
        },
        handler: async () => new Response(),
      },
      baseURL: "http://127.0.0.1:3001",
      taskMutationOrigins: ["http://127.0.0.1:5173"],
    },
    changes: {
      read: async (_user, event, id) => {
        calls.push(event + (id ?? ""));
        if (fail) throw new Error("PRIVATE_DB_ERROR");
        return [change];
      },
      create: async () => {
        calls.push("create");
        return change;
      },
      update: async () => {
        throw new ChangeCommandError(409, "CHANGE_VERSION_CONFLICT");
      },
    },
  });
  try {
    const path = `/api/events/${eventId}/changes`;
    const read = await app.inject({ url: path });
    assert.equal(read.statusCode, 200);
    assert.equal(read.headers["cache-control"], "no-store");
    assert.equal(
      (await app.inject({ url: `${path}/${change.id}` })).statusCode,
      200,
    );
    for (const headers of [
      {},
      { origin: "https://hostile.invalid" },
      { origin: "http://127.0.0.1:5173", "sec-fetch-site": "cross-site" },
    ]) {
      const before = calls.length;
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: path,
            headers,
            payload: { title: "Arrival" },
          })
        ).statusCode,
        403,
      );
      assert.equal(calls.length, before);
    }
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path,
          headers: { origin: "http://127.0.0.1:5173" },
          payload: { title: "Arrival" },
        })
      ).statusCode,
      201,
    );
    const conflict = await app.inject({
      method: "PATCH",
      url: `${path}/${change.id}`,
      headers: { origin: "http://127.0.0.1:5173" },
      payload: { expectedVersion: 1 },
    });
    assert.equal(conflict.statusCode, 409);
    assert.deepEqual(conflict.json(), {
      status: "error",
      code: "CHANGE_VERSION_CONFLICT",
    });
    assert.equal(
      (await app.inject({ method: "DELETE", url: `${path}/${change.id}` }))
        .statusCode,
      404,
    );
    fail = true;
    const error = await app.inject({ url: path });
    assert.equal(error.statusCode, 500);
    assert.ok(!error.body.includes("PRIVATE"));
    signedIn = false;
    for (const method of ["GET", "POST", "PATCH"] as const)
      assert.equal(
        (
          await app.inject({
            method,
            url: method === "PATCH" ? `${path}/${change.id}` : path,
          })
        ).statusCode,
        401,
      );
  } finally {
    await app.close();
  }
});
