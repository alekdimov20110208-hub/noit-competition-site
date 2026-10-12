// Controlled real sessions and read-only PostgreSQL comparisons. Transport
// interceptions below are labelled; no business records or auth artifacts saved.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createDemoWorkspace } from "../src/data/demo.ts";
import { mapTaskRead } from "../src/services/RemoteWorkspaceService.ts";
import { toWorkspaceView } from "../src/services/workspaceViews.ts";
import {
  getEventChanges,
  getPersonalChangeAttention,
} from "../src/domain/changeCoordination.ts";
import { eventCalendarNow } from "../src/services/taskReadState.ts";
import {
  getTaskCounts,
  getAttentionTasks,
  getTeamWorkload,
} from "../src/domain/workspace.ts";
import { getTeamRoster } from "../src/pages/team/helpers.ts";
import { readDatabaseEnv } from "../server/src/config/env.ts";
import { createDatabasePool } from "../server/src/db/pool.ts";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = "http://127.0.0.1:5173",
  out = process.env.BUDOGRAPH_EVIDENCE_DIR ?? "tmp/p1d3-evidence/browser";
mkdirSync(out, { recursive: true });
const report = { checks: [], errors: 0, mutations: 0, matrix: [] };
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
const contexts = [];
let observedPage;
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
let lastLogin = 0;
const poison = createDemoWorkspace();
for (const rows of [
  poison.events,
  poison.teamMembers,
  poison.tasks,
  poison.changes,
  poison.templates,
])
  for (const row of rows) {
    row.name = "LOCAL_ONLY_POISON";
    row.title = "LOCAL_ONLY_POISON";
  }
async function make(label) {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
    locale: "en-GB",
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", () => report.errors++);
  page.on("request", (request) => {
    if (/\/api\/events/.test(request.url()) && request.method() !== "GET")
      report.mutations++;
  });
  await page.addInitScript((poison) => {
    localStorage.setItem(
      "budograph.preferences.v1",
      JSON.stringify({ version: 1, language: "en", theme: "light" }),
    );
    localStorage.setItem("budograph.workspace.v1", JSON.stringify(poison));
  }, poison);
  await page.goto(origin + "/");
  await page.locator("#login-email").waitFor();
  const remaining = 11_000 - (Date.now() - lastLogin);
  if (remaining > 0)
    await new Promise((resolve) => setTimeout(resolve, remaining));
  assert.ok(
    process.env[`BUDOGRAPH_${label}_EMAIL`] &&
      process.env[`BUDOGRAPH_${label}_PASSWORD`],
    "Controlled account inputs required",
  );
  await page
    .locator("#login-email")
    .fill(process.env[`BUDOGRAPH_${label}_EMAIL`]);
  await page
    .locator("#login-password")
    .fill(process.env[`BUDOGRAPH_${label}_PASSWORD`]);
  lastLogin = Date.now();
  await page.locator("button[type=submit]").click();
  await page.locator("#event-overview-title").waitFor();
  // Bind this assigned-work fixture suite explicitly. Metadata-only copies and
  // retained lifecycle fixtures legitimately change default landing order.
  const accessible = await page.evaluate(
    async () => (await (await fetch("/api/events")).json()).events,
  );
  const fixture = await pool.query(
    "SELECT event_id FROM public.task WHERE title=$1 AND deleted_at IS NULL AND event_id=ANY($2::UUID[])",
    [
      "Verify the two-user responsibility loop",
      accessible.filter((event) => !event.archived).map((event) => event.id),
    ],
  );
  assert.equal(
    fixture.rows.length,
    1,
    "Exactly one authorized active controlled responsibility fixture required",
  );
  await page.goto(origin + `/events/${fixture.rows[0].event_id}/dashboard`);
  await page.locator("#event-overview-title").waitFor();
  return { context, page };
}
async function read(page) {
  return page.evaluate(async () => {
    const events = await fetch("/api/events").then((r) => r.json());
    const selectedId = location.pathname.split("/")[2];
    const event = events.events.find(
      (event) => event.id === selectedId && !event.archived,
    );
    const tasks = await fetch(`/api/events/${event.id}/tasks`).then((r) =>
      r.json(),
    );
    const active = await fetch(`/api/events/${event.id}/members`).then((r) =>
      r.json(),
    );
    const changes = await fetch(`/api/events/${event.id}/changes`).then((r) =>
      r.json(),
    );
    return {
      event,
      ...tasks,
      activeMembers: active.members,
      changes: changes.changes,
    };
  });
}
async function safe(page) {
  assert.doesNotMatch(
    await page.locator(".app-main").innerText(),
    /LOCAL_ONLY_POISON|DO_NOT_EXPOSE|task-transport/,
  );
  assert.ok(
    await page.evaluate(() =>
      localStorage
        .getItem("budograph.workspace.v1")
        .includes("LOCAL_ONLY_POISON"),
    ),
  );
}
async function verifyDashboard(page, data) {
  assert.equal(
    await page.locator("#event-overview-title").innerText(),
    data.event.name,
  );
  assert.match(
    await page.locator(".event-overview__guest").innerText(),
    new RegExp(data.event.timezone),
  );
  const mapped = mapTaskRead(data.event, data),
    now = eventCalendarNow(new Date(), data.event.timezone),
    counts = getTaskCounts(mapped.tasks, now);
  assert.deepEqual(
    await page.locator(".event-overview__metrics dd").allTextContents(),
    [
      counts.completed,
      counts.total,
      counts.active,
      counts.blocked,
      counts.overdue,
    ].map(String),
  );
  const focus = getAttentionTasks(mapped.tasks, now, mapped.tasks.length).slice(
    0,
    5,
  );
  assert.deepEqual(
    await page
      .locator(".focus-item[data-task-focus-key] strong")
      .allTextContents(),
    focus.map((t) => t.title),
  );
  const links = await page
    .locator('.page--dashboard a[href*="/tasks?task="]')
    .evaluateAll((nodes) =>
      nodes.map((node) => new URL(node.href).searchParams.get("task")),
    );
  assert.ok(links.every((id) => data.tasks.some((t) => t.id === id)));
  const changes = getEventChanges(data.changes, data.event.id);
  assert.deepEqual(
    await page
      .locator(".change-impact__entry")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.changeId)),
    changes.map((change) => change.id),
  );
  if (!changes.length)
    assert.match(
      await page.locator(".change-impact").innerText(),
      /No changes recorded/,
    );
  else
    assert.deepEqual(
      await page.locator(".change-impact__title-link").allTextContents(),
      changes.map((change) => change.title),
    );
  const personal = getPersonalChangeAttention(changes, data.event).slice(
    0,
    Math.max(0, 5 - focus.length),
  );
  assert.deepEqual(
    await page
      .locator("[data-change-attention-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.dataset.changeAttentionId),
      ),
    personal.map((item) => item.change.id),
  );
  const workloads = getTeamWorkload(data.activeMembers, mapped.tasks, now);
  assert.equal(
    await page.locator(".pressure-row").count(),
    workloads.filter((w) => w.blocked || w.overdue || w.active >= 4).length,
  );
  await safe(page);
}
async function verifyTeam(page, data) {
  await page
    .locator(`.sidebar__nav a[href="/events/${data.event.id}/team"]`)
    .click();
  await page.locator(".team-roster__member").first().waitFor();
  const view = toWorkspaceView({
    ...mapTaskRead(data.event, data),
    activeMembers: data.activeMembers,
  });
  const roster = getTeamRoster(
    view,
    eventCalendarNow(new Date(), data.event.timezone),
  );
  assert.deepEqual(
    await page
      .locator(".team-roster__name")
      .evaluateAll((nodes) => nodes.map((n) => n.childNodes[0].textContent)),
    roster.map((s) => s.member.name),
  );
  assert.deepEqual(
    await page.locator(".team-roster__role").allTextContents(),
    roster.map((s) => s.member.role),
  );
  const assigned = roster.find((s) => s.assigned > 0);
  assert.ok(
    assigned,
    "Controlled fixture must assign a task to an active member",
  );
  await page.locator(`[data-team-member="${assigned.member.id}"]`).click();
  const expected = [
    assigned.open,
    assigned.attention.length,
    ...(assigned.overdue ? [assigned.overdue] : []),
    ...(assigned.blocked ? [assigned.blocked] : []),
    ...(assigned.notAccepted ? [assigned.notAccepted] : []),
  ].map(String);
  assert.deepEqual(
    await page.locator(".team-facts dd").allTextContents(),
    expected,
  );
  assert.equal(await page.locator(".team-detail select").count(), 0);
  await safe(page);
}
async function roundTrip(page, selector, destination) {
  const link = page.locator(selector).first();
  const href = await link.getAttribute("href"),
    focusKey = await link.getAttribute("data-task-focus-key");
  const eventId = new URL(href, origin).pathname.split("/")[2];
  const scopedDestination = `/events/${eventId}/${destination === "/" ? "dashboard" : destination.slice(1)}`;
  const scroll = await page.evaluate(() => scrollY);
  await link.click();
  await page.getByRole("dialog").waitFor();
  assert.equal(new URL(page.url()).search, new URL(href, origin).search);
  await page.keyboard.press("Escape");
  await page.waitForURL(origin + scopedDestination);
  await page.locator(`[data-task-focus-key="${focusKey}"]`).waitFor();
  await page.waitForFunction(
    (key) => document.activeElement?.dataset.taskFocusKey === key,
    focusKey,
  );
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - scroll) < 3);
  await page.goForward();
  await page.getByRole("dialog").waitFor();
  await page.goBack();
  await page.waitForURL(origin + scopedDestination);
}
async function dashboardRoundTrip(page, data, restoredData = data) {
  const selector = '.page--dashboard a[href*="/tasks?task="]:visible';
  if (await page.locator(selector).count()) {
    await roundTrip(page, selector, "/");
    return "real-link";
  }
  // Completed-only preparation can legitimately have no Dashboard task links.
  // Reuse a loaded task ID in a labelled, isolated read response, never a DB write.
  assert.ok(
    data.tasks.length,
    "Controlled Event needs a stored task for navigation verification",
  );
  const fixture = {
    ...data,
    changes: [],
    tasks: [
      {
        ...data.tasks[0],
        status: "not-started",
        accepted: false,
        acceptedByMemberId: null,
        acceptedAt: null,
      },
    ],
  };
  const transport = (route) =>
    route.fulfill({
      json: {
        tasks: fixture.tasks,
        members: fixture.members,
      },
    });
  await page.route("**/api/events/*/tasks", transport);
  const changeTransport = (route) => route.fulfill({ json: { changes: [] } });
  await page.route("**/api/events/*/changes", changeTransport);
  try {
    await page.reload();
    await page.locator("#event-overview-title").waitFor();
    await verifyDashboard(page, fixture);
    await roundTrip(page, selector, "/");
  } finally {
    await page.unroute("**/api/events/*/tasks", transport);
    await page.unroute("**/api/events/*/changes", changeTransport);
    await page.reload();
    await page.locator("#event-overview-title").waitFor();
    await verifyDashboard(page, restoredData);
  }
  return "isolated-transport";
}
try {
  const organizer = await make("ORGANIZER"),
    initial = await read(organizer.page);
  observedPage = organizer.page;
  assert.equal(initial.event.membership.accessRole, "ORGANIZER");
  const eventRows = await pool.query(
    "SELECT name, to_char(start_date, 'YYYY-MM-DD') AS start, to_char(end_date, 'YYYY-MM-DD') AS finish, timezone FROM public.event WHERE id=$1",
    [initial.event.id],
  );
  assert.deepEqual(eventRows.rows[0], {
    name: initial.event.name,
    start: initial.event.startDate,
    finish: initial.event.endDate,
    timezone: initial.event.timezone,
  });
  const members = await pool.query(
    'SELECT member.id, identity.name, member.operational_role AS role FROM public.event_member member JOIN public."user" identity ON identity.id=member.user_id WHERE member.event_id=$1 AND member.active=TRUE AND member.deactivated_at IS NULL AND identity.active=TRUE ORDER BY member.id',
    [initial.event.id],
  );
  assert.deepEqual(
    [...initial.activeMembers].sort((a, b) => a.id.localeCompare(b.id)),
    members.rows,
  );
  const tasks = await pool.query(
    "SELECT id, title, status, priority, to_char(deadline, 'YYYY-MM-DD') AS deadline, assigned_member_id, accepted_by_member_id, version FROM public.task WHERE event_id=$1 AND deleted_at IS NULL ORDER BY id",
    [initial.event.id],
  );
  for (const row of tasks.rows) {
    const task = initial.tasks.find((t) => t.id === row.id);
    assert.ok(task);
    for (const key of ["title", "status", "priority", "deadline", "version"])
      assert.equal(task[key], row[key]);
    assert.equal(task.assignedMemberId, row.assigned_member_id);
    assert.equal(task.acceptedByMemberId, row.accepted_by_member_id);
  }
  await verifyDashboard(organizer.page, initial);
  const navigationSource = await dashboardRoundTrip(organizer.page, initial);
  checked(
    `Organizer Dashboard: Event/counts/focus/pressure match real API and SQL; task round-trip (${navigationSource}) restores focus, scroll, Back/Forward`,
  );
  for (const status of ["in-progress", "completed"]) {
    const fixture = {
      ...initial,
      changes: [],
      tasks: [
        {
          ...initial.tasks[0],
          status,
          deadline: "9999-12-31",
          deadlineTime: null,
          assignedMemberId: initial.event.membership.id,
          accepted: true,
          acceptedByMemberId: initial.event.membership.id,
          acceptedAt: initial.tasks[0].updatedAt,
        },
      ],
      members: initial.activeMembers,
    };
    const fixtureTaskRead = (route) =>
      route.fulfill({
        json: { tasks: fixture.tasks, members: fixture.members },
      });
    await organizer.page.route("**/api/events/*/tasks", fixtureTaskRead);
    // This isolated Task transport fixture also has an explicit empty Change read.
    // Canonical Changes are checked separately against real API data above/below.
    const fixtureChangeRead = (route) =>
      route.fulfill({ json: { changes: [] } });
    await organizer.page.route("**/api/events/*/changes", fixtureChangeRead);
    await organizer.page.reload();
    await organizer.page.locator("#event-overview-title").waitFor();
    await verifyDashboard(organizer.page, fixture);
    assert.equal(
      await organizer.page.locator(".focus-item[data-task-focus-key]").count(),
      0,
    );
    assert.equal(
      await dashboardRoundTrip(organizer.page, fixture),
      status === "completed" ? "isolated-transport" : "real-link",
    );
    await organizer.page.unroute("**/api/events/*/tasks", fixtureTaskRead);
    await organizer.page.unroute("**/api/events/*/changes", fixtureChangeRead);
    await organizer.page.reload();
    await organizer.page.locator("#event-overview-title").waitFor();
    await verifyDashboard(organizer.page, initial);
    checked(
      `Labelled ${status} transport fixture: no Task attention items; canonical personal Change attention checked separately; meaningful task navigation without business mutations`,
    );
  }
  let readRequests = 0;
  const counter = (request) => {
    if (/\/api\/events/.test(request.url())) readRequests++;
  };
  organizer.page.on("request", counter);
  await verifyTeam(organizer.page, initial);
  await roundTrip(
    organizer.page,
    '.team-work-row__link[href*="/tasks?task="]',
    "/team",
  );
  assert.equal(readRequests, 0);
  organizer.page.off("request", counter);
  checked(
    "Organizer Team: active identities/roles/assignment/acceptance summaries match real API/SQL; real responsibility link preserves history/focus; pages share reads",
  );
  await organizer.page.reload();
  await organizer.page.locator(".team-roster__member").first().waitFor();
  assert.deepEqual((await read(organizer.page)).tasks, initial.tasks);
  checked(
    "Refresh retains canonical Event/member/task state; poisoned localStorage remains unused and untouched",
  );
  const member = await make("MEMBER"),
    seen = await read(member.page);
  assert.equal(seen.event.membership.accessRole, "MEMBER");
  assert.equal(seen.event.id, initial.event.id);
  assert.deepEqual(seen.tasks, initial.tasks);
  assert.deepEqual(seen.activeMembers, initial.activeMembers);
  await verifyDashboard(member.page, seen);
  await verifyTeam(member.page, seen);
  await member.page
    .locator('.team-work-row__link[href*="/tasks?task="]')
    .first()
    .click();
  await member.page.getByRole("dialog").waitFor();
  assert.equal(
    await member.page.locator(".task-assignment-select select").count(),
    0,
  );
  await member.page.keyboard.press("Escape");
  checked(
    "Independent Member sees the same authorized Event, Team and responsibility state; no Organizer assignment authority",
  );
  for (const path of ["/", "/team"]) {
    for (const width of [1440, 768, 390, 320]) {
      report.step = `${path} viewport ${width}`;
      await organizer.page.setViewportSize({ width, height: 900 });
      await organizer.page.goto(
        origin +
          `/events/${initial.event.id}/${path === "/" ? "dashboard" : path.slice(1)}`,
      );
      await organizer.page
        .locator(
          path === "/" ? "#event-overview-title" : ".team-roster__member",
        )
        .first()
        .waitFor();
      assert.equal(
        await organizer.page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await organizer.page.locator(".app-main").screenshot({
        path: `${out}/${path === "/" ? "dashboard" : "team"}-${width}.png`,
        animations: "disabled",
      });
      report.matrix.push({ path, width, overflow: false });
    }
    await organizer.page.setViewportSize({ width: 1440, height: 900 });
    report.step = `${path} loading`;
    let release;
    const hold = new Promise((resolve) => {
      release = resolve;
    });
    await organizer.page.route("**/api/events/*/members", async (route) => {
      await hold;
      await route.continue();
    });
    await organizer.page.reload();
    await organizer.page.locator('[aria-busy="true"]').waitFor();
    assert.equal(
      await organizer.page.locator(".focus-item,.team-roster__member").count(),
      0,
    );
    release();
    await organizer.page
      .locator(path === "/" ? "#event-overview-title" : ".team-roster__member")
      .first()
      .waitFor();
    await organizer.page.unroute("**/api/events/*/members");
    for (const status of [500, 403]) {
      report.step = `${path} error ${status}`;
      await organizer.page.route("**/api/events/*/members", (route) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: '{"message":"DO_NOT_EXPOSE"}',
        }),
      );
      await organizer.page.reload();
      await organizer.page.getByRole("alert").waitFor();
      await safe(organizer.page);
      assert.equal(
        await organizer.page
          .locator(".focus-item,.team-roster__member")
          .count(),
        0,
      );
      assert.equal(
        await organizer.page.evaluate(
          async () => (await fetch("/api/me")).status,
        ),
        200,
      );
      await organizer.page.unroute("**/api/events/*/members");
      await organizer.page.getByRole("button", { name: "Try again" }).click();
      await organizer.page
        .locator(
          path === "/" ? "#event-overview-title" : ".team-roster__member",
        )
        .first()
        .waitFor();
    }
    await organizer.page.route("**/api/events/*/tasks", (route) =>
      route.fulfill({ json: { tasks: [], members: [] } }),
    );
    report.step = `${path} empty`;
    await organizer.page.route("**/api/events/*/members", (route) =>
      route.fulfill({ json: { members: [] } }),
    );
    await organizer.page.route("**/api/events/*/changes", (route) =>
      route.fulfill({ json: { changes: [] } }),
    );
    await organizer.page.reload();
    await organizer.page
      .locator(path === "/" ? "#event-overview-title" : ".team-empty-copy")
      .first()
      .waitFor();
    assert.equal(
      await organizer.page.locator('a[href*="/tasks?task="]').count(),
      0,
    );
    await safe(organizer.page);
    await organizer.page.unroute("**/api/events/*/tasks");
    await organizer.page.unroute("**/api/events/*/members");
    await organizer.page.unroute("**/api/events/*/changes");
    await organizer.page.route("**/api/events", (route) =>
      route.fulfill({ json: { events: [] } }),
    );
    await organizer.page.reload();
    await organizer.page.getByRole("alert").waitFor();
    await organizer.page.unroute("**/api/events");
    checked(
      `${path}: real responsive layout plus labelled intercepted loading/empty/no-Event/500/403 states; sanitized retry, no demo fallback`,
    );
  }
  // P3A replaces the former unconnected Changes placeholder with real data.
  // Compare the complete scoped list instead of assuming this Event is empty.
  const changes = await organizer.page.evaluate(async (eventId) => {
    const response = await fetch(`/api/events/${eventId}/changes`);
    if (!response.ok) throw new Error("Changes read failed");
    return (await response.json()).changes;
  }, initial.event.id);
  await organizer.page.goto(origin + `/events/${initial.event.id}/changes`);
  await organizer.page
    .locator(".page--changes:not([aria-busy=true])")
    .waitFor();
  assert.deepEqual(
    await organizer.page.locator(".change-register__title").allTextContents(),
    changes.map((change) => change.title),
  );
  assert.deepEqual(
    await organizer.page
      .locator(".change-register__title")
      .evaluateAll((links) => links.map((link) => new URL(link.href).pathname)),
    changes.map((change) => `/events/${initial.event.id}/changes/${change.id}`),
  );
  if (!changes.length) await organizer.page.locator(".empty-state").waitFor();
  await safe(organizer.page);
  await organizer.page.goto(origin + `/events/${initial.event.id}/templates`);
  await organizer.page.locator(".empty-state").waitFor();
  await safe(organizer.page);
  checked(
    "Changes matches the real scoped API list and durable links; Templates retains its truthful unconnected empty state; no demo fallback",
  );
  await organizer.page.goto(origin + "/");
  await organizer.page.locator("#event-overview-title").waitFor();
  await organizer.page.evaluate(async () => {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    window.dispatchEvent(new Event("focus"));
  });
  await organizer.page.locator("#login-email").waitFor();
  assert.equal(await organizer.page.locator(".app-shell").count(), 0);
  assert.equal(
    await member.page.evaluate(async () => (await fetch("/api/me")).status),
    200,
  );
  await member.page.evaluate(async () => {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    window.dispatchEvent(new Event("focus"));
  });
  await member.page.locator("#login-email").waitFor();
  checked(
    "Real Dashboard and Team read 401s clear shell/workspace and return to Login; independent sessions stay isolated",
  );
  assert.equal(report.errors, 0);
  assert.equal(report.mutations, 0);
  checked(
    "Zero application errors and zero Event/task business mutation requests",
  );
} catch (error) {
  if (observedPage && (await observedPage.locator(".app-main").count())) {
    console.log(
      "Failure state:",
      report.step,
      await observedPage.locator(".app-main").innerText(),
    );
    await observedPage
      .locator(".app-main")
      .screenshot({ path: `${out}/failure.png` });
  }
  throw error;
} finally {
  for (const context of contexts) {
    try {
      await context.request.post(origin + "/api/auth/sign-out", {
        headers: { origin },
        data: {},
      });
    } catch {}
    await context.close();
  }
  await browser.close();
  await pool.end();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
