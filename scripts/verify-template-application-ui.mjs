// Browser -> real Fastify T2 route/service -> explicit transactional SQL double.
// Every API request is intercepted. No shared database, account or session writes.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createApp } from "../server/src/app.ts";
import { createTemplateApplicationService } from "../server/src/templates/service.ts";
import {
  templateFixture,
  eventId,
  actorId,
  user,
} from "../server/tests/helpers/template-fixture.ts";
import { eventDto } from "../server/src/events/model.ts";
import { taskDto } from "../server/src/tasks/model.ts";
import { createEventHistoryReadService } from "../server/src/events/history.ts";
import { createI18n } from "../src/i18n/createI18n.ts";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = process.env.BUDOGRAPH_BASE_URL ?? "http://127.0.0.1:5173",
  out = process.env.BUDOGRAPH_EVIDENCE_DIR ?? "tmp/templates-t2/browser";
mkdirSync(out, { recursive: true });
const report = {
  syntheticTransport: true,
  transactionalSqlDouble: true,
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
});
async function fixture({
  width = 1440,
  language = "en",
  theme = "light",
  role = "ORGANIZER",
  archived = false,
  mode = "success",
} = {}) {
  const f = templateFixture();
  f.options.role = role;
  if (archived) f.store.event.archived_at = new Date("2026-10-16T00:00:00Z");
  const controls = { mode, applyCalls: [], previewCalls: 0, taskReads: 0 };
  const history = createEventHistoryReadService({
    query: async (_sql, values) => {
      assert.equal(values[0], eventId);
      assert.equal(values[1], user.id);
      return {
        rows: f.store.activities
          .map((entry, index) => ({
            viewer_id: actorId,
            cursor_valid: true,
            id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
            event_id: eventId,
            action_type: entry.action,
            actor_user_id: user.id,
            actor_member_id: actorId,
            actor_name: user.name,
            target_type: entry.action === "task.created" ? "task" : "event",
            target_id: entry.targetId,
            target_title:
              entry.action === "task.created"
                ? f.store.tasks.find((task) => task.id === entry.targetId)
                    ?.title
                : f.store.event.name,
            target_available: true,
            payload: entry.payload,
            created_at: `2026-10-16T00:00:01.${String(index).padStart(6, "0")}Z`,
          }))
          .reverse(),
      };
    },
  });
  const app = createApp({
    checkDatabase: async () => {},
    templates: createTemplateApplicationService(f.pool),
    events: { list: async () => [], history },
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
  await context.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (
      new RegExp(`^/api/events/${eventId}/templates/(preview|apply)$`).test(
        path,
      ) &&
      request.method() === "POST"
    ) {
      const apply = path.endsWith("apply");
      if (!apply) controls.previewCalls++;
      if (!apply && controls.mode === "offlineReview") return route.abort();
      if (apply)
        controls.applyCalls.push({
          key: request.headers()["idempotency-key"],
          body: request.postDataJSON(),
        });
      if (apply && controls.mode === "key-reused")
        return route.fulfill({
          status: 409,
          json: { status: "error", code: "IDEMPOTENCY_KEY_REUSED" },
        });
      const response = await app.inject({
        method: "POST",
        url: path,
        headers: {
          origin,
          "content-type": "application/json",
          ...(apply
            ? { "idempotency-key": request.headers()["idempotency-key"] }
            : {}),
        },
        payload: request.postDataJSON(),
      });
      if (apply && controls.mode === "lost" && controls.applyCalls.length === 1)
        return route.abort();
      return route.fulfill({
        status: response.statusCode,
        json: response.json(),
      });
    }
    if (request.method() !== "GET") {
      report.unexpectedRequests.push({ method: request.method(), path });
      return route.abort();
    }
    if (path === "/api/me") return route.fulfill({ json: { user } });
    if (path === `/api/events/${eventId}/history`) {
      const response = await app.inject({ method: "GET", url: path });
      return route.fulfill({
        status: response.statusCode,
        json: response.json(),
      });
    }
    if (path === "/api/events")
      return route.fulfill({
        json: {
          events: [
            eventDto(f.store.event, {
              id: actorId,
              accessRole: f.options.role,
            }),
          ],
        },
      });
    if (path === `/api/events/${eventId}/tasks`) {
      controls.taskReads++;
      if (controls.mode === "refreshFail" && controls.applyCalls.length)
        return route.fulfill({ status: 503, json: { status: "error" } });
      return route.fulfill({
        json: { tasks: f.store.tasks.map(taskDto), members: [] },
      });
    }
    if (new RegExp(`^/api/events/${eventId}/tasks/[^/]+$`).test(path)) {
      const task = f.store.tasks.find((t) => t.id === path.split("/").at(-1));
      return route.fulfill({
        status: task ? 200 : 404,
        json: task ? { task: taskDto(task) } : { status: "error" },
      });
    }
    for (const [suffix, json] of [
      ["members", { members: [] }],
      ["changes", { changes: [] }],
      ["notifications", { notifications: [], unreadCount: 0 }],
      ["invitations", { invitations: [] }],
    ])
      if (path === `/api/events/${eventId}/${suffix}`)
        return route.fulfill({ json });
    report.unexpectedRequests.push({ method: request.method(), path });
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  const i18n = createI18n(language),
    panel = page.locator(".template-application");
  await page.goto(`${origin}/events/${eventId}/templates`);
  await page.locator(".templates-t1__event h2").waitFor();
  async function review() {
    await panel
      .getByRole("button", { name: i18n.t("templates.t2.review"), exact: true })
      .click();
    await panel.locator(".template-application__review h3").waitFor();
  }
  async function confirm() {
    await panel.getByRole("checkbox").press("Space");
  }
  async function apply() {
    await panel
      .getByRole("button", { name: i18n.t("templates.t2.apply"), exact: true })
      .press("Enter");
  }
  async function accepted() {
    await panel
      .getByRole("heading", {
        name: i18n.t("templates.t2.accepted"),
        exact: true,
      })
      .waitFor();
  }
  async function close() {
    await context.close();
    await app.close();
  }
  return {
    f,
    controls,
    context,
    page,
    panel,
    i18n,
    review,
    confirm,
    apply,
    accepted,
    close,
  };
}
try {
  for (const width of [1440, 768, 390, 320])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"]) {
        const h = await fixture({ width, language, theme });
        try {
          await h.review();
          assert.equal(await h.panel.locator("li").count(), 4);
          assert.equal(
            await h.panel
              .getByRole("button", {
                name: h.i18n.t("templates.t2.apply"),
                exact: true,
              })
              .isEnabled(),
            false,
          );
          await h.confirm();
          assert.equal(
            await h.panel
              .getByRole("button", {
                name: h.i18n.t("templates.t2.apply"),
                exact: true,
              })
              .isEnabled(),
            true,
          );
          await h.page.evaluate(async () => {
            await document.fonts.ready;
            document.activeElement?.blur();
            window.scrollTo({ top: 0, behavior: "instant" });
          });
          await h.page.screenshot({
            path: `${out}/review-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
          const refreshed = h.page.waitForResponse(
            (response) =>
              response.url().endsWith(`/api/events/${eventId}/tasks`) &&
              response.request().method() === "GET",
          );
          // Two synchronous click events exercise the controller's immediate gate.
          await h.panel
            .getByRole("button", {
              name: h.i18n.t("templates.t2.apply"),
              exact: true,
            })
            .evaluate((button) => {
              button.click();
              button.click();
            });
          await h.accepted();
          await refreshed;
          assert.equal(h.controls.applyCalls.length, 1);
          assert.equal(h.f.store.tasks.length, 4);
          assert.equal(h.f.store.receipts.length, 1);
          assert.ok(h.controls.taskReads >= 2);
          assert.equal(
            await h.page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          await h.page.screenshot({
            path: `${out}/success-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
          await h.panel
            .getByRole("button", {
              name: h.i18n.t("templates.t2.openTasks"),
              exact: true,
            })
            .click();
          await h.page.locator(".task-row").first().waitFor();
          assert.equal(await h.page.locator(".task-row").count(), 4);
          report.cases.push({
            name: "review-explicit-confirm-double-click-refresh-navigation",
            width,
            language,
            theme,
            status: "PASS",
          });
        } finally {
          await h.close();
        }
      }
  for (const [role, archived] of [
    ["MEMBER", false],
    ["ORGANIZER", true],
    ["MEMBER", true],
  ]) {
    const h = await fixture({ role, archived });
    try {
      await h.review();
      assert.equal(
        await h.panel
          .getByRole("button", {
            name: h.i18n.t("templates.t2.apply"),
            exact: true,
          })
          .count(),
        0,
      );
      assert.equal(h.f.store.tasks.length, 0);
      report.cases.push({
        name: `read-only-${role}-${archived}`,
        status: "PASS",
      });
    } finally {
      await h.close();
    }
  }
  {
    const h = await fixture();
    try {
      await h.page
        .getByRole("button", {
          name: h.i18n.t("templates.t1.none"),
          exact: true,
        })
        .click();
      assert.equal(
        await h.panel
          .getByRole("button", {
            name: h.i18n.t("templates.t2.review"),
            exact: true,
          })
          .isEnabled(),
        false,
      );
      assert.equal(h.controls.previewCalls, 0);
      report.cases.push({ name: "zero-selection-blocked", status: "PASS" });
    } finally {
      await h.close();
    }
  }
  {
    const h = await fixture({ mode: "lost" });
    try {
      await h.review();
      await h.confirm();
      await h.apply();
      await h.panel
        .getByText(h.i18n.t("templates.t2.error.uncertain"), { exact: true })
        .waitFor();
      assert.equal(h.f.store.tasks.length, 4);
      assert.equal(
        await h.panel
          .getByRole("heading", {
            name: h.i18n.t("templates.t2.accepted"),
            exact: true,
          })
          .count(),
        0,
      );
      await h.page.reload();
      await h.panel
        .getByRole("button", {
          name: h.i18n.t("templates.t2.recover"),
          exact: true,
        })
        .waitFor();
      await h.panel
        .getByRole("button", {
          name: h.i18n.t("templates.t2.recover"),
          exact: true,
        })
        .click();
      await h.accepted();
      assert.equal(h.f.store.tasks.length, 4);
      assert.deepEqual(h.controls.applyCalls[0], h.controls.applyCalls[1]);
      report.cases.push({
        name: "lost-response-reload-recovery-same-key-payload",
        status: "PASS",
      });
    } finally {
      await h.close();
    }
  }
  for (const scenario of ["stale", "revoked", "archived"]) {
    const h = await fixture();
    try {
      await h.review();
      await h.confirm();
      if (scenario === "stale") h.f.store.event.version++;
      if (scenario === "revoked") h.f.options.role = "MEMBER";
      if (scenario === "archived") h.f.store.event.archived_at = new Date();
      await h.apply();
      const key =
        scenario === "stale"
          ? "conflict"
          : scenario === "revoked"
            ? "forbidden"
            : "archived";
      await h.panel
        .getByText(h.i18n.t(`templates.t2.error.${key}`), { exact: true })
        .waitFor();
      assert.equal(h.f.store.tasks.length, 0);
      if (scenario === "stale") {
        assert.equal(await h.panel.getByRole("checkbox").count(), 0);
        await h.review();
        await h.confirm();
        await h.apply();
        await h.accepted();
        assert.notEqual(
          h.controls.applyCalls[0].key,
          h.controls.applyCalls[1].key,
        );
      }
      report.cases.push({ name: scenario, status: "PASS" });
    } finally {
      await h.close();
    }
  }
  {
    const h = await fixture({ mode: "offlineReview" });
    try {
      await h.panel
        .getByRole("button", {
          name: h.i18n.t("templates.t2.review"),
          exact: true,
        })
        .click();
      await h.panel
        .getByText(h.i18n.t("templates.t2.error.unavailable"), { exact: true })
        .waitFor();
      assert.equal(h.f.store.tasks.length, 0);
      h.controls.mode = "success";
      await h.review();
      report.cases.push({ name: "offline-review-retry", status: "PASS" });
    } finally {
      await h.close();
    }
  }
  {
    const h = await fixture({ mode: "refreshFail" });
    try {
      await h.review();
      await h.confirm();
      await h.apply();
      await h.accepted();
      await h.panel
        .getByText(h.i18n.t("templates.t2.refreshFailed"), { exact: true })
        .waitFor();
      assert.equal(h.f.store.tasks.length, 4);
      h.controls.mode = "success";
      await h.panel
        .getByRole("button", {
          name: h.i18n.t("templates.t2.refresh"),
          exact: true,
        })
        .click();
      await h.page.locator(".templates-t1__event h2").waitFor();
      report.cases.push({
        name: "confirmed-creation-refresh-failure-recovery",
        status: "PASS",
      });
    } finally {
      await h.close();
    }
  }
  {
    const h = await fixture();
    try {
      await h.review();
      await h.confirm();
      await h.apply();
      await h.accepted();
      await h.panel
        .getByRole("button", {
          name: h.i18n.t("templates.t2.new"),
          exact: true,
        })
        .click();
      await h.review();
      await h.panel
        .getByText(h.i18n.t("templates.t2.duplicates", { count: 4 }), {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await h.panel
          .getByRole("button", {
            name: h.i18n.t("templates.t2.apply"),
            exact: true,
          })
          .isEnabled(),
        false,
      );
      await h.confirm();
      await h.apply();
      await h.accepted();
      assert.equal(h.f.store.tasks.length, 8);
      assert.notEqual(
        h.controls.applyCalls[0].key,
        h.controls.applyCalls[1].key,
      );
      report.cases.push({
        name: "explicit-new-attempt-duplicate-warning",
        status: "PASS",
      });
    } finally {
      await h.close();
    }
  }
  {
    const h = await fixture({ mode: "key-reused" });
    try {
      await h.review();
      await h.confirm();
      await h.apply();
      await h.panel
        .getByText(h.i18n.t("templates.t2.error.key-reused"), { exact: true })
        .waitFor();
      assert.equal(
        await h.panel
          .getByRole("button", {
            name: h.i18n.t("templates.t2.recover"),
            exact: true,
          })
          .isEnabled(),
        false,
      );
      assert.equal(h.f.store.tasks.length, 0);
      report.cases.push({
        name: "key-conflict-no-silent-new-attempt",
        status: "PASS",
      });
    } finally {
      await h.close();
    }
  }
  {
    const h = await fixture();
    try {
      await h.review();
      await h.confirm();
      await h.apply();
      await h.accepted();
      await h.page.goto(`${origin}/events/${eventId}/history`);
      await h.page
        .getByRole("heading", {
          name: h.i18n.t("history.template.applied"),
          exact: true,
        })
        .waitFor();
      assert.equal(await h.page.locator(".event-history__entry").count(), 5);
      const provenance = h.i18n.t("history.template.origin", {
        template: "international-aikido-seminar",
        version: 1,
        operation: h.controls.applyCalls[0].key,
      });
      assert.equal(
        await h.page.getByText(provenance, { exact: true }).count(),
        5,
      );
      await h.page
        .locator('.event-history__entry a[href*="/tasks"]')
        .first()
        .click();
      assert.ok(new URL(h.page.url()).searchParams.get("task"));
      report.cases.push({
        name: "traceable-history-and-created-task-link",
        status: "PASS",
      });
    } finally {
      await h.close();
    }
  }
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
