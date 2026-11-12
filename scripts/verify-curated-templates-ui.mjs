// Real isolated PostgreSQL and Fastify services; synthetic authentication and
// intercepted API transport. No requests or writes reach development Supabase.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { templateIsolatedPool } from "../server/tests/helpers/template-isolated-db.ts";
import { createPostgresFixture } from "../server/tests/postgres-fixture.ts";
import { createApp } from "../server/src/app.ts";
import { createTemplateApplicationService } from "../server/src/templates/service.ts";
import { createPersonalTemplateService } from "../server/src/templates/library.ts";
import { createEventService } from "../server/src/events/service.ts";
import { createTaskService } from "../server/src/tasks/service.ts";
import { CURATED_TEMPLATES } from "../server/src/templates/curated.ts";
import { createI18n } from "../src/i18n/createI18n.ts";
import { resolveBlueprintDate } from "../server/src/templates/model.ts";

// Run unchanged T4.1 flows by default, or exercise a new T4.2 blueprint through
// the same real isolated SQL service. This never connects to development data.
const primaryIndex = Number(process.env.BUDOGRAPH_CURATED_TEST_INDEX ?? 0);
if (!Number.isInteger(primaryIndex) || !CURATED_TEMPLATES[primaryIndex])
  throw Error("Invalid curated browser test index");
const primary = CURATED_TEMPLATES[primaryIndex];

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = process.env.BUDOGRAPH_BASE_URL ?? "http://127.0.0.1:5173",
  out = process.env.BUDOGRAPH_EVIDENCE_DIR ?? "tmp/templates-t4/browser";
mkdirSync(out, { recursive: true });
const report = {
  realIsolatedPostgres: true,
  syntheticAuthentication: true,
  sharedDatabaseRequests: 0,
  cases: [],
  unexpectedRequests: [],
  pageErrors: [],
};
const browser = await chromium.launch({
    headless: true,
    ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
      ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
      : {}),
  }),
  pool = await templateIsolatedPool();
const cases = [];
for (const width of [320, 390, 768, 1440])
  for (const language of ["bg", "en"])
    for (const theme of ["light", "dark"])
      cases.push({ width, language, theme, mode: "normal" });
for (const mode of [
  "member",
  "archived",
  "lostApply",
  "stale",
  "changedEvent",
  "retry",
  "invalidCatalog",
  "emptyCatalog",
  "noEvent",
  "loading",
])
  cases.push({ width: 390, language: "bg", theme: "dark", mode });
try {
  for (const { width, language, theme, mode } of cases) {
    const client = await pool.connect(),
      f = await createPostgresFixture(client).finally(() => client.release());
    const user = {
      id: f.organizerUser,
      name: "Synthetic curated browser",
      email: "synthetic@example.invalid",
    };
    await pool.query(
      "UPDATE public.event SET start_date='2026-11-20',end_date='2026-11-20' WHERE id=$1",
      [f.eventId],
    );
    await pool.query(
      "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role,active) VALUES($1,$2,$3,'ORGANIZER','Organizer',TRUE)",
      [randomUUID(), f.foreignEventId, user.id],
    );
    if (mode === "member")
      await pool.query(
        "UPDATE public.event_member SET access_role='MEMBER' WHERE id=$1",
        [f.organizerId],
      );
    if (mode === "archived")
      await pool.query(
        "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
        [f.eventId],
      );
    const app = createApp({
      checkDatabase: async () => {},
      personalTemplates: createPersonalTemplateService(pool),
      templates: createTemplateApplicationService(pool),
      events: createEventService(pool),
      tasks: createTaskService(pool),
      authentication: {
        baseURL: origin,
        taskMutationOrigins: [origin],
        auth: {
          handler: async () => new Response(),
          api: {
            getSession: async () => ({ user: { ...user, active: true } }),
          },
        },
      },
    });
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
        serviceWorkers: "block",
      }),
      i18n = createI18n(language),
      applyCalls = [],
      previews = [];
    let catalogReads = 0,
      releaseCatalog,
      allowCatalogRetry = false;
    const heldCatalog = new Promise((resolve) => {
      releaseCatalog = resolve;
    });
    await context.addInitScript(
      ({ language, theme }) =>
        localStorage.setItem(
          "budograph.preferences.v1",
          JSON.stringify({ version: 1, language, theme }),
        ),
      { language, theme },
    );
    await context.route("**/api/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname;
      if (path === "/api/me") return route.fulfill({ json: { user } });
      if (
        req.method() === "GET" &&
        /\/(notifications|changes|invitations)$/.test(path)
      )
        return route.fulfill({
          json: path.endsWith("notifications")
            ? { notifications: [], unreadCount: 0 }
            : path.endsWith("changes")
              ? { changes: [] }
              : { invitations: [] },
        });
      if (mode === "noEvent" && path === "/api/events")
        return route.fulfill({ json: { events: [] } });
      if (!(
        req.method() === "GET" ||
        (req.method() === "POST" && /\/templates\/(preview|apply)$/.test(path))
      )) {
        report.unexpectedRequests.push({ method: req.method(), path });
        return route.abort();
      }
      if (path === "/api/templates/curated") {
        catalogReads++;
        if (mode === "loading") await heldCatalog;
        if (mode === "retry" && !allowCatalogRetry)
          return route.fulfill({ status: 503, json: {} });
        if (mode === "invalidCatalog")
          return route.fulfill({
            json: { catalogVersion: 1, templates: [{}] },
          });
        if (mode === "emptyCatalog")
          return route.fulfill({ json: { catalogVersion: 1, templates: [] } });
      }
      if (path.endsWith("/templates/apply"))
        applyCalls.push({
          key: req.headers()["idempotency-key"],
          body: req.postDataJSON(),
        });
      if (path.endsWith("/templates/preview"))
        previews.push(req.postDataJSON());
      const response = await app.inject({
        method: req.method(),
        url: path + url.search,
        headers: {
          origin,
          ...(req.headers()["idempotency-key"]
            ? { "idempotency-key": req.headers()["idempotency-key"] }
            : {}),
        },
        ...(req.method() === "POST" ? { payload: req.postDataJSON() } : {}),
      });
      if (
        mode === "lostApply" &&
        path.endsWith("/templates/apply") &&
        applyCalls.length === 1
      )
        return route.abort();
      return route.fulfill({
        status: response.statusCode,
        json: response.json(),
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    const button = (key) =>
      page.getByRole("button", { name: i18n.t(key), exact: true });
    const openLibrary = async () => {
      await button("templates.t4.library").click();
    };
    const openTemplate = async (index = primaryIndex) => {
      await page
        .getByRole("button", {
          name: `${i18n.t("templates.t4.open")}: ${CURATED_TEMPLATES[index].name[language]}`,
          exact: true,
        })
        .click();
      await page
        .getByRole("heading", {
          name: CURATED_TEMPLATES[index].name[language],
          exact: true,
        })
        .waitFor();
    };
    try {
      await page.goto(
        `${origin}${mode === "noEvent" ? "/templates" : `/events/${f.eventId}/templates`}`,
      );
      await openLibrary();
      if (mode === "loading") {
        await page
          .getByText(i18n.t("templates.t4.loading"), { exact: true })
          .waitFor();
        releaseCatalog();
      }
      if (mode === "retry") {
        await page
          .getByText(i18n.t("templates.t4.error"), { exact: true })
          .waitFor();
        allowCatalogRetry = true;
        await button("templates.t1.retry").click();
      }
      if (mode === "invalidCatalog" || mode === "emptyCatalog") {
        await page
          .getByText(
            i18n.t(
              mode === "invalidCatalog"
                ? "templates.t4.error"
                : "templates.t4.empty",
            ),
            { exact: true },
          )
          .waitFor();
        assert.equal(applyCalls.length, 0);
        report.cases.push({ width, language, theme, mode, status: "PASS" });
        continue;
      }
      await page.locator(".curated-library__row").first().waitFor();
      assert.equal(await page.locator(".curated-library__row").count(), 24);
      // Inspect all new detail lists in both languages at the narrowest width.
      if (mode === "normal" && width === 320 && theme === "dark") {
        for (let index = 12; index < CURATED_TEMPLATES.length; index++) {
          await openTemplate(index);
          const entry = CURATED_TEMPLATES[index];
          assert.equal(
            await page
              .locator(".templates-t1__items input[type=checkbox]")
              .count(),
            entry.items.length,
          );
          for (const item of entry.items)
            assert.ok(
              await page
                .getByText(item.text[language].title, { exact: true })
                .count(),
            );
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          );
          await button("templates.t4.back").click();
        }
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const search = page.getByRole("searchbox");
      await search.fill(language === "bg" ? "кантар" : "weigh-in");
      assert.equal(await page.locator(".curated-library__row").count(), 1);
      await search.fill("nonexistent-2026");
      await page
        .getByText(i18n.t("templates.t4.noResults"), { exact: true })
        .waitFor();
      await button("templates.t4.clear").click();
      await page
        .getByLabel(i18n.t("templates.t4.category"), { exact: true })
        .selectOption("aikido");
      await page
        .getByLabel(i18n.t("templates.t4.difficulty"), { exact: true })
        .selectOption("beginner");
      assert.equal(await page.locator(".curated-library__row").count(), 1);
      await page
        .getByLabel(i18n.t("templates.t4.category"), { exact: true })
        .selectOption("");
      await page
        .getByLabel(i18n.t("templates.t4.difficulty"), { exact: true })
        .selectOption("");
      if (mode === "normal")
        await page.screenshot({
          path: `${out}/library-${width}-${language}-${theme}.png`,
          fullPage: true,
        });
      await openTemplate();
      const choices = page.locator(".templates-t1__items input[type=checkbox]");
      assert.equal(await choices.count(), primary.items.length);
      await button("templates.t1.none").click();
      assert.equal(
        await page.locator(".templates-t1__items input:checked").count(),
        0,
      );
      if (mode === "noEvent") {
        assert.equal(await page.locator(".template-application").count(), 0);
        report.cases.push({
          width,
          language,
          theme,
          mode,
          status: "PASS",
          applyCalls: 0,
        });
        continue;
      }
      const panel = page.locator(".template-application"),
        reviewButton = panel.getByRole("button", {
          name: i18n.t("templates.t2.review"),
          exact: true,
        });
      assert.equal(await reviewButton.isEnabled(), false);
      await choices.nth(0).press("Space");
      await choices.nth(1).press("Space");
      await button("templates.t4.back").click();
      await openTemplate(1);
      assert.equal(
        await page.locator(".templates-t1__items input:checked").count(),
        9,
      );
      await button("templates.t4.back").click();
      await openTemplate();
      assert.equal(
        await page.locator(".templates-t1__items input:checked").count(),
        primary.items.length,
      );
      await button("templates.t1.none").click();
      await choices.nth(0).press("Space");
      await choices.nth(1).press("Space");
      if (mode === "changedEvent") {
        await page.goto(`${origin}/events/${f.foreignEventId}/templates`);
        await openLibrary();
        await openTemplate();
        assert.equal(
          await page.locator(".templates-t1__items input:checked").count(),
          primary.items.length,
        );
        assert.equal(
          await panel.locator(".template-application__review").count(),
          0,
        );
        report.cases.push({
          width,
          language,
          theme,
          mode,
          status: "PASS",
          applyCalls: 0,
        });
        continue;
      }
      await reviewButton.click();
      await panel.locator(".template-application__review h3").waitFor();
      assert.equal(await panel.locator("li").count(), 2);
      assert.deepEqual(
        previews.at(-1).itemIds,
        primary.items.slice(0, 2).map((i) => i.id),
      );
      assert.ok(await panel.getByText("2026-11-20", { exact: false }).count());
      assert.ok(
        (await panel.innerText()).includes(
          i18n.formatTaskDeadline(
            resolveBlueprintDate("2026-11-20", primary.items[0].dayOffset),
            primary.items[0].deadlineTime,
          ),
        ),
      );
      if (mode === "member" || mode === "archived") {
        await panel
          .getByText(i18n.t("templates.t2.readOnly"), { exact: true })
          .waitFor();
        assert.equal(
          await panel
            .getByRole("button", {
              name: i18n.t("templates.t2.apply"),
              exact: true,
            })
            .count(),
          0,
        );
        assert.equal(applyCalls.length, 0);
        report.cases.push({
          width,
          language,
          theme,
          mode,
          status: "PASS",
          applyCalls: 0,
        });
        continue;
      }
      const apply = panel.getByRole("button", {
        name: i18n.t("templates.t2.apply"),
        exact: true,
      });
      assert.equal(await apply.isEnabled(), false);
      await panel.getByRole("checkbox").press("Space");
      if (mode === "stale") {
        await choices.nth(2).press("Space");
        assert.equal(await apply.isEnabled(), false);
        await reviewButton.click();
        await page.waitForFunction(
          () =>
            document.querySelectorAll(".template-application li").length === 3,
        );
        await panel.getByRole("checkbox").press("Space");
        await pool.query(
          "UPDATE public.event SET version=version+1 WHERE id=$1",
          [f.eventId],
        );
        await apply.click();
        await panel
          .getByText(i18n.t("templates.t2.error.conflict"), { exact: true })
          .waitFor();
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::INT n FROM public.template_application_receipt WHERE event_id=$1",
              [f.eventId],
            )
          ).rows[0].n,
          0,
        );
        report.cases.push({ width, language, theme, mode, status: "PASS" });
        continue;
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (mode === "normal")
        await page.screenshot({
          path: `${out}/review-${width}-${language}-${theme}.png`,
          fullPage: true,
        });
      await apply.press("Enter");
      if (mode === "lostApply") {
        await panel
          .getByRole("button", {
            name: i18n.t("templates.t2.recover"),
            exact: true,
          })
          .waitFor();
        await page.reload();
        await openLibrary();
        await openTemplate(1);
        await panel
          .getByRole("button", {
            name: i18n.t("templates.t2.recover"),
            exact: true,
          })
          .click();
        assert.equal(applyCalls.length, 2);
        assert.deepEqual(applyCalls[0], applyCalls[1]);
      }
      await panel
        .getByRole("heading", {
          name: i18n.t("templates.t2.accepted"),
          exact: true,
        })
        .waitFor();
      const outcome = (
        await pool.query(
          "SELECT outcome FROM public.template_application_receipt WHERE actor_user_id=$1 AND operation_id=$2",
          [user.id, applyCalls[0].key],
        )
      ).rows[0].outcome;
      assert.equal(outcome.createdCount, 2);
      assert.equal(outcome.templateId, primary.id);
      await button("templates.t4.history").click();
      await page
        .getByRole("heading", {
          name: i18n.t("history.template.applied"),
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator(".event-history__entry").count(), 3);
      assert.ok(
        (
          await page.locator(".event-history__entry").first().innerText()
        ).includes(primary.id),
      );
      report.cases.push({
        width,
        language,
        theme,
        mode,
        status: "PASS",
        createdTasks: 2,
        historyEntries: 3,
        applyCalls: applyCalls.length,
      });
    } catch (error) {
      await page.screenshot({
        path: `${out}/failure-${mode}-${width}-${language}-${theme}.png`,
        fullPage: true,
      });
      console.log((await page.locator("main").innerText()).slice(-5000));
      throw error;
    } finally {
      releaseCatalog();
      await context.close();
      await app.close();
    }
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.unexpectedRequests, []);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.failure = String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await pool.end();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
