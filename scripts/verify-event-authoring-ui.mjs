// Real controlled accounts and PostgreSQL; only named transport error/empty
// cases are intercepted. Intentional UI-created development Events are retained.
// No credentials, cookies, storageState, HAR, trace or session dump is saved.
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
  out = "tmp/p2a-evidence/browser";
mkdirSync(out, { recursive: true });
const config = readDatabaseEnv();
assert.equal(
  config.nodeEnv,
  "development",
  "Controlled development database required",
);
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
  applicationErrors: 0,
  requests: [],
};
const contexts = [],
  run = randomUUID().slice(0, 8);
let lastLogin = 0;
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
const href = (id, page = "dashboard") => `/events/${id}/${page}`;
const fields = (event) => ({
  name: event.name,
  startDate: event.startDate,
  endDate: event.endDate,
  timezone: event.timezone,
});
async function safe(page) {
  assert.doesNotMatch(
    await page.locator(".app-main").innerText(),
    /DO_NOT_EXPOSE|LOCAL_P2A_POISON|postgres|Fastify|BETTER_AUTH_SECRET/,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
}
async function reachableSubmit(page) {
  const submit = page.locator(".event-form button[type=submit]");
  await submit.focus();
  await page.waitForFunction(
    () => {
      const button = document.querySelector(".event-form button[type=submit]");
      if (!button || button !== document.activeElement) return false;
      const box = button.getBoundingClientRect();
      return (
        box.top >= 0 &&
        box.bottom <= innerHeight &&
        [box.top + 2, (box.top + box.bottom) / 2, box.bottom - 2].every((y) =>
          button.contains(
            document.elementFromPoint((box.left + box.right) / 2, y),
          ),
        )
      );
    },
    undefined,
    { timeout: 3000 },
  );
  await submit.evaluate((button) =>
    button.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  assert.equal(
    await submit.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return (
        box.top >= 0 &&
        box.bottom <= innerHeight &&
        [box.top + 2, (box.top + box.bottom) / 2, box.bottom - 2].every((y) =>
          button.contains(
            document.elementFromPoint((box.left + box.right) / 2, y),
          ),
        )
      );
    }),
    true,
    "The full submit target must remain reachable above fixed mobile navigation",
  );
}
async function make(label) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-GB",
    timezoneId: "Europe/Sofia",
    reducedMotion: "reduce",
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", () => report.applicationErrors++);
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() !== "GET" &&
      /^\/api\/events(?:\/[^/]+)?$/.test(path)
    ) {
      const body = request.postDataJSON();
      assert.ok(
        Object.keys(body).every((key) =>
          [
            "name",
            "startDate",
            "endDate",
            "timezone",
            "expectedVersion",
          ].includes(key),
        ),
        "Only product-editable fields and expectedVersion may be sent",
      );
      report.requests.push({
        method: request.method(),
        path,
        expectedVersion: body.expectedVersion ?? null,
      });
    }
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("budograph.preferences.v1"))
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language: "en", theme: "light" }),
      );
    localStorage.setItem("budograph.workspace.v1", "LOCAL_P2A_POISON");
  });
  await page.goto(origin + "/");
  await page.locator("#login-email").waitFor();
  const remaining = 11_000 - (Date.now() - lastLogin);
  if (remaining > 0)
    await new Promise((resolve) => setTimeout(resolve, remaining));
  assert.ok(
    process.env[`BUDOGRAPH_${label}_EMAIL`] &&
      process.env[`BUDOGRAPH_${label}_PASSWORD`],
    "Controlled inputs required",
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
  return { page, context };
}
async function read(page, id) {
  return page.evaluate(async (id) => {
    const me = await fetch("/api/me").then((r) => r.json());
    const { events } = await fetch("/api/events", { cache: "no-store" }).then(
      (r) => r.json(),
    );
    const event = events.find(
      (event) => event.id === (id ?? location.pathname.split("/")[2]),
    );
    const [tasks, members] = await Promise.all([
      fetch(`/api/events/${event.id}/tasks`).then((r) => r.json()),
      fetch(`/api/events/${event.id}/members`).then((r) => r.json()),
    ]);
    return {
      user: me.user,
      events,
      event,
      tasks: tasks.tasks,
      members: members.members,
    };
  }, id);
}
async function fill(page, values) {
  for (const key of ["name", "startDate", "endDate", "timezone"])
    await page.locator(`#event-${key}`).fill(values[key]);
}
async function settled(page, id, name) {
  await page.waitForURL(origin + href(id));
  await page.locator("#event-overview-title").waitFor();
  await page.waitForFunction(
    (name) =>
      document.querySelector("#event-overview-title")?.textContent === name,
    name,
  );
  await safe(page);
}
async function create(page, label, pending = false) {
  report.step = `${label}: create Event`;
  await page.goto(origin + "/events/new");
  await page.locator("#event-name").waitFor();
  assert.equal(
    await page.locator("#event-timezone").inputValue(),
    "Europe/Sofia",
  );
  const values = {
    name: `BudoGraph P2A ${label} ${run}`,
    startDate: "2030-03-30",
    endDate: "2030-03-31",
    timezone: "Europe/Sofia",
  };
  await fill(page, values);
  await page.evaluate(() => {
    window.__p2aCreateSentinel = "persist-without-reload";
  });
  let release, started;
  const hold = new Promise((resolve) => {
      release = resolve;
    }),
    incoming = new Promise((resolve) => {
      started = resolve;
    });
  let count = 0;
  const handler = async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    count++;
    started();
    await hold;
    await route.continue();
  };
  if (pending) await page.route(origin + "/api/events", handler);
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/events" &&
      response.request().method() === "POST",
  );
  await page.locator(".event-form").evaluate((form) => {
    form.requestSubmit();
    if (form.dataset.duplicate) form.requestSubmit();
  });
  if (pending) {
    await incoming;
    await page.locator(".event-form[aria-busy=true]").waitFor();
    assert.equal(
      await page.locator(".event-form button[type=submit]").isDisabled(),
      true,
    );
    assert.equal(await page.locator("#event-name").isDisabled(), true);
    await page.locator(".event-form").evaluate((form) => form.requestSubmit());
    assert.equal(count, 1);
    release();
  }
  const response = await responsePromise;
  assert.equal(response.status(), 201);
  const { event } = await response.json();
  if (pending) await page.unroute(origin + "/api/events", handler);
  assert.deepEqual(fields(event), values);
  assert.equal(event.membership.accessRole, "ORGANIZER");
  assert.equal(event.version, 1);
  await settled(page, event.id, event.name);
  assert.equal(
    await page.evaluate(() => window.__p2aCreateSentinel),
    "persist-without-reload",
  );
  report.intentionalEvents.push({
    id: event.id,
    name: event.name,
    createdByAccountLabel: label,
    retained: true,
  });
  return event;
}
async function save(page, expectedStatus = 200) {
  const pendingResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      /^\/api\/events\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await page.locator(".event-form button[type=submit]").click();
  const response = await pendingResponse;
  assert.equal(response.status(), expectedStatus);
  return expectedStatus === 200 ? (await response.json()).event : null;
}
async function switchTo(page, eventId, destination) {
  const selector = page.locator(
    "#event-switcher:visible, #mobile-event-switcher:visible",
  );
  await selector.selectOption(eventId);
  await page.waitForURL(origin + href(eventId, destination));
  await page
    .locator(
      destination === "dashboard"
        ? "#event-overview-title"
        : destination === "tasks"
          ? ".page--tasks:not([aria-busy])"
          : ".team-roster__member",
    )
    .first()
    .waitFor();
  assert.equal(await selector.inputValue(), eventId);
  await safe(page);
}
async function proveDatabase(page, event, expectedActions) {
  const data = await read(page, event.id);
  const rows = await pool.query(
    "SELECT owner_user_id, name, to_char(start_date,'YYYY-MM-DD') AS start, to_char(end_date,'YYYY-MM-DD') AS finish, timezone, version FROM public.event WHERE id=$1",
    [event.id],
  );
  assert.deepEqual(rows.rows[0], {
    owner_user_id: data.user.id,
    name: event.name,
    start: event.startDate,
    finish: event.endDate,
    timezone: event.timezone,
    version: event.version,
  });
  const members = await pool.query(
    "SELECT id,user_id,access_role,active,deactivated_at FROM public.event_member WHERE event_id=$1",
    [event.id],
  );
  assert.deepEqual(members.rows, [
    {
      id: event.membership.id,
      user_id: data.user.id,
      access_role: "ORGANIZER",
      active: true,
      deactivated_at: null,
    },
  ]);
  assert.equal(data.tasks.length, 0);
  assert.equal(data.members.length, 1);
  const tasks = await pool.query(
    "SELECT count(*)::integer AS count FROM public.task WHERE event_id=$1",
    [event.id],
  );
  assert.equal(tasks.rows[0].count, 0);
  const activities = await pool.query(
    "SELECT action_type,actor_user_id,actor_member_id,target_type,target_id,payload FROM public.activity_entry WHERE event_id=$1 ORDER BY created_at,id",
    [event.id],
  );
  assert.deepEqual(
    activities.rows.map((row) => row.action_type),
    expectedActions,
  );
  for (const row of activities.rows) {
    assert.equal(row.actor_user_id, data.user.id);
    assert.equal(row.actor_member_id, event.membership.id);
    assert.equal(row.target_type, "event");
    assert.equal(row.target_id, event.id);
  }
  return activities.rows;
}
try {
  const organizer = await make("ORGANIZER"),
    initial = await read(organizer.page),
    original = initial.event;
  assert.equal(original.membership.accessRole, "ORGANIZER");
  assert.ok(
    initial.tasks.length,
    "Existing P1 task fixture must remain present",
  );
  assert.equal(new URL(organizer.page.url()).pathname, href(original.id));
  checked(
    "Real Organizer login migrates legacy route into durable original Event Dashboard",
  );

  report.step = "labelled initial Event list loading";
  let releaseInitialList, initialListStarted;
  const initialListHold = new Promise((resolve) => {
    releaseInitialList = resolve;
  });
  const initialListIncoming = new Promise((resolve) => {
    initialListStarted = resolve;
  });
  const heldInitialList = async (route) => {
    initialListStarted();
    await initialListHold;
    await route.continue();
  };
  await organizer.page.route(origin + "/api/events", heldInitialList);
  await organizer.page.goto(origin + "/events/new");
  await initialListIncoming;
  await organizer.page.locator("#event-name").waitFor();
  try {
    assert.equal(
      await organizer.page
        .locator("#event-switcher option:checked")
        .innerText(),
      "Loading events…",
    );
    assert.equal(
      await organizer.page.locator("#event-switcher").isDisabled(),
      true,
    );
  } finally {
    releaseInitialList();
  }
  await organizer.page.waitForFunction(
    () => !document.querySelector("#event-switcher")?.disabled,
  );
  await organizer.page.unroute(origin + "/api/events", heldInitialList);
  checked(
    "Labelled held initial list: direct Create shows Loading events while pending, then accessible options without a false zero-Event claim",
  );

  report.step = "labelled empty account";
  const empty = (route) => route.fulfill({ json: { events: [] } });
  await organizer.page.route(origin + "/api/events", empty);
  await organizer.page.goto(origin + "/");
  await organizer.page
    .getByRole("heading", { name: "No events yet" })
    .first()
    .waitFor();
  await organizer.page
    .locator(".app-main")
    .getByRole("button", { name: "Create event", exact: true })
    .click();
  await organizer.page.locator("#event-name").waitFor();
  assert.equal(
    await organizer.page.locator(".task-row,.team-roster__member").count(),
    0,
  );
  await organizer.page.unroute(origin + "/api/events", empty);
  checked(
    "Labelled zero-membership list: clear Create Event path and no task/member/demo fallback",
  );

  report.step = "create validation and labelled failures";
  const beforeValidation = report.requests.length;
  await organizer.page.locator(".event-form button[type=submit]").click();
  assert.equal(
    await organizer.page.locator("input[aria-invalid=true]").count(),
    3,
  );
  assert.equal(
    await organizer.page
      .locator("#event-name")
      .evaluate((node) => node === document.activeElement),
    true,
  );
  assert.equal(report.requests.length, beforeValidation);
  const values = {
    name: "P2A safe failure check",
    startDate: "2030-03-31",
    endDate: "2030-03-30",
    timezone: "Arbitrary/Invalid",
  };
  await fill(organizer.page, values);
  await organizer.page.locator(".event-form button[type=submit]").click();
  assert.equal(
    await organizer.page.locator("#event-endDate").getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(
    await organizer.page
      .locator("#event-timezone")
      .getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(report.requests.length, beforeValidation);
  await fill(organizer.page, {
    ...values,
    endDate: "2030-03-31",
    timezone: "Europe/Sofia",
  });
  for (const status of [400, 403, 404, 500, "network"]) {
    report.step = `labelled create failure ${status}`;
    const failure = (route) =>
      route.request().method() !== "POST"
        ? route.continue()
        : status === "network"
          ? route.abort()
          : route.fulfill({
              status,
              json: {
                code: "DO_NOT_EXPOSE",
                fields: status === 400 ? { name: "NAME_REQUIRED" } : undefined,
              },
            });
    await organizer.page.route(origin + "/api/events", failure);
    const failedRequest =
      status === "network"
        ? organizer.page.waitForEvent(
            "requestfailed",
            (request) =>
              new URL(request.url()).pathname === "/api/events" &&
              request.method() === "POST",
          )
        : organizer.page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/api/events" &&
              response.request().method() === "POST" &&
              response.status() === status,
          );
    await organizer.page.locator(".event-form button[type=submit]").click();
    await failedRequest;
    await organizer.page.getByRole("alert").waitFor();
    await organizer.page.waitForFunction(
      () =>
        document.querySelector(".event-form")?.getAttribute("aria-busy") ===
        "false",
    );
    await safe(organizer.page);
    await organizer.page.waitForFunction(
      () => document.querySelector('[role="alert"]') === document.activeElement,
    );
    assert.equal(
      await organizer.page
        .locator(".event-form button[type=submit]")
        .isEnabled(),
      true,
    );
    await organizer.page.unroute(origin + "/api/events", failure);
  }
  checked(
    "Client name/calendar/order/timezone validation, focused associated errors and labelled sanitized 400/403/404/500/network failures with explicit retry",
  );

  let authored = await create(organizer.page, "Organizer", true);
  await proveDatabase(organizer.page, authored, ["EVENT_CREATED"]);
  const fresh = await read(organizer.page, authored.id);
  assert.deepEqual(fresh.tasks, []);
  assert.deepEqual(
    await organizer.page
      .locator(".event-overview__metrics dd")
      .allTextContents(),
    ["0", "0", "0", "0", "0"],
  );
  await organizer.page.goto(origin + href(authored.id, "tasks"));
  await organizer.page
    .getByRole("heading", { name: "No tasks for this event" })
    .waitFor();
  assert.equal(await organizer.page.locator(".task-row").count(), 0);
  await organizer.page.goto(origin + href(authored.id, "team"));
  await organizer.page.locator(".team-roster__member").waitFor();
  assert.equal(await organizer.page.locator(".team-roster__member").count(), 1);
  assert.match(
    await organizer.page.locator(".team-roster__name").innerText(),
    new RegExp(fresh.user.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  checked(
    "UI create is one pending command, navigates without reload and persists owner + active Organizer + EVENT_CREATED atomically; fresh Dashboard/Tasks/Team are real and contain no cloned tasks",
  );

  report.step = "Organizer basic edit";
  await organizer.page.goto(origin + href(authored.id, "edit"));
  await organizer.page.locator("#event-name").waitFor();
  const editedFields = {
    name: authored.name + " edited",
    startDate: "2030-04-01",
    endDate: "2030-04-03",
    timezone: "Asia/Tokyo",
  };
  await fill(organizer.page, editedFields);
  const priorVersion = authored.version;
  authored = await save(organizer.page);
  assert.equal(authored.version, priorVersion + 1);
  assert.equal(report.requests.at(-1).expectedVersion, priorVersion);
  await settled(organizer.page, authored.id, editedFields.name);
  await organizer.page.reload();
  await settled(organizer.page, authored.id, editedFields.name);
  const editedActivity = await proveDatabase(organizer.page, authored, [
    "EVENT_CREATED",
    "EVENT_UPDATED",
  ]);
  assert.deepEqual(editedActivity[1].payload.before, {
    ...fields(fresh.event),
    version: priorVersion,
  });
  assert.deepEqual(editedActivity[1].payload.after, {
    ...editedFields,
    version: authored.version,
  });
  checked(
    "Organizer edits all four basics with expectedVersion; version increments and before/after activity and refresh match real PostgreSQL",
  );

  for (const destination of ["dashboard", "tasks", "team"]) {
    report.step = `Event switching ${destination}`;
    await organizer.page.goto(origin + href(authored.id, destination));
    await switchTo(organizer.page, original.id, destination);
    const real = await read(organizer.page, original.id);
    assert.equal(real.event.id, original.id);
    if (destination === "dashboard")
      assert.equal(
        await organizer.page.locator("#event-overview-title").innerText(),
        original.name,
      );
    if (destination === "tasks")
      assert.equal(
        await organizer.page.locator(".task-row").count(),
        initial.tasks.length,
      );
    if (destination === "team")
      assert.equal(
        await organizer.page.locator(".team-roster__member").count(),
        initial.members.length,
      );
    await switchTo(organizer.page, authored.id, destination);
    assert.equal(await organizer.page.locator(".task-row").count(), 0);
    if (destination === "team")
      assert.equal(
        await organizer.page.locator(".team-roster__member").count(),
        1,
      );
    await organizer.page.goBack();
    await organizer.page.waitForURL(origin + href(original.id, destination));
    await organizer.page.goForward();
    await organizer.page.waitForURL(origin + href(authored.id, destination));
  }
  await organizer.page.goto(
    origin + href(original.id, "tasks") + `?task=${initial.tasks[0].id}`,
  );
  await organizer.page.getByRole("dialog").waitFor();
  // The switcher is outside the modal, so leave its focus trap before switching.
  await organizer.page.keyboard.press("Escape");
  await organizer.page.getByRole("dialog").waitFor({ state: "hidden" });
  await switchTo(organizer.page, authored.id, "tasks");
  assert.equal(new URL(organizer.page.url()).search, "");
  await organizer.page.reload();
  await organizer.page
    .getByRole("heading", { name: "No tasks for this event" })
    .waitFor();
  checked(
    "Dashboard, Tasks and Team switches keep equivalent pages, fully replace Event data, preserve Back/Forward and deep-link refresh, and discard foreign task detail IDs",
  );

  report.step = "stale in-flight Event read";
  let releaseStale, startedStale;
  const staleHold = new Promise((resolve) => {
      releaseStale = resolve;
    }),
    staleStart = new Promise((resolve) => {
      startedStale = resolve;
    });
  const slow = async (route) => {
    startedStale();
    await staleHold;
    try {
      await route.continue();
    } catch {}
  };
  await organizer.page.route(origin + `/api/events/${original.id}/tasks`, slow);
  await organizer.page.goto(origin + href(original.id, "tasks"));
  await staleStart;
  assert.equal(await organizer.page.locator(".task-row").count(), 0);
  await switchTo(organizer.page, authored.id, "tasks");
  releaseStale();
  await organizer.page.unroute(
    origin + `/api/events/${original.id}/tasks`,
    slow,
  );
  await organizer.page.waitForTimeout(100);
  assert.equal(await organizer.page.locator(".task-row").count(), 0);
  assert.equal(
    new URL(organizer.page.url()).pathname,
    href(authored.id, "tasks"),
  );
  checked(
    "Labelled held original-Event read is cancelled or ignored after switch; no original rows reappear as fresh-Event data",
  );

  report.step = "cross-Event Dashboard Back focus and scroll";
  const dashboardTaskLink = '.page--dashboard a[href*="/tasks?task="]:visible';
  await organizer.page.goto(origin + href(original.id));
  await organizer.page.locator("#event-overview-title").waitFor();
  let usedNavigationFixture = false;
  if (!(await organizer.page.locator(dashboardTaskLink).count())) {
    usedNavigationFixture = true;
    await organizer.page.route(
      origin + `/api/events/${original.id}/tasks`,
      (route) =>
        route.fulfill({
          json: {
            tasks: [
              {
                ...initial.tasks[0],
                status: "not-started",
                accepted: false,
                acceptedByMemberId: null,
                acceptedAt: null,
              },
            ],
            members: initial.members,
          },
        }),
      { times: 1 },
    );
    await organizer.page.reload();
    await organizer.page.locator(dashboardTaskLink).first().waitFor();
  }
  const originLink = organizer.page.locator(dashboardTaskLink).first();
  await originLink.scrollIntoViewIfNeeded();
  const originFocusKey = await originLink.getAttribute("data-task-focus-key");
  const originScroll = await organizer.page.evaluate(() => scrollY);
  await originLink.click();
  await organizer.page.getByRole("dialog").waitFor();
  await organizer.page.keyboard.press("Escape");
  await organizer.page.waitForURL(origin + href(original.id));
  await organizer.page.waitForFunction(
    (key) => document.activeElement?.dataset.taskFocusKey === key,
    originFocusKey,
  );
  await switchTo(organizer.page, authored.id, "dashboard");
  let finishBackRead, startedBackRead;
  const backReadHold = new Promise((resolve) => {
    finishBackRead = resolve;
  });
  const backReadStarted = new Promise((resolve) => {
    startedBackRead = resolve;
  });
  const backRead = async (route) => {
    startedBackRead();
    await backReadHold;
    await route.continue();
  };
  await organizer.page.route(
    origin + `/api/events/${original.id}/tasks`,
    backRead,
  );
  await organizer.page.goBack();
  await backReadStarted;
  assert.equal(new URL(organizer.page.url()).pathname, href(original.id));
  assert.equal(
    await organizer.page
      .locator(".focus-item,.task-row,#event-overview-title")
      .count(),
    0,
  );
  finishBackRead();
  await organizer.page.locator("#event-overview-title").waitFor();
  await organizer.page.waitForFunction(
    (key) => document.activeElement?.dataset.taskFocusKey === key,
    originFocusKey,
  );
  assert.ok(
    Math.abs((await organizer.page.evaluate(() => scrollY)) - originScroll) < 3,
  );
  await organizer.page.unroute(
    origin + `/api/events/${original.id}/tasks`,
    backRead,
  );
  checked(
    `Cross-Event Back waits for held original Dashboard read and restores original task trigger, focus and scroll without fresh-Event data (${usedNavigationFixture ? "labelled navigation transport" : "real task link"})`,
  );

  const member = await make("MEMBER"),
    memberInitial = await read(member.page);
  assert.equal(memberInitial.event.id, original.id);
  assert.equal(memberInitial.event.membership.accessRole, "MEMBER");
  assert.equal(
    memberInitial.events.some((event) => event.id === authored.id),
    false,
  );
  assert.equal(
    await member.page.locator(`a[href="${href(original.id, "edit")}"]`).count(),
    0,
  );
  const listed = await member.page
    .locator("#event-switcher option")
    .evaluateAll((nodes) =>
      nodes.filter((node) => node.value).map((node) => node.value),
    );
  assert.deepEqual(
    listed.sort(),
    memberInitial.events
      .filter((event) => !event.archived)
      .map((event) => event.id)
      .sort(),
  );
  await member.page.goto(origin + href(original.id, "edit"));
  await member.page.getByRole("alert").waitFor();
  assert.equal(await member.page.locator(".event-form").count(), 0);
  const memberDenied = await member.context.request.patch(
    origin + `/api/events/${original.id}`,
    {
      headers: { origin },
      data: { ...fields(original), expectedVersion: original.version },
    },
  );
  assert.equal(memberDenied.status(), 403);
  for (const path of [href(authored.id), href(authored.id, "edit")]) {
    await member.page.goto(origin + path);
    await member.page.getByRole("alert").waitFor();
    assert.equal(
      await member.page
        .locator(".event-form,.focus-item,.task-row,.team-roster__member")
        .count(),
      0,
    );
    await safe(member.page);
  }
  const forbiddenRead = await member.context.request.get(
    origin + `/api/events/${authored.id}/tasks`,
  );
  assert.equal(forbiddenRead.status(), 404);
  const forged = await member.context.request.post(origin + "/api/events", {
    headers: { origin },
    data: {
      ...fields(authored),
      ownerUserId: initial.user.id,
      accessRole: "ORGANIZER",
      memberId: original.membership.id,
    },
  });
  assert.equal(forged.status(), 400);
  checked(
    "Independent Member switcher matches real accessible list; edit affordance absent, direct edit403, foreign route/read404 and forged ownership/role400 all fail closed",
  );
  const memberCreated = await create(member.page, "Member");
  await proveDatabase(member.page, memberCreated, ["EVENT_CREATED"]);
  const dualRole = await read(member.page, memberCreated.id);
  assert.equal(
    dualRole.events.find((event) => event.id === original.id).membership
      .accessRole,
    "MEMBER",
  );
  assert.equal(dualRole.event.membership.accessRole, "ORGANIZER");
  assert.equal(
    await member.page
      .locator(`a[href="${href(memberCreated.id, "edit")}"]:visible`)
      .count(),
    1,
  );
  checked(
    "Same real user is MEMBER in original Event and automatically ORGANIZER/owner in their separately UI-created Event; no global Organizer account type",
  );

  report.step = "real Event edit conflict and concurrent requests";
  await organizer.page.goto(origin + href(authored.id, "edit"));
  await organizer.page.locator("#event-name").waitFor();
  const newerFields = {
    ...fields(authored),
    name: authored.name + " canonical",
  };
  const concurrent = await Promise.all([
    organizer.context.request.patch(origin + `/api/events/${authored.id}`, {
      headers: { origin },
      data: { ...newerFields, expectedVersion: authored.version },
    }),
    organizer.context.request.patch(origin + `/api/events/${authored.id}`, {
      headers: { origin },
      data: {
        ...newerFields,
        name: newerFields.name + " second",
        expectedVersion: authored.version,
      },
    }),
  ]);
  assert.deepEqual(
    concurrent.map((response) => response.status()).sort(),
    [200, 409],
  );
  const winner = (
    await concurrent.find((response) => response.status() === 200).json()
  ).event;
  await organizer.page
    .locator("#event-name")
    .fill("P2A stale draft must not overwrite canonical");
  const commandsBeforeConflict = report.requests.length;
  await save(organizer.page, 409);
  await organizer.page.getByRole("alert").waitFor();
  await organizer.page.waitForFunction(
    (name) => document.querySelector("#event-name")?.value === name,
    winner.name,
  );
  assert.match(
    await organizer.page.getByRole("alert").innerText(),
    /changed elsewhere/,
  );
  assert.equal(report.requests.length, commandsBeforeConflict + 1);
  assert.equal(
    (await read(organizer.page, authored.id)).event.version,
    winner.version,
  );
  await proveDatabase(organizer.page, winner, [
    "EVENT_CREATED",
    "EVENT_UPDATED",
    "EVENT_UPDATED",
  ]);
  await organizer.page.locator("#event-name").fill(winner.name + " reviewed");
  authored = await save(organizer.page);
  assert.equal(authored.version, winner.version + 1);
  await settled(organizer.page, authored.id, authored.name);
  await proveDatabase(organizer.page, authored, [
    "EVENT_CREATED",
    "EVENT_UPDATED",
    "EVENT_UPDATED",
    "EVENT_UPDATED",
  ]);
  checked(
    "Two simultaneous real edits with same version yield one200/one409 and one activity; stale UI409 reloads canonical data, explains conflict, never replays and requires explicit reviewed retry",
  );

  report.step = "keyboard switcher and Event authoring layout";
  await organizer.page.goto(origin + href(authored.id));
  await settled(organizer.page, authored.id, authored.name);
  const switcher = organizer.page.locator("#event-switcher");
  assert.equal(await switcher.isDisabled(), false);
  assert.equal(await switcher.inputValue(), authored.id);
  const keyboardAccessibleIds = await switcher
    .locator("option")
    .evaluateAll((options) => options.map((option) => option.value));
  await switcher.focus();
  await switcher.press("ArrowUp");
  await switcher.press("Enter");
  const keyboardSelectedId = await switcher.inputValue();
  assert.ok(
    keyboardSelectedId && keyboardAccessibleIds.includes(keyboardSelectedId),
  );
  assert.notEqual(keyboardSelectedId, authored.id);
  await organizer.page.waitForURL(origin + href(keyboardSelectedId));
  await organizer.page.waitForFunction(() =>
    ["main-content", "event-switcher"].includes(document.activeElement?.id),
  );
  for (const width of [1440, 1024, 768, 390, 320])
    for (const language of ["en", "bg"])
      for (const theme of ["light", "dark"]) {
        report.step = `authoring ${width}/${language}/${theme}`;
        await organizer.page.setViewportSize({ width, height: 900 });
        await organizer.page.evaluate(
          ({ language, theme }) =>
            localStorage.setItem(
              "budograph.preferences.v1",
              JSON.stringify({ version: 1, language, theme }),
            ),
          { language, theme },
        );
        await organizer.page.goto(origin + href(authored.id, "edit"));
        await organizer.page.locator("#event-name").waitFor();
        assert.equal(
          await organizer.page.locator("html").getAttribute("lang"),
          language,
        );
        assert.equal(
          await organizer.page.locator("html").getAttribute("data-theme"),
          theme,
        );
        assert.equal(
          await organizer.page.locator(".page--event-authoring h1").innerText(),
          language === "bg" ? "Редактиране на събитието" : "Edit event",
        );
        assert.equal(
          await organizer.page.locator("#event-name").inputValue(),
          authored.name,
        );
        await safe(organizer.page);
        for (const id of ["name", "startDate", "endDate", "timezone"]) {
          assert.equal(
            await organizer.page.locator(`label[for="event-${id}"]`).count(),
            1,
          );
          const box = await organizer.page
            .locator(`#event-${id}`)
            .boundingBox();
          assert.ok(box.height >= 44);
        }
        const visibleSwitcher = organizer.page.locator(
          "#event-switcher:visible,#mobile-event-switcher:visible",
        );
        assert.equal(await visibleSwitcher.count(), 1);
        assert.ok((await visibleSwitcher.boundingBox()).height >= 44);
        const submit = await organizer.page
          .locator(".event-form button[type=submit]")
          .boundingBox();
        assert.ok(submit.height >= 44);
        await reachableSubmit(organizer.page);
        await organizer.page.locator(".page--event-authoring").screenshot({
          path: `${out}/edit-${width}-${language}-${theme}.png`,
          animations: "disabled",
        });
        await organizer.page.goto(origin + "/events/new");
        await organizer.page.locator("#event-name").waitFor();
        assert.equal(
          await organizer.page.locator("html").getAttribute("lang"),
          language,
        );
        assert.equal(
          await organizer.page.locator("html").getAttribute("data-theme"),
          theme,
        );
        assert.equal(
          await organizer.page.locator(".page--event-authoring h1").innerText(),
          language === "bg" ? "Създаване на събитие" : "Create event",
        );
        await safe(organizer.page);
        await reachableSubmit(organizer.page);
        await organizer.page.locator(".page--event-authoring").screenshot({
          path: `${out}/create-${width}-${language}-${theme}.png`,
          animations: "disabled",
        });
        report.matrix.push({
          width,
          language,
          theme,
          noOverflow: true,
          labels: true,
          controls44: true,
          submitReachable: true,
          focusedSubmitUnobscured: true,
        });
      }
  checked(
    "Native switcher works by keyboard and retains focus; 20 BG/EN light/dark desktop/tablet/mobile cases verify Create/Edit labels, date/timezone controls, 44px targets and no overflow",
  );

  report.step = "real expired Event mutation session";
  await organizer.page.setViewportSize({ width: 1440, height: 900 });
  await organizer.page.evaluate(() =>
    localStorage.setItem(
      "budograph.preferences.v1",
      JSON.stringify({ version: 1, language: "en", theme: "light" }),
    ),
  );
  const finalWorkspaceRead = organizer.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/events/${authored.id}/members` && response.status() === 200,
  );
  await organizer.page.goto(origin + href(authored.id, "edit"));
  await organizer.page.locator("#event-name").waitFor();
  await (await finalWorkspaceRead).finished();
  await organizer.page.waitForLoadState("networkidle");
  await organizer.page
    .locator("#event-name")
    .fill("Expired edit must not persist");
  await organizer.context.request.post(origin + "/api/auth/sign-out", {
    headers: { origin },
    data: {},
  });
  await save(organizer.page, 401);
  await organizer.page.locator("#login-email").waitFor();
  assert.equal(await organizer.page.locator(".app-shell").count(), 0);
  assert.equal(
    (await member.context.request.get(origin + "/api/me")).status(),
    200,
  );
  assert.equal(
    (
      await pool.query("SELECT name,version FROM public.event WHERE id=$1", [
        authored.id,
      ])
    ).rows[0].name,
    authored.name,
  );
  checked(
    "Actual expired Event-edit session returns401, removes shell, preserves canonical Event and leaves independent Member session authenticated",
  );
  assert.equal(report.applicationErrors, 0);
} catch (error) {
  report.failureKind = error instanceof Error ? error.name : "Unknown";
  report.failureAt =
    error instanceof Error
      ? error.stack?.match(/verify-event-authoring-ui\.mjs:\d+:\d+/)?.[0]
      : undefined;
  report.failure =
    "Event authoring browser verification did not complete. Step identifies unfinished coverage; credentials and raw errors omitted.";
  throw new Error(report.failure);
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
