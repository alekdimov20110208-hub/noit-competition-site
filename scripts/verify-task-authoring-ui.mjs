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
  out = "tmp/p2b-evidence/browser",
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
const fields = (task) => ({
  title: task.title,
  category: task.category,
  context: task.context,
  deadline: task.deadline,
  deadlineTime: task.deadlineTime,
  priority: task.priority,
});
async function make(label) {
  report.step = `login ${label}`;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    timezoneId: "Pacific/Honolulu",
  });
  contexts.push(context);
  await context.addInitScript(() => {
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
  await page.locator("#task-author-deadline").fill("2026-11-01");
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
try {
  report.step = "login";
  const organizer = await make("ORGANIZER"),
    member = await make("MEMBER");
  const organizerEvents = await events(organizer),
    memberEvents = await events(member);
  const shared = organizerEvents.find(
    (event) =>
      event.membership.accessRole === "ORGANIZER" &&
      memberEvents.some(
        (value) =>
          value.id === event.id && value.membership.accessRole === "MEMBER",
      ),
  );
  assert.ok(shared, "Controlled shared Event required");
  const memberEvent = memberEvents.find((event) => event.id === shared.id);

  report.step = "fresh event";
  await organizer.page.goto(origin + "/events/new");
  await organizer.page.locator("#event-name").fill(`P2B development ${run}`);
  await organizer.page.locator("#event-startDate").fill("2026-11-02");
  await organizer.page.locator("#event-endDate").fill("2026-11-03");
  const eventResponse = organizer.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/events" &&
      response.request().method() === "POST",
  );
  await organizer.page.locator(".event-form button[type=submit]").click();
  const freshResponse = await eventResponse;
  assert.equal(freshResponse.status(), 201);
  const fresh = (await freshResponse.json()).event;
  report.intentionalEvents.push(fresh.id);
  await open(organizer, fresh.id);
  assert.equal((await read(organizer, fresh.id)).tasks.length, 0);
  await organizer.page
    .getByText("No tasks for this event", { exact: true })
    .waitFor();
  await createForm(organizer.page);
  await organizer.page
    .locator(".task-authoring-form button[type=submit]")
    .click();
  assert.equal(
    await organizer.page
      .locator("#task-author-title")
      .getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(
    await organizer.page
      .locator("#task-author-title")
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await organizer.page.keyboard.press("Escape");
  await organizer.page
    .locator(".task-authoring-form")
    .waitFor({ state: "hidden" });
  assert.equal(
    await organizer.page
      .getByRole("button", { name: "Create task", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await createForm(organizer.page);
  await fill(organizer.page, `P2B fresh task ${run}`);
  await organizer.page.locator("#task-author-assignedMemberId-trigger").click();
  assert.equal(
    await organizer.page.getByRole("listbox").getByRole("option").count(),
    2,
  );
  await organizer.page
    .getByRole("option", { name: "Unassigned", exact: true })
    .click();
  for (const status of [400, 403, 404, 500, "network"]) {
    const path = `**/api/events/${fresh.id}/tasks`;
    const handler = (route) =>
      route.request().method() === "POST"
        ? status === "network"
          ? route.abort("failed")
          : route.fulfill({
              status,
              json: {
                error: "PRIVATE_ERROR",
                fields: { title: "INVALID_TEXT" },
              },
            })
        : route.continue();
    await organizer.page.route(path, handler);
    await organizer.page
      .locator(".task-authoring-form button[type=submit]")
      .click();
    await organizer.page.locator(".task-authoring-form [role=alert]").waitFor();
    await organizer.page.waitForFunction(
      () =>
        !document.querySelector(".task-authoring-form button[type=submit]")
          .disabled,
    );
    await safe(organizer.page);
    await organizer.page.unroute(path, handler);
  }
  checked(
    "Fresh real Event has zero tasks; Organizer form labels, optional scoped assignee, validation/focus/cancel and sanitized 400/403/404/500/network failures",
  );

  report.step = "pending create";
  let release;
  const held = new Promise((resolve) => (release = resolve));
  let createRequests = 0;
  const createPath = `**/api/events/${fresh.id}/tasks`;
  const holdCreate = async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    createRequests++;
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  };
  await organizer.page.route(createPath, holdCreate);
  const saved = save(organizer.page, fresh.id);
  await organizer.page.waitForFunction(
    () =>
      document.querySelector(".task-authoring-form button[type=submit]")
        ?.disabled,
  );
  assert.equal(
    await organizer.page.locator("#task-author-title").isDisabled(),
    true,
  );
  await organizer.page.keyboard.press("Enter");
  assert.equal(createRequests, 1);
  release();
  const freshTask = await saved;
  report.intentionalTasks.push(freshTask.id);
  await organizer.page.unroute(createPath, holdCreate);
  await organizer.page.locator(".task-drawer__identity h2").waitFor();
  assert.equal(
    new URL(organizer.page.url()).searchParams.get("task"),
    freshTask.id,
  );
  assert.equal((await read(organizer, fresh.id)).tasks.length, 1);
  const row = (
    await pool.query(
      `SELECT event_id,created_by,version,status,priority,assigned_member_id,accepted_by_member_id,accepted_at,to_char(deadline,'YYYY-MM-DD') AS deadline,
        to_char(deadline_time,'HH24:MI') AS "deadlineTime" FROM public.task WHERE id=$1`,
      [freshTask.id],
    )
  ).rows[0];
  assert.deepEqual(row, {
    event_id: fresh.id,
    created_by: fresh.membership.id,
    version: 1,
    status: "not-started",
    priority: "important",
    assigned_member_id: null,
    accepted_by_member_id: null,
    accepted_at: null,
    deadline: "2026-11-01",
    deadlineTime: null,
  });
  assert.equal((await activity(freshTask.id)).length, 1);
  await organizer.page.reload();
  await organizer.page.locator(".task-drawer__identity h2").waitFor();
  assert.equal(
    await organizer.page.locator(".task-drawer__identity h2").innerText(),
    freshTask.title,
  );
  await editForm(organizer.page);
  await organizer.page
    .locator("#task-author-title")
    .fill(`P2B fresh edited ${run}`);
  await organizer.page.locator("#task-author-deadline").fill("2026-10-31");
  await organizer.page.locator("#task-author-priority-trigger").click();
  await organizer.page
    .getByRole("option", { name: "Critical", exact: true })
    .click();
  const edited = await save(organizer.page, fresh.id, freshTask.id);
  assert.equal(edited.version, 2);
  assert.equal(edited.deadline, "2026-10-31");
  await organizer.page.locator(".task-drawer__identity h2").waitFor();
  await organizer.page.reload();
  await organizer.page.locator(".task-drawer__identity h2").waitFor();
  assert.equal(
    await organizer.page.locator(".task-drawer__identity h2").innerText(),
    edited.title,
  );
  await organizer.page.goto(origin + href(fresh.id, "dashboard"));
  await organizer.page.locator("#event-overview-title").waitFor();
  assert.ok(
    (await organizer.page.locator(".page--dashboard").innerText()).includes(
      edited.title,
    ),
  );
  await organizer.page.goto(origin + href(fresh.id, "team"));
  await organizer.page.locator(".team-roster__member").waitFor();
  assert.equal(await organizer.page.locator(".team-roster__member").count(), 1);
  checked(
    "One pending UI create persists one real PostgreSQL task/history; initial not-started/unaccepted/unassigned, DATE before Event start, deep-link and refresh; title/deadline/priority edit persists and Dashboard/Team derive real data",
  );

  report.step = "responsibility integration";
  diagnosticPage = organizer.page;
  await open(organizer, shared.id);
  await createForm(organizer.page);
  await fill(organizer.page, `P2B shared task ${run}`);
  await organizer.page.locator("#task-author-assignedMemberId-trigger").click();
  const active = (
    await (
      await organizer.context.request.get(
        origin + `/api/events/${shared.id}/members`,
      )
    ).json()
  ).members;
  const assignee = active.find(
    (value) => value.id === memberEvent.membership.id,
  );
  assert.ok(assignee);
  await organizer.page
    .getByRole("option", {
      name: assignee.name + (assignee.role ? ` · ${assignee.role}` : ""),
      exact: true,
    })
    .click();
  let sharedTask = await save(organizer.page, shared.id);
  report.intentionalTasks.push(sharedTask.id);
  assert.equal(sharedTask.accepted, false);
  assert.equal(sharedTask.assignedMemberId, assignee.id);
  await open(member, shared.id, sharedTask.id);
  assert.equal(
    await member.page
      .getByRole("button", { name: "Create task", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await member.page
      .getByRole("button", { name: "Edit task details", exact: true })
      .count(),
    0,
  );
  const acceptResponse = member.page.waitForResponse(
    (response) =>
      response.url().endsWith(`/${sharedTask.id}/acceptance`) &&
      response.request().method() === "PUT",
  );
  await member.page
    .getByRole("button", { name: "Accept responsibility", exact: true })
    .click();
  const accepted = (await (await acceptResponse).json()).task;
  assert.equal(accepted.acceptedByMemberId, assignee.id);
  sharedTask = accepted;
  await open(organizer, shared.id, sharedTask.id);
  await editForm(organizer.page);
  await organizer.page
    .locator("#task-author-context")
    .fill("Authoring must preserve current acceptance");
  sharedTask = await save(organizer.page, shared.id, sharedTask.id);
  assert.equal(sharedTask.acceptedAt, accepted.acceptedAt);
  await open(member, shared.id, sharedTask.id);
  const statusResponse = member.page.waitForResponse(
    (response) =>
      response.url().endsWith(`/${sharedTask.id}/status`) &&
      response.request().method() === "PATCH",
  );
  await member.page.locator(`#drawer-status-${sharedTask.id}-trigger`).click();
  await member.page
    .getByRole("option", { name: "In progress", exact: true })
    .click();
  sharedTask = (await (await statusResponse).json()).task;
  assert.equal(sharedTask.accepted, true);
  await open(organizer, shared.id, sharedTask.id);
  const unassignResponse = organizer.page.waitForResponse(
    (response) =>
      response.url().endsWith(`/${sharedTask.id}/assignment`) &&
      response.request().method() === "POST",
  );
  await organizer.page
    .locator(`#drawer-assignment-${sharedTask.id}`)
    .selectOption("");
  sharedTask = (await (await unassignResponse).json()).task;
  assert.equal(sharedTask.accepted, false);
  await organizer.page.waitForFunction(
    () =>
      !document
        .querySelector(".task-action-feedback")
        ?.textContent.includes("Saving"),
  );
  const backResponse = organizer.page.waitForResponse(
    (response) =>
      response.url().endsWith(`/${sharedTask.id}/assignment`) &&
      response.request().method() === "POST",
  );
  await organizer.page
    .locator(`#drawer-assignment-${sharedTask.id}`)
    .selectOption(assignee.id);
  sharedTask = (await (await backResponse).json()).task;
  assert.equal(sharedTask.accepted, false);
  await open(member, shared.id, sharedTask.id);
  const reaccept = member.page.waitForResponse(
    (response) =>
      response.url().endsWith(`/${sharedTask.id}/acceptance`) &&
      response.request().method() === "PUT",
  );
  await member.page
    .getByRole("button", { name: "Accept responsibility", exact: true })
    .click();
  sharedTask = (await (await reaccept).json()).task;
  checked(
    "Initial real Member assignment is unaccepted; independent Member has no authoring controls, explicitly accepts/changes lifecycle; detail edit preserves acceptance, unassignment clears it and assign-back requires explicit reacceptance",
  );

  report.step = "authorization";
  for (const [account, eventId, method, taskId, expected, data] of [
    [member, shared.id, "POST", null, 403, fields(sharedTask)],
    [
      member,
      shared.id,
      "PATCH",
      sharedTask.id,
      403,
      { ...fields(sharedTask), expectedVersion: sharedTask.version },
    ],
    [member, fresh.id, "POST", null, 404, fields(sharedTask)],
    [
      organizer,
      fresh.id,
      "PATCH",
      sharedTask.id,
      404,
      { ...fields(sharedTask), expectedVersion: sharedTask.version },
    ],
    [
      organizer,
      fresh.id,
      "POST",
      null,
      400,
      { ...fields(sharedTask), assignedMemberId: assignee.id },
    ],
  ]) {
    const response = await account.context.request.fetch(
      origin + `/api/events/${eventId}/tasks${taskId ? `/${taskId}` : ""}`,
      { method, headers: { origin }, data },
    );
    assert.equal(response.status(), expected);
  }
  for (const forged of [
    "eventId",
    "actor",
    "accepted",
    "status",
    "version",
    "assignedMemberId",
  ])
    await command(
      organizer,
      shared.id,
      sharedTask.id,
      "",
      { expectedVersion: sharedTask.version, [forged]: "forged" },
      400,
    );
  checked(
    "Real-session Member403/foreign Event404/foreign Task404/foreign assignee400 and forged actor/scope/acceptance/status/version/assignment patch400 fail closed",
  );

  report.step = "conflict";
  await open(organizer, shared.id, sharedTask.id);
  await editForm(organizer.page);
  await organizer.page
    .locator("#task-author-title")
    .fill("Stale draft must never overwrite");
  await organizer.page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  assert.equal(
    await organizer.page.locator("#task-author-title").inputValue(),
    "Stale draft must never overwrite",
  );
  const concurrent = await command(organizer, shared.id, sharedTask.id, "", {
    title: `P2B newer canonical ${run}`,
    expectedVersion: sharedTask.version,
  });
  const beforeCount = (await activity(sharedTask.id)).length;
  let patches = 0;
  organizer.page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname ===
        `/api/events/${shared.id}/tasks/${sharedTask.id}`
    )
      patches++;
  });
  await save(organizer.page, shared.id, sharedTask.id, 409);
  await organizer.page.waitForFunction(
    (value) => document.querySelector("#task-author-title")?.value === value,
    concurrent.title,
  );
  assert.equal(patches, 1);
  assert.equal((await activity(sharedTask.id)).length, beforeCount);
  assert.ok(
    (
      await organizer.page
        .locator(".task-authoring-form [role=alert]")
        .innerText()
    ).includes("changed elsewhere"),
  );
  const noop = await save(organizer.page, shared.id, sharedTask.id);
  assert.equal(noop.version, concurrent.version);
  assert.equal((await activity(sharedTask.id)).length, beforeCount);
  await organizer.page.locator(".task-drawer__identity").waitFor();
  await editForm(organizer.page);
  await organizer.page
    .locator("#task-author-title")
    .fill(`P2B explicit retry ${run}`);
  const retry = await save(organizer.page, shared.id, sharedTask.id);
  assert.equal(retry.version, concurrent.version + 1);
  const raceCount = (await activity(sharedTask.id)).length;
  const simultaneous = await Promise.all(
    ["A", "B"].map((title) =>
      organizer.context.request
        .patch(origin + `/api/events/${shared.id}/tasks/${sharedTask.id}`, {
          headers: { origin },
          data: {
            title: `Simultaneous ${title}`,
            expectedVersion: retry.version,
          },
        })
        .then((response) => response.status()),
    ),
  );
  assert.deepEqual(simultaneous.sort(), [200, 409]);
  assert.equal(
    (await read(organizer, shared.id, sharedTask.id)).task.version,
    retry.version + 1,
  );
  assert.equal((await activity(sharedTask.id)).length, raceCount + 1);
  checked(
    "Stale edit409 loads current canonical form, rejects overwrite/replay; current no-op preserves history/version, explicit save increments once; simultaneous same-version writes commit only once",
  );
  report.step = "failed conflict recovery";
  await open(organizer, shared.id, sharedTask.id);
  await editForm(organizer.page);
  const current = (await read(organizer, shared.id, sharedTask.id)).task;
  await command(organizer, shared.id, sharedTask.id, "", {
    title: `P2B recovery canonical ${run}`,
    expectedVersion: current.version,
  });
  const recoveryPath = `**/api/events/${shared.id}/tasks`;
  const failRefresh = (route) =>
    route.request().method() === "GET"
      ? route.abort("failed")
      : route.continue();
  await organizer.page.route(recoveryPath, failRefresh);
  await save(organizer.page, shared.id, sharedTask.id, 409);
  const reloadButton = organizer.page.getByRole("button", {
    name: "Load latest details",
    exact: true,
  });
  await reloadButton.waitFor();
  await organizer.page.waitForFunction(() =>
    document
      .querySelector(".task-authoring-form [role=alert]")
      ?.textContent.includes("could not be loaded"),
  );
  assert.equal(
    await organizer.page
      .locator(".task-authoring-form button[type=submit]")
      .isDisabled(),
    true,
  );
  assert.equal(await reloadButton.isEnabled(), true);
  await organizer.page.unroute(recoveryPath, failRefresh);
  await reloadButton.click();
  await organizer.page.waitForFunction(
    (value) => document.querySelector("#task-author-title")?.value === value,
    `P2B recovery canonical ${run}`,
  );
  await organizer.page.waitForFunction(
    () =>
      !document.querySelector(".task-authoring-form button[type=submit]")
        .disabled,
  );
  assert.equal(
    (await read(organizer, shared.id, sharedTask.id)).task.version,
    current.version + 1,
  );
  await organizer.page.keyboard.press("Escape");
  checked(
    "Failed 409 workspace refresh disables Save; usable explicit latest-details recovery restores canonical version without automatic write",
  );

  report.step = "switch isolation";
  await open(organizer, fresh.id);
  await organizer.page.locator(".sidebar select").selectOption(shared.id);
  await organizer.page.locator(".page--tasks:not([aria-busy])").waitFor();
  assert.equal(
    await organizer.page.getByText(edited.title, { exact: true }).count(),
    0,
  );
  await organizer.page.locator(".sidebar select").selectOption(fresh.id);
  await organizer.page.getByText(edited.title, { exact: true }).waitFor();
  await createForm(organizer.page);
  await fill(organizer.page, `P2B switch-held task ${run}`);
  let releaseSwitch;
  const heldSwitch = new Promise((resolve) => (releaseSwitch = resolve));
  let heldTask;
  const switchHandler = async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    heldTask = (await response.json()).task;
    await heldSwitch;
    await route.fulfill({ response }).catch(() => {});
  };
  await organizer.page.route(createPath, switchHandler);
  await organizer.page
    .locator(".task-authoring-form button[type=submit]")
    .click();
  await organizer.page.waitForFunction(
    () =>
      document.querySelector(".task-authoring-form button[type=submit]")
        ?.disabled,
  );
  await organizer.page.locator(".sidebar select").selectOption(shared.id);
  await organizer.page.locator(".page--tasks:not([aria-busy])").waitFor();
  releaseSwitch();
  await organizer.page.unroute(createPath, switchHandler);
  assert.equal(
    await organizer.page
      .getByText(`P2B switch-held task ${run}`, { exact: true })
      .count(),
    0,
  );
  if (heldTask) report.intentionalTasks.push(heldTask.id);
  await open(organizer, fresh.id, freshTask.id);
  await editForm(organizer.page);
  await organizer.page
    .locator("#task-author-context")
    .fill("Held edit stays scoped to A");
  let releaseEdit;
  const heldEdit = new Promise((resolve) => (releaseEdit = resolve));
  const editPath = `**/api/events/${fresh.id}/tasks/${freshTask.id}`;
  const editHandler = async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const response = await route.fetch();
    await heldEdit;
    await route.fulfill({ response }).catch(() => {});
  };
  await organizer.page.route(editPath, editHandler);
  await organizer.page
    .locator(".task-authoring-form button[type=submit]")
    .click();
  await organizer.page.waitForFunction(
    () =>
      document.querySelector(".task-authoring-form button[type=submit]")
        ?.disabled,
  );
  await organizer.page.locator(".sidebar select").selectOption(shared.id);
  await organizer.page.locator(".page--tasks:not([aria-busy])").waitFor();
  releaseEdit();
  await organizer.page.unroute(editPath, editHandler);
  assert.equal(
    await organizer.page.getByText(edited.title, { exact: true }).count(),
    0,
  );
  checked(
    "A/B/A switches isolate authored rows; switching during real held create and edit never navigates or publishes old Event data into the selected Event",
  );
  await open(organizer, fresh.id, freshTask.id);
  await editForm(organizer.page);
  for (const status of [400, 403, 404, 500, "network"]) {
    const handler = (route) =>
      route.request().method() === "PATCH"
        ? status === "network"
          ? route.abort("failed")
          : route.fulfill({
              status,
              json: {
                error: "PRIVATE_ERROR",
                fields: { context: "INVALID_TEXT" },
              },
            })
        : route.continue();
    await organizer.page.route(editPath, handler);
    await organizer.page
      .locator(".task-authoring-form button[type=submit]")
      .click();
    await organizer.page.locator(".task-authoring-form [role=alert]").waitFor();
    await organizer.page.waitForFunction(
      () =>
        !document.querySelector(".task-authoring-form button[type=submit]")
          .disabled,
    );
    await safe(organizer.page);
    await organizer.page.unroute(editPath, handler);
  }
  await organizer.page.keyboard.press("Escape");
  checked(
    "Edit form retains draft and renders safe recoverable 400/403/404/500/network transport-double errors",
  );

  report.step = "responsive authoring";
  for (const width of [1440, 1024, 768, 390, 320])
    for (const language of ["en", "bg"])
      for (const theme of ["light", "dark"]) {
        await organizer.page.setViewportSize({ width, height: 900 });
        await organizer.page.evaluate(
          ({ language, theme }) =>
            localStorage.setItem(
              "budograph.preferences.v1",
              JSON.stringify({ version: 1, language, theme }),
            ),
          { language, theme },
        );
        await open(organizer, fresh.id);
        assert.equal(
          await organizer.page.locator("html").getAttribute("lang"),
          language,
        );
        assert.equal(
          await organizer.page.locator("html").getAttribute("data-theme"),
          theme,
        );
        report.step = `responsive ${width}/${language}/${theme}`;
        await organizer.page
          .getByRole("button", {
            name: language === "en" ? "Create task" : "Създаване на задача",
            exact: true,
          })
          .click();
        await organizer.page.locator(".task-authoring-form").waitFor();
        await safe(organizer.page);
        const submit = organizer.page.locator(
          ".task-authoring-form button[type=submit]",
        );
        await submit.focus();
        await submit.evaluate((button) =>
          button.scrollIntoView({ block: "center", behavior: "instant" }),
        );
        assert.equal(
          await submit.evaluate((button) => {
            const box = button.getBoundingClientRect();
            return (
              box.height >= 44 &&
              box.top >= 0 &&
              box.bottom <= innerHeight &&
              button.contains(
                document.elementFromPoint(
                  box.x + box.width / 2,
                  box.y + box.height / 2,
                ),
              )
            );
          }),
          true,
        );
        assert.ok(
          (
            await organizer.page
              .locator("#task-author-priority-trigger")
              .boundingBox()
          ).height >= 44,
        );
        for (const field of ["title", "category", "context", "deadline"])
          assert.equal(
            await organizer.page
              .locator(`label[for="task-author-${field}"]`)
              .count(),
            1,
          );
        await organizer.page.locator("#task-author-priority-trigger").focus();
        await organizer.page.keyboard.press("Enter");
        const popup = organizer.page.getByRole("listbox");
        await popup.waitFor();
        assert.ok(
          (await popup.getByRole("option").first().boundingBox()).height >= 44,
        );
        assert.equal(
          await popup.evaluate((node) => {
            const b = node.getBoundingClientRect();
            return (
              b.left >= 0 &&
              b.right <= innerWidth &&
              b.top >= 0 &&
              b.bottom <= innerHeight
            );
          }),
          true,
        );
        await organizer.page.keyboard.press("ArrowDown");
        await organizer.page.keyboard.press("Enter");
        await popup.waitFor({ state: "hidden" });
        await submit.focus();
        await submit.evaluate((button) =>
          button.scrollIntoView({ block: "center", behavior: "instant" }),
        );
        await organizer.page.locator(".task-drawer").screenshot({
          path: `${out}/create-${width}-${language}-${theme}.png`,
          animations: "disabled",
        });
        await organizer.page.keyboard.press("Escape");
        await organizer.page
          .locator(".task-authoring-form")
          .waitFor({ state: "hidden" });
        await open(organizer, fresh.id, freshTask.id);
        await organizer.page
          .getByRole("button", {
            name:
              language === "en"
                ? "Edit task details"
                : "Редактиране на задачата",
            exact: true,
          })
          .click();
        await organizer.page.locator(".task-authoring-form").waitFor();
        await safe(organizer.page);
        await organizer.page.locator(".task-drawer").screenshot({
          path: `${out}/edit-${width}-${language}-${theme}.png`,
          animations: "disabled",
        });
        report.matrix.push({
          width,
          language,
          theme,
          noOverflow: true,
          submitReachable: true,
          controls44: true,
        });
      }
  checked(
    "20 desktop/narrow/tablet/mobile BG/EN light/dark Create+Edit cases: no overflow, 44px targets, reachable submit, labelled date/priority and keyboard Escape",
  );

  report.step = "expired edit session";
  const editAccount = await make("ORGANIZER");
  diagnosticPage = editAccount.page;
  await open(editAccount, fresh.id, freshTask.id);
  await editForm(editAccount.page);
  const beforeExpiry = (await read(editAccount, fresh.id, freshTask.id)).task;
  await editAccount.page
    .locator("#task-author-title")
    .fill("Expired edit must not persist");
  await editAccount.context.request.post(origin + "/api/auth/sign-out", {
    headers: { origin },
    data: {},
  });
  await save(editAccount.page, fresh.id, freshTask.id, 401);
  await editAccount.page.locator("#login-email").waitFor();
  assert.equal(
    (await read(organizer, fresh.id, freshTask.id)).task.version,
    beforeExpiry.version,
  );
  checked(
    "Actual expired edit401 clears its workspace with no task/version write",
  );
  report.step = "expired session";
  diagnosticPage = organizer.page;
  await organizer.page.setViewportSize({ width: 1440, height: 900 });
  await organizer.page.evaluate(() =>
    localStorage.setItem(
      "budograph.preferences.v1",
      JSON.stringify({ version: 1, language: "en", theme: "light" }),
    ),
  );
  await open(organizer, fresh.id);
  await createForm(organizer.page);
  await fill(organizer.page, "Expired create must not persist");
  const count = (await read(organizer, fresh.id)).tasks.length;
  await organizer.context.request.post(origin + "/api/auth/sign-out", {
    headers: { origin },
    data: {},
  });
  await save(organizer.page, fresh.id, null, 401);
  await organizer.page.locator("#login-email").waitFor();
  assert.equal(await organizer.page.locator(".app-shell").count(), 0);
  assert.equal(
    (
      await pool.query(
        "SELECT COUNT(*)::INT AS count FROM public.task WHERE event_id=$1",
        [fresh.id],
      )
    ).rows[0].count,
    count,
  );
  checked(
    "Actual expired create401 clears workspace with no demo fallback and no database write",
  );
  assert.equal(report.applicationErrors, 0);
} catch (error) {
  if (diagnosticPage && !diagnosticPage.isClosed()) {
    report.formDiagnostic = await diagnosticPage
      .locator(".task-authoring-form")
      .evaluateAll((forms) =>
        forms.map((form) => ({
          values: Array.from(form.querySelectorAll("input,textarea")).map(
            (input) => ({ id: input.id, value: input.value }),
          ),
          errors: Array.from(
            form.querySelectorAll(".task-authoring-error,[role=alert]"),
          ).map((node) => node.textContent),
          submitDisabled: form.querySelector("button[type=submit]")?.disabled,
          assignee: form.querySelector("#task-author-assignedMemberId-value")
            ?.textContent,
        })),
      )
      .catch(() => []);
    await diagnosticPage
      .screenshot({ path: `${out}/failure.png` })
      .catch(() => {});
  }
  report.failureKind = error instanceof Error ? error.name : "Unknown";
  report.failureAt =
    error instanceof Error
      ? error.stack?.match(/verify-task-authoring-ui\.mjs:\d+:\d+/)?.[0]
      : undefined;
  throw new Error(
    "Task authoring browser verification did not complete; report step identifies unfinished coverage. Raw errors/credentials omitted.",
  );
} finally {
  for (const context of contexts) {
    await context.request
      .post(origin + "/api/auth/sign-out", { headers: { origin }, data: {} })
      .catch(() => {});
    await context.close();
  }
  await browser.close();
  await pool.end();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
