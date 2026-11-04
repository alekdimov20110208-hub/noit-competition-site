// All business records below are isolated synthetic browser fixtures only.
// Every API request is intercepted; no real authentication or database is used.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { calendarFixtureHost } from "./calendar-fixture-host.mjs";
import { createCalendarFixtureApi } from "./preview-calendar-c1a.mjs";
import {
  stamp,
  event,
  other,
  members,
  task,
  tasks,
} from "./calendar-fixtures.mjs";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const out = process.env.BUDOGRAPH_EVIDENCE_DIR ?? "tmp/calendar-c1a/browser";
mkdirSync(out, { recursive: true });
const report = {
  synthetic: true,
  databaseConnections: 0,
  cases: [],
  unexpectedRequests: [],
  mutations: [],
  pageErrors: [],
  consoleErrors: [],
  apiCases: [],
};
for (const role of ["ORGANIZER", "MEMBER", null]) {
  const app = createCalendarFixtureApi(role);
  try {
    const events = await app.inject({ url: "/api/events" });
    const tasksUrl = (id) => `/api/events/${id}/tasks`;
    const selected = await app.inject({ url: tasksUrl(event.id) });
    const foreign = await app.inject({ url: tasksUrl(other.id) });
    assert.equal(events.statusCode, role ? 200 : 401);
    assert.equal(selected.statusCode, role ? 200 : 401);
    assert.equal(
      foreign.statusCode,
      role === "ORGANIZER" ? 200 : role ? 404 : 401,
    );
    if (role) {
      assert.deepEqual(
        events
          .json()
          .events.map(({ id, membership }) => [id, membership.accessRole]),
        (role === "ORGANIZER" ? [event, other] : [event]).map(({ id }) => [
          id,
          role,
        ]),
      );
      assert.deepEqual(selected.json().tasks, tasks);
    }
    assert.equal(
      (await app.inject({ url: tasksUrl(event.id), method: "POST" }))
        .statusCode,
      405,
    );
    report.apiCases.push(role ?? "signed-out");
  } finally {
    await app.close();
  }
}
const { server, origin } = await calendarFixtureHost();
const browser = await chromium
  .launch({
    headless: true,
    ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
      ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
      : {}),
  })
  .catch(async (error) => {
    await server.close();
    throw error;
  });
async function setup({
  width = 390,
  language = "en",
  theme = "light",
  mode = "normal",
  timezoneId = "Europe/Sofia",
  clock = stamp,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
    timezoneId,
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ language, theme }) =>
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language, theme }),
      ),
    { language, theme },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("Failed to load resource")
    )
      report.consoleErrors.push(message.text());
  });
  await page.clock.setFixedTime(new Date(clock));
  let releaseLoading;
  const loading = new Promise((resolve) => {
    releaseLoading = resolve;
  });
  let attempts = 0;
  await context.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      report.mutations.push(`${request.method()} ${path}`);
      return route.fulfill({
        status: 405,
        json: { error: "READ_ONLY_FIXTURE" },
      });
    }
    const fulfill = (json) => route.fulfill({ json });
    if (path === "/api/registration") return fulfill({ enabled: false });
    if (path === "/api/me" && mode === "signedOut")
      return fulfill({ user: null });
    if (path === "/api/me")
      return fulfill({
        user: {
          id: "SYNTHETIC_CALENDAR_USER",
          name: "Synthetic Calendar",
          email: "calendar@example.invalid",
        },
      });
    if (path === "/api/events")
      return fulfill({
        events:
          mode === "noEvent"
            ? []
            : [
                {
                  ...event,
                  archived: mode === "archived",
                  membership: {
                    ...event.membership,
                    accessRole: mode === "member" ? "MEMBER" : "ORGANIZER",
                  },
                },
                other,
              ],
      });
    const match =
      /^\/api\/events\/([^/]+)\/(tasks|members|changes|notifications)$/.exec(
        path,
      );
    if (match && [event.id, other.id].includes(match[1])) {
      const [, eventId, resource] = match;
      if (resource === "tasks") {
        attempts++;
        if (mode === "loading") await loading;
        if (
          mode === "forbidden" ||
          mode === "not-found" ||
          (mode === "retry" && attempts === 1)
        )
          return route.fulfill({
            status:
              mode === "forbidden" ? 403 : mode === "not-found" ? 404 : 500,
            json: {
              error: {
                code: "FIXTURE_READ_ERROR",
                message: "Synthetic read error",
              },
            },
          });
        return fulfill({
          tasks:
            mode === "empty"
              ? []
              : mode === "invalid-deadline"
                ? [{ ...tasks[0], deadline: null }]
                : eventId === event.id
                  ? tasks
                  : [task(200, "SYNTHETIC Event B only", "2026-12-15")],
          members,
        });
      }
      if (resource === "members") return fulfill({ members });
      if (resource === "changes") return fulfill({ changes: [] });
      return fulfill({ notifications: [], unreadCount: 0 });
    }
    report.unexpectedRequests.push(path);
    return route.fulfill({
      status: 404,
      json: { error: "UNEXPECTED_FIXTURE_REQUEST" },
    });
  });
  await page.goto(
    mode === "noEvent"
      ? `${origin}/calendar`
      : `${origin}/events/${event.id}/calendar`,
  );
  const calendar = page.locator(".calendar-page");
  if (mode !== "signedOut") await calendar.waitFor();
  return { context, page, calendar, releaseLoading };
}
const run = async (name, options, check) => {
  const fixture = await setup(options);
  try {
    await check(fixture);
    report.cases.push({ name, ...options, pass: true });
    console.log(`PASS ${name} ${JSON.stringify(options)}`);
  } finally {
    fixture.releaseLoading();
    await fixture.context.close();
  }
};
try {
  for (const width of [320, 390, 768, 1440])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"]) {
        await run(
          "month-display",
          { width, language, theme },
          async ({ page, calendar }) => {
            await calendar.locator("table").waitFor();
            assert.equal(await calendar.locator("th").count(), 7);
            assert.equal(await calendar.locator("tbody > tr").count(), 5);
            assert.equal(
              await calendar.locator("tbody .calendar-page__date").count(),
              31,
            );
            const day = calendar
              .locator("td")
              .filter({ has: page.locator('time[datetime="2026-12-15"]') });
            assert.equal(await day.locator("button").count(), 3);
            assert.deepEqual(
              await calendar
                .locator('[data-event-day="true"] > time')
                .evaluateAll((days) => days.map((day) => day.dateTime)),
              ["2026-12-20", "2026-12-21"],
            );
            assert.match(
              await calendar.locator(".calendar-page__range").innerText(),
              language === "bg" ? /Дати на събитието/ : /Event dates/,
            );
            assert.equal(
              await day
                .getByText(
                  language === "bg" ? "Без зададен час" : "No time set",
                  { exact: true },
                )
                .count(),
              1,
            );
            assert.equal(
              await day.getByText("09:30", { exact: true }).count(),
              1,
            );
            assert.equal(
              await day.getByText("00:00", { exact: true }).count(),
              1,
            );
            assert.equal(
              await calendar
                .locator('[aria-current="date"]')
                .getAttribute("datetime"),
              "2026-12-15",
            );
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
              ),
              false,
            );
            await page.screenshot({
              path: `${out}/calendar-${width}-${language}-${theme}.png`,
              fullPage: true,
            });
            await calendar.locator('[role="region"]').focus();
            assert.equal(
              await calendar
                .locator('[role="region"]')
                .evaluate((el) => getComputedStyle(el).outlineStyle),
              "solid",
            );
            const taskButton = day.locator("button").last();
            await taskButton.focus();
            assert.equal(
              await taskButton.evaluate(
                (el) => getComputedStyle(el).outlineStyle,
              ),
              "solid",
            );
          },
        );
      }
  await run(
    "navigation-keyboard-task-return",
    {},
    async ({ page, calendar }) => {
      await calendar.locator("table").waitFor();
      await calendar
        .getByRole("button", { name: "Next month", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      assert.match(await calendar.locator("h2").innerText(), /January 2027/);
      const taskButton = calendar.getByRole("button", {
        name: /SYNTHETIC New year/,
      });
      await taskButton.focus();
      await page.keyboard.press("Enter");
      const drawer = page.getByRole("dialog", { name: "SYNTHETIC New year" });
      await drawer.waitFor();
      assert.equal(
        new URL(page.url()).pathname,
        `/events/${event.id}/calendar`,
      );
      assert.equal(await drawer.getByRole("button").count(), 1);
      assert.equal(await drawer.getByRole("combobox").count(), 0);
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "hidden" });
      assert.match(await calendar.locator("h2").innerText(), /January 2027/);
      assert.equal(
        await taskButton.evaluate((el) => el === document.activeElement),
        true,
      );
      await calendar
        .getByRole("button", { name: "Current month", exact: true })
        .click();
      assert.match(await calendar.locator("h2").innerText(), /December 2026/);
      await calendar
        .getByRole("button", { name: "Previous month", exact: true })
        .click();
      assert.match(await calendar.locator("h2").innerText(), /November 2026/);
      assert.match(await calendar.innerText(), /No Task deadlines this month/);
      await calendar
        .getByRole("button", { name: "Next month", exact: true })
        .click();
      for (let i = 0; i < 14; i++)
        await calendar
          .getByRole("button", { name: "Next month", exact: true })
          .click();
      assert.match(await calendar.locator("h2").innerText(), /February 2028/);
      assert.equal(
        await calendar.locator("tbody .calendar-page__date").count(),
        29,
      );
      assert.equal(
        await calendar
          .getByRole("button", { name: /SYNTHETIC Leap day/ })
          .count(),
        1,
      );
      await calendar
        .getByRole("button", { name: "Refresh calendar", exact: true })
        .click();
      await calendar.locator("table").waitFor();
      assert.match(await calendar.locator("h2").innerText(), /February 2028/);
    },
  );
  for (const mode of [
    "empty",
    "loading",
    "retry",
    "forbidden",
    "not-found",
    "invalid-deadline",
    "noEvent",
  ])
    await run(mode, { mode }, async ({ page, calendar, releaseLoading }) => {
      if (mode === "loading") {
        assert.equal(await calendar.getAttribute("aria-busy"), "true");
        assert.equal(await calendar.locator("table").count(), 0);
        releaseLoading();
        await calendar.locator("table").waitFor();
      } else if (mode === "empty") {
        await calendar.locator("table").waitFor();
        assert.match(
          await calendar.innerText(),
          /No Task deadlines this month/,
        );
        assert.equal(await calendar.locator("td button").count(), 0);
      } else if (mode === "noEvent") {
        await page.waitForURL("**/calendar");
        await page
          .getByRole("heading", { name: "No accessible event", exact: true })
          .waitFor();
        assert.equal(await page.locator(".calendar-page table").count(), 0);
      } else {
        await calendar.getByRole("alert").waitFor();
        assert.equal(await calendar.locator("table").count(), 0);
        if (mode === "retry") {
          await calendar
            .getByRole("button", { name: "Try again", exact: true })
            .click();
          await calendar.locator("table").waitFor();
        }
      }
    });
  await run("event-switch", {}, async ({ page, calendar }) => {
    await calendar.locator("table").waitFor();
    await page.locator("#mobile-event-switcher").selectOption(other.id);
    await page.waitForURL(`**/events/${other.id}/calendar`);
    await calendar
      .getByRole("button", { name: /SYNTHETIC Event B only/ })
      .waitFor();
    assert.equal(
      await calendar
        .getByRole("button", { name: /SYNTHETIC Date only/ })
        .count(),
      0,
    );
    assert.match(
      await calendar.locator(".calendar-page__range").innerText(),
      /SYNTHETIC Calendar Event B/,
    );
    assert.equal(await calendar.locator('[data-event-day="true"]').count(), 1);
    await calendar
      .getByRole("button", { name: "Next month", exact: true })
      .click();
    assert.deepEqual(
      await calendar
        .locator('[data-event-day="true"] > time')
        .evaluateAll((days) => days.map((day) => day.dateTime)),
      ["2027-01-01", "2027-01-02"],
    );
  });
  await run(
    "event-clock-differs-from-browser-clock",
    { timezoneId: "America/Los_Angeles", clock: "2027-01-01T00:30:00Z" },
    async ({ calendar }) => {
      await calendar.locator("table").waitFor();
      assert.match(await calendar.locator("h2").innerText(), /January 2027/);
      assert.equal(
        await calendar
          .locator('[aria-current="date"]')
          .getAttribute("datetime"),
        "2027-01-01",
      );
    },
  );
  for (const mode of ["normal", "member", "archived"])
    await run(mode, { mode }, async ({ calendar }) => {
      await calendar.locator("table").waitFor();
      assert.equal(await calendar.locator("td button").count(), 4);
      assert.equal(
        await calendar.locator("input,textarea,[draggable=true]").count(),
        0,
      );
      await calendar
        .getByRole("button", { name: /SYNTHETIC Date only/ })
        .click();
      const drawer = calendar.getByRole("dialog");
      assert.equal(await drawer.getByRole("button").count(), 1);
      assert.equal(await drawer.getByRole("combobox").count(), 0);
      await drawer.getByRole("button", { name: "Close task details" }).click();
    });
  await run("signedOut", { mode: "signedOut" }, async ({ page }) => {
    await page.waitForURL("**/login?returnTo=**");
    assert.equal(
      new URL(page.url()).searchParams.get("returnTo"),
      `/events/${event.id}/calendar`,
    );
    assert.equal(await page.locator(".calendar-page").count(), 0);
    assert.equal(await page.getByText("SYNTHETIC Date only").count(), 0);
  });
  assert.deepEqual(report.unexpectedRequests, []);
  assert.deepEqual(report.mutations, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  console.log(
    `Calendar C1-A: ${report.cases.length} browser cases and ${report.apiCases.length} Fastify role cases PASS. No UI mutations or unexpected API requests.`,
  );
} finally {
  await browser.close();
  await server.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
