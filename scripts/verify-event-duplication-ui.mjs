// Real Better Auth/PostgreSQL. Only Duplicate POSTs use an owned production-
// factory loopback backend until the shared process is explicitly reloaded.
// Transport-loss/validation fixtures are labelled; no auth artifacts are saved.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readServerEnv } from "../server/src/config/env.ts";
import { createDatabasePool } from "../server/src/db/pool.ts";
import { createAuth } from "../server/src/auth/auth.ts";
import { createApp } from "../server/src/app.ts";
import { createEventService } from "../server/src/events/service.ts";

const origin = "http://127.0.0.1:5173",
  out =
    process.env.BUDOGRAPH_EVIDENCE_DIR ??
    "tmp/event-management-stage45/duplicate-browser";
mkdirSync(out, { recursive: true });
const config = readServerEnv();
assert.equal(config.nodeEnv, "development");
for (const url of [
  "http://127.0.0.1:3001/api/health/live",
  "http://127.0.0.1:3001/api/health/ready",
  origin,
])
  assert.equal((await fetch(url)).status, 200);
const pool = createDatabasePool(config, () => {}),
  direct = process.env.BUDOGRAPH_DUPLICATE_DIRECT === "1";
const app = direct
  ? null
  : createApp({
      events: createEventService(pool),
      authentication: {
        auth: createAuth(pool, config),
        baseURL: config.betterAuthUrl,
        taskMutationOrigins: [origin, new URL(config.betterAuthUrl).origin],
      },
      checkDatabase: async () => {
        await pool.query("SELECT 1");
      },
    });
const backend = direct
  ? "http://127.0.0.1:3001"
  : await app.listen({ host: "127.0.0.1", port: 0 });
assert.equal((await fetch(backend + "/api/health/ready")).status, 200);
assert.equal(
  (
    await fetch(backend + `/api/events/${randomUUID()}/duplicate`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: "{}",
    })
  ).status,
  401,
);
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
    bridge: !direct,
    checks: [],
    matrix: [],
    intentionalEvents: [],
    errors: 0,
  },
  checked = (label) => {
    report.checks.push(label);
    console.log(`PASS: ${label}`);
  };
const sessionIds = async () =>
  (await pool.query('SELECT id FROM public."session" ORDER BY id')).rows.map(
    (row) => row.id,
  );
const originalSessions = await sessionIds();
let lastLogin = 0;
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
    await page.route(/\/api\/events\/[^/]+\/duplicate$/, async (route) => {
      const request = route.request();
      assert.equal(request.method(), "POST");
      const response = await route.fetch({
        url: backend + new URL(request.url()).pathname,
      });
      await route.fulfill({ response });
    });
  await page.goto(origin + "/events");
  await page.locator("#login-email").waitFor();
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
  const me = await (await context.request.get(origin + "/api/me")).json();
  return { context, page, user: me.user };
}
const request = (account, source, key, fields) =>
  account.context.request.post(backend + `/api/events/${source}/duplicate`, {
    headers: { origin, "Idempotency-Key": key },
    data: fields,
  });
const basics = {
  name: `Stage45 reviewed copy ${randomUUID().slice(0, 8)}`,
  startDate: "2026-11-10",
  endDate: "2026-11-12",
  timezone: "UTC",
};
async function sourceSnapshot(id) {
  const rows = [];
  for (const table of [
    "event",
    "event_member",
    "task",
    "activity_entry",
    "event_invitation",
    "event_change",
    "change_task",
    "notification",
  ])
    rows.push([
      table,
      (
        await pool.query(
          `SELECT md5(to_jsonb(r)::TEXT) AS hash FROM public.${table} r WHERE ${table === "event" ? "r.id" : "r.event_id"}=$1 ORDER BY md5(to_jsonb(r)::TEXT)`,
          [id],
        )
      ).rows,
    ]);
  return rows;
}
async function integrity(event, actorId) {
  const row = (
    await pool.query(
      "SELECT owner_user_id,version,archived_at,name,to_char(start_date,'YYYY-MM-DD') AS start_date,to_char(end_date,'YYYY-MM-DD') AS end_date,timezone FROM public.event WHERE id=$1",
      [event.id],
    )
  ).rows[0];
  assert.equal(row.owner_user_id, actorId);
  assert.equal(row.version, 1);
  assert.equal(row.archived_at, null);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::INT AS n FROM public.event_member WHERE event_id=$1 AND user_id=$2 AND access_role='ORGANIZER' AND active=TRUE",
        [event.id, actorId],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::INT AS n FROM public.event_member WHERE event_id=$1",
        [event.id],
      )
    ).rows[0].n,
    1,
  );
  for (const table of [
    "task",
    "event_invitation",
    "event_change",
    "change_task",
    "notification",
  ])
    assert.equal(
      (
        await pool.query(
          `SELECT count(*)::INT AS n FROM public.${table} WHERE event_id=$1`,
          [event.id],
        )
      ).rows[0].n,
      0,
    );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::INT AS n FROM public.activity_entry WHERE event_id=$1",
        [event.id],
      )
    ).rows[0].n,
    1,
  );
  report.intentionalEvents.push(event.id);
}
async function fill(page, fields) {
  for (const key of ["name", "startDate", "endDate", "timezone"])
    await page.locator(`#event-${key}`).fill(fields[key]);
}
async function form(page, source) {
  await page.goto(origin + `/events/${source.id}/duplicate`);
  await page.locator("#event-name").waitFor();
}
try {
  const organizer = await make("ORGANIZER"),
    member = await make("MEMBER");
  const sourceName =
    `Stage45 source ${randomUUID().slice(0, 8)} — Дълго име Long event name `
      .repeat(4)
      .slice(0, 200)
      .trim();
  const authored = await organizer.context.request.post(
    origin + "/api/events",
    {
      headers: { origin },
      data: {
        name: sourceName,
        startDate: "2026-10-01",
        endDate: "2026-10-02",
        timezone: "Europe/Sofia",
      },
    },
  );
  assert.equal(authored.status(), 201);
  const source = (await authored.json()).event;
  report.intentionalEvents.push(source.id);
  await pool.query(
    "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role,active) VALUES($1,$2,$3,'MEMBER','',TRUE)",
    [randomUUID(), source.id, member.user.id],
  );
  await pool.query(
    "INSERT INTO public.task(id,event_id,title,deadline,created_by,updated_by) VALUES($1,$2,'Owned duplication source task','2026-10-02',$3,$3)",
    [randomUUID(), source.id, source.membership.id],
  );
  const before = await sourceSnapshot(source.id);
  await organizer.page.goto(origin + "/events");
  const row = organizer.page
    .locator(".event-management__row")
    .filter({ hasText: sourceName });
  await row.waitFor();
  await row
    .getByRole("link", { name: `Duplicate event: ${sourceName}`, exact: true })
    .click();
  await organizer.page.locator("#event-name").waitFor();
  assert.equal(
    await organizer.page.locator("#event-timezone").inputValue(),
    source.timezone,
  );
  assert.equal(
    await organizer.page.locator("#event-startDate").inputValue(),
    "",
  );
  assert.equal(await organizer.page.locator("#event-endDate").inputValue(), "");
  assert.ok(
    (await organizer.page.locator("#event-name").inputValue()).endsWith(
      " (copy)",
    ),
  );
  assert.ok(
    (await organizer.page.locator("#event-name").inputValue()).length <= 200,
  );
  assert.match(
    await organizer.page.locator(".event-form").innerText(),
    /Tasks and team access are not copied/,
  );
  checked(
    "Organizer discovers Duplicate; source identified, bounded copy suffix/timezone prefilled, fresh dates required",
  );
  await organizer.page.locator(".event-form button[type=submit]").click();
  await organizer.page.locator("#event-startDate[aria-invalid=true]").waitFor();
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::INT AS n FROM public.event_command_receipt WHERE actor_user_id=$1 AND source_event_id=$2",
        [organizer.user.id, source.id],
      )
    ).rows[0].n,
    0,
  );
  checked(
    "Missing target dates fail accessible client validation without sending a business command",
  );
  await fill(organizer.page, basics);
  let submissions = 0;
  organizer.page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      new URL(req.url()).pathname === `/api/events/${source.id}/duplicate`
    )
      submissions++;
  });
  const acceptedResponse = organizer.page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === `/api/events/${source.id}/duplicate`,
  );
  await organizer.page.locator(".event-form").evaluate((element) => {
    element.requestSubmit();
    element.requestSubmit();
  });
  const response = await acceptedResponse;
  assert.equal(response.status(), 201);
  const created = (await response.json()).event;
  await organizer.page.waitForURL(origin + `/events/${created.id}/dashboard`);
  await organizer.page
    .locator(".dashboard-page, .page--dashboard, .dashboard")
    .first()
    .waitFor();
  assert.equal(submissions, 1);
  assert.equal(created.name, basics.name);
  assert.equal(created.startDate, basics.startDate);
  assert.equal(created.endDate, basics.endDate);
  assert.equal(created.timezone, basics.timezone);
  await integrity(created, organizer.user.id);
  assert.deepEqual(await sourceSnapshot(source.id), before);
  checked(
    "Rapid submit sends one command; resulting independent Event has exact metadata, sole Organizer, one fresh history entry and no inherited records",
  );
  await organizer.page.reload();
  await organizer.page.waitForURL(origin + `/events/${created.id}/dashboard`);
  await organizer.page.goBack();
  assert.equal(new URL(organizer.page.url()).pathname, "/events");
  await organizer.page.goForward();
  assert.equal(
    new URL(organizer.page.url()).pathname,
    `/events/${created.id}/dashboard`,
  );
  checked(
    "Success replaces the form route; refresh and Back/Forward preserve the correct new Event",
  );
  for (const acknowledgement of ["network", "malformed409"]) {
    await form(organizer.page, source);
    await fill(organizer.page, {
      ...basics,
      name: basics.name + " recovered " + acknowledgement,
    });
    let lostOutcome, lostKey;
    const lost = async (route) => {
      const req = route.request();
      lostKey = req.headers()["idempotency-key"];
      const result = await route.fetch({
        url: backend + new URL(req.url()).pathname,
      });
      assert.equal(result.status(), 201);
      lostOutcome = (await result.json()).event;
      if (acknowledgement === "network") await route.abort("failed");
      else
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: "unreadable",
        });
    };
    await organizer.page.route(`**/api/events/${source.id}/duplicate`, lost);
    await organizer.page.locator(".event-form button[type=submit]").click();
    await organizer.page.getByRole("alert").waitFor();
    assert.match(
      await organizer.page.getByRole("alert").innerText(),
      /may already have completed/,
    );
    assert.equal(
      await organizer.page
        .locator(".event-form fieldset")
        .evaluate((element) => element.disabled),
      true,
    );
    for (const field of ["name", "startDate", "endDate", "timezone"])
      assert.equal(
        await organizer.page.locator(`#event-${field}`).isDisabled(),
        true,
      );
    await organizer.page.unroute(`**/api/events/${source.id}/duplicate`, lost);
    await organizer.page.reload();
    await organizer.page
      .getByRole("button", { name: "Retry this duplication", exact: true })
      .waitFor();
    const recoveredResponse = organizer.page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === `/api/events/${source.id}/duplicate`,
    );
    await organizer.page
      .getByRole("button", { name: "Retry this duplication", exact: true })
      .click();
    const recovered = await recoveredResponse;
    assert.equal(recovered.request().headers()["idempotency-key"], lostKey);
    assert.deepEqual((await recovered.json()).event, lostOutcome);
    await organizer.page.waitForURL(
      origin + `/events/${lostOutcome.id}/dashboard`,
    );
    await integrity(lostOutcome, organizer.user.id);
    checked(
      `Labelled ${acknowledgement} acknowledgement fixture commits once; held fields and same UUID survive refresh and recover its durable accepted Event`,
    );
  }
  const concurrentKey = randomUUID();
  const concurrent = await Promise.all([
    request(organizer, source.id, concurrentKey, {
      ...basics,
      expectedVersion: 1,
    }),
    request(organizer, source.id, concurrentKey, {
      ...basics,
      expectedVersion: 1,
    }),
  ]);
  assert.ok(concurrent.every((r) => r.status() === 201));
  const results = await Promise.all(concurrent.map((r) => r.json()));
  assert.deepEqual(results[0], results[1]);
  await integrity(results[0].event, organizer.user.id);
  assert.equal(
    (
      await request(organizer, source.id, concurrentKey, {
        ...basics,
        name: "conflicting",
        expectedVersion: 1,
      })
    ).status(),
    409,
  );
  checked(
    "Authenticated concurrent HTTP retries return one Event; changed payload with the same UUID returns 409",
  );
  await member.page.goto(origin + "/events");
  const memberRow = member.page
    .locator(".event-management__row")
    .filter({ hasText: sourceName });
  await memberRow.waitFor();
  assert.equal(
    await memberRow.getByRole("link", { name: /Duplicate event/ }).count(),
    0,
  );
  await member.page.goto(origin + `/events/${source.id}/duplicate`);
  await member.page.getByRole("alert").waitFor();
  assert.equal(await member.page.locator(".event-form").count(), 0);
  assert.equal(
    (
      await request(member, source.id, concurrentKey, {
        ...basics,
        expectedVersion: 1,
      })
    ).status(),
    403,
  );
  await member.page.goto(origin + `/events/${created.id}/duplicate`);
  await member.page.getByRole("alert").waitFor();
  assert.equal(await member.page.locator(".event-form").count(), 0);
  assert.equal(
    (
      await request(member, created.id, concurrentKey, {
        ...basics,
        expectedVersion: 1,
      })
    ).status(),
    404,
  );
  checked(
    "Actual Member has no Duplicate action/form and receives 403; foreign duplicate result/source stays inaccessible with 404",
  );
  assert.deepEqual(await sourceSnapshot(source.id), before);
  await form(organizer.page, source);
  await fill(organizer.page, { ...basics, name: basics.name + " validated" });
  const rejected = (route) =>
    route.fulfill({
      status: 400,
      json: {
        code: "INVALID_EVENT_COMMAND",
        fields: { timezone: "INVALID_TIMEZONE" },
      },
    });
  await organizer.page.route(`**/api/events/${source.id}/duplicate`, rejected);
  await organizer.page.locator(".event-form button[type=submit]").click();
  await organizer.page.locator("#event-timezone[aria-invalid=true]").waitFor();
  assert.equal(await organizer.page.locator("#event-name").isDisabled(), false);
  await organizer.page.unroute(
    `**/api/events/${source.id}/duplicate`,
    rejected,
  );
  await organizer.page.locator("#event-timezone").fill("UTC");
  const validationRecovery = organizer.page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === `/api/events/${source.id}/duplicate`,
  );
  await organizer.page.locator(".event-form button[type=submit]").click();
  const validatedResponse = await validationRecovery;
  assert.equal(validatedResponse.status(), 201);
  const validated = (await validatedResponse.json()).event;
  await integrity(validated, organizer.user.id);
  await organizer.page.waitForURL(origin + `/events/${validated.id}/dashboard`);
  assert.deepEqual(await sourceSnapshot(source.id), before);
  checked(
    "Labelled server validation rejection releases only the failed draft; explicit corrected submission succeeds without source mutation",
  );

  await form(organizer.page, source);
  const reviewedConflict = {
    ...basics,
    name: basics.name + " after source edit",
  };
  await fill(organizer.page, reviewedConflict);
  const sourceEdit = await organizer.context.request.patch(
    origin + `/api/events/${source.id}`,
    {
      headers: { origin },
      data: {
        name: source.name,
        startDate: source.startDate,
        endDate: source.endDate,
        timezone: "UTC",
        expectedVersion: 1,
      },
    },
  );
  assert.equal(sourceEdit.status(), 200);
  const editedSourceBefore = await sourceSnapshot(source.id);
  const sourceConflict = organizer.page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === `/api/events/${source.id}/duplicate`,
  );
  await organizer.page.locator(".event-form button[type=submit]").click();
  assert.equal((await sourceConflict).status(), 409);
  await organizer.page
    .getByRole("alert")
    .filter({ hasText: "Its latest version has been loaded" })
    .waitFor();
  assert.equal(
    await organizer.page.locator("#event-name").inputValue(),
    reviewedConflict.name,
  );
  assert.equal(
    await organizer.page.locator("#event-startDate").inputValue(),
    reviewedConflict.startDate,
  );
  const reviewedSave = organizer.page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === `/api/events/${source.id}/duplicate`,
  );
  await organizer.page.locator(".event-form button[type=submit]").click();
  const afterConflict = await reviewedSave;
  assert.equal(afterConflict.status(), 201);
  const reviewedResult = (await afterConflict.json()).event;
  await integrity(reviewedResult, organizer.user.id);
  await organizer.page.waitForURL(
    origin + `/events/${reviewedResult.id}/dashboard`,
  );
  assert.deepEqual(await sourceSnapshot(source.id), editedSourceBefore);
  checked(
    "Real source Edit yields 409 for the held Duplicate draft; reload preserves target fields and requires an explicit reviewed save",
  );

  for (const width of process.env.BUDOGRAPH_DUPLICATE_SKIP_MATRIX === "1"
    ? []
    : [1440, 1024, 960, 768, 390, 360, 320])
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
        await form(organizer.page, source);
        assert.equal(
          await organizer.page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        assert.equal(
          await organizer.page.locator("#event-startDate").inputValue(),
          "",
        );
        const submit = organizer.page.locator(
          ".event-form button[type=submit]",
        );
        await submit.focus();
        await submit.scrollIntoViewIfNeeded();
        assert.equal(
          await submit.evaluate((button) => {
            const r = button.getBoundingClientRect();
            return (
              r.width >= 44 &&
              r.height >= 44 &&
              r.top >= 0 &&
              r.bottom <= innerHeight &&
              button.contains(
                document.elementFromPoint(
                  r.left + r.width / 2,
                  r.top + r.height / 2,
                ),
              )
            );
          }),
          true,
        );
        await organizer.page.evaluate(() => scrollTo(0, 0));
        await organizer.page.screenshot({
          path: `${out}/duplicate-${width}-${language}-${theme}.png`,
          fullPage: true,
        });
        report.matrix.push({ width, language, theme });
      }
  if (process.env.BUDOGRAPH_DUPLICATE_SKIP_MATRIX !== "1")
    checked(
      "BG/EN and Light/Dark matrix at seven widths preserves source wrapping, no overflow and reachable 44px controls",
    );
  if (process.env.BUDOGRAPH_DUPLICATE_SKIP_MATRIX !== "1")
    assert.equal(report.matrix.length, 28);
  await organizer.page.setViewportSize({ width: 390, height: 640 });
  await organizer.page.evaluate(() =>
    localStorage.setItem(
      "budograph.preferences.v1",
      JSON.stringify({ version: 1, language: "en", theme: "light" }),
    ),
  );
  await form(organizer.page, source);
  await organizer.page.evaluate(() => {
    document.documentElement.style.fontSize = "125%";
  });
  assert.equal(
    await organizer.page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await organizer.page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  checked("Short narrow viewport and 125% text expansion remain usable");
  await pool.query(
    "UPDATE public.event SET archived_at=clock_timestamp(),version=version+1 WHERE id=$1 AND owner_user_id=$2",
    [source.id, organizer.user.id],
  );
  const archiveBefore = await sourceSnapshot(source.id);
  await organizer.page.goto(origin + "/events");
  await organizer.page
    .getByRole("button", { name: "Archived", exact: true })
    .click();
  const archivedRow = organizer.page
    .locator(".event-management__row")
    .filter({ hasText: sourceName });
  await archivedRow.waitFor();
  await archivedRow
    .getByRole("link", { name: `Duplicate event: ${sourceName}`, exact: true })
    .click();
  await organizer.page.locator("#event-name").waitFor();
  await fill(organizer.page, {
    ...basics,
    name: basics.name + " from archive",
  });
  const archiveResponse = organizer.page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === `/api/events/${source.id}/duplicate`,
  );
  await organizer.page.locator(".event-form button[type=submit]").click();
  const archiveEvent = (await (await archiveResponse).json()).event;
  assert.equal(archiveEvent.archived, false);
  await integrity(archiveEvent, organizer.user.id);
  assert.deepEqual(await sourceSnapshot(source.id), archiveBefore);
  checked(
    "Owned explicitly labelled archived fixture permits Organizer metadata-only copy and preserves the archived source",
  );
  await organizer.page.goto(origin + `/events/${created.id}/history`);
  await organizer.page.locator("[data-history-id]").first().waitFor();
  assert.equal(await organizer.page.locator("[data-history-id]").count(), 1);
  await member.page.goto(origin + `/events/${source.id}/history`);
  await member.page.locator("[data-history-id]").first().waitFor();
  checked(
    "Created Event history contains its single fresh creation; source Member retains authorized archived history access",
  );
  assert.equal(report.errors, 0);
} catch (error) {
  report.failureAt =
    error instanceof Error
      ? error.stack?.match(/verify-event-duplication-ui\.mjs:\d+:\d+/)?.[0]
      : null;
  report.failure =
    "Duplicate browser verification incomplete; private diagnostics omitted.";
  throw new Error(report.failure);
} finally {
  let cleanup = true;
  for (const context of contexts) {
    try {
      const result = await context.request.post(origin + "/api/auth/sign-out", {
        headers: { origin },
        data: {},
      });
      if (result.status() !== 200) cleanup = false;
    } catch {
      cleanup = false;
    }
    try {
      await context.close();
    } catch {
      cleanup = false;
    }
  }
  try {
    report.sessionCleanupVerified =
      cleanup &&
      JSON.stringify(await sessionIds()) === JSON.stringify(originalSessions);
  } catch {
    report.sessionCleanupVerified = false;
  }
  const closed = await Promise.allSettled([browser.close(), app?.close()]);
  report.resourcesClosed = closed.every((r) => r.status === "fulfilled");
  await pool.end();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  assert.equal(report.sessionCleanupVerified, true);
  assert.equal(report.resourcesClosed, true);
}
