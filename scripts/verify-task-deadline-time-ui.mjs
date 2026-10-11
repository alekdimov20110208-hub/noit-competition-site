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
  out = "tmp/task-due-time-evidence/browser",
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
let diagnosticPage;
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
  diagnosticPage = page;
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
async function activity(id) {
  return (
    await pool.query(
      "SELECT action_type,payload,actor_member_id FROM public.activity_entry WHERE target_id=$1 ORDER BY created_at,id",
      [id],
    )
  ).rows;
}
async function safe(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.doesNotMatch(
    await page.locator(".app-main").innerText(),
    /PRIVATE_ERROR|LOCAL_P2B_POISON|Fastify|PostgreSQL|stack trace/,
  );
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
async function rendered(page, text, selector = ".task-progress-meta") {
  await page.waitForFunction(
    ({ text, selector }) =>
      [...document.querySelectorAll(selector)].some((el) =>
        el.textContent.includes(text),
      ),
    { text, selector },
  );
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
  diagnosticPage = organizer.page;
  const shared = (await events(organizer)).find(
    (event) => event.membership.accessRole === "ORGANIZER",
  );
  const memberEvents = await events(member);
  const sharedMemberEvent =
    memberEvents.find(
      (event) =>
        event.id === shared.id && event.membership.accessRole === "MEMBER",
    ) ??
    (await events(organizer)).find(
      (event) =>
        event.membership.accessRole === "ORGANIZER" &&
        memberEvents.some(
          (value) =>
            value.id === event.id && value.membership.accessRole === "MEMBER",
        ),
    );
  assert.ok(sharedMemberEvent);
  const fresh = (
    await api(organizer, "/api/events", "POST", {
      name: `Due time verification ${run}`,
      startDate: "2026-11-11",
      endDate: "2026-11-12",
      timezone: "Europe/Sofia",
    })
  ).event;
  report.intentionalEvents.push(fresh.id);
  await open(organizer, fresh.id);
  await createForm(organizer.page);
  await fill(organizer.page, `Due time ${run}`);
  assert.equal(
    await organizer.page.locator("#task-author-deadlineTime").count(),
    0,
  );
  let task = await save(organizer.page, fresh.id);
  report.intentionalTasks.push(task.id);
  assert.equal(task.deadline, "2026-11-10");
  assert.equal(task.deadlineTime, null);
  await rendered(organizer.page, "10 Nov 2026");
  assert.doesNotMatch(
    await organizer.page.locator(".task-progress-meta").innerText(),
    /10 Nov 2026 ·/,
  );
  checked("A: UI create without time preserves the date-only deadline");
  // Current Organizer may accept their own assignment under the locked contract.
  task = await command(organizer, fresh.id, task.id, "assignment", {
    assignedMemberId: fresh.membership.id,
    expectedVersion: task.version,
  });
  task = await command(organizer, fresh.id, task.id, "acceptance", {
    accepted: true,
    expectedVersion: task.version,
  });
  const acceptance = task.acceptedAt;
  for (const value of ["16:00", "18:30", null, "23:59"]) {
    await open(organizer, fresh.id, task.id);
    await editForm(organizer.page);
    if (value === null)
      await organizer.page
        .getByRole("button", { name: "Remove time", exact: true })
        .click();
    else await time(organizer.page, value);
    const count = (await activity(task.id)).length,
      version = task.version;
    task = await save(organizer.page, fresh.id, task.id);
    assert.equal(task.deadlineTime, value);
    assert.equal(task.version, version + 1);
    assert.equal(task.acceptedAt, acceptance);
    assert.equal((await activity(task.id)).length, count + 1);
    await organizer.page.reload();
    await organizer.page.locator(".task-drawer__identity").waitFor();
    await rendered(
      organizer.page,
      `10 Nov 2026${value === null ? "" : ` · ${value}`}`,
    );
    checked(
      `B–E/H: ${value === null ? "Remove time" : value} persists on refresh, one version/history entry, acceptance unchanged`,
    );
  }
  const change = (
    await api(organizer, `/api/events/${fresh.id}/changes`, "POST", {
      title: `Live time ${run}`,
      context: "Current affected work",
      responseOwnerMemberId: null,
      affectedTaskIds: [task.id],
    })
  ).change;
  const beforeChangeHistory = await activity(change.id);
  await organizer.page.goto(
    origin + `/events/${fresh.id}/changes/${change.id}`,
  );
  await organizer.page.locator(".change-detail").waitFor();
  await rendered(organizer.page, "10 Nov 2026 · 23:59", ".change-detail");
  await open(organizer, fresh.id, task.id);
  await editForm(organizer.page);
  await time(organizer.page, "18:30");
  task = await save(organizer.page, fresh.id, task.id);
  await organizer.page.goto(
    origin + `/events/${fresh.id}/changes/${change.id}`,
  );
  await organizer.page.locator(".change-detail").waitFor();
  await rendered(organizer.page, "10 Nov 2026 · 18:30", ".change-detail");
  const currentChange = (
    await api(organizer, `/api/events/${fresh.id}/changes/${change.id}`)
  ).change;
  assert.equal(currentChange.version, change.version);
  assert.equal(currentChange.updatedAt, change.updatedAt);
  assert.deepEqual(await activity(change.id), beforeChangeHistory);
  checked(
    "F/G: Existing Change shows current Task time with unchanged Change version/history/update metadata",
  );
  await open(organizer, fresh.id, task.id);
  await editForm(organizer.page);
  // A real second tab saves while the original form retains its read version.
  const tabB = await organizer.context.newPage();
  await tabB.goto(origin + href(fresh.id, "tasks", task.id));
  await tabB.locator(".task-drawer__identity").waitFor();
  await editForm(tabB);
  await time(tabB, "16:00");
  task = await save(tabB, fresh.id, task.id);
  await tabB.close();
  await time(organizer.page, "08:00");
  await save(organizer.page, fresh.id, task.id, 409);
  await organizer.page.waitForFunction(
    () =>
      document.querySelector("#task-author-deadlineTime")?.value === "16:00",
  );
  assert.match(
    await organizer.page
      .locator(".task-authoring-form [role=alert]")
      .innerText(),
    /changed elsewhere/,
  );
  const entries = (await activity(task.id)).length;
  const noop = await save(organizer.page, fresh.id, task.id);
  assert.equal(noop.version, task.version);
  assert.equal((await activity(task.id)).length, entries);
  checked(
    "I: Real two-tab stale time edit receives 409; recovery loads canonical time/version; no-op adds no history",
  );
  await editForm(organizer.page);
  await time(organizer.page, "08:00");
  const pattern = `**/api/events/${fresh.id}/tasks/${task.id}`;
  await organizer.page.route(pattern, (route) =>
    route.request().method() === "PATCH"
      ? route.abort("failed")
      : route.continue(),
  );
  await organizer.page
    .locator(".task-authoring-form button[type=submit]")
    .click();
  await organizer.page.waitForFunction(() =>
    document
      .querySelector(".task-authoring-form [role=alert]")
      ?.textContent.includes("could not be confirmed"),
  );
  assert.equal(
    await organizer.page.locator("#task-author-deadlineTime").inputValue(),
    "08:00",
  );
  assert.equal(
    (await read(organizer, fresh.id, task.id)).task.deadlineTime,
    "16:00",
  );
  assert.equal((await activity(task.id)).length, entries);
  await organizer.page.unroute(pattern);
  await organizer.page.keyboard.press("Escape");
  await open(organizer, fresh.id, task.id);
  await rendered(organizer.page, "10 Nov 2026 · 16:00");
  checked(
    "Network failure preserves unsaved time draft and confirmed canonical date/time without a fake save",
  );
  for (const value of [
    "25:00",
    "12:75",
    "abc",
    "9pm",
    "24:00",
    "08:00:00",
    "8:00",
  ]) {
    const response = await organizer.context.request.patch(
      origin + `/api/events/${fresh.id}/tasks/${task.id}`,
      {
        headers: { origin },
        data: { deadlineTime: value, expectedVersion: task.version },
      },
    );
    assert.equal(response.status(), 400);
    assert.equal((await response.json()).fields.deadlineTime, "INVALID_TIME");
  }
  await command(
    member,
    sharedMemberEvent.id,
    (await read(organizer, sharedMemberEvent.id)).tasks[0].id,
    "",
    { deadlineTime: "16:00", expectedVersion: 1 },
    403,
  );
  await open(
    member,
    sharedMemberEvent.id,
    (await read(organizer, sharedMemberEvent.id)).tasks[0].id,
  );
  assert.equal(
    await member.page
      .getByRole("button", { name: "Edit task details", exact: true })
      .count(),
    0,
  );
  checked(
    "Strict server HH:mm validation and unchanged Member authoring permissions",
  );
  await open(organizer, fresh.id);
  await createForm(organizer.page);
  await fill(organizer.page, `Created with time ${run}`);
  await time(organizer.page, "00:00");
  const timed = await save(organizer.page, fresh.id);
  report.intentionalTasks.push(timed.id);
  assert.equal(timed.deadlineTime, "00:00");
  const dateOnly = (
    await api(organizer, `/api/events/${fresh.id}/tasks`, "POST", {
      title: `Date-only ${run}`,
      category: "",
      context: "",
      deadline: "2026-11-10",
      priority: "normal",
      deadlineTime: null,
    })
  ).task;
  report.intentionalTasks.push(dateOnly.id);
  checked("UI create with midnight; date-only and timed Tasks coexist");
  await open(organizer, fresh.id, timed.id);
  await editForm(organizer.page);
  await organizer.page.locator("#task-author-deadlineTime").fill("");
  const cleared = await save(organizer.page, fresh.id, timed.id);
  assert.equal(cleared.deadlineTime, null);
  await open(organizer, fresh.id, task.id);
  await editForm(organizer.page);
  let invalidWrites = 0;
  const countWrite = (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname ===
        `/api/events/${fresh.id}/tasks/${task.id}`
    )
      invalidWrites++;
  };
  organizer.page.on("request", countWrite);
  for (const value of [
    "25:00",
    "12:75",
    "abc",
    "9pm",
    "24:00",
    "08:00:00",
    "8:00",
  ]) {
    await time(organizer.page, value);
    await organizer.page
      .locator(".task-authoring-form button[type=submit]")
      .click();
    await organizer.page.locator("#task-author-deadlineTime-error").waitFor();
    assert.equal(
      await organizer.page.evaluate(() => document.activeElement?.id),
      "task-author-deadlineTime",
    );
    assert.equal(
      await organizer.page.locator("#task-author-deadlineTime").inputValue(),
      value,
    );
  }
  organizer.page.off("request", countWrite);
  assert.equal(invalidWrites, 0);
  await time(organizer.page, "16:00");
  // Labeled server-validation envelope fixture verifies field error association.
  await organizer.page.route(pattern, (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            status: "error",
            code: "INVALID_TASK_COMMAND",
            fields: { deadlineTime: "INVALID_TIME" },
          }),
        })
      : route.continue(),
  );
  await save(organizer.page, fresh.id, task.id, 400);
  await organizer.page.locator("#task-author-deadlineTime-error").waitFor();
  assert.equal(
    await organizer.page
      .locator("#task-author-deadlineTime")
      .getAttribute("aria-invalid"),
    "true",
  );
  assert.match(
    await organizer.page
      .locator("#task-author-deadlineTime")
      .getAttribute("aria-describedby"),
    /task-author-deadlineTime-error/,
  );
  await organizer.page.unroute(pattern);
  await organizer.page.keyboard.press("Escape");
  checked(
    "Clearing time saves NULL; malformed keyboard text rejects without normalization/write; HTTP 400 fixture associates visible time error",
  );
  for (const width of [1440, 1080, 768, 390, 320])
    for (const language of ["en", "bg"])
      for (const theme of ["light", "dark"]) {
        report.step = `matrix ${width} ${language} ${theme}`;
        const page = organizer.page;
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          ({ language, theme }) =>
            localStorage.setItem(
              "budograph.preferences.v1",
              JSON.stringify({ version: 1, language, theme }),
            ),
          { language, theme },
        );
        await open(organizer, fresh.id, task.id);
        const day = language === "en" ? "10 Nov 2026" : "10.11.2026 г.";
        await rendered(page, `${day} · 16:00`);
        await safe(page);
        await page
          .getByRole("button", {
            name:
              language === "en"
                ? "Edit task details"
                : "Редактиране на задачата",
            exact: true,
          })
          .click();
        const input = page.locator("#task-author-deadlineTime");
        assert.equal(await input.inputValue(), "16:00");
        assert.equal(await input.getAttribute("placeholder"), "HH:mm");
        assert.equal(await input.getAttribute("type"), "text");
        assert.equal(
          await page
            .locator('label[for="task-author-deadlineTime"]')
            .isVisible(),
          true,
        );
        const remove = page.getByRole("button", {
          name: language === "en" ? "Remove time" : "Премахване на часа",
          exact: true,
        });
        assert.ok((await remove.boundingBox()).height >= 44);
        await safe(page);
        if ([1440, 320].includes(width))
          await page.screenshot({
            path: `${out}/edit-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
        await remove.focus();
        await page.keyboard.press("Enter");
        assert.equal(await input.count(), 0);
        await time(page, "23:59", language);
        await safe(page);
        await page.keyboard.press("Escape");
        await open(organizer, fresh.id);
        await rendered(page, `${day} · 16:00`, ".task-deadline");
        await rendered(page, day, ".task-deadline");
        await safe(page);
        if ([1440, 320].includes(width))
          await page.screenshot({
            path: `${out}/tasks-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
        await page
          .getByRole("button", {
            name: language === "en" ? "Create task" : "Създаване на задача",
            exact: true,
          })
          .click();
        await time(page, "23:59", language);
        await safe(page);
        if (width === 320)
          await page.screenshot({
            path: `${out}/create-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
        await page.keyboard.press("Escape");
        await page.goto(origin + href(fresh.id, "dashboard"));
        await page.locator("#event-overview-title").waitFor();
        await rendered(page, `${day} · 16:00`, ".change-impact");
        await rendered(page, "16:00", ".timeline-entry--task time");
        await safe(page);
        if ([1440, 320].includes(width))
          await page.screenshot({
            path: `${out}/dashboard-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
        await page.goto(origin + `/events/${fresh.id}/changes/${change.id}`);
        await page.locator(".change-detail").waitFor();
        await rendered(page, `${day} · 16:00`, ".change-detail");
        await safe(page);
        if ([1440, 320].includes(width))
          await page.screenshot({
            path: `${out}/change-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
        report.matrix.push({
          width,
          language,
          theme,
          create: true,
          edit: true,
          list: true,
          dashboard: true,
          change: true,
          overflow: false,
        });
        checked(
          `Matrix ${width}px ${language}/${theme}: forms, removal, date-only/timed rows, Dashboard and live impact`,
        );
      }
  assert.equal(report.applicationErrors, 0);
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.failure = String(error.message);
  if (diagnosticPage)
    await diagnosticPage
      .screenshot({ path: `${out}/failure.png`, fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  for (const context of contexts) await context.close();
  await browser.close();
  await pool.end();
}
