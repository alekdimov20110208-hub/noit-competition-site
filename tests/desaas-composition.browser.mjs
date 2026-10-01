import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createDemoWorkspace } from "../src/data/demo.ts";
import { localizeWorkspace } from "../src/i18n/localizeWorkspace.ts";
import { createI18n } from "../src/i18n/createI18n.ts";
import {
  CHANGE_SEVERITY_MESSAGE_KEYS,
  CHANGE_STATUS_MESSAGE_KEYS,
  TASK_PRIORITY_MESSAGE_KEYS,
  TASK_STATUS_MESSAGE_KEYS,
} from "../src/domain/labels.ts";

import { filterTasks } from "../src/pages/tasks/helpers.ts";
import {
  getTaskCounts,
  isTaskOverdue,
  getAttentionTasks,
  getTeamWorkload,
} from "../src/domain/workspace.ts";
import { getDemoReferenceNow } from "../src/data/demoTime.ts";
import {
  getAttentionReason,
  buildPreparationTimeline,
  partitionTeamPressure,
} from "../src/pages/dashboard/helpers.ts";

// Verification runtime only; reuse an installed Playwright and browser.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
    : "playwright"
);
const stage = process.env.BUDOGRAPH_REVIEW_STAGE ?? "final";
const base = process.env.BUDOGRAPH_BASE_URL ?? "http://127.0.0.1:4173";
const root = "tmp/phase-2b-4c-evidence";
const out = `${root}/${stage}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  headless: true,
});
const report = {
  stage,
  browser: browser.version(),
  matrix: [],
  boundaries: [],
  console: [],
  errors: [],
};
const matrix = [
  [1440, 1000, "en", "light"],
  [1440, 1000, "en", "dark"],
  [1280, 900, "bg", "light"],
  [1024, 900, "en", "light"],
  [768, 1024, "en", "light"],
  [390, 844, "bg", "light"],
  [360, 800, "en", "dark"],
  [320, 740, "bg", "dark"],
];
async function make(width, height, language, theme) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: language === "bg" ? "bg-BG" : "en-GB",
    timezoneId: "Europe/Sofia",
  });
  await context.addInitScript(
    ({ language, theme }) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(
          "budograph.preferences.v1",
          JSON.stringify({ version: 1, language, theme }),
        );
        sessionStorage.setItem("seeded", "1");
      }
    },
    { language, theme },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(String(e)));
  page.on("console", (m) => {
    if (["warning", "error"].includes(m.type())) report.console.push(m.text());
  });
  return { page, context };
}
async function go(page, path) {
  await page.goto(base + path);
  await page.locator("main h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${stage}: document overflow at ${page.viewportSize().width}`,
  );
}
async function dashboardFacts(page) {
  return page.evaluate(() => {
    const text = (e) => e?.textContent.replace(/\s+/g, " ").trim() ?? "";
    const all = (s, parent = document) => [...parent.querySelectorAll(s)];
    return {
      event: text(document.querySelector(".event-overview h1")),
      guest: text(document.querySelector(".event-overview__guest")),
      state: text(document.querySelector(".event-overview__state")),
      facts: all(".event-overview__facts > span").map(text),
      counts: Object.fromEntries(
        all(".event-overview dl > div")
          .map((e) => [
            text(e.querySelector("dt")),
            text(e.querySelector("dd")),
          ])
          .sort(),
      ),
      progress: document
        .querySelector('[role="progressbar"]')
        .getAttribute("aria-valuenow"),
      progressLabel: document
        .querySelector('[role="progressbar"]')
        .getAttribute("aria-label"),
      queue: all(".focus-item").map((e) => ({
        href: e.getAttribute("href"),
        title: text(e.querySelector("strong")),
        action: text(e.querySelector(".focus-item__action")),
        reason: text(e.querySelector(".focus-item__reason")),
        priority: text(e.querySelector(".focus-item__priority")),
        deadline: text(e.querySelector("time")),
      })),
      timeline: all(".timeline-window").map((w) => ({
        heading: text(w.querySelector("h3")),
        preview: w.querySelector(":scope > ol").children.length,
        entries: all(".timeline-entry", w).map((e) => ({
          href: e.getAttribute("href"),
          date: e.querySelector("time").dateTime,
          title: text(e.querySelector("strong")),
          kind: text(e.querySelector(".timeline-entry__kind")),
          state: text(e.querySelector(".timeline-entry__state")),
        })),
      })),
      changes: all(".change-impact__entry").map((e) => ({
        title: text(e.querySelector("h3")),
        description: text(e.querySelector("header > p")),
        areas: all("li", e).map(text),
        checkpoint: e
          .querySelector(".change-impact__checkpoint")
          .getAttribute("href"),
        checkpointTitle: text(
          e.querySelector(".change-impact__checkpoint strong"),
        ),
        date: text(e.querySelector(".change-impact__checkpoint time")),
      })),
      pressure: all(".pressure-row").map((e) => ({
        identity: text(e.querySelector(".pressure-row__identity")),
        signal: text(e.querySelector(".pressure-row__signal")),
        counts: text(e.querySelector(".pressure-row__counts")),
      })),
    };
  });
}
async function dashboardComposition(page) {
  assert.equal(
    await page
      .locator(
        ".event-overview__kicker, .focus-item__number, .timeline-entry__rail",
      )
      .count(),
    0,
  );
  const styles = await page.evaluate(() => {
    const event = getComputedStyle(document.querySelector(".event-overview"));
    const action = document.querySelector(".focus-item__action");
    const title = action.parentElement.querySelector("strong");
    const a = getComputedStyle(action),
      t = getComputedStyle(title);
    return {
      background: event.backgroundColor,
      shadow: event.boxShadow,
      radius: event.borderRadius,
      first: title === action.parentElement.firstElementChild,
      weight: +a.fontWeight < +t.fontWeight,
      utility:
        a.textTransform === "none" && a.backgroundColor === "rgba(0, 0, 0, 0)",
      progressWidth: document
        .querySelector('[role="progressbar"]')
        .getBoundingClientRect().width,
    };
  });
  assert.equal(styles.background, "rgba(0, 0, 0, 0)");
  assert.equal(styles.shadow, "none");
  assert.equal(styles.radius, "0px");
  assert.ok(styles.first && styles.weight && styles.utility);
  assert.ok(styles.progressWidth <= 220);
  assert.ok(
    await page.evaluate(
      () =>
        parseFloat(
          getComputedStyle(document.querySelector(".timeline-entry--milestone"))
            .paddingTop,
        ) >
        parseFloat(
          getComputedStyle(document.querySelector(".timeline-entry--task"))
            .paddingTop,
        ),
    ),
    "Milestones keep their additional spacing in compact layouts",
  );
  const link = page.locator(".event-overview__task-link");
  assert.equal(await link.isVisible(), page.viewportSize().width > 520);
  if (page.viewportSize().width > 520) {
    await link.click();
    await page.waitForURL("**/tasks");
    await page.goBack();
    await page.locator(".event-overview").waitFor();
  }
  const more = page.locator(".operational-focus button[aria-expanded]");
  const preview = await page.locator(".focus-item").count();
  assert.equal(preview, 5);
  await more.click();
  assert.equal(await more.getAttribute("aria-expanded"), "true");
  assert.ok((await page.locator(".focus-item").count()) > preview);
  const last = page.locator(".focus-item").last();
  const key = await last.getAttribute("data-task-focus-key");
  await last.click();
  await page.locator(".task-drawer").waitFor();
  await page.goBack();
  await page.waitForFunction(
    (key) => document.activeElement?.dataset.taskFocusKey === key,
    key,
  );
  assert.equal(await more.getAttribute("aria-expanded"), "true");
  await page.goForward();
  await page.locator(".task-drawer").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (key) => document.activeElement?.dataset.taskFocusKey === key,
    key,
  );
  await more.click();
  assert.equal(await page.locator(".focus-item").count(), preview);
  const disclosure = page.locator(".timeline-window details").first();
  await disclosure.locator("summary").click();
  assert.equal(await disclosure.getAttribute("open"), "");
  await disclosure.locator("summary").click();
  assert.equal(await disclosure.getAttribute("open"), null);
}
async function responseComposition(page, language) {
  const state = localizeWorkspace(createDemoWorkspace(), language);
  const { t, formatDateTime, plural } = createI18n(language, {
    timeZone: "Europe/Sofia",
  });
  for (const record of await page.locator(".change-impact__entry").all()) {
    const title = await record.locator("h3").innerText();
    const change = state.changes.find((change) => change.title === title);
    assert.ok(change);
    for (const value of [
      change.description,
      change.response,
      ...change.affectedAreas,
      t(CHANGE_SEVERITY_MESSAGE_KEYS[change.severity]),
      t(CHANGE_STATUS_MESSAGE_KEYS[change.responseStatus]),
      t("changes.responseOwner", {
        owner: state.teamMembers.find((m) => m.id === change.ownerId).name,
      }),
      t("changes.reported", { date: formatDateTime(change.reportedAt) }),
      plural(change.affectedTaskIds.length, {
        one: "dashboard.changes.affectedTasks.one",
        other: "dashboard.changes.affectedTasks.other",
      }),
    ])
      assert.ok(
        (await record.innerText()).includes(value),
        `Missing change fact: ${value}`,
      );
  }
  assert.ok(
    await page
      .locator(".change-impact__entry")
      .first()
      .evaluate((record) => {
        const style = getComputedStyle(record);
        const severity = record.querySelector(
          ".change-impact__identity > span",
        );
        const status = record.querySelector(".change-impact__meta > span");
        const checkpoint = record.querySelector(".change-impact__checkpoint");
        return (
          style.backgroundColor === "rgba(0, 0, 0, 0)" &&
          style.boxShadow === "none" &&
          getComputedStyle(severity).color !== getComputedStyle(status).color &&
          getComputedStyle(status).backgroundColor === "rgba(0, 0, 0, 0)" &&
          checkpoint.previousElementSibling.tagName === "P"
        );
      }),
  );
  assert.equal(
    await page
      .locator(".pressure-row .avatar, .pressure-row a, .pressure-row button")
      .count(),
    0,
  );
  const checkpoint = page.locator(".change-impact__checkpoint").first();
  const key = await checkpoint.getAttribute("data-task-focus-key");
  await checkpoint.click();
  await page.locator(".task-drawer").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (key) => document.activeElement?.dataset.taskFocusKey === key,
    key,
  );
  const quiet = page.locator(".team-pressure__quiet");
  await quiet.locator("summary").click();
  assert.equal(await quiet.getAttribute("open"), "");
  await quiet.locator("summary").click();
  assert.equal(await quiet.getAttribute("open"), null);
}
async function canonicalDashboard(page, language) {
  const state = localizeWorkspace(createDemoWorkspace(), language);
  const i18n = createI18n(language, { timeZone: "Europe/Sofia" });
  const now = getDemoReferenceNow();
  const event = state.events[0];
  assert.equal(
    await page.locator(".event-overview h1").innerText(),
    event.name,
  );
  assert.equal(
    await page.locator(".event-overview__guest").textContent(),
    i18n.t("dashboard.withGuest", { guest: event.guestInstructor }),
  );
  assert.deepEqual(
    await page.locator(".event-overview__state > span").allTextContents(),
    [
      i18n.t(`status.event.${event.status}`),
      i18n.t("dashboard.fictionalEvent"),
    ],
  );
  assert.deepEqual(
    await page.locator(".event-overview__facts > span").allTextContents(),
    [
      i18n.formatDateRange(event.startDate, event.endDate).replace(/\s/g, " "),
      event.location,
      i18n.plural(state.teamMembers.length, {
        one: "dashboard.teamCount.one",
        other: "dashboard.teamCount.other",
      }),
    ],
  );
  const counts = getTaskCounts(state.tasks, now);
  assert.deepEqual(
    (await dashboardFacts(page)).counts,
    Object.fromEntries(
      ["total", "completed", "active", "blocked", "overdue"].map((key) => [
        i18n.t(`dashboard.summary.${key}`),
        String(counts[key]),
      ]),
    ),
  );
  const timeline = buildPreparationTimeline(state.tasks, event.milestones, now);
  const windows = ["current", "today", "near", "later"];
  const limits = [2, 3, 4, 4];
  const actualTimeline = (await dashboardFacts(page)).timeline;
  assert.deepEqual(
    actualTimeline.map((w) => w.heading),
    windows
      .filter((w) => timeline.some((e) => e.window === w))
      .map((w) => i18n.t(`dashboard.timeline.window.${w}`)),
  );
  for (let i = 0; i < windows.length; i++) {
    const entries = timeline.filter((e) => e.window === windows[i]);
    if (!entries.length) continue;
    const actual = actualTimeline.find(
      (w) => w.heading === i18n.t(`dashboard.timeline.window.${windows[i]}`),
    );
    assert.equal(actual.preview, Math.min(limits[i], entries.length));
    assert.deepEqual(
      actual.entries.map((e) => [e.date, e.title, e.kind, e.state]),
      entries.map((e) => [
        e.date,
        e.kind === "task" ? e.task.title : e.milestone.title,
        i18n.t(`dashboard.timeline.${e.kind}`),
        e.kind === "task"
          ? i18n.t(TASK_STATUS_MESSAGE_KEYS[e.task.status])
          : i18n.t(`status.milestone.${e.milestone.status}`),
      ]),
    );
  }
  const { pressure } = partitionTeamPressure(
    getTeamWorkload(state.teamMembers, state.tasks, now).sort(
      (a, b) =>
        b.atRisk - a.atRisk ||
        b.active - a.active ||
        b.assigned - a.assigned ||
        a.member.name.localeCompare(b.member.name, i18n.locale),
    ),
  );
  assert.deepEqual(
    await page.locator(".pressure-row__identity strong").allTextContents(),
    pressure.map((w) => w.member.name),
  );
  assert.deepEqual(
    await page.locator(".pressure-row__identity > span").allTextContents(),
    pressure.map((w) => w.member.role),
  );
  assert.deepEqual(
    await page.locator(".pressure-row__counts").allTextContents(),
    pressure.map((w) =>
      i18n.t("dashboard.workload.pressureSummary", {
        blocked: String(w.blocked),
        overdue: String(w.overdue),
        active: String(w.active),
      }),
    ),
  );
  const expected = getAttentionTasks(
    state.tasks,
    now,
    state.tasks.length,
  ).slice(0, 5);
  const items = await page.locator(".focus-item").all();
  assert.equal(items.length, expected.length);
  for (let i = 0; i < items.length; i++) {
    assert.equal(
      await items[i].locator("strong").innerText(),
      expected[i].title,
    );
    assert.equal(
      await items[i].locator(".focus-item__reason").innerText(),
      getAttentionReason(expected[i], now, i18n),
    );
    assert.ok(
      (await items[i].innerText()).includes(
        state.teamMembers.find((m) => m.id === expected[i].ownerId).name,
      ),
    );
  }
  for (const entry of await page.locator(".timeline-entry--task").all()) {
    const id = new URL(await entry.getAttribute("href"), base).searchParams.get(
      "task",
    );
    const source = state.tasks.find((item) => item.id === id);
    assert.ok(source);
    assert.equal(
      await entry.locator(".timeline-entry__owner").textContent(),
      `${i18n.t("taskDetails.owner")}: ${state.teamMembers.find((m) => m.id === source.ownerId).name}`,
    );
  }
  const progress = page.getByRole("progressbar");
  assert.equal(
    Number(await progress.getAttribute("aria-valuenow")),
    Math.round(
      (state.tasks.filter((task) => task.status === "completed").length /
        state.tasks.length) *
        100,
    ),
  );
  for (const control of await page
    .locator(".page--dashboard .text-button, .page--dashboard summary")
    .all())
    if (await control.isVisible())
      assert.ok((await control.boundingBox()).height >= 44);
}
async function tasksComposition(page, language) {
  const state = localizeWorkspace(createDemoWorkspace(), language);
  const i18n = createI18n(language, { timeZone: "Europe/Sofia" });
  const now = getDemoReferenceNow();
  const allFilters = {
    search: "",
    status: "all",
    ownerId: "all",
    category: "all",
  };
  const totals = getTaskCounts(state.tasks, now);
  const expected = filterTasks(state.tasks, state.teamMembers, allFilters, now);
  assert.equal(
    await page.locator("main h1").innerText(),
    i18n.t("tasks.title"),
  );
  assert.equal(
    await page.locator(".page-header__description").innerText(),
    i18n.t("tasks.description", { event: state.events[0].name }),
  );
  assert.equal(
    await page.locator(".task-filters__result").getAttribute("aria-live"),
    "polite",
  );
  async function assertTotals() {
    assert.deepEqual(
      await page.locator(".tasks-overview dd").allTextContents(),
      [totals.total, totals.active, totals.blocked, totals.overdue].map(String),
    );
  }
  await assertTotals();
  await tasksAlignment(page);
  assert.ok(
    await page.locator(".tasks-overview").evaluate((e) => {
      const s = getComputedStyle(e);
      return (
        s.display === "flex" &&
        parseFloat(s.borderTopWidth) === 0 &&
        [...e.children].every((item) => {
          const s = getComputedStyle(item),
            d = getComputedStyle(item.querySelector("dd"));
          return (
            s.backgroundColor === "rgba(0, 0, 0, 0)" &&
            parseFloat(s.borderLeftWidth) === 0 &&
            parseFloat(d.fontSize) <= 14
          );
        })
      );
    }),
  );
  const rows = await page.locator(".task-row").all();
  assert.equal(rows.length, expected.length);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i],
      task = expected[i];
    assert.equal(await row.getAttribute("role"), "row");
    assert.equal(await row.locator('[role="cell"]').count(), 4);
    assert.equal(await row.locator(".task-row__link").innerText(), task.title);
    assert.equal(
      await row.locator(".task-row__context > span").first().innerText(),
      task.category,
    );
    assert.ok(
      (await row.locator(".task-owner").innerText()).includes(
        state.teamMembers.find((m) => m.id === task.ownerId).name,
      ),
    );
    assert.equal(
      await row.locator(".task-acceptance").innerText(),
      i18n.t(
        task.acknowledged
          ? "taskDetails.acknowledged"
          : "taskDetails.acknowledgementNeeded",
      ),
    );
    assert.equal(
      await row.locator(".task-deadline time").getAttribute("datetime"),
      task.deadline,
    );
    assert.equal(
      await row.locator(".task-deadline small").textContent(),
      isTaskOverdue(task, now)
        ? i18n.t("taskDetails.overdue")
        : i18n.t("tasks.table.updated", {
            date: i18n.formatDateTime(task.updatedAt),
          }),
    );
    assert.equal(
      await row.locator(".task-row__status .status-badge").innerText(),
      i18n.t(TASK_STATUS_MESSAGE_KEYS[task.status]),
    );
    assert.equal(
      await row.locator(".task-priority").count(),
      task.priority === "normal" ? 0 : 1,
    );
    if (task.priority !== "normal") {
      assert.equal(
        await row.locator(".task-priority").innerText(),
        i18n.t(TASK_PRIORITY_MESSAGE_KEYS[task.priority]),
      );
      assert.ok(
        await row.locator(".task-priority").evaluate((e) => {
          const s = getComputedStyle(e);
          return (
            !e.querySelector("svg") &&
            s.backgroundColor === "rgba(0, 0, 0, 0)" &&
            parseFloat(s.borderWidth) === 0
          );
        }),
      );
    }
  }
  await filters(page);
  // Each filter selects via keyboard; result counts change, complete-event totals do not.
  for (const id of ["status-filter", "owner-filter", "category-filter"]) {
    await page.locator(`#${id}-trigger`).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const count = await page.locator(".task-row").count();
    assert.ok(count > 0 && count < expected.length);
    assert.equal(
      await page.locator(".task-filters__result").innerText(),
      i18n.t("tasks.resultCount", {
        visible: String(count),
        total: String(expected.length),
      }),
    );
    await assertTotals();
    await page.locator(".task-filters__clear").click();
  }
  const first = expected[0];
  await page.locator("#task-search").fill(first.title);
  assert.equal(await page.locator(".task-row").count(), 1);
  await assertTotals();
  await drawer(page);
  const link = page.locator(".task-row__link").first();
  await link.click();
  await page.locator(".task-drawer").waitFor();
  await page.goBack();
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains("task-row__link"),
  );
  assert.equal(await page.locator("#task-search").inputValue(), first.title);
  await page.goForward();
  await page.locator(".task-drawer").waitFor();
  await page.reload();
  await page.locator(".task-drawer").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".task-drawer").waitFor({ state: "detached" });
  await page.locator("#task-search").fill("no-such-seminar-task-2b4c");
  assert.equal(await page.locator(".task-row").count(), 0);
  await assertTotals();
  await page.locator(".empty-state button").click();
  assert.equal(await page.locator(".task-row").count(), expected.length);
  await page.locator(".group-toggle").press("Space");
  assert.equal(
    await page.locator(".group-toggle").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".task-row").count(), expected.length);
  await registerGeometry(page);
  await assertTotals();
  await page.locator(".group-toggle").press("Enter");
  assert.deepEqual(
    await page.locator(".task-row__link").allTextContents(),
    expected.map((task) => task.title),
  );
  await go(page, "/tasks?task=unknown-2b4c");
  assert.equal(await page.locator('.notice[role="status"]').count(), 1);
  await page.locator(".notice button").click();
  await page.waitForURL("**/tasks");
}
async function tasksAlignment(page) {
  const title = await page.locator("main h1").boundingBox();
  const workspace = await page.locator(".task-workspace").boundingBox();
  assert.ok(
    Math.abs(title.x - workspace.x) <= 1,
    "Tasks heading must align with its working region",
  );
}
async function registerGeometry(page) {
  const problems = await page.locator(".task-row").evaluateAll((rows) =>
    rows.flatMap((row) => {
      const r = row.getBoundingClientRect();
      const children = [...row.children].filter(
        (e) => !e.classList.contains("task-row__chevron"),
      );
      const errors = [];
      for (const e of children) {
        const b = e.getBoundingClientRect();
        if (
          b.right > r.right + 1 ||
          b.left < r.left - 1 ||
          e.scrollWidth > e.clientWidth + 1
        )
          errors.push({ class: e.className, problem: "cell overflow" });
      }
      for (const badge of row.querySelectorAll(".status-badge")) {
        const b = badge.getBoundingClientRect();
        const arrow = row.querySelector(".task-row__chevron");
        if (arrow && getComputedStyle(arrow).display !== "none") {
          const a = arrow.getBoundingClientRect();
          if (b.right > a.left && b.bottom > a.top && b.top < a.bottom)
            errors.push({
              problem: "badge-arrow collision",
              text: badge.textContent,
            });
        }
      }
      for (let i = 0; i < children.length; i++)
        for (let j = i + 1; j < children.length; j++) {
          const a = children[i].getBoundingClientRect(),
            b = children[j].getBoundingClientRect();
          if (
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
          )
            errors.push({ problem: "cell collision" });
        }
      return errors;
    }),
  );
  assert.deepEqual(problems, []);
}
async function contrast(page) {
  const samples = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rgb = (color) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const blend = (front, back) =>
      front
        .slice(0, 3)
        .map((v, i) => (v * front[3]) / 255 + back[i] * (1 - front[3] / 255));
    const luminance = (color) =>
      color
        .map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    return [
      ...document.querySelectorAll(
        ".focus-item strong, .focus-item__action, .focus-item__reason, .focus-item__meta > *, .focus-item__priority, .timeline-entry strong, .timeline-entry__kind, .timeline-entry__state, .timeline-entry time, .change-impact__meta span, .change-impact__checkpoint strong, .pressure-row__identity > *, .pressure-row__signal, .pressure-row__counts, .event-overview__metric--overdue dd, .task-row__link, .task-acceptance, .task-deadline time, .task-deadline small, .task-row .status-badge, .task-priority, .tasks-overview dt, .tasks-overview dd, .change-impact__identity > span, .task-drawer__owner strong, .task-drawer__owner small, .task-drawer__acceptance-state p, .task-drawer__metadata dd",
      ),
    ]
      .filter(
        (e) =>
          e.checkVisibility({ checkVisibilityCSS: true }) &&
          e.getBoundingClientRect().height,
      )
      .map((e) => {
        const ancestors = [];
        for (let p = e; p; p = p.parentElement) ancestors.unshift(p);
        let bg = [255, 255, 255];
        for (const p of ancestors)
          bg = blend(rgb(getComputedStyle(p).backgroundColor), bg);
        const s = getComputedStyle(e),
          fg = blend(rgb(s.color), bg);
        const a = luminance(fg),
          b = luminance(bg);
        return {
          text: e.textContent.slice(0, 55),
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          minimum:
            parseFloat(s.fontSize) >= 24 ||
            (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700)
              ? 3
              : 4.5,
        };
      });
  });
  for (const sample of samples)
    assert.ok(sample.ratio >= sample.minimum, JSON.stringify(sample));
  return {
    count: samples.length,
    lowest: Math.min(...samples.map((s) => s.ratio)),
  };
}
async function filters(page) {
  for (const trigger of await page
    .locator(".task-filter-select .budo-select__trigger")
    .all()) {
    assert.ok((await trigger.boundingBox()).height >= 44);
    await trigger.focus();
    await page.keyboard.press("Space");
    const popup = page.getByRole("listbox");
    await popup.waitFor();
    const box = await popup.boundingBox();
    const viewport = page.viewportSize();
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1);
    assert.ok(box.y >= 0 && box.y + box.height <= viewport.height + 1);
    await page.keyboard.press("End");
    await page.keyboard.press("Home");
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () =>
        !document.querySelector('[role="listbox"]') &&
        document.activeElement?.classList.contains("budo-select__trigger"),
    );
    assert.equal(
      await trigger.evaluate((e) => e === document.activeElement),
      true,
    );
  }
}
async function drawer(page) {
  const link = page.locator(".task-row__link").first();
  await link.focus();
  await page.keyboard.press("Enter");
  await page.locator(".task-drawer").waitFor();
  const close = page.locator(".task-drawer__topbar .icon-button");
  const box = await close.boundingBox();
  assert.ok(Math.abs(box.width - 44) < 0.1);
  assert.ok(Math.abs(box.height - 44) < 0.1);
  for (const id of [
    "task-responsibility-heading",
    "task-progress-heading",
    "task-metadata-heading",
  ])
    assert.equal(await page.locator(`h3#${id}`).count(), 1);
  assert.equal(
    await page.locator(".task-drawer__section-heading span").count(),
    await page.locator("#task-relationships-heading").count(),
  );
  await page
    .locator(".task-drawer")
    .evaluate((e) =>
      Promise.all(e.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  const suffix = await page.evaluate(
    () =>
      `${innerWidth}-${document.documentElement.lang}-${document.documentElement.dataset.theme}`,
  );
  await page.screenshot({ path: `${out}/drawer-${suffix}.png` });
  await contrast(page);
  const controls = page
    .locator(".task-drawer")
    .locator('button, a[href], input, select, textarea, [tabindex="0"]');
  await controls.last().focus();
  await page.keyboard.press("Tab");
  assert.equal(await close.evaluate((e) => e === document.activeElement), true);
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await controls.last().evaluate((e) => e === document.activeElement),
    true,
  );
  const status = page.locator(".task-status-select .budo-select__trigger");
  await status.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("listbox").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".task-drawer").count(), 1);
  await page.keyboard.press("Escape");
  await page.locator(".task-drawer").waitFor({ state: "detached" });
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains("task-row__link"),
  );
}
try {
  for (const [width, height, language, theme] of matrix) {
    const key = `${width}-${language}-${theme}`;
    const { page, context } = await make(width, height, language, theme);
    const routes =
      stage === "group1" || stage === "group2"
        ? ["dashboard", "team"]
        : ["dashboard", "tasks", "team"];
    for (const route of routes) {
      await go(page, route === "dashboard" ? "/" : `/${route}`);
      await noOverflow(page);
      await page.screenshot({
        path: `${out}/${route}-${key}.png`,
        fullPage: true,
        animations: "disabled",
      });
      if (route === "dashboard") {
        const facts = await dashboardFacts(page);
        const factPath = `${root}/baseline/facts-${key}.json`;
        if (stage === "baseline")
          writeFileSync(factPath, JSON.stringify(facts, null, 2));
        else {
          if (existsSync(factPath))
            assert.deepEqual(
              facts,
              JSON.parse(readFileSync(factPath, "utf8")),
              `Dashboard facts ${key}`,
            );
          await canonicalDashboard(page, language);
          await dashboardComposition(page);
          if (stage !== "group1") await responseComposition(page, language);
        }
      }
      if (stage === "final" && route !== "team") {
        await contrast(page);
        if (route === "tasks") {
          await registerGeometry(page);
          await tasksComposition(page, language);
          await noOverflow(page);
        }
      }
      if (route === "team") {
        const before = `${root}/baseline/team-${key}.png`;
        if (stage !== "baseline" && existsSync(before))
          assert.ok(
            readFileSync(before).equals(readFileSync(`${out}/team-${key}.png`)),
            `Team initial screenshot changed ${key}`,
          );
        await page.locator(".team-roster__member").nth(1).click();
        await page.screenshot({
          path: `${out}/team-selected-${key}.png`,
          fullPage: true,
          animations: "disabled",
        });
        const selectedBefore = `${root}/baseline/team-selected-${key}.png`;
        if (stage !== "baseline" && existsSync(selectedBefore))
          assert.ok(
            readFileSync(selectedBefore).equals(
              readFileSync(`${out}/team-selected-${key}.png`),
            ),
            `Team selected screenshot changed ${key}`,
          );
      }
      report.matrix.push({ route, width, height, language, theme });
    }
    await context.close();
    console.log(`${stage}: ${key} passed`);
  }
  if (stage === "final") {
    for (const width of [
      1280, 1100, 1024, 1000, 980, 970, 961, 960, 900, 800, 768, 600, 430, 420,
      390, 360, 320,
    ]) {
      for (const language of ["en", "bg"]) {
        const { page, context } = await make(width, 900, language, "light");
        await go(page, "/tasks");
        await noOverflow(page);
        await tasksAlignment(page);
        await registerGeometry(page);
        await filters(page);
        const grid = await page
          .locator(".task-row")
          .first()
          .evaluate((e) => ({
            columns: getComputedStyle(e).gridTemplateColumns,
            areas: getComputedStyle(e).gridTemplateAreas,
          }));
        await page.screenshot({
          path: `${out}/tasks-boundary-${width}-${language}.png`,
        });
        await page.locator(".group-toggle").press("Space");
        await registerGeometry(page);
        await noOverflow(page);
        report.boundaries.push({ width, language, grid });
        await context.close();
      }
    }
  }
  assert.deepEqual(report.console, []);
  assert.deepEqual(report.errors, []);
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    `${stage}: ${report.matrix.length} page cases and ${report.boundaries.length} boundaries passed; zero console warnings/errors or page errors.`,
  );
} finally {
  await browser.close();
}
