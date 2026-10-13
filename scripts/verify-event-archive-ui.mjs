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
const direct = process.env.BUDOGRAPH_ARCHIVE_DIRECT === "1",
  origin = direct ? "http://127.0.0.1:5173" : "http://127.0.0.1:5174",
  out =
    process.env.BUDOGRAPH_EVIDENCE_DIR ?? "tmp/event-management-stage6/browser";
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
  await target
    .getByRole("button", { name: `Archive event: ${event.name}`, exact: true })
    .click();
  await page.locator("#archive-confirmation").waitFor();
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".event-archive-dialog")
        .getAttribute("aria-busy") ||
      document
        .querySelector(".event-archive-dialog")
        .getAttribute("aria-busy") === "false",
  );
  return page.locator(".event-archive-dialog");
}
async function historyCount(eventId) {
  return (
    await pool.query(
      "SELECT count(*)::INT AS n FROM public.activity_entry WHERE event_id=$1 AND action_type='EVENT_ARCHIVED'",
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
    vite = await createServer({
      configFile: false,
      cacheDir: "tmp/event-management-stage6/vite-cache",
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
      `Stage 6 Archive ${randomUUID()} — ` +
        "Дълго събитие / Long event ".repeat(4),
    ),
    memberId = randomUUID();
  await pool.query(
    "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role) VALUES($1,$2,$3,'MEMBER','Organizer responsibility')",
    [memberId, source.id, member.user.id],
  );
  const taskResponse = await request(
    organizer.context,
    `/api/events/${source.id}/tasks`,
    {
      title: "Stage 6 preserved Task",
      deadline: "2026-11-02",
      priority: "normal",
      assignedMemberId: memberId,
    },
  );
  assert.equal(taskResponse.status(), 201);
  const task = (await taskResponse.json()).task;
  const changeResponse = await request(
    organizer.context,
    `/api/events/${source.id}/changes`,
    {
      title: "Stage 6 preserved Change",
      affectedTaskIds: [task.id],
      decision: "Retained decision",
      response: "Retained response",
      planB: "Retained Plan B",
    },
  );
  assert.equal(changeResponse.status(), 201);
  const change = (await changeResponse.json()).change;
  await member.page.goto(origin + "/events");
  assert.equal(
    await row(member.page, source).locator(".event-management__danger").count(),
    0,
  );
  const forbidden = await request(
    member.context,
    `/api/events/${source.id}/archive`,
    { expectedVersion: 1, confirmationName: source.name },
    randomUUID(),
  );
  assert.equal(forbidden.status(), 403);
  let dialog = await open(organizer.page, source);
  assert.equal(
    await dialog
      .getByRole("button", { name: "Archive event", exact: true })
      .isDisabled(),
    true,
  );
  await organizer.page
    .locator("#archive-confirmation")
    .fill(source.name.toLowerCase());
  assert.equal(
    await dialog
      .getByRole("button", { name: "Archive event", exact: true })
      .isDisabled(),
    true,
  );
  await organizer.page.locator("#archive-confirmation").fill(source.name + " ");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Archive event", exact: true })
      .isDisabled(),
    true,
  );
  const invalid = await request(
    organizer.context,
    `/api/events/${source.id}/archive`,
    { expectedVersion: 1, confirmationName: source.name + " " },
    randomUUID(),
  );
  assert.equal(invalid.status(), 400);
  check(
    "Organizer discovery, Member absence/403, empty and exact case/space confirmation, server validation",
  );
  await organizer.page.keyboard.press("Escape");
  assert.equal(await organizer.page.locator("dialog[open]").count(), 0);
  assert.ok(
    await organizer.page.evaluate(
      () => document.activeElement?.getAttribute("aria-haspopup") === "dialog",
    ),
  );
  assert.equal(await historyCount(source.id), 0);
  dialog = await open(organizer.page, source);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await historyCount(source.id), 0);
  check("Cancel and Escape send no command and restore focus");
  if (process.env.BUDOGRAPH_ARCHIVE_SKIP_MATRIX !== "1")
    for (const width of [320, 360, 390, 768, 960, 1024, 1440])
      for (const language of ["en", "bg"])
        for (const theme of ["light", "dark"]) {
          await organizer.page.setViewportSize({ width, height: 900 });
          await prefs(organizer.page, language, theme);
          const target = row(organizer.page, source);
          await target.locator("summary").click();
          await target.locator(".event-archive-action").click();
          await organizer.page.locator("#archive-confirmation").waitFor();
          await organizer.page
            .locator("#archive-confirmation")
            .fill(source.name);
          const modal = organizer.page.locator("dialog[open]");
          await modal
            .locator("button[type=submit]")
            .waitFor({ state: "visible" });
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
          await organizer.page.screenshot({
            path: `${out}/archive-${width}-${language}-${theme}.png`,
          });
          await organizer.page.keyboard.press("Escape");
          report.matrix.push({ width, language, theme });
        }
  await organizer.page.setViewportSize({ width: 320, height: 540 });
  await prefs(organizer.page, "bg", "dark");
  await row(organizer.page, source).locator("summary").click();
  await row(organizer.page, source).locator(".event-archive-action").click();
  await organizer.page.locator("#archive-confirmation").fill(source.name);
  await organizer.page.evaluate(
    () => (document.documentElement.style.fontSize = "125%"),
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
  await organizer.page.locator("dialog[open] button[type=submit]").focus();
  assert.ok(
    await organizer.page.evaluate(
      () =>
        document.activeElement.getBoundingClientRect().bottom <= innerHeight,
    ),
  );
  report.stress.push("320px/540px/125% BG Dark keyboard reachability");
  await organizer.page.keyboard.press("Escape");
  await organizer.page.evaluate(
    () => (document.documentElement.style.fontSize = ""),
  );
  await organizer.page.setViewportSize({ width: 1440, height: 900 });
  await prefs(organizer.page, "en", "light");
  check(
    "Archive dialog responsive/theme/language matrix, focus trap, long names and 125% short-screen checks",
  );
  dialog = await open(organizer.page, source);
  const renamed = { ...source, name: source.name + " updated" };
  const edit = await organizer.context.request.patch(
    origin + `/api/events/${source.id}`,
    {
      headers: { origin },
      data: {
        name: renamed.name,
        startDate: source.startDate,
        endDate: source.endDate,
        timezone: source.timezone,
        expectedVersion: 1,
      },
    },
  );
  assert.equal(edit.status(), 200);
  renamed.version = (await edit.json()).event.version;
  await organizer.page.locator("#archive-confirmation").fill(source.name);
  await dialog.locator("button[type=submit]").click();
  await dialog
    .getByRole("button", { name: "Load current event details" })
    .waitFor();
  assert.equal(await historyCount(source.id), 0);
  await dialog
    .getByRole("button", { name: "Load current event details" })
    .click();
  await organizer.page.waitForFunction(
    () => document.querySelector("#archive-confirmation")?.value === "",
  );
  await organizer.page.locator("#archive-confirmation").fill(renamed.name);
  assert.equal(await dialog.locator("button[type=submit]").isDisabled(), false);
  check(
    "Real concurrent rename conflicts; explicit canonical reload requires renewed name confirmation",
  );
  const beforeTask = (
      await pool.query(
        "SELECT to_jsonb(t) AS data FROM public.task t WHERE id=$1",
        [task.id],
      )
    ).rows[0].data,
    beforeChange = (
      await pool.query(
        "SELECT to_jsonb(t) AS data FROM public.event_change t WHERE id=$1",
        [change.id],
      )
    ).rows[0].data;
  let archiveRequests = 0;
  organizer.page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      new URL(r.url()).pathname === `/api/events/${source.id}/archive`
    )
      archiveRequests++;
  });
  let release;
  const held = new Promise((r) => {
    release = r;
  });
  await organizer.page.route(
    `**/api/events/${source.id}/archive`,
    async (route) => {
      await held;
      await route.continue();
    },
  );
  await dialog.locator("form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await organizer.page.waitForFunction(
    () => document.querySelector("dialog[open] button[type=submit]")?.disabled,
  );
  assert.equal(archiveRequests, 1);
  release();
  await organizer.page.locator("dialog[open]").waitFor({ state: "hidden" });
  await organizer.page.unroute(`**/api/events/${source.id}/archive`);
  assert.equal(await row(organizer.page, renamed).count(), 0);
  await organizer.page
    .getByRole("button", { name: "Archived", exact: true })
    .click();
  await row(organizer.page, renamed).waitFor();
  assert.equal(
    await row(organizer.page, renamed)
      .locator(".event-management__danger")
      .count(),
    0,
  );
  assert.equal(await historyCount(source.id), 1);
  check(
    "Pending rapid submission coalesces; success moves exactly one Event from Active to Archived",
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT to_jsonb(t) AS data FROM public.task t WHERE id=$1",
        [task.id],
      )
    ).rows[0].data,
    beforeTask,
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT to_jsonb(t) AS data FROM public.event_change t WHERE id=$1",
        [change.id],
      )
    ).rows[0].data,
    beforeChange,
  );
  await organizer.page.goto(origin + eventHref(source.id, "/tasks", task.id));
  await organizer.page
    .getByText("Historical workspace:", { exact: false })
    .waitFor();
  assert.equal(
    await organizer.page
      .getByRole("button", { name: "Add task", exact: true })
      .count(),
    0,
  );
  await organizer.page.reload();
  await organizer.page
    .getByText("Historical workspace:", { exact: false })
    .waitFor();
  await member.page.goto(origin + `/events/${source.id}/changes/${change.id}`);
  await member.page
    .getByText("Historical workspace:", { exact: false })
    .waitFor();
  await member.page.goto(origin + `/events/${source.id}/history`);
  await member.page.getByText("Event archived", { exact: true }).waitFor();
  await organizer.page.goto(origin + `/events/${source.id}/history`);
  await organizer.page.getByText("Event archived", { exact: true }).waitFor();
  check(
    "Archived Task/Change deep links, Member/Organizer History and business rows stay preserved and read-only",
  );
  await organizer.page.goto(origin + "/events");
  await organizer.page.goBack();
  await organizer.page.getByText("Event archived", { exact: true }).waitFor();
  assert.ok(organizer.page.url().endsWith(`/events/${source.id}/history`));
  await organizer.page.goForward();
  await organizer.page.waitForURL(origin + "/events");
  await organizer.page.locator(".event-management__controls").waitFor();
  assert.ok(organizer.page.url().endsWith("/events"));
  check(
    "Refresh and Back/Forward retain explicit archived/global scope without unrelated Event redirects",
  );
  await organizer.page
    .getByRole("button", { name: "Archived", exact: true })
    .click();
  await row(organizer.page, renamed)
    .getByRole("link", {
      name: `Duplicate event: ${renamed.name}`,
      exact: true,
    })
    .click();
  await organizer.page.locator("#event-name").waitFor();
  await organizer.page
    .locator("#event-name")
    .fill(`Stage 6 independent copy ${randomUUID()}`);
  await organizer.page.locator("#event-startDate").fill("2026-12-01");
  await organizer.page.locator("#event-endDate").fill("2026-12-02");
  const duplicateResponse = organizer.page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname.endsWith(`/${source.id}/duplicate`),
  );
  await organizer.page.locator(".event-form button[type=submit]").click();
  const copy = (await (await duplicateResponse).json()).event;
  report.intentionalEvents.push(copy.id);
  assert.equal(copy.archived, false);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::INT AS n FROM public.task WHERE event_id=$1",
        [copy.id],
      )
    ).rows[0].n,
    0,
  );
  check(
    "Locked Stage 5 Duplicate remains available from an archive and creates independent clean state",
  );
  for (const transport of ["lost-response", "malformed-409"]) {
    const recovery = await create(
      organizer.context,
      `Stage 6 ${transport} ${randomUUID()}`,
    );
    dialog = await open(organizer.page, recovery);
    const keys = [];
    let lose = true;
    await organizer.page.route(
      `**/api/events/${recovery.id}/archive`,
      async (route) => {
        keys.push(route.request().headers()["idempotency-key"]);
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        if (lose) {
          lose = false;
          if (transport === "lost-response") await route.abort("failed");
          else
            await route.fulfill({
              status: 409,
              contentType: "text/plain",
              body: "Unreadable acknowledgement",
            });
        } else await route.fulfill({ response });
      },
    );
    await organizer.page.locator("#archive-confirmation").fill(recovery.name);
    await dialog.locator("button[type=submit]").click();
    await dialog
      .getByRole("button", { name: "Recover archive result", exact: true })
      .waitFor();
    await organizer.page.reload();
    await organizer.page
      .getByRole("button", { name: "Recover archive result", exact: true })
      .click();
    await organizer.page
      .locator("dialog[open]")
      .getByRole("button", { name: "Recover archive result", exact: true })
      .click();
    await organizer.page.locator("dialog[open]").waitFor({ state: "hidden" });
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1]);
    assert.equal(await historyCount(recovery.id), 1);
    await organizer.page.unroute(`**/api/events/${recovery.id}/archive`);
    check(
      `Real committed ${transport}: refresh recovers the same UUID and single archive history`,
    );
  }
  const nonowner = await create(
    organizer.context,
    `Stage 6 non-owner ${randomUUID()}`,
  );
  await pool.query(
    "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role) VALUES($1,$2,$3,'ORGANIZER','')",
    [randomUUID(), nonowner.id, member.user.id],
  );
  dialog = await open(member.page, nonowner);
  await member.page.locator("#archive-confirmation").fill(nonowner.name);
  await member.page.keyboard.press("Enter");
  await member.page.locator("dialog[open]").waitFor({ state: "hidden" });
  assert.equal(await historyCount(nonowner.id), 1);
  check("Active non-owner Organizer can archive; ownership remains distinct");
  const replayKey = (
    await pool.query(
      "SELECT command_id FROM public.event_command_receipt WHERE actor_user_id=$1 AND source_event_id=$2 AND command_type='EVENT_ARCHIVE'",
      [member.user.id, nonowner.id],
    )
  ).rows[0].command_id;
  await pool.query(
    "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE event_id=$1 AND user_id=$2",
    [nonowner.id, member.user.id],
  );
  assert.equal(
    (
      await request(
        member.context,
        `/api/events/${nonowner.id}/archive`,
        { expectedVersion: 1, confirmationName: nonowner.name },
        replayKey,
      )
    ).status(),
    404,
  );
  const revoked = await create(
    organizer.context,
    `Stage 6 revoked membership ${randomUUID()}`,
  );
  await pool.query(
    "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role) VALUES($1,$2,$3,'ORGANIZER','')",
    [randomUUID(), revoked.id, member.user.id],
  );
  dialog = await open(member.page, revoked);
  await member.page.locator("#archive-confirmation").fill(revoked.name);
  await pool.query(
    "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE event_id=$1 AND user_id=$2",
    [revoked.id, member.user.id],
  );
  await dialog.locator("button[type=submit]").click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(
    await member.page.locator("#archive-confirmation").isDisabled(),
    true,
  );
  assert.equal(
    await dialog.locator(".event-archive-dialog__name").textContent(),
    "This event is not available to you.",
  );
  assert.equal(await historyCount(revoked.id), 0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await row(member.page, revoked).count(), 0);
  check(
    "Membership revocation blocks fresh commands and receipt replay, clears scoped controls and creates no additional effect",
  );
  const expired = await create(
    organizer.context,
    `Stage 6 expired session ${randomUUID()}`,
  );
  await pool.query(
    "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role) VALUES($1,$2,$3,'ORGANIZER','')",
    [randomUUID(), expired.id, member.user.id],
  );
  dialog = await open(member.page, expired);
  await member.page.locator("#archive-confirmation").fill(expired.name);
  assert.equal(
    (await request(member.context, "/api/auth/sign-out", {})).status(),
    200,
  );
  await dialog.locator("button[type=submit]").click();
  await member.page.locator("#login-email").waitFor();
  assert.equal(await historyCount(expired.id), 0);
  check(
    "Expired real session clears private workflow and creates no archive effect",
  );
  for (const [path, body, status] of [
    [
      `/api/events/${expired.id}/archive`,
      {
        expectedVersion: 1,
        confirmationName: expired.name,
        ownerUserId: organizer.user.id,
      },
      400,
    ],
    [
      `/api/events/${randomUUID()}/archive`,
      { expectedVersion: 1, confirmationName: "Foreign" },
      404,
    ],
  ])
    assert.equal(
      (await request(organizer.context, path, body, randomUUID())).status(),
      status,
    );
  const untrusted = await organizer.context.request.post(
    origin + `/api/events/${expired.id}/archive`,
    {
      headers: {
        origin: "https://foreign.invalid",
        "Idempotency-Key": randomUUID(),
      },
      data: { expectedVersion: 1, confirmationName: expired.name },
    },
  );
  assert.equal(untrusted.status(), 403);
  check(
    "Forged ownership/body fields, foreign Event and untrusted Origin fail server-side",
  );
  assert.equal(report.errors, 0);
} catch (e) {
  report.failureAt =
    e.stack?.match(/verify-event-archive-ui\.mjs:\d+:\d+/)?.[0] ?? null;
  report.failure =
    "Archive browser verification incomplete; private diagnostics omitted.";
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
    await context.close().catch(() => {
      cleanup = false;
    });
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
