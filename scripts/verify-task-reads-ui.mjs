// Real controlled browser sessions + read-only PostgreSQL evidence. Credentials
// come from ignored environment files; no cookies/session dumps are written.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createDemoWorkspace } from "../src/data/demo.ts";
import { readDatabaseEnv } from "../server/src/config/env.ts";
import { createDatabasePool } from "../server/src/db/pool.ts";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = "http://127.0.0.1:5173",
  out = "tmp/p1d2-evidence/browser";
mkdirSync(out, { recursive: true });
const report = { checks: [], matrix: [], applicationErrors: 0, mutations: 0 };
const config = readDatabaseEnv();
assert.notEqual(config.nodeEnv, "production");
const pool = createDatabasePool(config, () => {});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
report.browser = browser.version();
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
const contexts = [];
let lastLogin = 0;
async function make(label, poison = false) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-GB",
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", () => report.applicationErrors++);
  page.on("request", (request) => {
    if (
      /\/api\/events\/.+\/tasks/.test(request.url()) &&
      !["GET", "HEAD"].includes(request.method())
    )
      report.mutations++;
  });
  const demo = createDemoWorkspace();
  if (poison)
    for (const task of demo.tasks) task.title = "P1D2_LOCAL_ONLY_SENTINEL";
  await page.addInitScript(
    ({ demo }) => {
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language: "en", theme: "light" }),
      );
      localStorage.setItem("budograph.workspace.v1", JSON.stringify(demo));
    },
    { demo },
  );
  await page.goto(origin + "/tasks");
  await page.locator("#login-email").waitFor();
  const remaining = 11_000 - (Date.now() - lastLogin);
  if (remaining > 0)
    await new Promise((resolve) => setTimeout(resolve, remaining));
  const email = process.env[`BUDOGRAPH_${label}_EMAIL`],
    password = process.env[`BUDOGRAPH_${label}_PASSWORD`];
  assert.ok(
    email && password,
    "Controlled development account inputs required.",
  );
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  lastLogin = Date.now();
  await page.locator("button[type=submit]").click();
  await page.locator(".app-main").waitFor();
  return { context, page };
}
async function currentRead(page) {
  const result = await page.evaluate(async () => {
    const events = await fetch("/api/events", {
      credentials: "same-origin",
      cache: "no-store",
    }).then((response) => response.json());
    const event = [...events.events].sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
    )[0];
    if (!event) return null;
    const tasks = await fetch(`/api/events/${event.id}/tasks`, {
      credentials: "same-origin",
      cache: "no-store",
    }).then((response) => response.json());
    return { event, ...tasks };
  });
  assert.ok(
    result?.tasks.length,
    "Real development Event with task fixture required.",
  );
  return result;
}
async function ready(page) {
  await page
    .locator(".page--tasks:not([aria-busy]) .task-row")
    .first()
    .waitFor();
}
async function reloadWith(page, handler) {
  await page.route("**/api/events/*/tasks", handler);
  await page.reload();
}
async function resetRoute(page) {
  await page.unroute("**/api/events/*/tasks");
  await page.reload();
  await ready(page);
}
try {
  const organizer = await make("ORGANIZER", true);
  await ready(organizer.page);
  const initial = await currentRead(organizer.page);
  assert.equal(initial.event.membership.accessRole, "ORGANIZER");
  const db = await pool.query(
    `SELECT id, title, category, context, to_char(deadline, 'YYYY-MM-DD') AS deadline,
    status, priority, assigned_member_id, version FROM public.task WHERE event_id = $1 AND deleted_at IS NULL ORDER BY deadline, id`,
    [initial.event.id],
  );
  assert.equal(db.rows.length, initial.tasks.length);
  for (const row of db.rows) {
    const dto = initial.tasks.find((task) => task.id === row.id);
    assert.ok(dto);
    for (const field of [
      "title",
      "category",
      "context",
      "deadline",
      "status",
      "priority",
      "version",
    ])
      assert.equal(dto[field], row[field]);
    assert.equal(dto.assignedMemberId, row.assigned_member_id);
    assert.equal(
      await organizer.page
        .locator(`a[href="/tasks?task=${row.id}"]`)
        .innerText(),
      row.title,
    );
  }
  assert.ok(
    !(await organizer.page
      .locator(".page--tasks")
      .innerText()
      .then((text) => text.includes("P1D2_LOCAL_ONLY_SENTINEL"))),
  );
  checked(
    "Organizer: real Event/task DTO and rendered titles match read-only PostgreSQL query; poisoned local demo is never used",
  );
  await organizer.page.reload();
  await ready(organizer.page);
  assert.deepEqual((await currentRead(organizer.page)).tasks, initial.tasks);
  checked("Organizer: refresh retains the real PostgreSQL task data");

  const member = await make("MEMBER", true);
  await ready(member.page);
  const seen = await currentRead(member.page);
  assert.equal(seen.event.membership.accessRole, "MEMBER");
  assert.equal(seen.event.id, initial.event.id);
  assert.deepEqual(seen.tasks, initial.tasks);
  await member.page.reload();
  await ready(member.page);
  checked(
    "Independent Member: same authorized Event/tasks, real membership role, refresh",
  );

  const task = initial.tasks[0];
  await organizer.page.goto(origin + `/tasks?task=${task.id}`);
  await organizer.page.getByRole("dialog").waitFor();
  assert.equal(
    await organizer.page.locator(".task-drawer__identity h2").innerText(),
    task.title,
  );
  assert.equal(
    await organizer.page.locator(".task-drawer__acceptance button").count(),
    0,
  );
  assert.equal(
    await organizer.page.locator(".task-assignment-select select").isEnabled(),
    true,
  );
  assert.equal(
    await organizer.page.locator(".task-status-select button").isDisabled(),
    false,
  );
  await organizer.page
    .getByRole("dialog")
    .screenshot({ path: `${out}/organizer-drawer.png` });
  await organizer.page.keyboard.press("Escape");
  await organizer.page.getByRole("dialog").waitFor({ state: "hidden" });
  checked(
    "Real task deep link and drawer preserve canonical content; Organizer assignment/status available, no acceptance impersonation; no actions sent",
  );

  await organizer.page.goto(origin + "/tasks?task=task-transport");
  await ready(organizer.page);
  await organizer.page.locator(".notice--warning").waitFor();
  assert.equal(await organizer.page.getByRole("dialog").count(), 0);
  assert.ok(
    !(await organizer.page.locator(".page--tasks").innerText()).includes(
      "P1D2_LOCAL_ONLY_SENTINEL",
    ),
  );
  checked(
    "Fictional Dashboard/Team task IDs cannot open a demo drawer in the remote Tasks route",
  );

  let release, started;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  const pending = new Promise((resolve) => {
    started = resolve;
  });
  let eventRequests = 0,
    taskRequests = 0;
  const countReads = (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/events") eventRequests++;
    if (/^\/api\/events\/[^/]+\/tasks$/.test(url.pathname)) taskRequests++;
  };
  organizer.page.on("request", countReads);
  await reloadWith(organizer.page, async (route) => {
    started();
    await hold;
    await route.continue();
  });
  await pending;
  await organizer.page.locator('.page--tasks[aria-busy="true"]').waitFor();
  assert.equal(await organizer.page.locator(".task-row").count(), 0);
  assert.equal(
    await organizer.page.locator(".task-register__header").count(),
    1,
  );
  assert.equal(await organizer.page.locator("#task-search").count(), 1);
  await organizer.page
    .locator(".page--tasks")
    .screenshot({ path: `${out}/loading.png` });
  release();
  await ready(organizer.page);
  assert.equal(eventRequests, 1);
  assert.equal(taskRequests, 1);
  organizer.page.off("request", countReads);
  await organizer.page.unroute("**/api/events/*/tasks");
  checked(
    "Loading retains header/register/toolbar, no stale rows; one Event + one task request under StrictMode",
  );

  await reloadWith(organizer.page, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tasks: [], members: [] }),
    }),
  );
  await organizer.page
    .getByRole("heading", { name: "No tasks for this event" })
    .waitFor();
  assert.equal(await organizer.page.locator(".task-row").count(), 0);
  await organizer.page
    .locator(".page--tasks")
    .screenshot({ path: `${out}/empty.png` });
  await resetRoute(organizer.page);
  checked(
    "Injected empty Event task result explains absence and never shows fictional tasks",
  );

  await organizer.page.route("**/api/events", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"events":[]}',
    }),
  );
  await organizer.page.reload();
  await organizer.page
    .getByRole("heading", { name: "No accessible event" })
    .waitFor();
  assert.equal(await organizer.page.locator(".task-row").count(), 0);
  await organizer.page.unroute("**/api/events");
  await organizer.page.reload();
  await ready(organizer.page);
  checked(
    "Injected empty account shows no active membership and no task/demo fallback",
  );

  await reloadWith(organizer.page, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: '{"message":"DO_NOT_EXPOSE_INTERNALS"}',
    }),
  );
  await organizer.page.getByRole("alert").waitFor();
  assert.equal(await organizer.page.locator(".task-row").count(), 0);
  assert.ok(
    !(await organizer.page.locator(".app-main").innerText()).includes(
      "DO_NOT_EXPOSE_INTERNALS",
    ),
  );
  await organizer.page
    .locator(".page--tasks")
    .screenshot({ path: `${out}/error.png` });
  await organizer.page.unroute("**/api/events/*/tasks");
  await organizer.page.getByRole("button", { name: "Try again" }).click();
  await ready(organizer.page);
  checked(
    "Injected backend failure sanitizes details, clears rows and recovers via explicit retry",
  );

  await reloadWith(organizer.page, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: '{"message":"DO_NOT_EXPOSE_INTERNALS"}',
    }),
  );
  await organizer.page.getByRole("alert").waitFor();
  assert.match(
    await organizer.page.getByRole("alert").innerText(),
    /cannot access/,
  );
  assert.equal(new URL(organizer.page.url()).pathname, "/tasks");
  assert.equal(await organizer.page.locator(".task-row").count(), 0);
  assert.equal(
    await organizer.page.evaluate(async () => (await fetch("/api/me")).status),
    200,
  );
  await resetRoute(organizer.page);
  checked(
    "Injected authorization denial stays in authenticated app with safe error and no stale tasks",
  );

  const before = JSON.stringify(initial.tasks);
  // Actual visual matrix is captured by the dedicated snapshot run; here test
  // the real task layout at each viewport with the current EN/light preference.
  for (const width of [1440, 1024, 768, 390, 320]) {
    await organizer.page.setViewportSize({ width, height: 900 });
    assert.equal(
      await organizer.page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const row = organizer.page.locator(".task-row").first();
    assert.equal(await row.locator('[role="cell"]').count(), 4);
    assert.equal(
      await organizer.page
        .locator(".task-register__header [role=columnheader]")
        .count(),
      4,
    );
    report.matrix.push({
      width,
      language: "en",
      theme: "light",
      overflow: false,
    });
    await organizer.page
      .locator(".page--tasks")
      .screenshot({ path: `${out}/real-tasks-${width}.png` });
  }
  assert.equal(
    JSON.stringify((await currentRead(organizer.page)).tasks),
    before,
  );
  assert.equal(report.mutations, 0);
  checked(
    "Real Tasks: desktop/tablet/narrow layout keeps four semantic cells; no overflow or task mutation requests",
  );

  // Hold a real task read, revoke the real session independently, then allow the
  // backend to return its actual 401. Do not inject an invented auth response.
  let unblock, hit;
  const wait = new Promise((resolve) => {
    unblock = resolve;
  });
  const intercepted = new Promise((resolve) => {
    hit = resolve;
  });
  await reloadWith(organizer.page, async (route) => {
    hit();
    await wait;
    await route.continue();
  });
  await intercepted;
  assert.equal(
    await organizer.page.evaluate(
      async () =>
        (
          await fetch("/api/auth/sign-out", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          })
        ).ok,
    ),
    true,
  );
  unblock();
  await organizer.page.locator("#login-email").waitFor();
  assert.equal(await organizer.page.locator(".app-main").count(), 0);
  assert.equal(
    new URL(organizer.page.url()).searchParams.get("reason"),
    "expired",
  );
  assert.equal(
    await member.page.evaluate(async () => (await fetch("/api/me")).status),
    200,
  );
  checked(
    "Actual expired task-read session returns to Login, clears shell/data and leaves independent Member session valid",
  );

  const cookies = await member.context.cookies();
  assert.ok(
    cookies.some(
      (cookie) =>
        /session/i.test(cookie.name) &&
        cookie.httpOnly &&
        cookie.sameSite === "Lax",
    ),
  );
  const storageSafe = await member.page.evaluate(() =>
    [...Object.entries(localStorage), ...Object.entries(sessionStorage)].every(
      ([key, value]) =>
        !/session_token|bearer|password|better.auth/i.test(key + value),
    ),
  );
  assert.equal(storageSafe, true);
  await member.page.locator(".account-control--desktop button").click();
  await member.page.locator("#login-email").waitFor();
  assert.equal(await member.page.locator(".task-row").count(), 0);
  checked(
    "HttpOnly cookie authentication; no browser-stored auth secrets; logout removes all real task content",
  );
  assert.equal(report.applicationErrors, 0);
  report.databaseProof = {
    taskCount: db.rows.length,
    rowDtoDomMatch: true,
    localSentinelAbsent: true,
    taskWorkflowUnchanged: true,
  };
} catch {
  report.failure =
    "Task read browser check failed. Previous checks identify completed coverage.";
  throw new Error(
    "Task read browser verification failed; see ignored evidence report. Credentials and raw request details are omitted.",
  );
} finally {
  // Clean up only this verifier's own sessions, even if an assertion failed.
  for (const context of contexts) {
    await context.request
      .post(origin + "/api/auth/sign-out", { headers: { origin }, data: {} })
      .catch(() => {});
    await context.close();
  }
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await pool.end();
}
