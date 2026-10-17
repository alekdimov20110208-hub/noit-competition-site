// Real owned isolated PostgreSQL + real Fastify services. Synthetic browser auth
// and fully intercepted API transport; never contacts development DB or sessions.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { templateIsolatedPool } from "../server/tests/helpers/template-isolated-db.ts";
import { createPostgresFixture } from "../server/tests/postgres-fixture.ts";
import { createApp } from "../server/src/app.ts";
import { createPersonalTemplateService } from "../server/src/templates/library.ts";
import { createTemplateApplicationService } from "../server/src/templates/service.ts";
import { createEventService } from "../server/src/events/service.ts";
import { createTaskService } from "../server/src/tasks/service.ts";
import { createI18n } from "../src/i18n/createI18n.ts";
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = process.env.BUDOGRAPH_BASE_URL ?? "http://127.0.0.1:5173",
  out = process.env.BUDOGRAPH_EVIDENCE_DIR ?? "tmp/templates-t3/browser";
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
try {
  for (const [width, language, theme, mode] of [
    [1440, "en", "light", "normal"],
    [390, "bg", "dark", "lostSave"],
    [320, "en", "dark", "normal"],
    [768, "bg", "light", "normal"],
    [1440, "bg", "dark", "lostApply"],
    [390, "en", "light", "member"],
    [320, "bg", "dark", "archived"],
  ]) {
    const client = await pool.connect(),
      f = await createPostgresFixture(client).finally(() => client.release());
    const user = {
        id: f.organizerUser,
        name: "Synthetic T3 browser",
        email: "synthetic@example.invalid",
      },
      library = createPersonalTemplateService(pool);
    await pool.query(
      `UPDATE public.task SET title='First reviewed Task',context='Synthetic sensitive source description',deadline='2026-10-04' WHERE id=$1`,
      [f.taskId],
    );
    await pool.query(
      `INSERT INTO public.task(id,event_id,title,context,deadline,deadline_time,created_by,updated_by) VALUES($1,$2,'Second reviewed Task','Other synthetic private detail','2026-10-02','15:00',$3,$3)`,
      [randomUUID(), f.eventId, f.organizerId],
    );
    await pool.query(
      `INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role,active) VALUES($1,$2,$3,'ORGANIZER','Organizer',TRUE)`,
      [randomUUID(), f.foreignEventId, user.id],
    );
    await pool.query(
      `UPDATE public.event SET start_date='2026-11-20',end_date='2026-11-22' WHERE id=$1`,
      [f.foreignEventId],
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
      personalTemplates: library,
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
      saveCalls = [],
      applyCalls = [];
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
      if (!["GET", "POST"].includes(req.method())) {
        report.unexpectedRequests.push({ path, method: req.method() });
        return route.abort();
      }
      if (path.endsWith("/templates/save"))
        saveCalls.push({
          key: req.headers()["idempotency-key"],
          body: req.postDataJSON(),
        });
      if (path.endsWith("/templates/apply"))
        applyCalls.push({
          key: req.headers()["idempotency-key"],
          body: req.postDataJSON(),
        });
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
        path.endsWith("/templates/save") &&
        mode === "lostSave" &&
        saveCalls.length === 1
      )
        return route.abort();
      if (
        path.endsWith("/templates/apply") &&
        mode === "lostApply" &&
        applyCalls.length === 1
      )
        return route.abort();
      return route.fulfill({
        status: response.statusCode,
        json: response.json(),
      });
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => report.pageErrors.push(e.message));
    page.setDefaultTimeout(10000);
    const button = (key) =>
      page.getByRole("button", { name: i18n.t(key), exact: true });
    try {
      await page.goto(`${origin}/events/${f.eventId}/templates`);
      await button("templates.t3.mine").click();
      if (mode === "member" || mode === "archived") {
        await page
          .getByText(i18n.t("templates.t3.chooseEvent"), { exact: true })
          .waitFor();
        assert.equal(await button("templates.t3.saveFrom").isEnabled(), false);
        assert.equal((await library.list(user)).templates.length, 0);
        report.cases.push({
          width,
          language,
          theme,
          mode,
          status: "PASS",
          saveCalls: 0,
          applyCalls: 0,
        });
        continue;
      }
      await button("templates.t3.saveFrom").click();
      await page
        .getByRole("checkbox", { name: "First reviewed Task", exact: true })
        .press("Space");
      await page
        .getByRole("checkbox", { name: "Second reviewed Task", exact: true })
        .press("Space");
      await button("templates.t3.review").click();
      await page
        .getByLabel(i18n.t("templates.t3.context"), { exact: true })
        .first()
        .waitFor();
      assert.deepEqual(
        await page
          .getByLabel(i18n.t("templates.t3.context"), { exact: true })
          .evaluateAll((elements) => elements.map((element) => element.value)),
        ["", ""],
      );
      await page
        .getByLabel(i18n.t("templates.t3.name"), { exact: true })
        .fill("Synthetic personal plan");
      const reviewed = page.getByRole("group", {
        name: "First reviewed Task",
        exact: true,
      });
      await reviewed.locator("summary").click();
      await reviewed
        .getByRole("button", {
          name: i18n.t("templates.t3.include"),
          exact: true,
        })
        .click();

      await reviewed
        .getByLabel(i18n.t("templates.t3.context"), { exact: true })
        .fill("Reviewed reusable text");
      await reviewed
        .getByRole("checkbox", {
          name: i18n.t("templates.t3.includeConfirm"),
          exact: true,
        })
        .press("Space");
      await page
        .getByRole("checkbox", {
          name: i18n.t("templates.t3.confirm"),
          exact: true,
        })
        .press("Space");
      await button("templates.t3.save").and(page.locator(":enabled")).waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `${out}/save-review-${width}-${language}-${theme}.png`,
        fullPage: true,
      });
      await button("templates.t3.save").press("Enter");
      if (mode === "lostSave") {
        await button("templates.t3.recover").waitFor();
        await page.reload();
        await button("templates.t3.mine").click();
        await button("templates.t3.recover").click();
        assert.equal(saveCalls.length, 2);
        assert.deepEqual(saveCalls[0], saveCalls[1]);
      }
      await page
        .getByText(i18n.t("templates.t3.saved"), { exact: true })
        .waitFor();
      let list = await library.list(user);
      assert.equal(list.templates.length, 1);
      const savedId = list.templates[0].id,
        detail = await library.detail(user, savedId);
      assert.equal(
        detail.items.filter((i) => i.context === "Reviewed reusable text")
          .length,
        1,
      );
      assert.equal(detail.items.filter((i) => i.context === "").length, 1);
      await page.reload();
      await button("templates.t3.mine").click();
      await button("templates.t3.open").click();
      await page
        .getByRole("heading", { name: "Synthetic personal plan", exact: true })
        .waitFor();
      await page.goto(`${origin}/events/${f.foreignEventId}/templates`);
      await button("templates.t3.mine").click();
      await button("templates.t3.open").click();
      const panel = page.locator(".template-application");
      await panel
        .getByRole("button", {
          name: i18n.t("templates.t2.review"),
          exact: true,
        })
        .click();
      await panel.locator(".template-application__review h3").waitFor();
      assert.equal(await panel.locator("li").count(), 2);
      assert.equal(
        await panel
          .getByRole("button", {
            name: i18n.t("templates.t2.apply"),
            exact: true,
          })
          .isEnabled(),
        false,
      );
      await panel.getByRole("checkbox").press("Space");
      await page.screenshot({
        path: `${out}/apply-review-${width}-${language}-${theme}.png`,
        fullPage: true,
      });
      await panel
        .getByRole("button", {
          name: i18n.t("templates.t2.apply"),
          exact: true,
        })
        .press("Enter");
      if (mode === "lostApply") {
        await panel
          .getByRole("button", {
            name: i18n.t("templates.t2.recover"),
            exact: true,
          })
          .waitFor();
        await page.reload();
        await button("templates.t3.mine").click();
        await button("templates.t3.open").click();
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
      const receipt = (
        await pool.query(
          "SELECT outcome FROM public.template_application_receipt WHERE actor_user_id=$1 AND operation_id=$2",
          [user.id, applyCalls[0].key],
        )
      ).rows[0].outcome;
      assert.equal(receipt.createdCount, 2);
      const tasks = (
        await pool.query(
          `SELECT to_char(deadline,'YYYY-MM-DD') date FROM public.task WHERE id=ANY($1::UUID[]) ORDER BY deadline`,
          [receipt.taskIds],
        )
      ).rows;
      assert.deepEqual(tasks, [{ date: "2026-11-19" }, { date: "2026-11-21" }]);
      await page.goto(`${origin}/events/${f.foreignEventId}/history`);
      await page
        .getByRole("heading", {
          name: i18n.t("history.template.applied"),
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator(".event-history__entry").count(), 3);
      assert.equal(await page.getByText(savedId, { exact: false }).count(), 0);
      report.cases.push({
        width,
        language,
        theme,
        mode,
        status: "PASS",
        saveCalls: saveCalls.length,
        createdTasks: 2,
        historyEntries: 3,
        persistedAfterRefresh: true,
      });
    } catch (e) {
      await page.screenshot({
        path: `${out}/failure-${width}.png`,
        fullPage: true,
      });
      console.log(
        (await page.locator(".personal-templates").innerText()).slice(0, 4000),
      );
      throw e;
    } finally {
      await context.close();
      await app.close();
    }
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.unexpectedRequests, []);
  report.status = "PASS";
} catch (e) {
  report.status = "FAIL";
  report.failure = String(e.stack ?? e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await pool.end();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
