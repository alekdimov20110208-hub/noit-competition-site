import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createDemoWorkspace } from "../src/data/demo.ts";
import { verifyTeamEdges } from "./team-workspace-edges.mjs";
// Uses an existing verification runtime, without adding application dependencies.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
    : "playwright"
);
const out = "tmp/phase-2b-3-evidence";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  headless: true,
});
const baseURL = process.env.BUDOGRAPH_BASE_URL ?? "http://127.0.0.1:4173";
const report = {
  browser: browser.version(),
  matrix: [],
  extra: [],
  console: [],
  errors: [],
};
async function make(
  width,
  lang,
  theme,
  workspace = null,
  reducedMotion = "no-preference",
  historyState = null,
) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: lang === "bg" ? "bg-BG" : "en-GB",
    timezoneId: "Europe/Sofia",
    reducedMotion,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) report.console.push(m.text());
  });
  page.on("pageerror", (e) => report.errors.push(String(e)));
  await page.addInitScript(
    ({ lang, theme, workspace, historyState }) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(
          "budograph.preferences.v1",
          JSON.stringify({ version: 1, language: lang, theme }),
        );
        if (workspace)
          localStorage.setItem(
            "budograph.workspace.v1",
            JSON.stringify(workspace),
          );
        if (historyState) history.replaceState(historyState, "");
        sessionStorage.setItem("seeded", "1");
      }
    },
    { lang, theme, workspace, historyState },
  );
  return { context, page };
}
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let previous = scrollY,
          stable = 0,
          frames = 0;
        function tick() {
          stable = scrollY === previous ? stable + 1 : 0;
          previous = scrollY;
          if (stable >= 8 || ++frames >= 120) resolve();
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }),
  );
}
async function go(page, path = "/team") {
  await page.goto(baseURL + path);
  await page.locator("main h1").waitFor();
  await settle(page);
}
async function focusView(page) {
  return page.evaluate(() => {
    const e = document.activeElement;
    const r = e.getBoundingClientRect();
    const sheet = document.querySelector(".team-sheet__body");
    const header = document
      .querySelector(".app-header")
      .getBoundingClientRect();
    const nav = document.querySelector(".mobile-nav").getBoundingClientRect();
    const bounds = sheet?.getBoundingClientRect();
    return {
      key: e.dataset.taskFocusKey,
      member: e.dataset.teamMember,
      id: e.id,
      tag: e.tagName,
      scrollY,
      detailScrollTop: sheet?.scrollTop ?? 0,
      visible:
        r.top >= (bounds?.top ?? header.bottom) - 1 &&
        r.bottom <=
          (bounds?.bottom ?? (nav.height ? nav.top : innerHeight)) + 1,
      top: r.top,
      bottom: r.bottom,
      outline: getComputedStyle(e).outlineStyle,
    };
  });
}
async function geometry(page, width) {
  const result = await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll(
        ".team-workspace, .team-roster, .team-detail, .team-sheet, .team-sheet__body",
      ),
    ];
    return {
      document: document.documentElement.scrollWidth,
      regions: elements.map((e) => ({
        name: e.className,
        scroll: e.scrollWidth,
        client: e.clientWidth,
      })),
      smallText: [
        ...document.querySelectorAll(
          ".team-page p, .team-detail p, .team-roster span, .team-work-row a",
        ),
      ].filter(
        (e) =>
          e.getClientRects().length &&
          parseFloat(getComputedStyle(e).fontSize) < 12,
      ).length,
    };
  });
  assert.equal(result.document, width);
  assert.equal(result.smallText, 0);
  for (const region of result.regions)
    assert.ok(region.scroll <= region.client + 1, JSON.stringify(region));
  return result;
}
async function select(page, id, compact) {
  const button = page.locator(`[data-team-member="${id}"]`);
  await button.focus();
  await page.keyboard.press("Enter");
  await page.locator("#team-member-heading").waitFor();
  await settle(page);
  assert.equal(await button.getAttribute("aria-pressed"), "true");
  if (compact) {
    assert.equal(await page.locator(".team-sheet").count(), 1);
    assert.equal(
      await page.evaluate(() => document.getElementById("root").inert),
      true,
    );
    assert.equal((await focusView(page)).id, "team-member-heading");
  } else
    assert.equal(
      await button.evaluate((e) => e === document.activeElement),
      true,
    );
}
async function returned(page, key, compact) {
  await page.waitForFunction(
    (key) => document.activeElement?.dataset.taskFocusKey === key,
    key,
  );
  await settle(page);
  const view = await focusView(page);
  assert.equal(new URL(page.url()).pathname, "/team");
  assert.equal(await page.locator(".team-sheet").count(), Number(compact));
  assert.equal(await page.locator(".task-drawer").count(), 0);
  assert.equal(view.visible, true, JSON.stringify(view));
  return view;
}
async function taskRoundtrip(page, compact) {
  const link = page.locator(".team-work-row__link:visible").first();
  await link.focus();
  await settle(page);
  const key = await link.getAttribute("data-task-focus-key");
  const href = await link.getAttribute("href");
  const before = await focusView(page);
  await page.keyboard.press("Enter");
  await page.locator(".task-drawer").waitFor();
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, href);
  assert.equal(await page.locator(".team-sheet").count(), 0);
  assert.equal(
    await page.evaluate(() => document.getElementById("root").inert),
    false,
  );
  await page.goBack();
  const after = await returned(page, key, compact);
  assert.ok(Math.abs(after.detailScrollTop - before.detailScrollTop) <= 20);
  await page.goForward();
  await page.locator(".task-drawer").waitFor();
  await page.goBack();
  await returned(page, key, compact);
  await page.keyboard.press("Enter");
  await page.locator(".task-drawer").waitFor();
  await page.keyboard.press("Escape");
  await returned(page, key, compact);
  await page.keyboard.press("Enter");
  await page.locator(".task-drawer").waitFor();
  await page.locator(".task-drawer__topbar button").click();
  await returned(page, key, compact);
  return { before, after, href };
}
function stressWorkspace() {
  const state = createDemoWorkspace();
  state.demoLabel = "Synthetic Team browser verification only";
  const long =
    "Александра Константинополска — координация на международните участници";
  state.teamMembers = [
    {
      ...state.teamMembers[0],
      id: "many",
      name: long,
      role:
        "Отговорник за посрещането, настаняването и безопасния достъп до тренировъчната зала " +
        "Непрекъснатадългадума".repeat(5),
    },
    {
      ...state.teamMembers[0],
      id: "accepted",
      name: "Всичко прието",
      role: "Предстояща подготовка",
    },
    {
      ...state.teamMembers[0],
      id: "done",
      name: "Завършена подготовка",
      role: "Зала",
    },
    {
      ...state.teamMembers[0],
      id: "zero",
      name: "Без задачи",
      role: "Наблюдател",
    },
    ...Array.from({ length: 20 }, (_, i) => ({
      ...state.teamMembers[0],
      id: `extra-${i}`,
      name: `Тестов участник ${i + 1}`,
      role: "Изолирани тестови данни",
    })),
  ];
  const base = {
    ...state.tasks[0],
    category: "Придвижване и настаняване",
    context: "Synthetic browser coverage",
    ownerId: "many",
    priority: "normal",
    acknowledged: true,
  };
  state.tasks = Array.from({ length: 100 }, (_, i) => ({
    ...base,
    id: `many-${String(i).padStart(3, "0")}`,
    title:
      `Задача ${i + 1}: Подробно уточняване на пристигането на инструктора и осигуряване на достъп до залата ` +
      "Придвижване".repeat(9),
    status: i < 10 ? "blocked" : i < 30 ? "not-started" : "completed",
    acknowledged: i >= 20,
    deadline: i < 10 ? "2026-09-01" : "2026-09-20",
    blockedBy:
      i < 10 ? "Очаква се потвърждение на пристигането на госта" : undefined,
  }));
  state.tasks.push(
    ...Array.from({ length: 8 }, (_, i) => ({
      ...base,
      id: `accepted-${i}`,
      ownerId: "accepted",
      title: `Предстояща приета задача ${i}`,
      status: "in-progress",
      deadline: "2026-09-20",
    })),
  );
  state.tasks.push({
    ...base,
    id: "done-only",
    ownerId: "done",
    title: "Завършена задача",
    status: "completed",
    deadline: "2026-09-01",
  });
  state.events[0].leadOrganizerId = "many";
  state.changes = [];
  return state;
}
try {
  const matrix = [1440, 1024, 768, 390, 320].flatMap((w) =>
    ["en", "bg"].flatMap((l) => ["light", "dark"].map((t) => [w, l, t])),
  );
  matrix.push(
    [1280, "bg", "light"],
    [960, "en", "light"],
    [961, "bg", "dark"],
    [900, "en", "light"],
    [430, "en", "light"],
    [360, "en", "dark"],
  );
  for (const [width, lang, theme] of matrix) {
    const { page, context } = await make(width, lang, theme);
    await go(page);
    const availableWidth = await page
      .locator(".team-workspace")
      .evaluate((e) => e.getBoundingClientRect().width);
    const compact = width <= 960 || availableWidth < 660;
    const name = `team-${width}-${lang}-${theme}`;
    const snapshot = await page.locator(".demo-snapshot").innerText();
    const storage = await page.evaluate(() => JSON.stringify(localStorage));
    assert.equal(
      await page.locator(".team-workspace").getAttribute("data-compact"),
      String(compact),
    );
    assert.equal(await page.locator("[data-team-member]").count(), 5);
    assert.equal(
      await page
        .locator('[data-team-member][aria-pressed="true"]')
        .getAttribute("data-team-member"),
      "member-lina-moreva",
    );
    assert.equal(await page.locator(".team-sheet").count(), 0);
    await geometry(page, width);
    await page.screenshot({
      path: `${out}/${name}-roster.png`,
      fullPage: true,
    });
    const historyLength = await page.evaluate(() => history.length);
    await select(page, "member-anton-ravin", compact);
    assert.equal(
      await page.evaluate(() => history.length),
      historyLength + Number(compact),
    );
    assert.equal(
      await page.locator("#team-member-heading").innerText(),
      "Anton Ravin",
    );
    assert.equal(await page.locator("#team-attention-list > li").count(), 1);
    assert.equal(await page.locator("#team-upcoming-list > li").count(), 1);
    assert.match(
      await page.locator(".team-work-row__reason").first().innerText(),
      lang === "bg" ? /Блокирана/ : /Blocked/,
    );
    assert.equal(await page.locator(".team-detail").count(), 1);
    const geometryResult = await geometry(page, width);
    if (!compact) {
      const roster = await page.locator(".team-roster").boundingBox();
      const detail = await page.locator(".team-detail").boundingBox();
      assert.ok(detail.x > roster.x + roster.width);
      assert.ok(
        roster.width / (roster.width + detail.width) >= 0.36 &&
          roster.width / (roster.width + detail.width) <= 0.4,
      );
      await page.locator(".team-roster__skip").click();
      assert.equal((await focusView(page)).id, "team-member-heading");
    } else {
      const close = page.locator(".team-sheet__close");
      const box = await close.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
      await close.focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page
          .locator(".team-detail__footer > a")
          .evaluate((e) => e === document.activeElement),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await close.evaluate((e) => e === document.activeElement),
        true,
      );
      await page.locator("#team-member-heading").focus();
    }
    await page.screenshot({ path: `${out}/${name}-detail.png` });
    const navigation = await taskRoundtrip(page, compact);
    await page.screenshot({ path: `${out}/${name}-returned.png` });
    if (compact) {
      await page.keyboard.press("Escape");
      await page.locator(".team-sheet").waitFor({ state: "hidden" });
      await page.waitForFunction(
        () =>
          document.activeElement?.dataset.teamMember === "member-anton-ravin",
      );
      assert.equal(
        await page.evaluate(() => document.getElementById("root").inert),
        false,
      );
      await page.goForward();
      await page.locator(".team-sheet").waitFor();
      await page.locator(".team-sheet__close").click();
      await page.locator(".team-sheet").waitFor({ state: "hidden" });
      await select(page, "member-anton-ravin", true);
    }
    assert.equal(await page.locator(".demo-snapshot").innerText(), snapshot);
    assert.equal(
      await page.evaluate(() => JSON.stringify(localStorage)),
      storage,
    );
    report.matrix.push({
      name,
      height: 900,
      availableWidth,
      compact,
      geometry: geometryResult,
      navigation,
      history:
        "Back/Forward/Back, Escape, close, sheet close/reopen; storage unchanged",
    });
    await context.close();
    console.log(name + " passed");
  }
  for (const [width, lang, theme] of [
    [1440, "en", "light"],
    [1024, "bg", "dark"],
    [390, "bg", "light"],
    [320, "bg", "dark"],
  ]) {
    const { page, context } = await make(width, lang, theme, stressWorkspace());
    await go(page);
    const compact = width <= 960;
    await select(page, "many", compact);
    assert.equal(await page.locator("#team-attention-list > li").count(), 3);
    assert.equal(await page.locator("#team-upcoming-list > li").count(), 2);
    assert.equal(await page.locator(".team-history[open]").count(), 0);
    assert.equal(
      await page.locator('[data-team-disclosure="completed"]').innerText(),
      lang === "bg" ? "Завършени задачи 70" : "Completed work 70",
    );
    await page.locator('[data-team-disclosure="attention"]').click();
    assert.equal(await page.locator("#team-attention-list > li").count(), 20);
    const link = page
      .locator("#team-attention-list .team-work-row__link")
      .nth(15);
    await link.focus();
    await settle(page);
    const key = await link.getAttribute("data-task-focus-key");
    const before = await focusView(page);
    await page.keyboard.press("Enter");
    await page.locator(".task-drawer").waitFor();
    await page.reload();
    await page.locator(".task-drawer").waitFor();
    await page.keyboard.press("Escape");
    const after = await returned(page, key, compact);
    assert.ok(Math.abs(after.detailScrollTop - before.detailScrollTop) <= 20);
    assert.ok(
      Math.abs(after.scrollY - before.scrollY) <= 100,
      JSON.stringify({ before, after }),
    );
    assert.equal(
      await page
        .locator('[data-team-disclosure="attention"]')
        .getAttribute("aria-expanded"),
      "true",
    );
    await page.locator('[data-team-disclosure="attention"]').click();
    await settle(page);
    assert.equal(await page.locator("#team-attention-list > li").count(), 3);
    assert.equal((await focusView(page)).visible, true);
    await page.locator('[data-team-disclosure="upcoming"]').click();
    assert.equal(await page.locator("#team-upcoming-list > li").count(), 10);
    await page.locator('[data-team-disclosure="upcoming"]').click();
    const completed = page.locator('[data-team-disclosure="completed"]');
    await completed.focus();
    await page.keyboard.press("Enter");
    await page.locator(".team-history[open]").waitFor();
    assert.equal(
      await page.locator(".team-history .team-work-row__link:visible").count(),
      70,
    );
    const completedLink = page
      .locator(".team-history .team-work-row__link")
      .nth(40);
    await completedLink.focus();
    const completedKey = await completedLink.getAttribute(
      "data-task-focus-key",
    );
    await page.keyboard.press("Enter");
    await page.locator(".task-drawer").waitFor();
    await page.goBack();
    await returned(page, completedKey, compact);
    await completed.focus();
    await page.keyboard.press("Space");
    await page.locator(".team-history[open]").waitFor({ state: "hidden" });
    await geometry(page, width);
    await page.screenshot({
      path: `${out}/stress-${width}-${lang}-${theme}.png`,
    });
    if (compact) {
      await page.locator(".team-sheet__close").click();
      await page.locator(".team-sheet").waitFor({ state: "hidden" });
    }
    await select(page, "zero", compact);
    assert.equal(await page.locator(".team-work-row").count(), 0);
    assert.match(
      await page.locator(".team-detail").innerText(),
      /No tasks assigned|Няма възложени задачи/,
    );
    if (compact) {
      await page.keyboard.press("Escape");
      await page.locator(".team-sheet").waitFor({ state: "hidden" });
    }
    await select(page, "done", compact);
    assert.equal(await page.locator(".team-work-row__link:visible").count(), 0);
    assert.match(
      await page.locator(".team-detail").innerText(),
      /All assigned tasks are completed|Всички възложени задачи са завършени/,
    );
    if (compact) {
      await page.keyboard.press("Escape");
      await page.locator(".team-sheet").waitFor({ state: "hidden" });
    }
    await select(page, "accepted", compact);
    assert.equal(await page.locator("#team-attention-list").count(), 0);
    assert.equal(await page.locator("#team-upcoming-list > li").count(), 5);
    report.extra.push({
      name: `100-task stress-${width}-${lang}-${theme}`,
      before,
      after,
      result:
        "100 owned; 20 attention; 10 upcoming; 70 collapsed completed; zero, completed-only, all accepted, long BG and 24 members; disclosures and reload return passed",
    });
    await context.close();
    console.log(`stress-${width} passed`);
  }
  // Direct links preserve the existing Tasks contract and cannot open a Team sheet.
  for (const id of ["task-guest-itinerary", "unknown-task"]) {
    const { page, context } = await make(390, "bg", "light");
    await go(page, `/tasks?task=${id}`);
    await page.reload();
    const count = await page.evaluate(() => history.length);
    if (id === "unknown-task") {
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.match(
        await page.getByRole("status").innerText(),
        /Задачата не е намерена/,
      );
    } else {
      await page.locator(".task-drawer").waitFor();
      await page.keyboard.press("Escape");
      await page.locator(".task-drawer").waitFor({ state: "hidden" });
      assert.equal(
        new URL(page.url()).pathname + new URL(page.url()).search,
        "/tasks",
      );
      assert.equal(await page.evaluate(() => history.length), count);
    }
    report.extra.push({ name: `direct-${id}`, result: "load/reload safe" });
    await context.close();
  }
  // Changed task moves behind a closed completed disclosure: use visible fallback.
  for (const width of [1440, 390]) {
    const { page, context } = await make(width, "en", "light");
    await go(page);
    const compact = width <= 960;
    await select(page, "member-lina-moreva", compact);
    await page
      .locator("#team-attention-list .team-work-row__link")
      .first()
      .click();
    await page.locator(".task-status-select .budo-select__trigger").click();
    await page.getByRole("option", { name: "Completed", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      (compact) =>
        compact
          ? document.activeElement?.id === "team-member-heading"
          : document.activeElement?.dataset.teamMember === "member-lina-moreva",
      compact,
    );
    assert.equal((await focusView(page)).visible, true);
    assert.equal(await page.locator(".team-history[open]").count(), 0);
    report.extra.push({
      name: `edited-origin-${width}`,
      result: "same member, visible heading/roster fallback",
    });
    await context.close();
  }
  // Resizing changes presentation, without adding history or trapping background focus.
  const resized = await make(1024, "en", "light");
  await go(resized.page);
  await select(resized.page, "member-anton-ravin", false);
  const h = await resized.page.evaluate(() => history.length);
  await resized.page.setViewportSize({ width: 960, height: 900 });
  await resized.page.locator(".team-sheet").waitFor();
  await resized.page.locator(".team-sheet__close").click();
  await resized.page.locator(".team-sheet").waitFor({ state: "hidden" });
  assert.equal(await resized.page.evaluate(() => history.length), h);
  await select(resized.page, "member-anton-ravin", true);
  await resized.page.setViewportSize({ width: 961, height: 900 });
  await settle(resized.page);
  assert.equal(await resized.page.locator(".team-sheet").count(), 1);
  await resized.page.setViewportSize({ width: 1024, height: 900 });
  await resized.page.locator(".team-sheet").waitFor({ state: "hidden" });
  await resized.page.goBack();
  await settle(resized.page);
  assert.equal(new URL(resized.page.url()).pathname, "/team");
  assert.equal(
    await resized.page.evaluate(() => document.getElementById("root").inert),
    false,
  );
  await resized.page.setViewportSize({ width: 1440, height: 900 });
  await resized.page.locator(".team-workspace").evaluate((e) => {
    e.style.maxWidth = "650px";
  });
  await resized.page.waitForFunction(
    () => document.querySelector(".team-workspace").dataset.compact === "true",
  );
  assert.equal(await resized.page.locator(".team-sheet").count(), 0);
  await select(resized.page, "member-anton-ravin", true);
  await resized.page.locator(".team-workspace").evaluate((e) => {
    e.style.maxWidth = "";
  });
  await resized.page.locator(".team-sheet").waitFor({ state: "hidden" });
  report.extra.push({
    name: "960/961 resize and 650px available-content fallback",
    result: "selection retained, no automatic pushes, inert cleaned up",
  });
  await resized.context.close();
  // Full-register link remains honest and transient context survives its Back.
  const register = await make(390, "en", "dark");
  await go(register.page);
  await select(register.page, "member-anton-ravin", true);
  await register.page.locator(".team-detail__footer > a").click();
  await register.page.locator(".task-row").first().waitFor();
  assert.equal(new URL(register.page.url()).search, "");
  await register.page.goBack();
  await register.page.locator(".team-sheet").waitFor();
  assert.equal(
    await register.page.locator("#team-member-heading").innerText(),
    "Anton Ravin",
  );
  report.extra.push({
    name: "Open Tasks full-register link",
    result: "unfiltered /tasks, Back restores member sheet",
  });
  await register.context.close();
  // The sheet has no animation; reduced-motion rendering retains keyboard access.
  const reduced = await make(320, "bg", "dark", null, "reduce");
  await go(reduced.page);
  await select(reduced.page, "member-anton-ravin", true);
  assert.equal(
    await reduced.page
      .locator(".team-sheet")
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  await geometry(reduced.page, 320);
  report.extra.push({
    name: "reduced-motion-320-bg-dark",
    result: "no sheet animation, full geometry and keyboard access",
  });
  await reduced.context.close();
  await verifyTeamEdges({
    make,
    go,
    select,
    settle,
    geometry,
    focusView,
    report,
  });
  assert.deepEqual(report.console, []);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
  await browser.close();
  console.log(
    JSON.stringify({
      matrix: report.matrix.length,
      extra: report.extra.length,
      console: report.console,
      errors: report.errors,
      failure: report.failure,
    }),
  );
}
