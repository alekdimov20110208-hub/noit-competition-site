// Synthetic transport only: all /api requests are intercepted, including auth.
// Never signs in, writes records, or connects a test to the shared database.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createI18n } from "../src/i18n/createI18n.ts";
import { AIKIDO_SEMINAR_STARTER as template } from "../src/domain/eventTemplates.ts";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = process.env.BUDOGRAPH_BASE_URL ?? "http://127.0.0.1:5173";
const out = process.env.BUDOGRAPH_EVIDENCE_DIR ?? "tmp/templates-t1/browser";
mkdirSync(out, { recursive: true });
const report = {
  synthetic: true,
  cases: [],
  writeAttempts: [],
  unexpectedRequests: [],
  pageErrors: [],
};
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event = {
  id: id(1),
  name: "SYNTHETIC — International Aikido seminar",
  startDate: "2026-11-20",
  endDate: "2026-11-22",
  timezone: "Europe/Sofia",
  archived: false,
  version: 1,
  membership: { id: id(2), accessRole: "ORGANIZER" },
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
async function fixture({
  width = 1440,
  language = "en",
  theme = "light",
  events = [event],
  status = 200,
  authenticated = true,
  hold = null,
} = {}) {
  const controls = { events, status, hold };
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ language, theme }) => {
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language, theme }),
      );
    },
    { language, theme },
  );
  await context.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      report.writeAttempts.push({ method: request.method(), path });
      return route.abort();
    }
    if (path === "/api/me")
      return route.fulfill({
        status: authenticated ? 200 : 401,
        json: authenticated
          ? {
              user: {
                id: id(2),
                name: "Synthetic T1 user",
                email: "synthetic@example.invalid",
              },
            }
          : {},
      });
    if (path === "/api/events") {
      if (controls.hold) await controls.hold;
      return route.fulfill({
        status: controls.status,
        json: controls.status === 200 ? { events: controls.events } : {},
      });
    }
    for (const [suffix, json] of [
      ["tasks", { tasks: [], members: [] }],
      ["members", { members: [] }],
      ["changes", { changes: [] }],
      ["notifications", { notifications: [], unreadCount: 0 }],
      ["invitations", { invitations: [] }],
    ])
      if (new RegExp(`^/api/events/[^/]+/${suffix}$`).test(path))
        return route.fulfill({ json });
    report.unexpectedRequests.push(path);
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  return { context, page, controls, i18n: createI18n(language) };
}
const root = (page) => page.locator(".page--templates-t1");
async function ready(page, i18n) {
  await root(page)
    .getByRole("heading", { name: i18n.t(template.titleKey), exact: true })
    .waitFor();
  await page.locator(".templates-t1__event h2").waitFor();
}
async function countSelected(page, count) {
  assert.equal(
    await root(page).locator('input[type="checkbox"]:checked').count(),
    count,
  );
}
async function layout(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "No horizontal overflow",
  );
  assert.equal(await root(page).locator('input[type="checkbox"]').count(), 4);
  const labels = await root(page)
    .locator(".templates-t1__choice")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  assert.ok(
    labels.every((height) => height >= 44),
    "44px label touch targets",
  );
  assert.equal(
    await root(page)
      .getByRole("button", { name: /apply|прилагане/i })
      .count(),
    0,
  );
}
try {
  for (const width of [1440, 1024, 768, 390, 360, 320])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"]) {
        const { context, page, i18n } = await fixture({
          width,
          language,
          theme,
        });
        try {
          await page.goto(`${origin}/events/${event.id}/templates`);
          await ready(page, i18n);
          await countSelected(page, 4);
          const deadlines = await root(page)
            .locator(".templates-t1__deadline strong")
            .allTextContents();
          assert.deepEqual(
            deadlines,
            [
              ["2026-11-13", null],
              ["2026-11-19", null],
              ["2026-11-19", "15:00"],
              ["2026-11-20", "08:30"],
            ].map(([date, time]) => i18n.formatTaskDeadline(date, time)),
          );
          await root(page)
            .getByRole("checkbox", {
              name: i18n.t(template.items[1].titleKey),
              exact: true,
            })
            .press("Space");
          await countSelected(page, 3);
          assert.ok(
            (
              await root(page).locator(".templates-t1__toolbar").innerText()
            ).includes(
              i18n.t("templates.t1.selected", { selected: 3, total: 4 }),
            ),
          );
          await root(page)
            .getByRole("button", {
              name: i18n.t("templates.t1.none"),
              exact: true,
            })
            .click();
          await countSelected(page, 0);
          assert.equal(
            await root(page)
              .getByText(i18n.t("templates.t1.empty"), { exact: true })
              .isVisible(),
            true,
          );
          await root(page)
            .getByRole("button", {
              name: i18n.t("templates.t1.all"),
              exact: true,
            })
            .click();
          await countSelected(page, 4);
          await layout(page);
          await page.evaluate(async () => {
            await document.fonts.ready;
            document.activeElement?.blur();
            window.scrollTo({ top: 0, behavior: "instant" });
          });
          await page.screenshot({
            path: `${out}/templates-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
          report.cases.push({
            name: "selection-dates-layout-keyboard",
            width,
            language,
            theme,
            status: "PASS",
          });
        } finally {
          await context.close();
        }
      }
  for (const [name, variant, message] of [
    [
      "member",
      { ...event, membership: { ...event.membership, accessRole: "MEMBER" } },
      "templates.t2.member",
    ],
    [
      "archived-organizer",
      { ...event, archived: true },
      "templates.t1.archived",
    ],
    [
      "archived-member",
      {
        ...event,
        archived: true,
        membership: { ...event.membership, accessRole: "MEMBER" },
      },
      "templates.t1.archived",
    ],
  ]) {
    const { context, page, i18n } = await fixture({ events: [variant] });
    try {
      await page.goto(`${origin}/events/${event.id}/templates`);
      await ready(page, i18n);
      assert.equal(
        await root(page)
          .getByText(i18n.t(message), { exact: true })
          .isVisible(),
        true,
      );
      await root(page).getByRole("checkbox").first().press("Space");
      await countSelected(page, 3);
      report.cases.push({ name, status: "PASS" });
    } finally {
      await context.close();
    }
  }
  for (const [name, events, status, path, message] of [
    ["no-events", [], 200, "/templates", "templates.t1.noEvent"],
    [
      "inaccessible-scope",
      [],
      200,
      `/events/${id(9)}/templates`,
      "templates.t1.denied",
    ],
    [
      "forbidden",
      [event],
      403,
      `/events/${event.id}/templates`,
      "templates.t1.denied",
    ],
    [
      "unavailable-retry",
      [event],
      503,
      `/events/${event.id}/templates`,
      "templates.t1.error",
    ],
  ]) {
    const { context, page, i18n, controls } = await fixture({ events, status });
    try {
      await page.goto(`${origin}${path}`);
      await root(page).getByText(i18n.t(message), { exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, path);
      assert.equal(await page.locator(".templates-t1__event h2").count(), 0);
      assert.ok(
        (
          await root(page)
            .locator(".templates-t1__deadline strong")
            .allTextContents()
        ).every((text) => text === i18n.t("templates.t1.needsEvent")),
      );
      await root(page).getByRole("checkbox").first().press("Space");
      await countSelected(page, 3);
      if (status === 503) {
        controls.status = 200;
        await root(page)
          .getByRole("button", {
            name: i18n.t("templates.t1.retry"),
            exact: true,
          })
          .click();
        await ready(page, i18n);
        await countSelected(page, 3);
      }
      report.cases.push({ name, status: "PASS" });
    } finally {
      await context.close();
    }
  }
  {
    let release;
    const hold = new Promise((resolve) => {
      release = resolve;
    });
    const { context, page, i18n } = await fixture({ hold });
    try {
      await page.goto(`${origin}/events/${event.id}/templates`);
      await root(page)
        .getByText(i18n.t("templates.t1.loading"), { exact: true })
        .waitFor();
      assert.equal(await page.locator(".templates-t1__event h2").count(), 0);
      release();
      await ready(page, i18n);
      report.cases.push({
        name: "loading-before-authorized-dates",
        status: "PASS",
      });
    } finally {
      release();
      await context.close();
    }
  }
  {
    const second = {
      ...event,
      id: id(3),
      name: "SYNTHETIC — Second Event",
      startDate: "2027-01-01",
      endDate: "2027-01-03",
      timezone: "America/New_York",
    };
    const { context, page, i18n, controls } = await fixture({
      events: [event, second],
    });
    let release;
    try {
      await page.goto(`${origin}/templates`);
      await ready(page, i18n);
      assert.equal(
        new URL(page.url()).pathname,
        `/events/${event.id}/templates`,
      );
      await root(page).getByRole("checkbox").first().press("Space");
      await page
        .getByRole("button", { name: "Use Bulgarian", exact: true })
        .click();
      await countSelected(page, 3);
      assert.equal(await page.locator("html").getAttribute("lang"), "bg");
      await page
        .getByRole("button", {
          name: "Използване на английски език",
          exact: true,
        })
        .click();
      controls.hold = new Promise((resolve) => {
        release = resolve;
      });
      await page.locator("#event-switcher").selectOption(second.id);
      await root(page)
        .getByText(i18n.t("templates.t1.loading"), { exact: true })
        .waitFor();
      assert.equal(await page.locator(".templates-t1__event h2").count(), 0);
      assert.equal(
        (await root(page).innerText()).includes("13 Nov 2026"),
        false,
      );
      release();
      controls.hold = null;
      await page
        .locator(".templates-t1__event h2")
        .getByText(second.name, { exact: true })
        .waitFor();
      await countSelected(page, 4);
      assert.equal(
        await root(page)
          .locator(".templates-t1__deadline strong")
          .first()
          .innerText(),
        i18n.formatDate("2026-12-25"),
      );
      await root(page).getByRole("checkbox").first().press("Space");
      await root(page)
        .getByRole("button", {
          name: i18n.t("templates.t1.manage"),
          exact: true,
        })
        .click();
      await page.locator(".page--events").waitFor();
      await page
        .locator(".sidebar__nav")
        .getByRole("link", { name: "Templates", exact: true })
        .click();
      await ready(page, i18n);
      await countSelected(page, 4);
      report.cases.push({
        name: "routing-language-switch-reset-event-switch-no-stale-dates",
        status: "PASS",
      });
    } finally {
      release?.();
      await context.close();
    }
  }
  {
    const { context, page } = await fixture({ authenticated: false });
    try {
      await page.goto(`${origin}/templates`);
      await page.locator('input[type="password"]').waitFor();
      assert.equal(await root(page).count(), 0);
      report.cases.push({
        name: "unauthenticated-catalog-hidden",
        status: "PASS",
      });
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(report.writeAttempts, []);
  assert.deepEqual(report.unexpectedRequests, []);
  assert.deepEqual(report.pageErrors, []);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.failure = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({ ...report, cases: report.cases.length }, null, 2),
  );
}
