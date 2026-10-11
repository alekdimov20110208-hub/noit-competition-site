// Real UI commands against the controlled development Event. Only explicit
// error/pending cases intercept transport. Credentials and sessions stay in memory.
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
  out = process.env.BUDOGRAPH_EVIDENCE_DIR ?? "tmp/p1d2b-evidence/browser";
mkdirSync(out, { recursive: true });
const report = { checks: [], matrix: [], writes: [], applicationErrors: 0 };
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
const contexts = [],
  confirmed = [];
const readDiagnostics = new WeakMap();
function observeReads(page) {
  const reads = [];
  readDiagnostics.set(page, reads);
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (
      response.request().method() !== "GET" ||
      !(path === "/api/me" || path.startsWith("/api/events"))
    )
      return;
    reads.push({
      path: path.replace(
        /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/gi,
        ":id",
      ),
      status: response.status(),
    });
    if (reads.length > 20) reads.shift();
  });
}
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
let lastLogin = 0,
  eventId,
  taskId,
  organizerId,
  memberId;
const labels = {
  "not-started": "Not started",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
};
async function make(label) {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
    locale: "en-GB",
  });
  contexts.push(context);
  const page = await context.newPage();
  observeReads(page);
  page.on("pageerror", () => report.applicationErrors++);
  await page.addInitScript(() =>
    localStorage.setItem(
      "budograph.preferences.v1",
      JSON.stringify({ version: 1, language: "en", theme: "light" }),
    ),
  );
  await page.goto(origin + "/tasks");
  await page.locator("#login-email").waitFor();
  const remaining = 11_000 - (Date.now() - lastLogin);
  if (remaining > 0)
    await new Promise((resolve) => setTimeout(resolve, remaining));
  const email = process.env[`BUDOGRAPH_${label}_EMAIL`],
    password = process.env[`BUDOGRAPH_${label}_PASSWORD`];
  assert.ok(email && password, "Controlled inputs required");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  lastLogin = Date.now();
  await page.locator("button[type=submit]").click();
  await page
    .locator(".page--tasks:not([aria-busy]) .task-row")
    .first()
    .waitFor();
  page.on("request", (request) => {
    if (
      /\/tasks\/[^/]+\/(assignment|acceptance|status)$/.test(
        new URL(request.url()).pathname,
      )
    ) {
      const body = request.postDataJSON();
      assert.ok(
        !Object.keys(body).some((key) =>
          /actor|acceptedBy|acceptedAt|role|eventId/i.test(key),
        ),
      );
      report.writes.push({
        kind: new URL(request.url()).pathname.split("/").at(-1),
        expectedVersion: body.expectedVersion,
        label,
      });
    }
  });
  return { page, context };
}
async function read(page) {
  return page.evaluate(async () => {
    const { events } = await fetch("/api/events", { cache: "no-store" }).then(
      (response) => response.json(),
    );
    const event = [...events].sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
    )[0];
    const body = await fetch(`/api/events/${event.id}/tasks`, {
      cache: "no-store",
    }).then((response) => response.json());
    return { event, ...body };
  });
}
async function open(page) {
  await page.goto(origin + `/events/${eventId}/tasks?task=${taskId}`);
  await page.getByRole("dialog").waitFor();
}
async function settled(page) {
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".task-action-feedback")
        ?.textContent.includes("Saving"),
  );
}
async function act(page, kind, trigger, actionType, actor, status = 200) {
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/events/${eventId}/tasks/${taskId}/${kind}` &&
      response.request().method() !== "GET",
  );
  await trigger();
  const response = await responsePromise;
  assert.equal(response.status(), status);
  const body = status === 200 ? await response.json() : null;
  await settled(page);
  if (status === 200 && actionType)
    confirmed.push({ actionType, version: body.task.version, actor });
  return body?.task;
}
async function assign(page, id, actionType) {
  const before = (await read(page)).tasks.find((task) => task.id === taskId);
  if (before.assignedMemberId === id) return before;
  return act(
    page,
    "assignment",
    () => page.locator(`#drawer-assignment-${taskId}`).selectOption(id ?? ""),
    actionType,
    organizerId,
  );
}
async function status(page, value, actor, expected = 200) {
  return act(
    page,
    "status",
    async () => {
      await page.locator(`#drawer-status-${taskId}-trigger`).click();
      await page
        .getByRole("option", { name: labels[value], exact: true })
        .click();
    },
    expected === 200 ? "task.status_changed" : null,
    actor,
    expected,
  );
}
async function accept(page, actor = memberId) {
  return act(
    page,
    "acceptance",
    () =>
      page
        .getByRole("button", { name: "Accept responsibility", exact: true })
        .click(),
    "task.accepted",
    actor,
  );
}
async function withdraw(page, actor = memberId) {
  return act(
    page,
    "acceptance",
    () =>
      page
        .getByRole("button", { name: "Withdraw acceptance", exact: true })
        .click(),
    "task.acceptance_withdrawn",
    actor,
  );
}
async function sqlTask() {
  const { rows } = await pool.query(
    "SELECT assigned_member_id, accepted_by_member_id, accepted_at, status, version FROM public.task WHERE event_id = $1 AND id = $2",
    [eventId, taskId],
  );
  return rows[0];
}
try {
  const organizer = await make("ORGANIZER"),
    member = await make("MEMBER");
  const initial = await read(organizer.page),
    memberInitial = await read(member.page);
  assert.equal(initial.event.membership.accessRole, "ORGANIZER");
  assert.equal(memberInitial.event.membership.accessRole, "MEMBER");
  assert.equal(initial.event.id, memberInitial.event.id);
  eventId = initial.event.id;
  organizerId = initial.event.membership.id;
  memberId = memberInitial.event.membership.id;
  const fixture = initial.tasks.filter(
    (task) => task.title === "Verify the two-user responsibility loop",
  );
  assert.equal(fixture.length, 1, "One controlled task fixture required");
  taskId = fixture[0].id;
  const historyStart = fixture[0].version;
  await open(organizer.page);
  await open(member.page);
  const organizerOwnTask = fixture[0].assignedMemberId === organizerId;
  assert.equal(
    await organizer.page
      .getByRole("button", { name: "Accept responsibility", exact: true })
      .count(),
    organizerOwnTask && !fixture[0].accepted ? 1 : 0,
  );
  assert.equal(
    await organizer.page
      .getByRole("button", { name: "Withdraw acceptance", exact: true })
      .count(),
    organizerOwnTask && fixture[0].accepted ? 1 : 0,
  );
  assert.equal(await member.page.locator(".task-assignment-select").count(), 0);
  const candidates = await organizer.page.evaluate(
    async (eventId) =>
      fetch(`/api/events/${eventId}/members`).then((response) =>
        response.json(),
      ),
    eventId,
  );
  assert.ok(candidates.members.some((member) => member.id === memberId));
  for (const candidate of candidates.members)
    assert.deepEqual(Object.keys(candidate).sort(), ["id", "name", "role"]);
  checked(
    "Separate real Organizer/Member sessions; backend-derived membership; minimal active Event assignment candidates; no Organizer acceptance impersonation",
  );

  await assign(organizer.page, null, "task.unassigned");
  await open(member.page);
  if (
    (await read(organizer.page)).tasks.find((task) => task.id === taskId)
      .status !== "not-started"
  )
    await status(organizer.page, "not-started", organizerId);
  assert.equal(
    await member.page.locator(".task-drawer__acceptance button").count(),
    0,
  );
  assert.equal(await member.page.locator(".task-status-select").count(), 0);
  const assigned = await assign(organizer.page, memberId, "task.assigned");
  await open(member.page);
  assert.equal((await sqlTask()).assigned_member_id, memberId);
  await member.page
    .getByRole("button", { name: "Accept responsibility", exact: true })
    .waitFor();
  assert.equal(assigned.accepted, false);
  checked(
    "Organizer assigns using real member ID; refreshed Member sees assignment and explicit Accept; unassigned Member has no acceptance/status control",
  );

  const accepted = await accept(member.page);
  assert.equal(accepted.acceptedByMemberId, memberId);
  assert.ok(accepted.acceptedAt);
  await member.page
    .getByRole("button", { name: "Withdraw acceptance", exact: true })
    .waitFor();
  await open(organizer.page);
  assert.match(
    await organizer.page.locator(".task-drawer__acceptance-state").innerText(),
    /Accepted/,
  );
  assert.equal((await sqlTask()).accepted_by_member_id, memberId);
  checked(
    "Member acceptance is server-confirmed and visible to Organizer after explicit refresh; real PostgreSQL acceptance metadata matches",
  );

  await withdraw(member.page);
  assert.equal((await sqlTask()).accepted_by_member_id, null);
  assert.equal((await sqlTask()).assigned_member_id, memberId);
  await accept(member.page);
  checked(
    "Explicit withdrawal clears acceptance while preserving assignment; responsibility can be accepted again",
  );

  for (const value of ["in-progress", "blocked", "completed", "not-started"]) {
    const changed = await status(member.page, value, memberId);
    assert.equal(changed.status, value);
    assert.equal(changed.accepted, true);
    await open(organizer.page);
    assert.equal(
      (await read(organizer.page)).tasks.find((task) => task.id === taskId)
        .status,
      value,
    );
  }
  checked(
    "Assigned Member changes all four approved statuses independently of acceptance; Organizer refresh sees canonical state",
  );

  await open(member.page);
  const stale = (await read(member.page)).tasks.find(
    (task) => task.id === taskId,
  );
  await status(organizer.page, "blocked", organizerId);
  await status(member.page, "completed", memberId, 409);
  assert.match(
    await member.page.getByRole("alert").innerText(),
    /changed elsewhere/,
  );
  assert.equal(
    await member.page
      .locator(`#drawer-status-${taskId}-trigger .budo-select__value`)
      .innerText(),
    "Blocked",
  );
  assert.equal(report.writes.at(-1).expectedVersion, stale.version);
  assert.equal((await sqlTask()).status, "blocked");
  await member.page
    .getByRole("dialog")
    .screenshot({ path: `${out}/real-conflict.png` });
  checked(
    "Real stale Member UI receives HTTP 409, refetches canonical blocked state, announces conflict and does not replay/overwrite",
  );

  await assign(organizer.page, organizerId, "task.reassigned");
  await open(member.page);
  assert.equal(
    await member.page.locator(".task-drawer__acceptance button").count(),
    0,
  );
  assert.equal((await sqlTask()).accepted_by_member_id, null);
  await organizer.page
    .getByRole("button", { name: "Accept responsibility", exact: true })
    .waitFor();
  const organizerAccepted = await accept(organizer.page, organizerId);
  assert.equal(organizerAccepted.acceptedByMemberId, organizerId);
  assert.ok(organizerAccepted.acceptedAt);
  const storedAcceptance = await sqlTask();
  assert.equal(storedAcceptance.accepted_by_member_id, organizerId);
  assert.equal(
    storedAcceptance.accepted_at.toISOString(),
    organizerAccepted.acceptedAt,
  );
  await organizer.page
    .getByRole("button", { name: "Withdraw acceptance", exact: true })
    .waitFor();
  await withdraw(organizer.page, organizerId);
  const withdrawn = await sqlTask();
  assert.equal(withdrawn.assigned_member_id, organizerId);
  assert.equal(withdrawn.accepted_by_member_id, null);
  assert.equal(withdrawn.accepted_at, null);
  await organizer.page
    .getByRole("button", { name: "Accept responsibility", exact: true })
    .waitFor();
  // Reaccept to prove that reassigning an Organizer's accepted work clears it too.
  await accept(organizer.page, organizerId);
  checked(
    "Self-assigned Organizer: real Accept and Withdraw UI commands persist canonical member/time metadata and clear acceptance without changing assignment",
  );
  await assign(organizer.page, memberId, "task.reassigned");
  assert.equal(
    await organizer.page.locator(".task-drawer__acceptance button").count(),
    0,
  );
  const beforeImpersonation = await sqlTask();
  const denied = await organizer.context.request.put(
    `${origin}/api/events/${eventId}/tasks/${taskId}/acceptance`,
    {
      headers: { origin },
      data: { accepted: true, expectedVersion: beforeImpersonation.version },
    },
  );
  assert.equal(denied.status(), 403);
  assert.deepEqual(await sqlTask(), beforeImpersonation);
  checked(
    "Organizer viewing another Member's task has no acceptance control; direct real-session acceptance attempt returns 403 without changing canonical state",
  );
  await open(member.page);
  await member.page
    .getByRole("button", { name: "Accept responsibility", exact: true })
    .waitFor();
  assert.equal((await sqlTask()).accepted_by_member_id, null);
  await accept(member.page);
  await open(organizer.page);
  await assign(organizer.page, null, "task.unassigned");
  await open(member.page);
  assert.equal((await sqlTask()).assigned_member_id, null);
  assert.equal((await sqlTask()).accepted_by_member_id, null);
  await assign(organizer.page, memberId, "task.assigned");
  await open(member.page);
  assert.equal((await sqlTask()).accepted_by_member_id, null);
  checked(
    "Reassignment and unassignment clear acceptance in both UIs; assigning back never restores previous acceptance; other Member cannot act",
  );

  let release, reached;
  const hold = new Promise((resolve) => {
      release = resolve;
    }),
    hit = new Promise((resolve) => {
      reached = resolve;
    });
  await member.page.route("**/tasks/*/acceptance", async (route) => {
    const response = await route.fetch();
    reached();
    await hold;
    await route.fulfill({ response });
  });
  const beforePending = report.writes.length;
  const responseWait = member.page.waitForResponse((response) =>
    response.url().endsWith("/acceptance"),
  );
  await member.page
    .getByRole("button", { name: "Accept responsibility", exact: true })
    .click();
  await hit;
  const button = member.page.getByRole("button", {
    name: "Accept responsibility",
    exact: true,
  });
  assert.equal(await button.isDisabled(), true);
  await button.evaluate((button) => button.click());
  assert.match(
    await member.page.locator(".task-drawer__acceptance-state").innerText(),
    /Not accepted/,
  );
  assert.equal(
    await member.page.locator(`#drawer-status-${taskId}-trigger`).isDisabled(),
    true,
  );
  assert.equal(report.writes.length - beforePending, 1);
  release();
  const pendingResponse = await responseWait;
  const pendingBody = await pendingResponse.json();
  await settled(member.page);
  confirmed.push({
    actionType: "task.accepted",
    version: pendingBody.task.version,
    actor: memberId,
  });
  await member.page.unroute("**/tasks/*/acceptance");
  checked(
    "Held real response: confirmed state stays unchanged before response; duplicate action and status controls disabled; exactly one acceptance request",
  );

  for (const [responseStatus, text] of [
    [400, /Check your selection/],
    [403, /not permitted/],
    [404, /no longer available/],
    [500, /could not be confirmed/],
  ]) {
    await member.page.route("**/tasks/*/status", (route) =>
      route.fulfill({
        status: responseStatus,
        contentType: "application/json",
        body: '{"message":"SYNTHETIC_INTERNAL_DO_NOT_EXPOSE"}',
      }),
    );
    await status(member.page, "in-progress", memberId, responseStatus);
    assert.match(await member.page.getByRole("alert").innerText(), text);
    assert.ok(
      !(await member.page.getByRole("dialog").innerText()).includes(
        "SYNTHETIC_INTERNAL_DO_NOT_EXPOSE",
      ),
    );
    assert.equal((await sqlTask()).status, "blocked");
    await member.page.unroute("**/tasks/*/status");
  }
  await member.page.route("**/tasks/*/status", (route) => route.abort());
  await member.page.locator(`#drawer-status-${taskId}-trigger`).click();
  await member.page
    .getByRole("option", { name: "In progress", exact: true })
    .click();
  await member.page.getByRole("alert").waitFor();
  await settled(member.page);
  assert.match(
    await member.page.getByRole("alert").innerText(),
    /could not be confirmed/,
  );
  await member.page.unroute("**/tasks/*/status");
  checked(
    "Explicit transport doubles: 400/403/404/500/network errors are accessible, sanitized, retain confirmed task data, refetch and never retry commands",
  );

  // One read-only synthetic row tests switching drawers in the one-task Event.
  // No command targets it and no task is created in PostgreSQL. The real target
  // keeps its actual version; its stale command below still gets a real 409.
  const recoverySnapshot = await read(member.page);
  const recoveryTask = recoverySnapshot.tasks.find(
    (task) => task.id === taskId,
  );
  await member.page.route(
    "**/api/events/*/tasks",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tasks: [
            ...recoverySnapshot.tasks,
            {
              ...recoveryTask,
              id: randomUUID(),
              title: "Recovery-only transport fixture",
            },
          ],
          members: recoverySnapshot.members,
        }),
      }),
    { times: 1 },
  );
  // Keep the current Member UI stale, then force the canonical GET to fail after
  // a real 409. Further writes must stay disabled until explicit refresh.
  await open(member.page);
  await open(organizer.page);
  await status(organizer.page, "in-progress", organizerId);
  await member.page.route("**/api/events/*/tasks", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await status(member.page, "completed", memberId, 409);
  assert.match(
    await member.page.getByRole("alert").innerText(),
    /displayed state may be out of date/,
  );
  assert.equal(
    await member.page.locator(`#drawer-status-${taskId}-trigger`).isDisabled(),
    true,
  );
  await member.page.keyboard.press("Escape");
  await member.page.getByRole("dialog").waitFor({ state: "hidden" });
  for (const href of ["/", "/team"]) {
    const scopedHref = `/events/${eventId}/${href === "/" ? "dashboard" : href.slice(1)}`;
    await member.page.locator(`.sidebar__nav a[href="${scopedHref}"]`).click();
    await member.page.getByRole("alert").waitFor();
    assert.match(
      await member.page.getByRole("alert").innerText(),
      /latest workspace data could not be confirmed/,
    );
    await member.page.getByRole("button", { name: "Try again" }).waitFor();
  }
  await member.page
    .locator(`.sidebar__nav a[href="/events/${eventId}/tasks"]`)
    .click();
  await member.page.getByRole("button", { name: "Refresh task" }).waitFor();
  const otherTask = member.page.locator(
    `.task-row__link:not([href$="${taskId}"])`,
  );
  assert.ok(
    await otherTask.count(),
    "Read-only second-task transport fixture for recovery check",
  );
  await otherTask.first().click();
  await member.page.getByRole("dialog").waitFor();
  assert.equal(
    await member.page
      .locator('button[id^="drawer-status-"][id$="-trigger"]')
      .isDisabled(),
    true,
  );
  assert.match(
    await member.page.getByRole("alert").innerText(),
    /displayed state may be out of date/,
  );
  await member.page.getByRole("button", { name: "Refresh task" }).waitFor();
  await member.page.keyboard.press("Escape");
  await member.page.getByRole("dialog").waitFor({ state: "hidden" });
  await member.page.unroute("**/api/events/*/tasks");
  await member.page.getByRole("button", { name: "Refresh task" }).click();
  await member.page
    .locator(".page--tasks:not([aria-busy]) .task-row")
    .first()
    .waitFor();
  await member.page.locator(`.task-row__link[href$="${taskId}"]`).click();
  await member.page.getByRole("dialog").waitFor();
  await member.page.waitForFunction(
    (id) =>
      document.querySelector(`#drawer-status-${id}-trigger .budo-select__value`)
        ?.textContent === "In progress",
    taskId,
  );
  checked(
    "Real 409 plus injected failed refetch blocks writes; closing/switching drawers (read-only synthetic second row) retains recovery feedback and explicit Refresh restores canonical state",
  );

  // Keyboard action uses the existing listbox and native member select.
  await organizer.page.locator(`#drawer-assignment-${taskId}`).focus();
  assert.equal(
    await organizer.page
      .locator(`#drawer-assignment-${taskId}`)
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await member.page.locator(`#drawer-status-${taskId}-trigger`).focus();
  await member.page.keyboard.press("Enter");
  await member.page.waitForFunction(
    (id) =>
      document.activeElement?.closest(`#drawer-status-${id}-listbox`) !== null,
    taskId,
  );
  await member.page.keyboard.press("End");
  await member.page.waitForFunction(
    (id) =>
      document.activeElement ===
      document.querySelector(
        `#drawer-status-${id}-listbox [role="option"]:last-child`,
      ),
    taskId,
  );
  const keyboardResponse = member.page.waitForResponse(
    (response) =>
      response.url().endsWith("/status") &&
      response.request().method() === "PATCH",
  );
  await member.page.keyboard.press("Enter");
  const keyboardBody = await (await keyboardResponse).json();
  await settled(member.page);
  confirmed.push({
    actionType: "task.status_changed",
    version: keyboardBody.task.version,
    actor: memberId,
  });
  assert.equal(keyboardBody.task.status, "completed");
  checked(
    "Keyboard: labeled assignment select and existing status listbox operate with visible focus, Enter and End",
  );

  for (const [role, session] of [
    ["organizer", organizer],
    ["member", member],
  ])
    for (const width of [1440, 1024, 768, 390, 320])
      for (const language of ["en", "bg"])
        for (const theme of ["light", "dark"]) {
          const page = await session.context.newPage();
          observeReads(page);
          console.log(`Drawer matrix: ${role} ${width} ${language}/${theme}`);
          await page.setViewportSize({ width, height: 900 });
          await page.addInitScript(
            ({ language, theme }) =>
              localStorage.setItem(
                "budograph.preferences.v1",
                JSON.stringify({ version: 1, language, theme }),
              ),
            { language, theme },
          );
          await page.goto(origin + `/events/${eventId}/tasks?task=${taskId}`);
          await page.getByRole("dialog").waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          if (role === "organizer")
            assert.ok(
              await page
                .locator(".task-assignment-select select")
                .evaluate(
                  (element) => element.getBoundingClientRect().height >= 44,
                ),
            );
          else
            assert.ok(
              await page
                .locator(".task-drawer__acceptance button")
                .evaluate(
                  (element) => element.getBoundingClientRect().height >= 44,
                ),
            );
          assert.ok(
            await page
              .locator(".task-status-select button")
              .evaluate(
                (element) => element.getBoundingClientRect().height >= 44,
              ),
          );
          await page.getByRole("dialog").screenshot({
            path: `${out}/${role}-${width}-${language}-${theme}.png`,
          });
          report.matrix.push({
            role,
            width,
            language,
            theme,
            overflow: false,
            targets44px: true,
          });
          await page.close();
        }
  checked(
    "40 Organizer/Member mutation drawer cases: BG/EN × light/dark × desktop/tablet/390/320; no overflow, 44px assignment/acceptance/status targets",
  );

  // Deterministic development end state, using UI commands rather than SQL edits.
  await open(member.page);
  await withdraw(member.page);
  await open(organizer.page);
  await status(organizer.page, "not-started", organizerId);
  const final = await sqlTask();
  assert.equal(final.assigned_member_id, memberId);
  assert.equal(final.accepted_by_member_id, null);
  assert.equal(final.accepted_at, null);
  assert.equal(final.status, "not-started");
  const { rows: history } = await pool.query(
    "SELECT action_type, actor_member_id, payload, created_at FROM public.activity_entry WHERE event_id = $1 AND target_id = $2 AND target_type = 'task' AND (payload->>'taskVersion')::integer > $3 ORDER BY created_at",
    [eventId, taskId, historyStart],
  );
  for (const entry of confirmed) {
    const row = history.find(
      (row) => row.payload.taskVersion === entry.version,
    );
    assert.ok(row, "Every confirmed UI change has activity history");
    assert.equal(row.action_type, entry.actionType);
    assert.equal(row.actor_member_id, entry.actor);
    assert.ok(row.created_at instanceof Date);
  }
  for (const action of [
    "task.assigned",
    "task.reassigned",
    "task.unassigned",
    "task.accepted",
    "task.acceptance_withdrawn",
    "task.status_changed",
  ])
    assert.ok(history.some((row) => row.action_type === action));
  assert.ok(
    history.some(
      (row) =>
        row.action_type === "task.reassigned" &&
        row.payload.acceptanceCleared === true,
    ),
  );
  report.activity = {
    verifiedUiChanges: confirmed.length,
    entries: history.length,
    actions: [...new Set(history.map((row) => row.action_type))],
  };
  report.finalTask = {
    assignedToControlledMember: true,
    accepted: false,
    status: final.status,
    version: final.version,
  };
  checked(
    "Read-only PostgreSQL checks: all six UI-triggered ActivityEntry types and scoped actors/versions; reassignment records acceptance clearing; deterministic fixture retained",
  );

  await open(member.page);
  await member.page.evaluate(() =>
    fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  const expired = member.page.waitForResponse(
    (response) =>
      response.url().endsWith("/status") &&
      response.request().method() === "PATCH",
  );
  await member.page.locator(`#drawer-status-${taskId}-trigger`).click();
  await member.page
    .getByRole("option", { name: "Blocked", exact: true })
    .click();
  assert.equal((await expired).status(), 401);
  await member.page.locator("#login-email").waitFor();
  assert.equal(await member.page.locator(".app-main").count(), 0);
  assert.equal(
    await organizer.page.evaluate(async () => (await fetch("/api/me")).status),
    200,
  );
  for (const session of [organizer, member]) {
    const values = await session.page.evaluate(() =>
      [...Object.values(localStorage), ...Object.values(sessionStorage)].join(
        "\n",
      ),
    );
    for (const label of ["ORGANIZER", "MEMBER"])
      assert.ok(!values.includes(process.env[`BUDOGRAPH_${label}_PASSWORD`]));
    assert.ok(
      !/better-auth\.session|session_token|access_token|refresh_token/.test(
        values,
      ),
    );
  }
  checked(
    "Actual mutation 401 expires only Member auth, clears task UI, preserves Organizer session; browser storage contains no credentials/session tokens",
  );
  assert.equal(report.applicationErrors, 0);
} catch (error) {
  let diagnostic = String(error?.message ?? "");
  for (const [key, value] of Object.entries(process.env))
    if (
      /SECRET|PASSWORD|TOKEN|EMAIL|DATABASE_URL/i.test(key) &&
      value?.length >= 4
    )
      diagnostic = diagnostic.replaceAll(value, "[REDACTED]");
  console.log(
    "Verification diagnostic:",
    diagnostic.replace(/http[^\s]+/g, "[URL]").slice(0, 700),
  );
  console.log(
    "Verification failure type/location:",
    error?.name,
    error?.stack?.match(/verify-task-actions-ui\.mjs:\d+:\d+/)?.[0] ??
      "unknown",
  );
  for (const context of contexts)
    for (const page of context.pages()) {
      console.log("Safe read diagnostics:", {
        loginVisible: await page.locator("#login-email").isVisible(),
        checkingVisible: await page.locator(".auth-check").isVisible(),
        reads: readDiagnostics.get(page),
      });
      if (await page.locator(".app-main").count()) {
        await page
          .locator(".app-main")
          .screenshot({
            path: `${out}/failure-${contexts.indexOf(context)}.png`,
          })
          .catch(() => {});
        console.log(
          "App state:",
          await page.locator(".page--tasks .notice").allTextContents(),
          "dialogs:",
          await page.getByRole("dialog").count(),
        );
      }
    }
  report.failure =
    "Task action verification did not complete. Inspect the last passed check; no credentials recorded.";
  throw new Error(report.failure);
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  for (const context of contexts) {
    await context.request
      .post(origin + "/api/auth/sign-out", { headers: { origin }, data: {} })
      .catch(() => {});
    await context.close();
  }
  await browser.close();
  await pool.end();
}
