// Real authenticated PostgreSQL reads through the production Fastify/Auth/Event
// factories. A narrow loopback bridge loads the new read endpoint without
// restarting the user's healthy shared backend. Error/empty cases are labelled.
// No credentials, cookies, storage snapshots, traces or raw errors are saved.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readServerEnv } from "../server/src/config/env.ts";
import { createDatabasePool } from "../server/src/db/pool.ts";
import { createAuth } from "../server/src/auth/auth.ts";
import { createApp } from "../server/src/app.ts";
import { createEventService } from "../server/src/events/service.ts";
const origin = "http://127.0.0.1:5173";
const out =
  process.env.BUDOGRAPH_EVIDENCE_DIR ??
  "tmp/event-management-stage23/history-browser";
mkdirSync(out, { recursive: true });
const config = readServerEnv();
assert.equal(config.nodeEnv, "development");
for (const url of [
  "http://127.0.0.1:3001/api/health/live",
  "http://127.0.0.1:3001/api/health/ready",
  origin,
])
  assert.equal((await fetch(url)).status, 200);
const pool = createDatabasePool(config, () => {});
const direct = process.env.BUDOGRAPH_HISTORY_DIRECT === "1";
const app = direct
  ? null
  : createApp({
      events: createEventService(pool),
      authentication: {
        auth: createAuth(pool, config),
        baseURL: config.betterAuthUrl,
      },
      checkDatabase: async () => {
        await pool.query("SELECT 1");
      },
    });
const backend = direct
  ? "http://127.0.0.1:3001"
  : await app.listen({ host: "127.0.0.1", port: 0 });
if (!direct) assert.notEqual(new URL(backend).port, "3001");
assert.equal((await fetch(backend + "/api/health/ready")).status, 200);
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const contexts = [],
  report = {
    browser: browser.version(),
    checks: [],
    matrix: [],
    bridge: direct
      ? "Direct shared backend/Vite HTTP requests; no history bridge."
      : "Only history GETs use an owned loopback production-factory backend; existing auth/workflows stay on the unchanged shared service.",
    errors: 0,
  };
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
let lastLogin = 0;
const snapshot = async () =>
  (
    await pool.query(
      "SELECT id,md5(to_jsonb(a)::TEXT) AS hash FROM public.activity_entry a ORDER BY id",
    )
  ).rows;
const before = await snapshot();
const sessionIds = async () =>
  (await pool.query('SELECT id FROM public."session" ORDER BY id')).rows.map(
    (row) => row.id,
  );
const originalSessions = await sessionIds();
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
  if (!direct)
    await page.route(/\/api\/events\/[^/]+\/history(?:\?|$)/, async (route) => {
      const request = route.request();
      assert.equal(request.method(), "GET");
      const url = new URL(request.url());
      const response = await route.fetch({
        url: backend + url.pathname + url.search,
      });
      await route.fulfill({ response });
    });
  await page.goto(origin + "/events");
  const pause = 11000 - (Date.now() - lastLogin);
  if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
  await page
    .locator("#login-email")
    .fill(process.env[`BUDOGRAPH_${role}_EMAIL`]);
  await page
    .locator("#login-password")
    .fill(process.env[`BUDOGRAPH_${role}_PASSWORD`]);
  lastLogin = Date.now();
  await page.locator("button[type=submit]").click();
  await page.locator(".event-management__row").first().waitFor();
  const events = await page.evaluate(
    async () => (await fetch("/api/events").then((r) => r.json())).events,
  );
  return { page, context, events };
}
async function loaded(page) {
  await page.locator(".page--event-history:not([aria-busy=true])").waitFor();
}
async function getHistory(page, id) {
  return page.evaluate(async (id) => {
    const r = await fetch(`/api/events/${id}/history`);
    return {
      status: r.status,
      body: await r.json(),
      cache: r.headers.get("cache-control"),
    };
  }, id);
}
try {
  const organizer = await make("ORGANIZER"),
    member = await make("MEMBER");
  // Bind pagination/relationship regressions to the established shared fixture,
  // not newly retained metadata-only sources with short creation histories.
  const sharedIds = organizer.events
    .filter((e) => !e.archived && member.events.some((m) => m.id === e.id))
    .map((e) => e.id);
  const controlled = await pool.query(
    "SELECT event_id FROM public.task WHERE title=$1 AND deleted_at IS NULL AND event_id=ANY($2::UUID[])",
    ["Verify the two-user responsibility loop", sharedIds],
  );
  assert.equal(
    controlled.rows.length,
    1,
    "Exactly one authorized controlled history fixture required",
  );
  const shared = organizer.events.find(
    (e) => e.id === controlled.rows[0].event_id,
  );
  assert.ok(shared, "Existing controlled shared Event is required");
  for (const current of [organizer, member]) {
    const { page } = current;
    const link = page.locator(
      `.event-management__row a[href="/events/${shared.id}/history"]`,
    );
    assert.equal(await link.count(), 1);
    await link.click();
    await loaded(page);
    const data = await getHistory(page, shared.id);
    assert.equal(data.status, 200);
    assert.equal(data.cache, "no-store");
    const ids = (
      await pool.query(
        "SELECT id FROM public.activity_entry WHERE event_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50",
        [shared.id],
      )
    ).rows.map((r) => r.id);
    assert.deepEqual(
      await page
        .locator("[data-history-id]")
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.historyId)),
      ids,
    );
    assert.deepEqual(
      data.body.entries.map((e) => e.id),
      ids,
    );
    assert.equal(data.body.eventId, shared.id);
    for (const entry of data.body.entries)
      assert.equal(entry.eventId, shared.id);
    await page.reload();
    await loaded(page);
    assert.equal(new URL(page.url()).pathname, `/events/${shared.id}/history`);
  }
  checked(
    "Real Organizer/Member listing links, authorized PostgreSQL-backed actor/action/target reads, refresh and no-store history",
  );
  const data = await getHistory(organizer.page, shared.id);
  if (data.body.nextCursor) {
    await organizer.page
      .getByRole("button", { name: "Load older records", exact: true })
      .click();
    await loaded(organizer.page);
    const expected = (
      await pool.query(
        "SELECT id FROM public.activity_entry WHERE event_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100",
        [shared.id],
      )
    ).rows.map((r) => r.id);
    assert.deepEqual(
      await organizer.page
        .locator("[data-history-id]")
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.historyId)),
      expected,
    );
    checked(
      "Real older-page append matches deterministic PostgreSQL order with no duplicate or omitted records",
    );
  } else
    report.pagination =
      "Real Event has at most 50 entries; paging integrity is covered by rollback-only PostgreSQL and unit tests.";
  const taskLink = organizer.page
    .locator('.event-history__entry a[href*="?task="]')
    .first();
  assert.equal(
    await taskLink.count(),
    1,
    "Controlled Event must expose its recorded Task link",
  );
  if (await taskLink.count()) {
    const href = await taskLink.getAttribute("href");
    await taskLink.click();
    await organizer.page.waitForURL(origin + href);
    await organizer.page.locator(".task-drawer").first().waitFor();
    report.taskRelationshipVerified = true;
    await organizer.page.goBack();
    await loaded(organizer.page);
  }
  const changeLink = organizer.page
    .locator('.event-history__entry a[href*="/changes/"]')
    .first();
  assert.equal(
    await changeLink.count(),
    1,
    "Controlled Event must expose its recorded Change link",
  );
  if (await changeLink.count()) {
    const href = await changeLink.getAttribute("href");
    await changeLink.click();
    await organizer.page.waitForURL(origin + href);
    await organizer.page.locator(".change-detail").waitFor();
    report.changeRelationshipVerified = true;
    await organizer.page.goBack();
    await loaded(organizer.page);
  }
  checked(
    "Existing recorded Task/Change links navigate within their Event and Back returns to history",
  );
  const privateEvent = organizer.events.find(
    (e) => !member.events.some((m) => m.id === e.id),
  );
  assert.ok(privateEvent);
  assert.equal((await getHistory(member.page, privateEvent.id)).status, 404);
  await member.page.goto(origin + `/events/${privateEvent.id}/history`);
  await member.page.getByRole("alert").waitFor();
  assert.equal(await member.page.locator("[data-history-id]").count(), 0);
  await organizer.page.goto(origin + `/events/${privateEvent.id}/history`);
  await loaded(organizer.page);
  const selector = organizer.page.locator(
    "#event-switcher:visible,#mobile-event-switcher:visible",
  );
  await selector.selectOption(shared.id);
  await organizer.page.waitForURL(origin + `/events/${shared.id}/history`);
  await loaded(organizer.page);
  checked(
    "Foreign Event HTTP404/direct URL fail closed; Event switching keeps history route and replaces scope",
  );
  if (process.env.BUDOGRAPH_HISTORY_SKIP_MATRIX !== "1") {
    for (const width of [320, 360, 390, 768, 960, 1024, 1440])
      for (const language of ["bg", "en"])
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
          await organizer.page.goto(origin + `/events/${shared.id}/history`);
          await loaded(organizer.page);
          assert.equal(
            await organizer.page.locator("html").getAttribute("lang"),
            language,
          );
          assert.equal(
            await organizer.page.locator("html").getAttribute("data-theme"),
            theme,
          );
          assert.equal(
            await organizer.page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          for (const button of await organizer.page
            .locator(".page--event-history .button")
            .all()) {
            const b = await button.boundingBox();
            assert.ok(b.height >= 44);
          }
          assert.equal(
            await organizer.page.locator(".mobile-nav a").count(),
            5,
          );
          const refresh = organizer.page.getByRole("button", {
            name:
              language === "bg" ? "Обновяване на историята" : "Refresh history",
            exact: true,
          });
          await refresh.focus();
          await organizer.page.waitForFunction(() => {
            const b = document.activeElement.getBoundingClientRect();
            return (
              b.top >= 0 &&
              b.bottom <= innerHeight &&
              document.activeElement.contains(
                document.elementFromPoint(
                  (b.left + b.right) / 2,
                  (b.top + b.bottom) / 2,
                ),
              )
            );
          });
          await organizer.page.evaluate(() => {
            document.activeElement.blur();
            window.scrollTo(0, 0);
          });
          await organizer.page.screenshot({
            path: `${out}/history-${width}-${language}-${theme}.png`,
          });
          report.matrix.push({
            width,
            language,
            theme,
            noOverflow: true,
            targets44: true,
            keyboardReachable: true,
          });
        }
    checked(
      "28 BG/EN Light/Dark 320–1440px history cases preserve five-item navigation, readable layout and keyboard/touch reachability",
    );
  }
  // Labelled recovery presentation fixtures; not canonical history evidence.
  await organizer.page.setViewportSize({ width: 1440, height: 900 });
  const empty = (route) =>
    route.fulfill({
      json: { eventId: shared.id, entries: [], nextCursor: null },
    });
  await organizer.page.route(`**/api/events/${shared.id}/history`, empty);
  await organizer.page.reload();
  await loaded(organizer.page);
  assert.equal(await organizer.page.locator(".empty-state").count(), 1);
  await organizer.page.unroute(`**/api/events/${shared.id}/history`, empty);
  const fail = (route) =>
    route.fulfill({ status: 500, json: { secret: "DO_NOT_EXPOSE" } });
  await organizer.page.route(`**/api/events/${shared.id}/history`, fail);
  await organizer.page.reload();
  await organizer.page.getByRole("alert").waitFor();
  assert.equal(await organizer.page.locator("[data-history-id]").count(), 0);
  assert.doesNotMatch(
    await organizer.page.locator(".app-main").innerText(),
    /DO_NOT_EXPOSE/,
  );
  await organizer.page.unroute(`**/api/events/${shared.id}/history`, fail);
  await organizer.page
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await loaded(organizer.page);
  assert.ok(await organizer.page.locator("[data-history-id]").count());
  checked(
    "Labelled empty/HTTP500 fixtures remain honest and safe; explicit retry recovers real history",
  );
  await organizer.page.goto(origin + "/account");
  await organizer.page.locator(".profile-page").waitFor();
  checked(
    "Profile read-only navigation remains available; established passwords are never changed",
  );
  await member.page.goto(origin + `/events/${shared.id}/history`);
  await loaded(member.page);
  await member.context.request.post(origin + "/api/auth/sign-out", {
    headers: { origin },
    data: {},
  });
  await member.page.reload();
  await member.page.locator("#login-email").waitFor();
  assert.equal(await member.page.locator("[data-history-id]").count(), 0);
  assert.equal(
    (await organizer.context.request.get(origin + "/api/me")).status(),
    200,
  );
  checked(
    "Real revoked session clears history/shell while independent Organizer session remains authenticated",
  );
  assert.deepEqual(await snapshot(), before);
  report.historyRowsPreserved = before.length;
  checked(
    "Independent row hashes prove every existing canonical history entry unchanged; read-only browser run creates no business fixtures",
  );
  assert.equal(report.errors, 0);
} catch (error) {
  report.failureAt =
    error instanceof Error
      ? error.stack?.match(/verify-event-history-ui\.mjs:\d+:\d+/)?.[0]
      : null;
  report.failure =
    "History browser verification incomplete; private error details omitted.";
  throw new Error(report.failure);
} finally {
  let cleanupOk = true;
  for (const context of contexts) {
    try {
      const response = await context.request.post(
        origin + "/api/auth/sign-out",
        { headers: { origin }, data: {} },
      );
      if (response.status() !== 200) cleanupOk = false;
    } catch {
      cleanupOk = false;
    }
    try {
      await context.close();
    } catch {
      cleanupOk = false;
    }
  }
  try {
    report.sessionCleanupVerified =
      cleanupOk &&
      JSON.stringify(await sessionIds()) === JSON.stringify(originalSessions);
  } catch {
    report.sessionCleanupVerified = false;
  }
  const resources = await Promise.allSettled([browser.close(), app?.close()]);
  report.resourcesClosed = resources.every(
    (result) => result.status === "fulfilled",
  );
  try {
    await pool.end();
  } catch {
    report.resourcesClosed = false;
  }
  report.bridgeClosed = !direct && report.resourcesClosed;
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  assert.equal(
    report.sessionCleanupVerified,
    true,
    "Owned sessions must be removed and existing session IDs preserved",
  );
  assert.equal(
    report.resourcesClosed,
    true,
    "Owned browser/backend/pool must close",
  );
}
