// Real controlled accounts and PostgreSQL. Named failure cases intercept only
// transport; intentional UI-created development Events/tasks are retained.
// Credentials/session cookies remain in memory, never in evidence artifacts.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readDatabaseEnv } from "../server/src/config/env.ts";
import { createDatabasePool } from "../server/src/db/pool.ts";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = "http://127.0.0.1:5173",
  out = "tmp/reminders-evidence/browser",
  run = randomUUID().slice(0, 8);
mkdirSync(out, { recursive: true });
const config = readDatabaseEnv();
assert.equal(config.nodeEnv, "development");
const pool = createDatabasePool(config, () => {});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const report = {
  browser: browser.version(),
  checks: [],
  matrix: [],
  intentionalEvents: [],
  intentionalTasks: [],
  applicationErrors: 0,
  step: "start",
};
const contexts = [];
let lastLogin = 0;
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
const href = (event, page = "tasks", task) =>
  `/events/${event}/${page}${task ? `?task=${task}` : ""}`;
async function make(label) {
  report.step = `login ${label}`;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    timezoneId: "Pacific/Honolulu",
  });
  contexts.push(context);
  await context.addInitScript(() => {
    if (location.href === "about:blank") return;
    if (!localStorage.getItem("budograph.preferences.v1"))
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language: "en", theme: "light" }),
      );
  });
  const page = await context.newPage();
  page.on("pageerror", () => report.applicationErrors++);
  await page.goto(origin + "/tasks");
  await page.locator("#login-email").waitFor();
  const remaining = 11_000 - (Date.now() - lastLogin);
  if (remaining > 0)
    await new Promise((resolve) => setTimeout(resolve, remaining));
  const email = process.env[`BUDOGRAPH_${label}_EMAIL`],
    password = process.env[`BUDOGRAPH_${label}_PASSWORD`];
  assert.ok(email && password, "Controlled account environment required");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  lastLogin = Date.now();
  const loginResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/sign-in/email",
  );
  await page.locator("button[type=submit]").click();
  assert.equal((await loginResponse).status(), 200);
  await page.locator(".app-shell").waitFor();
  await page.locator(".page--tasks:not([aria-busy])").waitFor();
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400)
      report.checks.push(
        `HTTP ${response.status()} ${new URL(response.url()).pathname}`,
      );
  });
  return { page, context };
}
async function events(account) {
  const response = await account.context.request.get(origin + "/api/events");
  assert.equal(response.status(), 200);
  return (await response.json()).events;
}
async function read(account, eventId, taskId) {
  const response = await account.context.request.get(
    origin + `/api/events/${eventId}/tasks${taskId ? `/${taskId}` : ""}`,
  );
  assert.equal(response.status(), 200);
  return response.json();
}
async function open(account, eventId, taskId) {
  await account.page.goto(origin + href(eventId, "tasks", taskId));
  await account.page.locator(".page--tasks:not([aria-busy])").waitFor();
  if (taskId) await account.page.locator(".task-drawer__identity").waitFor();
}
async function createForm(page) {
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.locator(".task-authoring-form").waitFor();
  await page.waitForFunction(
    () => document.activeElement?.id === "task-author-title",
  );
}
async function editForm(page) {
  await page
    .getByRole("button", { name: "Edit task details", exact: true })
    .click();
  await page.locator(".task-authoring-form").waitFor();
}
async function fill(page, title) {
  await page.locator("#task-author-title").fill(title);
  await page.locator("#task-author-category").fill("Preparation");
  await page
    .locator("#task-author-context")
    .fill("Controlled development authoring verification");
  await page.locator("#task-author-deadline").fill("2026-11-10");
  await page.locator("#task-author-priority-trigger").click();
  await page.getByRole("option", { name: "Important", exact: true }).click();
}
async function save(page, eventId, taskId, expected = taskId ? 200 : 201) {
  const path = `/api/events/${eventId}/tasks${taskId ? `/${taskId}` : ""}`;
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      response.request().method() === (taskId ? "PATCH" : "POST"),
  );
  void responsePromise.catch(() => {});
  await page.locator(".task-authoring-form button[type=submit]").click();
  const response = await responsePromise;
  report.lastExpectedStatus = expected;
  report.lastActualStatus = response.status();
  assert.equal(response.status(), expected);
  return expected < 300 ? (await response.json()).task : null;
}
async function command(account, eventId, taskId, kind, data, expected = 200) {
  const response = await account.context.request.fetch(
    origin + `/api/events/${eventId}/tasks/${taskId}${kind ? `/${kind}` : ""}`,
    {
      method:
        kind === "assignment"
          ? "POST"
          : kind === "acceptance"
            ? "PUT"
            : "PATCH",
      headers: { origin },
      data,
    },
  );
  assert.equal(response.status(), expected);
  return expected === 200 ? (await response.json()).task : null;
}
async function api(
  account,
  path,
  method = "GET",
  data,
  expected = method === "POST" ? 201 : 200,
) {
  const response = await account.context.request.fetch(origin + path, {
    method,
    headers: { origin },
    ...(data ? { data } : {}),
  });
  assert.equal(response.status(), expected);
  return expected < 300 ? response.json() : null;
}
async function time(page, value, language = "en") {
  const input = page.locator("#task-author-deadlineTime");
  if (!(await input.count())) {
    await page
      .getByRole("button", {
        name: language === "en" ? "Add time" : "Добавяне на час",
        exact: true,
      })
      .focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => document.activeElement?.id === "task-author-deadlineTime",
    );
  }
  await input.fill(value);
}
try {
  const organizer = await make("ORGANIZER"),
    member = await make("MEMBER");
  const mine = await events(organizer),
    theirs = await events(member);
  const shared = mine.find(
    (e) =>
      e.membership.accessRole === "ORGANIZER" &&
      theirs.some((m) => m.id === e.id && m.membership.accessRole === "MEMBER"),
  );
  assert.ok(shared);
  const recipient = theirs.find((e) => e.id === shared.id).membership.id;
  const roster = (await api(organizer, `/api/events/${shared.id}/members`))
    .members;
  const assigned = roster.find((m) => m.id === recipient);
  assert.ok(assigned);
  const foreign = (
    await api(organizer, "/api/events", "POST", {
      name: `Notification isolation ${run}`,
      startDate: "2097-10-14",
      endDate: "2097-10-15",
      timezone: "Europe/Sofia",
    })
  ).event;
  report.intentionalEvents.push(foreign.id);
  const title = `Synthetic reminders ${run} · ${"Long operational task title ".repeat(5)}`;
  await open(organizer, shared.id);
  await createForm(organizer.page);
  await fill(organizer.page, title);
  await organizer.page.locator("#task-author-deadline").fill("2097-10-14");
  assert.equal(
    await organizer.page.locator("#task-reminder-60").isDisabled(),
    true,
  );
  await time(organizer.page, "17:30");
  await organizer.page.locator("#task-reminder-60").check();
  await organizer.page.locator("#task-reminder-15").check();
  await organizer.page.locator("#task-author-assignedMemberId-trigger").click();
  await organizer.page.waitForFunction(
    () =>
      document.activeElement?.id === "task-author-assignedMemberId-option-0",
  );
  await organizer.page
    .getByRole("option", {
      name: assigned.name + (assigned.role ? ` · ${assigned.role}` : ""),
      exact: true,
    })
    .click();
  report.assigneeLabel = await organizer.page
    .locator("#task-author-assignedMemberId-trigger")
    .innerText();
  organizer.page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      new URL(req.url()).pathname === `/api/events/${shared.id}/tasks`
    )
      report.authoredAssignee = req.postDataJSON()?.assignedMemberId;
  });
  let task = await save(organizer.page, shared.id);
  report.intentionalTasks.push(task.id);
  assert.deepEqual(task.reminderOffsets, [60, 15]);
  assert.equal(task.assignedMemberId, recipient);
  await open(organizer, shared.id, task.id);
  await editForm(organizer.page);
  assert.equal(
    await organizer.page.locator("#task-reminder-60").isChecked(),
    true,
  );
  await organizer.page.keyboard.press("Escape");
  await open(member, shared.id, task.id);
  assert.equal(
    await member.page
      .getByRole("button", { name: "Edit task details", exact: true })
      .count(),
    0,
  );
  await member.page.keyboard.press("Escape");
  checked(
    "A–C: date-only controls disabled; real Organizer configuration persists; Member cannot edit",
  );
  const { createReminderWorker } =
    await import("../server/src/notifications/worker.ts");
  const scheduled = (
    await pool.query(
      "SELECT due_at FROM public.task_reminder WHERE task_id=$1 LIMIT 1",
      [task.id],
    )
  ).rows[0].due_at;
  let instant = new Date(scheduled.getTime() - 60 * 60_000);
  const worker = createReminderWorker(pool, () => instant);
  await worker.run();
  await worker.run();
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::INT n FROM public.notification WHERE task_id=$1 AND kind='TASK_DUE_REMINDER'",
        [task.id],
      )
    ).rows[0].n,
    1,
  );
  await member.page.locator(".notification-bell").click();
  await member.page.locator(".notification-list").waitFor();
  const reminder = member.page
    .locator(".notification-item")
    .filter({ hasText: "Reminder · 1 hour before" })
    .filter({ hasText: title });
  assert.equal(await reminder.count(), 1);
  assert.equal(await reminder.getAttribute("data-unread"), "true");
  await reminder.click();
  await member.page.locator(".task-drawer__identity").waitFor();
  assert.ok(member.page.url().endsWith(`?task=${task.id}`));
  await member.page.keyboard.press("Escape");
  await member.page.reload();
  await member.page.locator(".notification-bell").waitFor();
  await member.page.locator(".notification-bell").click();
  await member.page.locator(".notification-list").waitFor();
  assert.equal(
    await member.page
      .locator(".notification-item")
      .filter({ hasText: "Reminder · 1 hour before" })
      .filter({ hasText: title })
      .getAttribute("data-unread"),
    "false",
  );
  checked(
    "D–F: deterministic reminder appears exactly once; opening its task persists read state after reload",
  );
  instant = new Date(scheduled.getTime() - 15 * 60_000);
  await worker.run();
  await member.page
    .getByRole("button", { name: "Refresh notifications", exact: true })
    .click();
  await member.page
    .getByRole("button", { name: "Mark all as read", exact: true })
    .click();
  await member.page.waitForFunction(() =>
    document
      .querySelector(".notification-bell")
      ?.getAttribute("aria-label")
      ?.includes("0 unread"),
  );
  await member.page.keyboard.press("Escape");
  checked("G: mark all read refetches durable zero unread count");
  task = await command(organizer, shared.id, task.id, "", {
    deadlineTime: "18:30",
    expectedVersion: task.version,
  });
  task = await command(organizer, shared.id, task.id, "assignment", {
    assignedMemberId: shared.membership.id,
    expectedVersion: task.version,
  });
  instant = new Date(scheduled.getTime());
  await worker.run();
  const delivered = await pool.query(
    "SELECT recipient_user_id FROM public.notification WHERE task_id=$1 AND kind='TASK_DUE_REMINDER' ORDER BY created_at",
    [task.id],
  );
  assert.equal(delivered.rows.length, 3);
  assert.notEqual(
    delivered.rows[2].recipient_user_id,
    delivered.rows[0].recipient_user_id,
  );
  task = await command(organizer, shared.id, task.id, "status", {
    status: "completed",
    expectedVersion: task.version,
  });
  instant = new Date(scheduled.getTime() + 45 * 60_000);
  await worker.run();
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::INT n FROM public.notification WHERE task_id=$1 AND kind='TASK_DUE_REMINDER'",
        [task.id],
      )
    ).rows[0].n,
    3,
  );
  task = await command(organizer, shared.id, task.id, "", {
    deadlineTime: null,
    expectedVersion: task.version,
  });
  assert.deepEqual(task.reminderOffsets, []);
  checked(
    "H–J: reassignment delivers to current assignee; completion suppresses pending reminder; removing time clears rows",
  );
  await open(organizer, foreign.id);
  await organizer.page.locator(".notification-bell").click();
  await organizer.page
    .getByText("No notifications for this event.", { exact: true })
    .waitFor();
  assert.equal(await organizer.page.locator(".notification-item").count(), 0);
  await organizer.page.keyboard.press("Escape");
  checked("K: Event switch shows its own empty notification state");
  const race = (
    await api(organizer, `/api/events/${shared.id}/tasks`, "POST", {
      title: `Synthetic race ${run}`,
      deadline: "2097-10-14",
      deadlineTime: "19:30",
      priority: "normal",
      assignedMemberId: recipient,
      reminderOffsets: [60],
    })
  ).task;
  report.intentionalTasks.push(race.id);
  instant = new Date(scheduled.getTime() + 60 * 60_000);
  await Promise.all([
    worker.run(),
    createReminderWorker(pool, () => instant).run(),
  ]);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::INT n FROM public.notification WHERE task_id=$1 AND kind='TASK_DUE_REMINDER'",
        [race.id],
      )
    ).rows[0].n,
    1,
  );
  checked("L: concurrent real workers produce exactly one reminder row");
  // Explicit transport failures must remain visible and never substitute demo rows.
  await open(member, shared.id);
  await member.page.route(
    `**/api/events/${shared.id}/notifications/*/read`,
    (route) => route.fulfill({ status: 503, body: "{}" }),
  );
  await member.page.locator(".notification-bell").click();
  await member.page.locator(".notification-list").waitFor();
  const unread = member.page
    .locator(".notification-item[data-unread=true]")
    .first();
  const unreadCount = await member.page
    .locator(".notification-bell")
    .getAttribute("aria-label");
  await unread.click();
  await member.page
    .getByRole("alert")
    .filter({ hasText: "Read state could not be saved" })
    .waitFor();
  assert.equal(
    await member.page.locator(".notification-bell").getAttribute("aria-label"),
    unreadCount,
  );
  await member.page.unroute(`**/api/events/${shared.id}/notifications/*/read`);
  await member.page.keyboard.press("Escape");
  await member.page.route(`**/api/events/${shared.id}/notifications`, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await member.page.locator(".notification-bell").click();
  await member.page
    .getByRole("alert")
    .filter({ hasText: "Notifications could not be loaded" })
    .waitFor();
  await member.page.unroute(`**/api/events/${shared.id}/notifications`);
  await member.page
    .getByRole("button", { name: "Refresh notifications", exact: true })
    .click();
  await member.page.locator(".notification-list").waitFor();
  await member.page.keyboard.press("Escape");
  checked(
    "fetch/read failures are explicit, recoverable, and do not falsely save read state",
  );
  // Retain only synthetic notifications for the bounded long-list UI fixture.
  await pool.query(
    `INSERT INTO public.notification (id,event_id,recipient_user_id,kind,task_id,actor_user_id,task_title,deadline,deadline_time,timezone,task_version)
    SELECT gen_random_uuid(),$1,m.user_id,'TASK_ASSIGNED',$2,$3,$4,'2097-10-14','17:30','Europe/Sofia',10000+i FROM public.event_member m CROSS JOIN generate_series(1,52) i WHERE m.id=$5`,
    [
      shared.id,
      task.id,
      delivered.rows[0].recipient_user_id,
      title,
      shared.membership.id,
    ],
  );
  for (const width of [1440, 1080, 768, 390, 320])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"]) {
        const page = organizer.page;
        report.step = `matrix ${width} ${language} ${theme}`;
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          ({ language, theme }) =>
            localStorage.setItem(
              "budograph.preferences.v1",
              JSON.stringify({ version: 1, language, theme }),
            ),
          { language, theme },
        );
        await open(organizer, shared.id);
        await page.locator(".notification-bell").waitFor();
        await page.locator(".notification-bell").focus();
        await page.keyboard.press("Enter");
        await page.locator(".notification-list").waitFor();
        assert.equal(await page.locator(".notification-item").count(), 50);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        assert.equal(
          await page
            .locator(".notification-panel")
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
          true,
        );
        assert.equal(
          await page
            .locator(".notification-panel")
            .evaluate(
              (el) =>
                getComputedStyle(el).color ===
                getComputedStyle(document.documentElement).color,
            ),
          true,
        );
        await page.screenshot({
          path: `${out}/panel-${width}-${language}-${theme}.png`,
          fullPage: true,
        });
        await page.keyboard.press("Escape");
        await page.waitForFunction(() =>
          document.activeElement?.classList.contains("notification-bell"),
        );
        await open(organizer, shared.id, task.id);
        await page
          .getByRole("button", {
            name:
              language === "en"
                ? "Edit task details"
                : "Редактиране на задачата",
            exact: true,
          })
          .click();
        await page.locator(".task-authoring-form").waitFor();
        assert.equal(
          await page.locator("#task-reminder-60").isDisabled(),
          true,
        );
        await time(page, "17:30", language);
        assert.equal(
          await page.locator("#task-reminder-60").isDisabled(),
          false,
        );
        await page.locator("#task-reminder-15").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${out}/form-${width}-${language}-${theme}.png`,
        });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await page.keyboard.press("Escape");
        report.matrix.push({ width, language, theme });
        checked(
          `Matrix ${width} ${language}/${theme}: bounded panel, keyboard/Escape, long title, reminder form, no overflow`,
        );
      }
  assert.equal(report.applicationErrors, 0);
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.failure = error instanceof Error ? error.name : "UnknownError";
  // Keep operational content, credentials and raw Playwright arguments out of logs.
  throw new Error(
    "Task reminder verification failed; inspect the sanitized report.",
  );
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
  await pool.end();
}
