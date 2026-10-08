import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  NotificationService,
  NotificationFailure,
  parseNotifications,
} from "./notifications.ts";
import { validReminderOffsets } from "../domain/taskReminders.ts";
import {
  validateTaskFields,
  authoredFields,
  taskAuthoringAllowed,
} from "./taskAuthoring.ts";
import { createI18n } from "../i18n/createI18n.ts";
import {
  reminderPresetKey,
  reminderNotificationKey,
} from "../i18n/notificationMessages.ts";
const event = randomUUID(),
  id = randomUUID();
const n = {
  id,
  eventId: event,
  taskId: randomUUID(),
  taskTitle: "Synthetic task",
  kind: "TASK_DUE_REMINDER",
  deadline: "2026-10-14",
  deadlineTime: "17:30",
  timezone: "Europe/Sofia",
  reminderOffsetMinutes: 60,
  dueAt: "2026-10-14T14:30:00.000Z",
  createdAt: "2026-10-14T13:30:00.000Z",
  readAt: null,
};
test("typed notification DTOs fail closed on foreign Event, malformed metadata, unbounded and contradictory counts", () => {
  assert.deepEqual(
    parseNotifications({ notifications: [n], unreadCount: 1 }, event),
    { notifications: [n], unreadCount: 1 },
  );
  for (const bad of [
    { ...n, eventId: randomUUID() },
    { ...n, kind: "ACTIVITY" },
    { ...n, readAt: "bad" },
    { ...n, deadlineTime: null },
    { ...n, reminderOffsetMinutes: 90 },
    { ...n, timezone: "invalid" },
    { ...n, dueAt: null },
  ])
    assert.throws(
      () => parseNotifications({ notifications: [bad], unreadCount: 1 }, event),
      NotificationFailure,
    );
  for (const body of [
    { notifications: [n], unreadCount: 0 },
    { notifications: [n, n], unreadCount: 2 },
    { notifications: Array(51).fill(n), unreadCount: 51 },
    { notifications: [], unreadCount: -1 },
  ])
    assert.throws(() => parseNotifications(body, event), NotificationFailure);
});
test("canonical requests preserve cookie auth and server confirmed read state without exposing identity", async () => {
  const paths: string[] = [];
  const service = new NotificationService(async (path, options) => {
    paths.push(String(path));
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.body, undefined);
    return Response.json(
      String(path).endsWith("read-all")
        ? { status: "ok" }
        : String(path).endsWith("/read")
          ? { notification: { ...n, readAt: n.createdAt } }
          : { notifications: [n], unreadCount: 1 },
    );
  });
  const signal = new AbortController().signal;
  assert.equal((await service.list(event, signal)).unreadCount, 1);
  assert.ok((await service.markRead(event, id, signal)).readAt);
  await service.markAllRead(event, signal);
  assert.deepEqual(paths, [
    `/api/events/${event}/notifications`,
    `/api/events/${event}/notifications/${id}/read`,
    `/api/events/${event}/notifications/read-all`,
  ]);
  for (const status of [401, 403, 404, 500])
    await assert.rejects(
      new NotificationService(async () => new Response(null, { status })).list(
        event,
        signal,
      ),
      NotificationFailure,
    );
  await assert.rejects(
    new NotificationService(async () => {
      throw new Error("Mock transport failure");
    }).markRead(event, id, signal),
    NotificationFailure,
  );
  await assert.rejects(
    new NotificationService(async () =>
      Response.json({ notification: n }),
    ).markRead(event, id, signal),
    NotificationFailure,
  );
});
test("fixed reminders validate time and preserve authoring fields, with Organizer-only affordances", () => {
  assert.ok(validReminderOffsets([1440, 60, 15]));
  for (const bad of [[60, 60], [1], ["60"], null, [1440, 60, 15, 1]])
    assert.equal(validReminderOffsets(bad), false);
  const fields = {
    title: "Task",
    category: "",
    context: "",
    deadline: "2026-10-14",
    deadlineTime: "17:30",
    priority: "normal" as const,
    reminderOffsets: [60],
  };
  assert.deepEqual(validateTaskFields(fields), {});
  assert.equal(
    validateTaskFields({ ...fields, deadlineTime: null }).reminderOffsets,
    "REMINDERS_REQUIRE_TIME",
  );
  assert.equal(
    validateTaskFields({ ...fields, reminderOffsets: [1] }).reminderOffsets,
    "INVALID_REMINDERS",
  );
  const task = {
    ...fields,
    id,
    eventId: event,
    ownerId: "",
    status: "completed" as const,
    acknowledged: true,
    updatedAt: n.createdAt,
  };
  assert.deepEqual(authoredFields(task), fields);
  assert.equal(taskAuthoringAllowed(undefined), false);
});
test("BG/EN reminder and notification labels use the live UI language", () => {
  for (const language of ["bg", "en"] as const) {
    const i18n = createI18n(language, { timeZone: "Europe/Sofia" });
    for (const offset of [1440, 60, 15]) {
      assert.notEqual(
        i18n.t(reminderPresetKey(offset)),
        reminderPresetKey(offset),
      );
      assert.notEqual(
        i18n.t(reminderNotificationKey(offset)),
        reminderNotificationKey(offset),
      );
    }
    assert.ok(i18n.t("notifications.unread", { count: 2 }).includes("2"));
  }
});
test("panel and authoring source preserve narrow refresh, real errors, read semantics and existing task navigation", async () => {
  const panel = await readFile(
    new URL("../components/NotificationCenter.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    panel,
    /setInterval|WebSocket|EventSource|requestPermission|createDemo/,
  );
  assert.match(panel, /showModal/);
  assert.match(panel, /onOpenTask\(confirmed.taskId\)/);
  assert.match(panel, /notifications.writeError/);
  const form = await readFile(
    new URL("../components/TaskAuthoringForm.tsx", import.meta.url),
    "utf8",
  );
  assert.match(form, /REMINDER_OFFSETS.map/);
  assert.match(form, /reminders.requiresTime/);
});
