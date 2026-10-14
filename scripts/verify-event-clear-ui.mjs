// Real Better Auth/PostgreSQL, production service factories and owned isolated
// Vite/backend. Network-loss and malformed-acknowledgement cases are labelled.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { readServerEnv } from "../server/src/config/env.ts";
import { createDatabasePool } from "../server/src/db/pool.ts";
import { createAuth } from "../server/src/auth/auth.ts";
import { createApp } from "../server/src/app.ts";
import { createEventService } from "../server/src/events/service.ts";
import { createTaskService } from "../server/src/tasks/service.ts";
import { createChangeService } from "../server/src/changes/service.ts";
import { createNotificationService } from "../server/src/notifications/service.ts";
import { createInvitationService } from "../server/src/invitations/service.ts";
import { eventHref } from "../src/routes.ts";
const direct = process.env.BUDOGRAPH_CLEAR_DIRECT === "1",
  origin = direct ? "http://127.0.0.1:5173" : "http://127.0.0.1:5174",
  out =
    process.env.BUDOGRAPH_EVIDENCE_DIR ?? "tmp/event-management-stage7/browser";
mkdirSync(out, { recursive: true });
const config = readServerEnv();
assert.equal(config.nodeEnv, "development");
const pool = createDatabasePool(config, () => {});
const app = direct
  ? null
  : createApp({
      events: createEventService(pool),
      tasks: createTaskService(pool),
      changes: createChangeService(pool),
      notifications: createNotificationService(pool),
      invitations: createInvitationService(pool),
      authentication: {
        auth: createAuth(pool, { ...config, publicAppUrl: origin }),
        baseURL: config.betterAuthUrl,
        taskMutationOrigins: [origin, new URL(config.betterAuthUrl).origin],
      },
      checkDatabase: async () => {
        await pool.query("SELECT 1");
      },
    });
let vite, browser;
const contexts = [],
  report = {
    isolated: !direct,
    checks: [],
    matrix: [],
    stress: [],
    intentionalEvents: [],
    errors: 0,
  },
  check = (label) => {
    report.checks.push(label);
    console.log("PASS: " + label);
  };
const sessions = async () =>
    (await pool.query('SELECT id FROM public."session" ORDER BY id')).rows.map(
      (r) => r.id,
    ),
  beforeSessions = await sessions();
const request = (context, path, data, key) =>
  context.request.post(origin + path, {
    headers: { origin, ...(key ? { "Idempotency-Key": key } : {}) },
    data,
  });
async function make(role) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-GB",
    timezoneId: "Europe/Sofia",
    reducedMotion: "reduce",
  });
  contexts.push(context);
  await context.addInitScript(() => {
    if (
      location.href !== "about:blank" &&
      !localStorage.getItem("budograph.preferences.v1")
    )
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language: "en", theme: "light" }),
      );
  });
  const page = await context.newPage();
  page.on("pageerror", () => report.errors++);
  await page.goto(origin + "/events");
  await page
    .locator("#login-email")
    .fill(process.env[`BUDOGRAPH_${role}_EMAIL`]);
  await page
    .locator("#login-password")
    .fill(process.env[`BUDOGRAPH_${role}_PASSWORD`]);
  await page.locator("button[type=submit]").click();
  await page.locator(".event-management__row").first().waitFor();
  const me = await (await context.request.get(origin + "/api/me")).json();
  return { context, page, user: me.user };
}
async function create(context, name) {
  const response = await request(context, "/api/events", {
    name,
    startDate: "2026-11-01",
    endDate: "2026-11-02",
    timezone: "UTC",
  });
  assert.equal(response.status(), 201);
  const event = (await response.json()).event;
  report.intentionalEvents.push(event.id);
  return event;
}
const row = (page, event) =>
  page.locator(".event-management__row").filter({
    has: page.getByRole("heading", { name: event.name, exact: true }),
  });
async function open(page, event) {
  await page.goto(origin + "/events");
  const target = row(page, event);
  await target.locator("summary").click();
  await target.locator(".event-clear-trigger").click();
  await page.locator("#clear-confirmation").waitFor();
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".event-clear-dialog")
        .getAttribute("aria-busy") ||
      document
        .querySelector(".event-clear-dialog")
        .getAttribute("aria-busy") === "false",
  );
  return page.locator(".event-clear-dialog");
}
async function historyCount(eventId) {
  return (
    await pool.query(
      "SELECT count(*)::INT AS n FROM public.activity_entry WHERE event_id=$1 AND action_type='EVENT_TASKS_CLEARED'",
      [eventId],
    )
  ).rows[0].n;
}
async function prefs(page, language, theme) {
  await page.evaluate(
    ({ language, theme }) =>
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language, theme }),
      ),
    { language, theme },
  );
  await page.reload();
}
try {
  if (app) {
    const backend = await app.listen({ host: "127.0.0.1", port: 0 });
    report.ownedRuntime = {
      pid: process.pid,
      vitePort: 5174,
      backendPort: Number(new URL(backend).port),
    };
    vite = await createServer({
      configFile: false,
      cacheDir: "tmp/event-management-stage7/vite-cache",
      plugins: [react()],
      logLevel: "silent",
      server: {
        host: "127.0.0.1",
        port: 5174,
        strictPort: true,
        proxy: { "/api": { target: backend, changeOrigin: true } },
      },
    });
    await vite.listen();
  }
  assert.equal((await fetch(origin)).status, 200);
  const { chromium } = await import(
    process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
      ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
      : "playwright"
  );
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
      ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
      : {}),
  });
  report.browser = browser.version();
  const organizer = await make("ORGANIZER"),
    member = await make("MEMBER");
  const source = await create(
      organizer.context,
      `Stage 7 Clear ${randomUUID()} — ` + "Дълго име / Long name ".repeat(4),
    ),
    memberId = randomUUID();
  await pool.query(
    "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role) VALUES($1,$2,$3,'MEMBER','Organizer responsibility')",
    [memberId, source.id, member.user.id],
  );
  const taskCreate = async (event, title) => {
    const r = await request(
      organizer.context,
      `/api/events/${event.id}/tasks`,
      {
        title,
        deadline: "2026-11-02",
        deadlineTime: "10:00",
        reminderOffsets: [60],
        priority: "normal",
        assignedMemberId: event.id === source.id ? memberId : null,
      },
    );
    assert.equal(r.status(), 201);
    return (await r.json()).task;
  };
  const task = await taskCreate(source, "Stage 7 retained Task"),
    completed = await taskCreate(source, "Stage 7 completed Task");
  assert.equal(
    (
      await organizer.context.request.patch(
        origin + `/api/events/${source.id}/tasks/${completed.id}/status`,
        {
          headers: { origin },
          data: { expectedVersion: 1, status: "completed" },
        },
      )
    ).status(),
    200,
  );
  const c = await request(
    organizer.context,
    `/api/events/${source.id}/changes`,
    {
      title: "Stage 7 retained Change",
      affectedTaskIds: [task.id],
      decision: "Decision",
      response: "Response",
      planB: "Plan B",
      responseOwnerMemberId: memberId,
    },
  );
  assert.equal(c.status(), 201);
  const change = (await c.json()).change;
  const preview = async (context, event) => {
    const r = await context.request.get(
      origin + `/api/events/${event.id}/tasks/clear-preview`,
    );
    assert.equal(r.status(), 200);
    return r.json();
  };
  const body = (p) => ({
    expectedVersion: p.event.version,
    confirmationName: p.event.name,
    scopeRevision: p.scopeRevision,
  });
  const clearPath = (e) => `/api/events/${e.id}/tasks/clear`;
  const count = async (event) =>
    (
      await pool.query(
        "SELECT count(*)::INT n FROM public.task WHERE event_id=$1 AND deleted_at IS NULL",
        [event.id],
      )
    ).rows[0].n;
  await member.page.goto(origin + "/events");
  assert.equal(
    await row(member.page, source).locator(".event-management__danger").count(),
    0,
  );
  assert.equal(
    (
      await member.context.request.get(
        origin + `/api/events/${source.id}/tasks/clear-preview`,
      )
    ).status(),
    403,
  );
  assert.equal(
    (
      await request(
        member.context,
        clearPath(source),
        body(await preview(organizer.context, source)),
        randomUUID(),
      )
    ).status(),
    403,
  );
  let dialog = await open(organizer.page, source);
  assert.equal(await dialog.locator("button[type=submit]").isDisabled(), true);
  assert.match(await dialog.textContent(), /Reviewed Tasks: 2/);
  for (const name of [source.name.toLowerCase(), source.name + " "]) {
    await organizer.page.locator("#clear-confirmation").fill(name);
    assert.equal(
      await dialog.locator("button[type=submit]").isDisabled(),
      true,
    );
  }
  assert.equal(
    (
      await request(
        organizer.context,
        clearPath(source),
        {
          ...body(await preview(organizer.context, source)),
          confirmationName: source.name + " ",
        },
        randomUUID(),
      )
    ).status(),
    400,
  );
  check(
    "Owner preview counts, Member absence/direct denial and exact case/space confirmation",
  );
  await organizer.page.keyboard.press("Escape");
  assert.equal(await organizer.page.locator("dialog[open]").count(), 0);
  assert.ok(
    await organizer.page.evaluate(() =>
      document.activeElement?.classList.contains("event-clear-trigger"),
    ),
  );
  dialog = await open(organizer.page, source);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await count(source), 2);
  assert.equal(await historyCount(source.id), 0);
  check("Cancel/Escape send no command and return focus");
  const stale = await create(
    organizer.context,
    `Stage 7 stale ${randomUUID()}`,
  );
  await taskCreate(stale, "Reviewed");
  dialog = await open(organizer.page, stale);
  await organizer.page.locator("#clear-confirmation").fill(stale.name);
  await taskCreate(stale, "Concurrent new Task");
  await dialog.locator("button[type=submit]").click();
  await dialog.getByRole("alert").waitFor();
  assert.match(await dialog.textContent(), /scope changed/);
  assert.equal(await count(stale), 2);
  await dialog
    .getByRole("button", { name: "Reload the Task review", exact: true })
    .click();
  await organizer.page.waitForFunction(
    () =>
      document.querySelector("dialog[open]")?.getAttribute("aria-busy") ===
      "false",
  );
  assert.equal(
    await organizer.page.locator("#clear-confirmation").inputValue(),
    "",
  );
  assert.equal(await dialog.locator("button[type=submit]").isDisabled(), true);
  await organizer.page.keyboard.press("Escape");
  check(
    "Concurrent Task addition returns 409; explicit renewed review and retyping required",
  );
  const readFail = await create(
    organizer.context,
    `Stage 7 read failure ${randomUUID()}`,
  );
  await organizer.page.route(
    `**/api/events/${readFail.id}/tasks/clear-preview`,
    (route) => route.fulfill({ status: 503, body: "{}" }),
  );
  dialog = await open(organizer.page, readFail);
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.locator("button[type=submit]").isDisabled(), true);
  await organizer.page.unroute(
    `**/api/events/${readFail.id}/tasks/clear-preview`,
  );
  await dialog
    .getByRole("button", { name: "Reload the Task review", exact: true })
    .click();
  await organizer.page.waitForFunction(
    () =>
      document.querySelector("dialog[open]")?.getAttribute("aria-busy") ===
      "false",
  );
  await organizer.page.keyboard.press("Escape");
  check(
    "Count-read failure blocks Clear and permits explicit preview recovery",
  );
  const actorId = source.membership.id;
  await pool.query(
    "INSERT INTO public.task(id,event_id,title,deadline,created_by,updated_by) SELECT gen_random_uuid(),$1,'Stage 7 controlled load '||g,'2026-11-02',$2,$2 FROM generate_series(1,500) g",
    [source.id, actorId],
  );
  const p = await preview(organizer.context, source);
  assert.equal(p.taskCount, 502);
  if (process.env.BUDOGRAPH_CLEAR_SKIP_MATRIX !== "1")
    for (const width of [320, 360, 390, 768, 960, 1024, 1440])
      for (const language of ["en", "bg"])
        for (const theme of ["light", "dark"]) {
          await organizer.page.setViewportSize({ width, height: 900 });
          await prefs(organizer.page, language, theme);
          const target = row(organizer.page, source);
          await target.locator("summary").click();
          await organizer.page.evaluate(() => {
            window.__stage7Clicks = [];
            document.addEventListener(
              "click",
              (e) => window.__stage7Clicks.push(e.target.className),
              true,
            );
            document.addEventListener(
              "cancel",
              (e) => window.__stage7Clicks.push("cancel:" + e.target.className),
              true,
            );
          });
          await target.locator(".event-clear-trigger").click();
          await organizer.page.locator("#clear-confirmation").waitFor();
          await organizer.page.waitForFunction(
            () =>
              document
                .querySelector("dialog[open]")
                ?.getAttribute("aria-busy") === "false",
          );
          await organizer.page.locator("#clear-confirmation").fill(source.name);
          const modal = organizer.page.locator("dialog[open]");
          assert.equal(
            await modal.locator("button[type=submit]").isDisabled(),
            false,
          );
          assert.equal(
            await organizer.page.evaluate(
              () =>
                document.documentElement.scrollWidth > innerWidth ||
                document.querySelector("dialog[open]").scrollWidth >
                  document.querySelector("dialog[open]").clientWidth,
            ),
            false,
          );
          for (const button of await modal.locator("button").all()) {
            const box = await button.boundingBox();
            assert.ok(box.height >= 44 && box.width >= 44);
          }
          await modal.locator("button[type=submit]").focus();
          await organizer.page.keyboard.press("Tab");
          assert.ok(
            await organizer.page.evaluate(() =>
              document
                .querySelector("dialog[open]")
                .contains(document.activeElement),
            ),
          );
          await organizer.page.keyboard.press("Shift+Tab");
          assert.ok(
            await organizer.page.evaluate(() =>
              document
                .querySelector("dialog[open]")
                .contains(document.activeElement),
            ),
          );
          await organizer.page.screenshot({
            path: `${out}/clear-${width}-${language}-${theme}.png`,
          });
          await organizer.page.keyboard.press("Escape");
          report.matrix.push({ width, language, theme });
        }
  for (const colorScheme of ["light", "dark"])
    for (const language of ["en", "bg"]) {
      await organizer.page.emulateMedia({ colorScheme });
      await prefs(organizer.page, language, "system");
      await organizer.page.waitForFunction(
        (expected) => document.documentElement.dataset.theme === expected,
        colorScheme,
      );
      const target = row(organizer.page, source);
      await target.locator("summary").click();
      await target.locator(".event-clear-trigger").click();
      await organizer.page.locator("#clear-confirmation").waitFor();
      await organizer.page.screenshot({
        path: `${out}/system-${language}-${colorScheme}.png`,
      });
      await organizer.page.keyboard.press("Escape");
      report.stress.push({ system: colorScheme, language });
    }
  await prefs(organizer.page, "bg", "dark");
  await organizer.page.setViewportSize({ width: 320, height: 600 });
  await organizer.page.evaluate(
    () => (document.documentElement.style.fontSize = "125%"),
  );
  const stressTarget = row(organizer.page, source);
  await stressTarget.locator("summary").click();
  await stressTarget.locator(".event-clear-trigger").click();
  await organizer.page.locator("#clear-confirmation").waitFor();
  assert.equal(
    await organizer.page.evaluate(
      () =>
        document.documentElement.scrollWidth > innerWidth ||
        document.querySelector("dialog[open]").scrollWidth >
          document.querySelector("dialog[open]").clientWidth,
    ),
    false,
  );
  await organizer.page.screenshot({ path: `${out}/320-bg-dark-125.png` });
  await organizer.page.keyboard.press("Escape");
  report.stress.push({ width: 320, textScale: 125 });
  report.fullMatrixSkipped = process.env.BUDOGRAPH_CLEAR_SKIP_MATRIX === "1";
  check(
    report.fullMatrixSkipped
      ? "Full matrix explicitly skipped; System/320px stress and keyboard checks executed"
      : "28 BG/EN Light/Dark layouts; System media, 320px/125% stress, long names, 502 count, keyboard/focus and overflow",
  );
  await prefs(organizer.page, "en", "light");
  await organizer.page.setViewportSize({ width: 1440, height: 900 });
  const records = async () => {
    const r = {};
    for (const table of [
      "event_member",
      "event_change",
      "change_task",
      "task_reminder",
      "notification",
    ]) {
      const where =
        table === "task_reminder"
          ? "t.task_id IN(SELECT id FROM public.task WHERE event_id=$1)"
          : "t.event_id=$1";
      r[table] = (
        await pool.query(
          `SELECT md5(to_jsonb(t)::TEXT) hash FROM public.${table} t WHERE ${where} ORDER BY 1`,
          [source.id],
        )
      ).rows;
    }
    return r;
  };
  const retained = await records();
  dialog = await open(organizer.page, source);
  await organizer.page.locator("#clear-confirmation").fill(source.name);
  const keys = [];
  let release;
  const gate = new Promise((r) => (release = r));
  await organizer.page.route(`**${clearPath(source)}`, async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    await gate;
    await route.continue();
  });
  await dialog.locator("button[type=submit]").click();
  await dialog.locator("button[type=submit]:disabled").waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Cancel", exact: true })
      .isDisabled(),
    true,
  );
  await organizer.page.keyboard.press("Enter");
  await organizer.page.keyboard.press("Escape");
  assert.equal(await organizer.page.locator("dialog[open]").count(), 1);
  release();
  await organizer.page.locator("dialog[open]").waitFor({ state: "hidden" });
  await organizer.page.unroute(`**${clearPath(source)}`);
  assert.equal(keys.length, 1);
  assert.equal(await count(source), 0);
  assert.equal(await historyCount(source.id), 1);
  assert.deepEqual(await records(), retained);
  check(
    "One guarded intentional submit atomically clears 502 Tasks; all Team/Change/link/reminder/notification hashes retained",
  );
  await organizer.page.goto(origin + eventHref(source.id, "/tasks"));
  await organizer.page
    .getByRole("heading", { name: "Tasks", exact: true })
    .waitFor();
  assert.equal(await organizer.page.locator(".task-row").count(), 0);
  await organizer.page.goto(origin + eventHref(source.id));
  await organizer.page
    .getByRole("heading", { name: "Dashboard", exact: true })
    .waitFor();
  await organizer.page.waitForFunction(() => {
    const values = [
      ...document.querySelectorAll(".event-overview__metrics dd"),
    ];
    return (
      values.length === 5 && values.every((v) => v.textContent.trim() === "0")
    );
  });
  await organizer.page.goto(origin + eventHref(source.id, "/team"));
  await organizer.page
    .getByRole("heading", { name: "Team", exact: true })
    .waitFor();
  await organizer.page.waitForFunction(() => {
    const values = [...document.querySelectorAll(".team-facts dd")];
    return (
      values.length >= 2 && values.every((v) => v.textContent.trim() === "0")
    );
  });
  const read = (
    await (
      await organizer.context.request.get(
        origin + `/api/events/${source.id}/changes/${change.id}`,
      )
    ).json()
  ).change;
  assert.equal(read.impact.taskCount, 0);
  assert.equal(read.planB, "Plan B");
  assert.equal(read.removedTasks.length, 1);
  await organizer.page.goto(
    origin + eventHref(source.id, "/changes") + `/${change.id}`,
  );
  await organizer.page
    .getByText("Stage 7 retained Change", { exact: true })
    .waitFor();
  await organizer.page
    .getByText("removed Task references retained", { exact: false })
    .waitFor();
  await organizer.page.goto(
    origin + eventHref(source.id, "/tasks") + `?task=${task.id}`,
  );
  await organizer.page
    .getByText("This Task was removed from active views.", { exact: false })
    .waitFor();
  assert.equal(await organizer.page.locator(".task-drawer").count(), 0);
  check(
    "Canonical empty Tasks, Dashboard/Team refresh, retained Plan B/Change references and read-only Task deep link",
  );
  await organizer.page.reload();
  await organizer.page
    .getByText("This Task was removed from active views.", { exact: false })
    .waitFor();
  await organizer.page.goBack();
  await organizer.page.goForward();
  await organizer.page
    .getByText("This Task was removed from active views.", { exact: false })
    .waitFor();
  await member.page.goto(
    origin + eventHref(source.id, "/tasks") + `?task=${task.id}`,
  );
  await member.page
    .getByText("This Task was removed from active views.", { exact: false })
    .waitFor();
  const notifications = await (
    await member.context.request.get(
      origin + `/api/events/${source.id}/notifications`,
    )
  ).json();
  assert.ok(notifications.notifications.length >= 1);
  const mark = await member.context.request.post(
    origin +
      `/api/events/${source.id}/notifications/${notifications.notifications[0].id}/read`,
    { headers: { origin }, data: {} },
  );
  assert.equal(mark.status(), 200);
  check(
    "Refresh/Back/Forward and Member retained Task access; delivered notification read state preserved",
  );
  const empty = await create(
    organizer.context,
    `Stage 7 empty ${randomUUID()}`,
  );
  dialog = await open(organizer.page, empty);
  assert.match(await dialog.textContent(), /no active Tasks/);
  await organizer.page.locator("#clear-confirmation").fill(empty.name);
  await dialog.locator("button[type=submit]").click();
  await organizer.page.locator("dialog[open]").waitFor({ state: "hidden" });
  assert.equal(await historyCount(empty.id), 0);
  assert.equal((await preview(organizer.context, empty)).event.version, 1);
  check(
    "Confirmed zero-result uses durable no-op without Event/history change",
  );
  const recovery = await create(
    organizer.context,
    `Stage 7 response recovery ${randomUUID()}`,
  );
  await taskCreate(recovery, "Reviewed recovery Task");
  let dropped = false;
  const recoveryKeys = [];
  await organizer.page.route(`**${clearPath(recovery)}`, async (route) => {
    recoveryKeys.push(route.request().headers()["idempotency-key"]);
    if (!dropped) {
      dropped = true;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort("failed");
    } else await route.continue();
  });
  dialog = await open(organizer.page, recovery);
  await organizer.page.locator("#clear-confirmation").fill(recovery.name);
  await dialog.locator("button[type=submit]").click();
  await dialog.getByRole("alert").waitFor();
  await taskCreate(recovery, "New Task after accepted Clear");
  await organizer.page.reload();
  await organizer.page
    .getByRole("button", { name: "Recover clear result", exact: true })
    .click();
  await organizer.page
    .locator("dialog[open]")
    .getByRole("button", { name: "Recover clear result", exact: true })
    .click();
  await organizer.page.locator("dialog[open]").waitFor({ state: "hidden" });
  assert.equal(recoveryKeys.length, 2);
  assert.equal(recoveryKeys[0], recoveryKeys[1]);
  assert.equal(await count(recovery), 1);
  assert.equal(await historyCount(recovery.id), 1);
  await organizer.page.unroute(`**${clearPath(recovery)}`);
  check(
    "Lost real committed response: refresh recovers original UUID without clearing later Task",
  );
  const archived = await create(
    organizer.context,
    `Stage 7 archive denied ${randomUUID()}`,
  );
  const archivePreview = await preview(organizer.context, archived);
  assert.equal(
    (
      await request(
        organizer.context,
        `/api/events/${archived.id}/archive`,
        { expectedVersion: 1, confirmationName: archived.name },
        randomUUID(),
      )
    ).status(),
    200,
  );
  assert.equal(
    (
      await request(
        organizer.context,
        clearPath(archived),
        body(archivePreview),
        randomUUID(),
      )
    ).status(),
    403,
  );
  check("Archived Event excluded server-side");
  const nonowner = await create(
    organizer.context,
    `Stage 7 non-owner ${randomUUID()}`,
  );
  await taskCreate(nonowner, "Nonowner Task");
  await pool.query(
    "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role) VALUES($1,$2,$3,'ORGANIZER','')",
    [randomUUID(), nonowner.id, member.user.id],
  );
  const nonownerBody = body(await preview(member.context, nonowner));
  dialog = await open(member.page, nonowner);
  await member.page.locator("#clear-confirmation").fill(nonowner.name);
  await member.page.keyboard.press("Enter");
  await member.page.locator("dialog[open]").waitFor({ state: "hidden" });
  assert.equal(await count(nonowner), 0);
  check("Active non-owner Organizer permitted without ownership change");
  const receipt = (
    await pool.query(
      "SELECT command_id FROM public.event_command_receipt WHERE source_event_id=$1 AND actor_user_id=$2 AND command_type='EVENT_TASKS_CLEAR'",
      [nonowner.id, member.user.id],
    )
  ).rows[0];
  await pool.query(
    "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE event_id=$1 AND user_id=$2",
    [nonowner.id, member.user.id],
  );
  assert.equal(
    (
      await request(
        member.context,
        clearPath(nonowner),
        nonownerBody,
        receipt.command_id,
      )
    ).status(),
    404,
  );
  check("Revoked membership cannot disclose accepted replay");
  const expired = await create(
    organizer.context,
    `Stage 7 expired ${randomUUID()}`,
  );
  await pool.query(
    "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role) VALUES($1,$2,$3,'ORGANIZER','')",
    [randomUUID(), expired.id, member.user.id],
  );
  dialog = await open(member.page, expired);
  await member.page.locator("#clear-confirmation").fill(expired.name);
  assert.equal(
    (await request(member.context, "/api/auth/sign-out", {})).status(),
    200,
  );
  await dialog.locator("button[type=submit]").click();
  await member.page.locator("#login-email").waitFor();
  assert.equal(await historyCount(expired.id), 0);
  check("Expired real session clears private workflow without effects");
  const valid = body(await preview(organizer.context, recovery));
  assert.equal(
    (
      await request(
        organizer.context,
        clearPath(recovery),
        { ...valid, actorMemberId: randomUUID() },
        randomUUID(),
      )
    ).status(),
    400,
  );
  assert.equal(
    (
      await request(
        organizer.context,
        `/api/events/${randomUUID()}/tasks/clear`,
        valid,
        randomUUID(),
      )
    ).status(),
    404,
  );
  assert.equal(
    (
      await organizer.context.request.post(origin + clearPath(recovery), {
        headers: {
          origin: "https://foreign.invalid",
          "Idempotency-Key": randomUUID(),
        },
        data: valid,
      })
    ).status(),
    403,
  );
  check("Forged actor fields, foreign Event and untrusted Origin denied");
  assert.equal(report.errors, 0);
} catch (e) {
  const failedPage = contexts[0]?.pages()[0];
  if (failedPage) {
    report.failureState = await failedPage
      .evaluate(() => ({
        path: location.pathname,
        clicks: window.__stage7Clicks,
        dialogs: [...document.querySelectorAll("dialog")].map((d) => ({
          open: d.open,
          busy: d.getAttribute("aria-busy"),
          inputs: d.querySelectorAll("input").length,
          alerts: d.querySelectorAll("[role=alert]").length,
        })),
        login: !!document.querySelector("#login-email"),
      }))
      .catch(() => null);
    await failedPage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  }
  report.failureAt =
    e.stack?.match(/verify-event-clear-ui\.mjs:\d+:\d+/)?.[0] ?? null;
  report.failure =
    "Clear browser verification incomplete; private diagnostics omitted.";
  throw Error(report.failure);
} finally {
  let cleanup = true;
  for (const context of contexts) {
    try {
      if ((await request(context, "/api/auth/sign-out", {})).status() !== 200)
        cleanup = false;
    } catch {
      cleanup = false;
    }
    await context.close().catch(() => (cleanup = false));
  }
  report.sessionCleanupVerified =
    cleanup &&
    JSON.stringify(await sessions()) === JSON.stringify(beforeSessions);
  const closed = await Promise.allSettled([
    browser?.close(),
    vite?.close(),
    app?.close(),
  ]);
  report.resourcesClosed = closed.every((r) => r.status === "fulfilled");
  await pool.end();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  assert.equal(report.sessionCleanupVerified, true);
  assert.equal(report.resourcesClosed, true);
}
