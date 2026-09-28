import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createDemoWorkspace } from "../src/data/demo.ts";
import { pathToFileURL } from "node:url";
// Use an existing Playwright installation; this verification adds no application dependency.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
    : "playwright"
);
const out = "tmp/phase-2b-2-3d-evidence";
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
) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: lang === "bg" ? "bg-BG" : "en-GB",
    timezoneId: "Europe/Sofia",
    reducedMotion,
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) report.console.push(m.text());
  });
  page.on("pageerror", (e) => report.errors.push(String(e)));
  await page.addInitScript(
    ({ lang, theme, workspace }) => {
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
        sessionStorage.setItem("seeded", "1");
      }
    },
    { lang, theme, workspace },
  );
  return { page, context };
}
async function go(page, path = "/") {
  await page.goto(baseURL + path);
  await page.locator("main h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
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
async function focusView(page, selector) {
  return page
    .locator(selector)
    .first()
    .evaluate((e) => {
      const r = e.getBoundingClientRect(),
        header = document.querySelector(".app-header").getBoundingClientRect(),
        nav = document.querySelector(".mobile-nav").getBoundingClientRect();
      return {
        focused: document.activeElement === e,
        visible:
          r.top >= header.bottom - 1 &&
          r.bottom <= (nav.height ? nav.top : innerHeight) + 1,
        top: r.top,
        bottom: r.bottom,
        scrollY,
        outline: getComputedStyle(e).outlineStyle,
      };
    });
}
async function checkOrigin(page, key) {
  await page.waitForFunction(
    (key) => document.activeElement?.dataset.taskFocusKey === key,
    key,
  );
  await settle(page);
  const v = await focusView(page, `[data-task-focus-key="${key}"]`);
  assert.equal(v.focused, true);
  assert.equal(v.visible, true, JSON.stringify(v));
  assert.equal(
    await page
      .locator(".operational-focus button")
      .getAttribute("aria-expanded"),
    "true",
  );
  assert.equal(await page.locator(".focus-item").count(), 7);
  return v;
}
async function disclosures(page, selector) {
  const accessibility = await page.context().newCDPSession(page);
  async function checkNativeState(label, expanded) {
    const { nodes } = await accessibility.send("Accessibility.getFullAXTree");
    assert.ok(
      nodes.some(
        (node) =>
          node.role?.value === "DisclosureTriangle" &&
          node.name?.value === label &&
          node.properties?.some(
            (property) =>
              property.name === "expanded" && property.value.value === expanded,
          ),
      ),
    );
  }
  const all = page.locator(selector);
  const labels = [];
  for (let i = 0; i < (await all.count()); i++) {
    const d = all.nth(i),
      s = d.locator(":scope > summary");
    const before = await s.innerText();
    await checkNativeState(before, false);
    await s.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction((e) => e.open, await d.elementHandle());
    await page.waitForFunction(
      ({ e, before }) => e.textContent.trim() !== before,
      { e: await s.elementHandle(), before },
    );
    const after = await s.innerText();
    assert.notEqual(before, after);
    assert.match(after, /less|fewer|по-малко/);
    await checkNativeState(after, true);
    await page.keyboard.press("Space");
    await page.waitForFunction((e) => !e.open, await d.elementHandle());
    await page.waitForFunction(
      ({ e, before }) => e.textContent.trim() === before,
      { e: await s.elementHandle(), before },
    );
    assert.equal(await s.evaluate((e) => e === document.activeElement), true);
    await checkNativeState(before, false);
    labels.push({ before, after });
  }
  await accessibility.detach();
  return labels;
}
try {
  for (const [width, lang, theme] of [
    [1440, "en", "light"],
    [1440, "en", "dark"],
    [1024, "en", "light"],
    [390, "bg", "light"],
    [360, "en", "dark"],
    [320, "bg", "dark"],
  ]) {
    const { page, context } = await make(width, lang, theme);
    await go(page);
    const name = `dashboard-${width}-${lang}-${theme}`;
    const snapshot = await page.locator(".demo-snapshot").innerText();
    const btn = page.locator(".operational-focus button");
    assert.equal(await page.locator(".focus-item").count(), 5);
    assert.equal(await btn.getAttribute("aria-expanded"), "false");
    assert.equal(
      await btn.evaluate(
        (e) =>
          document.getElementById(e.getAttribute("aria-controls"))?.tagName,
      ),
      "OL",
    );
    const h = await page.evaluate(() => history.length);
    await btn.focus();
    await settle(page);
    const beforeExpand = await focusView(page, ".operational-focus button");
    assert.equal(beforeExpand.visible, true);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => document.querySelectorAll(".focus-item").length === 7,
    );
    await settle(page);
    const afterExpand = await focusView(page, ".operational-focus button");
    assert.equal(await btn.getAttribute("aria-expanded"), "true");
    assert.equal(afterExpand.focused, true);
    assert.equal(afterExpand.visible, true);
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page
        .locator(".focus-item")
        .last()
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () => document.querySelectorAll(".focus-item").length === 5,
    );
    await settle(page);
    const afterCollapse = await focusView(page, ".operational-focus button");
    assert.equal(afterCollapse.focused, true);
    assert.equal(afterCollapse.visible, true, JSON.stringify(afterCollapse));
    assert.equal(await page.evaluate(() => history.length), h);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => document.querySelectorAll(".focus-item").length === 7,
    );
    const origin = page.locator(".focus-item").nth(5);
    await origin.focus();
    await settle(page);
    const key = await origin.getAttribute("data-task-focus-key");
    const href = await origin.getAttribute("href");
    const before = await focusView(page, `[data-task-focus-key="${key}"]`);
    await page.screenshot({ path: `${out}/${name}-origin.png` });
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    assert.equal(
      new URL(page.url()).pathname + new URL(page.url()).search,
      href,
    );
    await page.goBack();
    const returned = await checkOrigin(page, key);
    assert.equal(await page.evaluate(() => history.length), h + 1);
    await page.screenshot({ path: `${out}/${name}-returned.png` });
    await page.goForward();
    await page.getByRole("dialog").waitFor();
    await page.goBack();
    await checkOrigin(page, key);
    assert.equal(await page.evaluate(() => history.length), h + 1);
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await checkOrigin(page, key);
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    await page.locator(".task-drawer__topbar button").click();
    await checkOrigin(page, key);
    await page.reload();
    await checkOrigin(page, key);
    const timeline = await disclosures(page, ".timeline-window__overflow");
    assert.ok(timeline.length > 0);
    const team = await disclosures(page, ".team-pressure__quiet");
    assert.equal(team.length, 1);
    assert.match(
      await page.locator(".pressure-list").innerText(),
      /Lina Moreva/,
    );
    assert.match(
      await page.locator(".pressure-list").innerText(),
      /Anton Ravin/,
    );
    const timelineOrigin = page.locator(".timeline-window__overflow").first();
    await timelineOrigin.locator("summary").click();
    const timelineLink = timelineOrigin.locator("a").first();
    await timelineLink.click();
    await page.getByRole("dialog").waitFor();
    await page.goBack();
    await page.waitForFunction(() =>
      document.activeElement?.matches(".timeline-window__overflow > summary"),
    );
    await settle(page);
    assert.equal(
      (await focusView(page, ".timeline-window__overflow > summary")).visible,
      true,
    );
    assert.equal(await page.locator(".demo-snapshot").innerText(), snapshot);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
    );
    const nav = page.locator(width <= 960 ? ".mobile-nav" : ".sidebar__nav");
    await nav.locator('a[href="/tasks"]').click();
    await page.locator(".task-row").first().waitFor();
    await nav.locator('a[href="/"]').click();
    await page.locator(".focus-item").first().waitFor();
    assert.equal(await page.locator(".focus-item").count(), 5);
    assert.equal(await btn.getAttribute("aria-expanded"), "false");
    assert.equal(
      await page.evaluate(() => history.state.budographDashboard),
      undefined,
    );
    if (width <= 960) {
      assert.equal(
        await page
          .locator(".mobile-nav")
          .evaluate((e) => getComputedStyle(e).backgroundColor),
        theme === "light" ? "rgb(255, 255, 255)" : "rgb(17, 26, 37)",
      );
      for (const link of await nav.locator("a").all()) {
        const r = await link.boundingBox();
        assert.ok(r.width >= 44 && r.height >= 44);
      }
    }
    report.matrix.push({
      name,
      beforeExpand,
      afterExpand,
      afterCollapse,
      before,
      returned,
      timeline,
      team,
      history:
        "Back/Forward/Back, Escape, close, reload, fresh navigation passed",
    });
    await context.close();
    console.log(name + " passed");
  }
  // Every native Timeline window and Team Pressure overflow, plus unchanged Change Impact.
  for (const lang of ["en", "bg"]) {
    const workspace = createDemoWorkspace();
    const base = workspace.tasks.find((t) => t.status === "blocked");
    for (const member of workspace.teamMembers)
      workspace.tasks.push({
        ...base,
        id: "synthetic-block-" + member.id,
        ownerId: member.id,
        title: "Synthetic pressure task",
        deadline: "2026-09-07",
      });
    workspace.changes.push({
      ...workspace.changes[0],
      id: "synthetic-change",
      title: "Synthetic second change",
    });
    const dates = ["2026-09-01", "2026-09-07", "2026-09-09", "2026-09-17"];
    for (let j = 0; j < dates.length; j++)
      for (let i = 0; i < 6; i++)
        workspace.events[0].milestones.push({
          id: `synthetic-${j}-${i}`,
          title: "Synthetic timeline coverage",
          date: dates[j],
          status: "upcoming",
        });
    const { page, context } = await make(
      lang === "bg" ? 320 : 1440,
      lang,
      "dark",
      workspace,
    );
    await go(page);
    const timeline = await disclosures(page, ".timeline-window__overflow");
    assert.equal(timeline.length, 4);
    const team = await disclosures(page, ".team-pressure__overflow");
    assert.equal(team.length, 1);
    const changes = await disclosures(page, ".dashboard-overflow");
    assert.equal(changes.length, 1);
    await page.screenshot({ path: `${out}/synthetic-${lang}.png` });
    report.extra.push({
      name: "all-disclosures-" + lang,
      timeline,
      team,
      changes,
    });
    await context.close();
  }
  for (const path of [
    "/tasks?task=task-guest-itinerary",
    "/tasks?task=unknown-task",
  ]) {
    const { page, context } = await make(390, "bg", "light");
    await go(page, path);
    const h = await page.evaluate(() => history.length);
    await page.reload();
    if (path.includes("unknown")) {
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.match(
        await page.getByRole("status").innerText(),
        /Задачата не е намерена/,
      );
      assert.equal(await page.locator(".task-row").count(), 16);
    } else {
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(
        new URL(page.url()).pathname + new URL(page.url()).search,
        "/tasks",
      );
      assert.equal(await page.evaluate(() => history.length), h);
    }
    report.extra.push({ name: path, result: "direct load/reload/close safe" });
    await context.close();
  }
  const { page, context } = await make(320, "bg", "dark", null, "reduce");
  await go(page);
  await page.locator(".operational-focus button").click();
  await page.locator(".focus-item").nth(6).focus();
  const key = await page
    .locator(".focus-item")
    .nth(6)
    .getAttribute("data-task-focus-key");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.reload();
  await page.getByRole("dialog").waitFor();
  const duration = await page
    .locator(".task-drawer")
    .evaluate((e) => parseFloat(getComputedStyle(e).animationDuration));
  assert.ok(duration <= 0.001);
  await page.keyboard.press("Escape");
  await checkOrigin(page, key);
  report.extra.push({
    name: "task reload then Escape; reduced motion",
    duration,
  });
  await context.close();
  // If editing removes the origin from attention, use its visible section control.
  const edited = await make(390, "en", "light");
  await go(edited.page);
  await edited.page.locator(".operational-focus button").click();
  await edited.page.locator(".focus-item").nth(5).click();
  await edited.page.getByRole("dialog").waitFor();
  await edited.page
    .locator(".task-status-select .budo-select__trigger")
    .click();
  await edited.page
    .getByRole("option", { name: "Completed", exact: true })
    .click();
  await edited.page.keyboard.press("Escape");
  await edited.page.waitForFunction(() =>
    document.activeElement?.matches(".operational-focus button"),
  );
  await settle(edited.page);
  assert.equal(
    (await focusView(edited.page, ".operational-focus button")).visible,
    true,
  );
  report.extra.push({
    name: "edited origin no longer in attention",
    result: "visible section control focused",
  });
  await edited.context.close();
  const edge = await make(320, "bg", "light");
  await go(edge.page);
  const toggle = edge.page.locator(".operational-focus button");
  await toggle.evaluate((e) => {
    e.focus({ preventScroll: true });
    const nav = document.querySelector(".mobile-nav").getBoundingClientRect();
    window.scrollBy({
      top: e.getBoundingClientRect().bottom - nav.top + 12,
      behavior: "instant",
    });
  });
  await settle(edge.page);
  await edge.page.keyboard.press("Enter");
  await settle(edge.page);
  assert.equal(
    (await focusView(edge.page, ".operational-focus button")).visible,
    true,
  );
  await edge.page.keyboard.press("Space");
  await settle(edge.page);
  assert.equal(
    (await focusView(edge.page, ".operational-focus button")).visible,
    true,
  );
  report.extra.push({
    name: "mobile disclosure at lower viewport edge",
    result: "focused control remains visible on expand/collapse",
  });
  await edge.context.close();
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
