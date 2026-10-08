import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import { registerReminderWorker } from "../src/notifications/worker.ts";
import { parseTaskAuthoring, TaskCommandError } from "../src/tasks/model.ts";
import { randomUUID } from "node:crypto";

test("reminder configuration presets, omission, strict duplicates and date-only creation", () => {
  const fields = {
    title: "Task",
    deadline: "2026-10-14",
    deadlineTime: "17:30",
    priority: "normal",
  };
  assert.deepEqual(
    parseTaskAuthoring({ ...fields, reminderOffsets: [15, 1440, 60] })
      .reminderOffsets,
    [1440, 60, 15],
  );
  assert.deepEqual(parseTaskAuthoring(fields).reminderOffsets, []);
  assert.equal(
    Object.hasOwn(
      parseTaskAuthoring({ expectedVersion: 1 }, true),
      "reminderOffsets",
    ),
    false,
  );
  for (const reminderOffsets of [
    [60, 60],
    [30],
    null,
    [60, 15, 1440, 60],
    ["60"],
  ])
    assert.throws(
      () => parseTaskAuthoring({ ...fields, reminderOffsets }),
      TaskCommandError,
    );
  assert.throws(
    () =>
      parseTaskAuthoring({
        title: "Task",
        deadline: fields.deadline,
        priority: "normal",
        reminderOffsets: [60],
      }),
    TaskCommandError,
  );
});
test("notification routes require session/trusted origin and never accept browser creation or recipient authority", async () => {
  const event = randomUUID(),
    id = randomUUID();
  let authenticated = true;
  let writes = 0;
  const user = {
    id: "synthetic-notification-user",
    active: true,
    name: "Synthetic",
    email: "synthetic@example.invalid",
  };
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: "http://localhost:3001",
      taskMutationOrigins: ["http://localhost:5173"],
      auth: {
        handler: async () => new Response(null, { status: 404 }),
        api: { getSession: async () => (authenticated ? { user } : null) },
      },
    },
    notifications: {
      list: async (actor, scope) => {
        assert.equal(actor.id, user.id);
        assert.equal(scope, event);
        return { notifications: [], unreadCount: 0 };
      },
      markRead: async () => {
        writes++;
        throw new TaskCommandError(404, "NOT_FOUND");
      },
      markAllRead: async () => {
        writes++;
        return { status: "ok" };
      },
    },
  });
  try {
    const path = `/api/events/${event}/notifications`;
    const read = await app.inject({ url: path });
    assert.equal(read.statusCode, 200);
    assert.equal(read.headers["cache-control"], "no-store");
    assert.equal(
      (
        await app.inject({
          url: path,
          method: "POST",
          payload: { message: "forged" },
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (await app.inject({ url: path + "/read-all", method: "POST" }))
        .statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          url: path + "/read-all",
          method: "POST",
          headers: { origin: "http://localhost:5173" },
          payload: { recipientUserId: "forged" },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          url: path + `/${id}/read`,
          method: "POST",
          headers: { origin: "http://localhost:5173" },
        })
      ).statusCode,
      404,
    );
    authenticated = false;
    assert.equal((await app.inject({ url: path })).statusCode, 401);
    assert.equal(writes, 1);
  } finally {
    await app.close();
  }
});
test("Fastify worker starts once, drains the active pass and leaves no timer on close", async () => {
  let count = 0;
  let finish: () => void = () => {};
  const app = createApp({ checkDatabase: async () => {} });
  registerReminderWorker(app, {
    run: async () => {
      count++;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return 0;
    },
  });
  await app.ready();
  assert.equal(count, 1);
  const closing = app.close();
  finish();
  await closing;
  assert.equal(count, 1);
});
