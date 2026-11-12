// T5 browser regression: real frontend and Fastify template routes/services.
// Synthetic authentication and the existing transactional SQL double only.
// No PostgreSQL, external APIs, accounts or existing Event data are touched.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";
import { createApp } from "../server/src/app.ts";
import { createTemplateApplicationService } from "../server/src/templates/service.ts";
import { curatedCatalogResponse } from "../server/src/templates/curated.ts";
import { eventDto } from "../server/src/events/model.ts";
import { taskDto } from "../server/src/tasks/model.ts";
import {
  templateFixture,
  eventId,
  actorId,
  user,
} from "../server/tests/helpers/template-fixture.ts";
import { AIKIDO_SEMINAR_STARTER } from "../src/domain/eventTemplates.ts";
import { createI18n } from "../src/i18n/createI18n.ts";
import { filterCuratedTemplates } from "../src/domain/curatedTemplates.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(root, "tmp/templates-t5/browser");
const temp = resolve(root, "tmp/templates-t5/os-temp");
for (const path of [out, temp]) {
  assert.ok(
    !relative(root, path).startsWith("..") && !isAbsolute(relative(root, path)),
  );
  mkdirSync(path, { recursive: true });
}
process.env.TEMP = temp;
process.env.TMP = temp;
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const host = createApp({
  frontendRoot: resolve(root, "dist"),
  checkDatabase: async () => {},
});
const origin = await host.listen({ host: "127.0.0.1", port: 0 });
const report = {
  syntheticAuthentication: true,
  transactionalSqlDouble: true,
  realDatabaseVerified: false,
  cases: [],
  unexpectedRequests: [],
  pageErrors: [],
};
const catalog = curatedCatalogResponse();
assert.equal(catalog.templates.length + 1, 25);
assert.equal(
  catalog.templates.reduce(
    (sum, entry) => sum + entry.itemCount,
    AIKIDO_SEMINAR_STARTER.items.length,
  ),
  213,
);
let browser;
async function fixture({
  width = 390,
  language = "bg",
  theme = "dark",
  mode = "normal",
} = {}) {
  const f = templateFixture();
  f.options.role = mode === "member" ? "MEMBER" : "ORGANIZER";
  if (mode === "archived")
    f.store.event.archived_at = new Date("2026-11-12T00:00:00Z");
  const app = createApp({
    checkDatabase: async () => {},
    templates: createTemplateApplicationService(f.pool),
    authentication: {
      baseURL: origin,
      taskMutationOrigins: [origin],
      auth: {
        handler: async () => new Response(),
        api: { getSession: async () => ({ user: { ...user, active: true } }) },
      },
    },
  });
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
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
  const controls = { retry: false, catalogReads: 0, preview: [], apply: [] };
  let releaseCatalog;
  const catalogGate = new Promise((resolve) => {
    releaseCatalog = resolve;
  });
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (url.origin !== origin) {
      report.unexpectedRequests.push({
        method: request.method(),
        path: request.url(),
      });
      return route.abort();
    }
    if (!path.startsWith("/api/")) return route.continue();
    if (
      request.method() === "POST" &&
      new RegExp(`^/api/events/${eventId}/templates/(preview|apply)$`).test(
        path,
      )
    ) {
      (path.endsWith("/apply") ? controls.apply : controls.preview).push(
        request.postDataJSON(),
      );
    } else if (request.method() !== "GET") {
      report.unexpectedRequests.push({ method: request.method(), path });
      return route.abort();
    }
    if (path === "/api/templates/curated") {
      controls.catalogReads++;
      if (mode === "loading") await catalogGate;
      if (mode === "error" && !controls.retry)
        return route.fulfill({ status: 503, json: {} });
      if (mode === "invalid")
        return route.fulfill({ json: { catalogVersion: 1, templates: [{}] } });
      if (mode === "empty")
        return route.fulfill({ json: { catalogVersion: 1, templates: [] } });
    }
    if (
      path === "/api/templates/curated" ||
      /\/templates\/(preview|apply)$/.test(path)
    ) {
      const response = await app.inject({
        method: request.method(),
        url: path,
        headers: {
          origin,
          ...(request.headers()["idempotency-key"]
            ? { "idempotency-key": request.headers()["idempotency-key"] }
            : {}),
        },
        ...(request.method() === "POST"
          ? { payload: request.postDataJSON() }
          : {}),
      });
      return route.fulfill({
        status: response.statusCode,
        json: response.json(),
      });
    }
    if (path === "/api/me") return route.fulfill({ json: { user } });
    if (path === "/api/registration")
      return route.fulfill({ json: { enabled: false } });
    if (path === "/api/events")
      return route.fulfill({
        json: {
          events:
            mode === "noEvent"
              ? []
              : [
                  eventDto(f.store.event, {
                    id: actorId,
                    accessRole: f.options.role,
                  }),
                ],
        },
      });
    if (path === `/api/events/${eventId}/tasks`)
      return route.fulfill({
        json: { tasks: f.store.tasks.map(taskDto), members: [] },
      });
    for (const [suffix, json] of [
      ["members", { members: [] }],
      ["changes", { changes: [] }],
      ["notifications", { notifications: [], unreadCount: 0 }],
      ["invitations", { invitations: [] }],
    ]) {
      if (path === `/api/events/${eventId}/${suffix}`)
        return route.fulfill({ json });
    }
    report.unexpectedRequests.push({ method: request.method(), path });
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  const i18n = createI18n(language);
  const button = (key) =>
    page.getByRole("button", { name: i18n.t(key), exact: true });
  await page.goto(
    `${origin}${mode === "noEvent" ? "/templates" : `/events/${eventId}/templates`}`,
  );
  await button("templates.t4.library").click();
  return { f, app, context, page, controls, releaseCatalog, i18n, button };
}
async function ready(h) {
  await h.page.locator(".curated-library__row").first().waitFor();
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Document must fit the viewport",
  );
  const overflow = await page.locator(".curated-library").evaluate((root) =>
    [...root.querySelectorAll("input, select, button, h3, dd")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width &&
          (r.left < -1 ||
            r.right > innerWidth + 1 ||
            el.scrollWidth > el.clientWidth + 1)
        );
      })
      .map((el) => el.outerHTML.slice(0, 160)),
  );
  assert.deepEqual(
    overflow,
    [],
    "Library content and controls must remain fully available",
  );
}
async function openFirst(h, activation = "keyboard") {
  const open = h.page.locator(".curated-library__row button").first();
  const id = await open.getAttribute("id");
  if (activation === "keyboard") {
    await open.focus();
    await h.page.keyboard.press("Enter");
  } else await open.click();
  const heading = h.page.locator(".templates-t1__intro h2");
  await heading.waitFor();
  assert.ok(
    await heading.evaluate((el) => el === document.activeElement),
    "Preview heading receives keyboard focus",
  );
  return id;
}
try {
  browser = await chromium.launch({
    headless: true,
    args: [`--log-file=${resolve(temp, "chromium.log")}`],
    ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
      ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
      : {}),
  });
  const cases = [];
  for (const width of [320, 390, 600, 768, 1024, 1440])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"])
        cases.push({ width, language, theme, mode: "normal" });
  for (const mode of [
    "member",
    "archived",
    "noEvent",
    "empty",
    "error",
    "invalid",
    "loading",
  ])
    cases.push({ width: 390, language: "bg", theme: "dark", mode });
  for (const config of cases.filter(
    (entry) =>
      !process.env.BUDOGRAPH_T5_MODE ||
      entry.mode === process.env.BUDOGRAPH_T5_MODE,
  )) {
    const h = await fixture(config),
      { page, button, i18n, controls } = h;
    try {
      if (config.mode === "loading") {
        await page
          .getByText(i18n.t("templates.t4.loading"), { exact: true })
          .waitFor();
        h.releaseCatalog();
      }
      if (config.mode === "error" || config.mode === "invalid") {
        await page
          .getByText(i18n.t("templates.t4.error"), { exact: true })
          .waitFor();
        if (config.mode === "invalid") continue;
        controls.retry = true;
        await button("templates.t1.retry").click();
      }
      if (config.mode === "empty") {
        await page
          .getByText(i18n.t("templates.t4.empty"), { exact: true })
          .waitFor();
        assert.equal(await page.locator(".curated-library__row").count(), 0);
        continue;
      }
      await ready(h);
      assert.equal(await page.locator(".curated-library__row").count(), 24);
      assert.equal(
        await page.locator("html").getAttribute("lang"),
        config.language,
      );
      assert.equal(
        await page.locator("html").getAttribute("data-theme"),
        config.theme,
      );
      for (let index = 0; index < catalog.templates.length; index++) {
        const entry = catalog.templates[index],
          row = page.locator(".curated-library__row").nth(index);
        assert.equal(
          await row.locator("h3").innerText(),
          entry.name[config.language],
        );
        assert.equal(
          await row.locator(".curated-library__count").innerText(),
          String(entry.itemCount),
        );
        assert.equal(
          await row.locator("dd").first().innerText(),
          i18n.t(`templates.t4.${entry.category}`),
        );
        assert.equal(
          await row.locator("button").getAttribute("aria-label"),
          `${i18n.t("templates.t4.open")}: ${entry.name[config.language]}`,
        );
      }
      await noOverflow(page);
      await page.screenshot({
        path: `${out}/library-${config.width}-${config.language}-${config.theme}-${config.mode}.png`,
        fullPage: true,
      });
      const search = page.getByRole("searchbox", {
        name: i18n.t("templates.t4.search"),
        exact: true,
      });
      const category = page.getByRole("combobox", {
        name: i18n.t("templates.t4.category"),
        exact: true,
      });
      const difficulty = page.getByRole("combobox", {
        name: i18n.t("templates.t4.difficulty"),
        exact: true,
      });
      assert.ok(await button("templates.t4.clear").isDisabled());
      await search.focus();
      await page.keyboard.press("Tab");
      assert.ok(await category.evaluate((el) => el === document.activeElement));
      await page.keyboard.press("Tab");
      assert.ok(
        await difficulty.evaluate((el) => el === document.activeElement),
      );
      await search.fill("no-template-matches-t5");
      await page
        .getByText(i18n.t("templates.t4.noResults"), { exact: true })
        .waitFor();
      await button("templates.t4.clear").click();
      assert.ok(await search.evaluate((el) => el === document.activeElement));
      await search.fill(config.language === "bg" ? "кантар" : "weigh-in");
      assert.equal(await page.locator(".curated-library__row").count(), 1);
      await button("templates.t4.clear").click();
      await category.selectOption("aikido");
      await difficulty.selectOption("beginner");
      const expected = filterCuratedTemplates(
        catalog.templates,
        "",
        "aikido",
        "beginner",
        config.language,
      );
      assert.equal(
        await page.locator(".curated-library__row").count(),
        expected.length,
      );
      const query = expected[0].name[config.language];
      await search.fill(query);
      const openerId = await openFirst(h);
      assert.equal(
        controls.apply.length,
        0,
        "Opening a template cannot apply it",
      );
      await noOverflow(page);
      await button("templates.t4.back").click();
      await ready(h);
      assert.equal(await category.inputValue(), "aikido");
      assert.equal(await difficulty.inputValue(), "beginner");
      assert.equal(await search.inputValue(), query);
      assert.ok(
        await page
          .locator(`[id='${openerId}']`)
          .evaluate((el) => el === document.activeElement),
        "Back restores the preview button's focus",
      );
      assert.equal(
        await page
          .locator(".curated-library__row[data-selected='true']")
          .count(),
        1,
      );
      await page
        .getByText(i18n.t("templates.t5.lastPreviewed"), { exact: true })
        .waitFor();
      if (
        config.language === "bg" &&
        config.theme === "dark" &&
        [390, 1440].includes(config.width)
      )
        await page.screenshot({
          path: `${out}/selected-${config.width}.png`,
          fullPage: false,
        });
      await button("templates.t4.clear").click();
      await ready(h);
      await openFirst(h, "pointer");
      const tasks = page.locator(".templates-t1__choice input"),
        total = await tasks.count();
      assert.equal(total, catalog.templates[0].itemCount);
      await tasks.first().uncheck();
      const panel = page.locator(".template-application");
      const reviewButton = panel.getByRole("button", {
        name: i18n.t("templates.t2.review"),
        exact: true,
      });
      if (config.mode === "noEvent") {
        assert.equal(await panel.count(), 0);
        assert.equal(controls.preview.length, 0);
        assert.equal(controls.apply.length, 0);
      } else {
        await reviewButton.click();
        await page.locator(".template-application__review h3").waitFor();
        assert.equal(controls.preview.at(-1).itemIds.length, total - 1);
        assert.ok(
          !controls.preview
            .at(-1)
            .itemIds.includes(catalog.templates[0].items[0].id),
        );
        assert.equal(
          controls.apply.length,
          0,
          "Reviewing cannot apply a template",
        );
        if (config.mode === "member" || config.mode === "archived") {
          assert.equal(await button("templates.t2.apply").count(), 0);
          await page
            .getByText(i18n.t("templates.t2.readOnly"), { exact: true })
            .waitFor();
        } else {
          assert.ok(await button("templates.t2.apply").isDisabled());
          await page
            .locator(".template-application__confirmation input")
            .check();
          assert.ok(await button("templates.t2.apply").isEnabled());
          await button("templates.t2.apply").click();
          await page
            .getByRole("heading", {
              name: i18n.t("templates.t2.accepted"),
              exact: true,
            })
            .waitFor();
          assert.equal(controls.apply.length, 1);
          assert.equal(controls.apply[0].confirmed, true);
          assert.equal(h.f.store.tasks.length, total - 1);
        }
      }
      assert.ok(
        controls.catalogReads <= 2,
        "Navigation and filters must not refetch the catalog",
      );
    } catch (error) {
      await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
      report.failure = { ...config, message: error.message };
      throw error;
    } finally {
      report.cases.push({
        ...config,
        status: report.failure ? "FAIL" : "PASS",
      });
      h.releaseCatalog();
      await h.context.close();
      await h.app.close();
    }
  }
  assert.deepEqual(report.unexpectedRequests, []);
  assert.deepEqual(report.pageErrors, []);
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser?.close();
  await host.close();
}
console.log(
  JSON.stringify({
    cases: report.cases.length,
    passed: report.cases.filter((entry) => entry.status === "PASS").length,
    unexpectedRequests: report.unexpectedRequests.length,
    pageErrors: report.pageErrors.length,
    syntheticAuthentication: true,
    transactionalSqlDouble: true,
    realDatabaseVerified: false,
  }),
);
