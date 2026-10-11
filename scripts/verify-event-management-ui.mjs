// Synthetic transport scenarios are explicitly labelled. The default run also
// verifies real controlled sessions and membership-scoped APIs, read-only.
// Credentials/cookies remain in memory; no auth artifacts are saved.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = "http://127.0.0.1:5173";
const out = "tmp/event-management-stage1/browser";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const report = {
  browser: browser.version(),
  fixtureChecks: [],
  realChecks: [],
  matrix: [],
  errors: 0,
};
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event = (n, role, archived = false) => ({
  id: id(n),
  name:
    n === 1
      ? "Дълго име на събитие Long event name ".repeat(5).slice(0, 200).trim()
      : `Synthetic Event ${n}`,
  startDate: "2026-10-09",
  endDate: "2026-10-10",
  timezone: "Europe/Sofia",
  archived,
  membership: { id: id(n + 10), accessRole: role },
  version: 1,
  createdAt: "2026-10-09T00:00:00Z",
  updatedAt: "2026-10-09T00:00:00Z",
});
const events = [
  event(1, "ORGANIZER"),
  event(2, "MEMBER"),
  event(3, "ORGANIZER", true),
];
const user = {
  id: "SYNTHETIC_MANAGEMENT_USER",
  name: "Synthetic user",
  email: "synthetic@example.invalid",
};
const checked = (label) => {
  report.fixtureChecks.push(label);
  console.log(`PASS fixture: ${label}`);
};
async function fixture(width = 1440, language = "en", theme = "light") {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    ({ language, theme }) => {
      if (location.href === "about:blank") return;
      if (!localStorage.getItem("budograph.preferences.v1"))
        localStorage.setItem(
          "budograph.preferences.v1",
          JSON.stringify({ version: 1, language, theme }),
        );
    },
    { language, theme },
  );
  const page = await context.newPage();
  page.on("pageerror", () => report.errors++);
  let current = events,
    failed = false,
    taskFailure = false,
    anonymous = false,
    held = null;
  let tasks = 0;
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: anonymous ? 401 : 200,
      json: { user: anonymous ? null : user },
    }),
  );
  await page.route("**/api/auth/sign-in/email", (route) => {
    anonymous = false;
    return route.fulfill({ json: { status: true } });
  });
  await page.route("**/api/events", async (route) => {
    assert.equal(
      route.request().method(),
      "GET",
      "Management listing must not write",
    );
    if (held) await held;
    await route.fulfill({
      status: failed ? 503 : 200,
      json: failed
        ? { error: "SYNTHETIC_PRIVATE_DETAIL" }
        : { events: current },
    });
  });
  await page.route("**/api/events/*/tasks", (route) => {
    tasks++;
    return route.fulfill({
      status: taskFailure ? 503 : 200,
      json: taskFailure ? {} : { tasks: [], members: [] },
    });
  });
  await page.route("**/api/events/*/members", (route) =>
    route.fulfill({ json: { members: [] } }),
  );
  await page.route("**/api/events/*/changes", (route) =>
    route.fulfill({ json: { changes: [] } }),
  );
  await page.route("**/api/events/*/notifications", (route) =>
    route.fulfill({ json: { notifications: [], unreadCount: 0 } }),
  );
  await page.route("**/api/events/*/invitations", (route) =>
    route.fulfill({ json: { invitations: [] } }),
  );
  return {
    page,
    context,
    tasks: () => tasks,
    set: (values) => {
      if ("events" in values) current = values.events;
      if ("failed" in values) failed = values.failed;
      if ("taskFailure" in values) taskFailure = values.taskFailure;
      if ("anonymous" in values) anonymous = values.anonymous;
      if ("held" in values) held = values.held;
    },
  };
}
async function ready(page) {
  await page.locator('.page--events[aria-busy="false"]').waitFor();
  assert.equal(new URL(page.url()).pathname, "/events");
}
async function geometry(page) {
  await page.evaluate(async () => document.fonts.ready);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.equal(
    await page
      .locator(
        '.sidebar__nav [aria-current="page"],.mobile-nav [aria-current="page"]',
      )
      .count(),
    0,
  );
  assert.equal(await page.locator(".mobile-nav a").count(), 5);
  const manage = page.locator('.event-switcher:visible a[href="/events"]');
  assert.equal(await manage.count(), 1);
  const measured = await manage.evaluate((link) => {
    const box = link.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(link);
    const lines = [...range.getClientRects()].filter((r) => r.width > 0);
    return {
      width: box.width,
      height: box.height,
      lines: lines.length,
      inBounds: box.left >= 0 && box.right <= innerWidth,
    };
  });
  assert.ok(measured.width >= 44 && measured.height >= 44);
  assert.equal(measured.lines, 1);
  assert.equal(measured.inBounds, true);
  assert.equal(
    await page
      .locator(
        '.event-switcher a[href="/events/new"],.event-switcher a[href$="/edit"]',
      )
      .count(),
    0,
  );
  if (await page.locator(".event-switcher--mobile").isVisible()) {
    assert.equal(
      await page.locator(".event-switcher--mobile").evaluate((switcher) => {
        const select = switcher.querySelector("select").getBoundingClientRect();
        const action = switcher.querySelector("a").getBoundingClientRect();
        return (
          select.width > 0 &&
          select.right <= action.left &&
          action.right <= innerWidth
        );
      }),
      true,
    );
  }
  await page.keyboard.press("Tab");
  await manage.focus();
  assert.equal(
    await manage.evaluate((link) => getComputedStyle(link).outlineStyle),
    "solid",
  );
  return measured;
}
try {
  for (const width of [320, 360, 390, 768, 960, 1024, 1440])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"]) {
        const f = await fixture(width, language, theme);
        try {
          await f.page.goto(origin + "/events");
          await ready(f.page);
          assert.equal(
            await f.page.locator(".event-management__row").count(),
            2,
          );
          assert.equal(
            await f.page
              .locator('.event-management__row a[href$="/edit"]')
              .count(),
            1,
          );
          assert.equal(f.tasks(), 0);
          const measured = await geometry(f.page);
          for (const control of await f.page
            .locator(".page--events a,.page--events button,.page--events input")
            .all()) {
            await control.focus();
            assert.equal(
              await control.evaluate((element) => {
                const box = element.getBoundingClientRect();
                const nav = document
                  .querySelector(".mobile-nav")
                  .getBoundingClientRect();
                const header = document
                  .querySelector(".app-header")
                  .getBoundingClientRect();
                const bottom = nav.height > 0 ? nav.top : innerHeight;
                return (
                  box.top >= header.bottom &&
                  box.bottom <= bottom &&
                  element.contains(
                    document.elementFromPoint(
                      box.left + box.width / 2,
                      box.top + box.height / 2,
                    ),
                  )
                );
              }),
              true,
              "Every focused listing control must be visible above the fixed mobile navigation",
            );
          }
          await f.page.evaluate(() => {
            document.activeElement?.blur();
            scrollTo(0, 0);
          });
          await f.page.screenshot({
            path: `${out}/events-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
          await f.page
            .getByRole("button", {
              name: language === "bg" ? "Архивирани" : "Archived",
              exact: true,
            })
            .click();
          assert.equal(
            await f.page.locator(".event-management__row").count(),
            1,
          );
          assert.equal(
            await f.page
              .locator('.event-management__row a[href$="/edit"]')
              .count(),
            0,
          );
          assert.equal(
            await f.page
              .locator(`a[href="/events/${id(3)}/dashboard"]`)
              .count(),
            1,
          );
          assert.equal(
            await f.page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          await f.page.locator("#event-search").fill("NO MATCH");
          await f.page.locator(".empty-state").waitFor();
          report.matrix.push({
            width,
            language,
            theme,
            synthetic: true,
            manageTarget: measured,
          });
        } finally {
          await f.context.close();
        }
      }
  checked(
    "28 BG/EN Light/Dark width cases: long names, status filters, permissions, search, focus, touch size and no overflow",
  );
  const f = await fixture();
  try {
    await f.page.goto(origin + "/events");
    await ready(f.page);
    await f.page.locator("#event-search").fill("  SYNTHETIC EVENT 2 ");
    assert.equal(await f.page.locator(".event-management__row").count(), 1);
    assert.equal(
      await f.page.locator('.event-management__row a[href$="/edit"]').count(),
      0,
    );
    await f.page.locator("#event-search").fill("");
    await f.page
      .locator(`.event-management__row a[href="/events/${id(1)}/edit"]`)
      .click();
    await f.page.locator("#event-name").waitFor();
    await f.page.goBack();
    await ready(f.page);
    await f.page.goForward();
    await f.page.locator("#event-name").waitFor();
    await f.page.goBack();
    await ready(f.page);
    await f.page.reload();
    await ready(f.page);
    await f.page.locator('.page-header a[href="/events/new"]').click();
    await f.page.locator("#event-name").waitFor();
    await f.page.locator('.event-switcher:visible a[href="/events"]').click();
    await ready(f.page);
    checked(
      "strict global navigation, direct refresh, Create/Edit compatibility and Back/Forward",
    );
    await f.page.goto(origin + `/events/${id(1)}/tasks?task=${id(100)}`);
    await f.page.locator(".page--tasks").waitFor();
    await f.page.locator("#event-switcher").selectOption(id(2));
    await f.page.waitForURL(origin + `/events/${id(2)}/tasks`);
    assert.equal(new URL(f.page.url()).search, "");
    await f.page.locator('.event-switcher:visible a[href="/events"]').click();
    await ready(f.page);
    await f.page.locator("#event-switcher").selectOption(id(1));
    await f.page.waitForURL(origin + `/events/${id(1)}/dashboard`);
    checked(
      "switching clears Task detail and global management selection opens the chosen Event Dashboard",
    );
    f.set({ taskFailure: true });
    await f.page.reload();
    await f.page.getByRole("alert").waitFor();
    await f.page.locator('.event-switcher:visible a[href="/events"]').click();
    await ready(f.page);
    assert.equal(await f.page.locator(".event-management__row").count(), 2);
    checked("management remains usable after Task workspace failure");
    f.set({ events: [] });
    await f.page.goto(origin + "/");
    await ready(f.page);
    assert.equal(await f.page.locator(".empty-state").count(), 1);
    assert.equal(
      await f.page.locator('.page-header a[href="/events/new"]').count(),
      1,
    );
    await geometry(f.page);
    checked(
      "zero-Event identity lands on global management with Create and Manage available",
    );
    f.set({ events: [events[2]], taskFailure: false });
    await f.page.goto(origin + "/");
    await ready(f.page);
    await f.page.getByRole("button", { name: "Archived", exact: true }).click();
    await f.page.locator(`a[href="/events/${id(3)}/dashboard"]`).click();
    await f.page.locator("#event-overview-title").waitFor();
    assert.equal(new URL(f.page.url()).pathname, `/events/${id(3)}/dashboard`);
    checked(
      "no active Events lead to management; explicit archived workspace stays readable",
    );
    f.set({ events, taskFailure: false });
    await f.page.goto(origin + `/events/${id(999)}/dashboard`);
    await f.page.getByRole("alert").waitFor();
    assert.equal(
      new URL(f.page.url()).pathname,
      `/events/${id(999)}/dashboard`,
    );
    assert.equal(await f.page.locator("#event-overview-title").count(), 0);
    checked(
      "inaccessible explicit ID never silently substitutes another Event",
    );
    f.set({ failed: true });
    await f.page.goto(origin + "/events");
    await ready(f.page);
    await f.page.getByRole("alert").waitFor();
    assert.equal(await f.page.locator(".event-management__row").count(), 0);
    assert.doesNotMatch(
      await f.page.locator(".app-main").innerText(),
      /SYNTHETIC_PRIVATE_DETAIL/,
    );
    f.set({ failed: false });
    await f.page
      .getByRole("button", { name: "Try again", exact: true })
      .click();
    await ready(f.page);
    assert.equal(await f.page.locator(".event-management__row").count(), 2);
    checked(
      "list failure hides stale results/private details and explicit retry recovers",
    );
    let release;
    f.set({
      held: new Promise((resolve) => {
        release = resolve;
      }),
    });
    await f.page.goto(origin + "/events");
    await f.page.locator('.page--events[aria-busy="true"]').waitFor();
    assert.equal(await f.page.locator(".event-management__row").count(), 0);
    await f.page.screenshot({ path: `${out}/loading-en.png` });
    f.set({ held: null });
    release();
    await ready(f.page);
    checked(
      "loading state has no stale Event rows and leaves Create/Manage reachable",
    );
    f.set({ anonymous: true });
    await f.page.goto(origin + "/events");
    await f.page.locator("#login-email").waitFor();
    assert.equal(new URL(f.page.url()).searchParams.get("returnTo"), "/events");
    await f.page.locator("#login-email").fill("synthetic@example.invalid");
    await f.page.locator("#login-password").fill("Synthetic test password");
    await f.page.locator("button[type=submit]").click();
    await ready(f.page);
    checked("anonymous direct management URL returns through login to /events");
  } finally {
    await f.context.close();
  }
  if (process.env.BUDOGRAPH_EVENT_MANAGEMENT_FIXTURES_ONLY !== "1") {
    for (const role of ["ORGANIZER", "MEMBER"]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      try {
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
        await ready(page);
        const authorized = await page.evaluate(
          async () => (await fetch("/api/events").then((r) => r.json())).events,
        );
        assert.equal(
          await page.locator(".event-management__row").count(),
          authorized.filter((e) => !e.archived).length,
        );
        assert.equal(
          await page.locator('.event-management__row a[href$="/edit"]').count(),
          authorized.filter(
            (e) => !e.archived && e.membership.accessRole === "ORGANIZER",
          ).length,
        );
        report.realChecks.push(
          `${role}: real session and exact membership-scoped listing/capabilities`,
        );
      } finally {
        await context.close();
      }
    }
  }
  assert.equal(report.errors, 0);
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
