import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Reuse a verification runtime; no application dependency or seed changes.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
    : "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  headless: true,
});
const base = process.env.BUDOGRAPH_BASE_URL ?? "http://127.0.0.1:4173";
const out = "tmp/phase-2b-4b-evidence";
mkdirSync(out, { recursive: true });
const report = { matrix: [], boundaries: [], console: [], errors: [] };
async function make(width, height, language, theme) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(
    ({ language, theme }) => {
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language, theme }),
      );
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
async function measure(page, first) {
  return page.evaluate((first) => {
    const rect = (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
    };
    const selectors = [
      ".focus-item__body strong",
      ".focus-item__meta",
      ".timeline-entry__body strong",
      ".pressure-row__identity strong",
      ".task-row__link",
      ".task-acceptance",
      ".task-deadline",
      ".task-deadline small",
      ".task-search",
      ".task-filter-select .budo-select__trigger",
      ".group-toggle",
      ".page--dashboard .text-button",
      ".dashboard-overflow__summary",
      ".team-roster__member",
    ];
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      firstRow: rect(document.querySelector(first)),
      samples: Object.fromEntries(
        selectors.flatMap((selector) => {
          const e = document.querySelector(selector);
          if (!e) return [];
          const s = getComputedStyle(e);
          return [
            [
              selector,
              {
                ...rect(e),
                fontSize: s.fontSize,
                fontWeight: s.fontWeight,
                lineHeight: s.lineHeight,
              },
            ],
          ];
        }),
      ),
    };
  }, first);
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
        ".focus-item strong, .focus-item__action, .focus-item__reason, .focus-item__meta > *, .focus-item__priority, .timeline-entry strong, .timeline-entry__kind, .timeline-entry__state, .timeline-entry time, .change-impact__meta span, .change-impact__checkpoint strong, .pressure-row__identity > *, .pressure-row__signal, .pressure-row__counts, .event-overview__metric--overdue dd, .task-row__link, .task-acceptance, .task-deadline time, .task-deadline small, .task-row .status-badge, .task-drawer__owner strong, .task-drawer__owner small, .task-drawer__acceptance-state p, .task-drawer__metadata dd",
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
  for (const [width, height, lang, theme] of [
    [1440, 1000, "en", "light"],
    [1440, 1000, "en", "dark"],
    [1280, 900, "bg", "light"],
    [1024, 900, "en", "light"],
    [390, 844, "bg", "light"],
    [360, 800, "en", "dark"],
    [320, 740, "bg", "dark"],
  ]) {
    const { page, context } = await make(width, height, lang, theme);
    for (const [name, path, first] of [
      ["dashboard", "/", ".focus-item"],
      ["tasks", "/tasks", ".task-row"],
      ["team", "/team", ".team-roster__member"],
    ]) {
      await go(page, path);
      const result = await measure(page, first);
      if (name !== "team") result.contrast = await contrast(page);
      assert.equal(result.scrollWidth, width);
      assert.equal(await page.locator("main h1").count(), 1);
      await page.screenshot({
        path: `${out}/${name}-${width}-${lang}-${theme}.png`,
      });
      if (name === "dashboard") {
        assert.equal(
          await page
            .locator(
              ".change-impact .dashboard-section-heading p, .team-pressure .dashboard-section-heading p",
            )
            .count(),
          0,
        );
        const colors = await page
          .locator(
            ".event-overview__metric--overdue dd, .event-overview__metric--blocked dd",
          )
          .evaluateAll((es) => es.map((e) => getComputedStyle(e).color));
        assert.equal(colors.length, 2);
        assert.equal(colors[0], colors[1]);
        for (const control of await page
          .locator(".page--dashboard .text-button, .page--dashboard summary")
          .all())
          if (await control.isVisible())
            assert.ok((await control.boundingBox()).height >= 44);
        await page.locator(".change-impact").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${out}/changes-${width}-${lang}-${theme}.png`,
        });
        await page.locator(".team-pressure").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${out}/pressure-${width}-${lang}-${theme}.png`,
        });
      }
      if (name === "tasks") {
        assert.equal(await page.locator(".page-header .eyebrow").count(), 0);
        await registerGeometry(page);
        await filters(page);
        await drawer(page);
        await page.locator(".group-toggle").press("Space");
        assert.ok((await page.locator(".task-group").count()) > 0);
        await registerGeometry(page);
        await page.locator(".group-toggle").press("Enter");
        await page.locator("#task-search").fill("no-match-alignment-check");
        assert.equal(await page.locator(".task-row").count(), 0);
        await page.locator(".task-filters__clear").click();
        assert.ok((await page.locator(".task-row").count()) > 0);
      }
      report.matrix.push({ name, lang, theme, ...result });
    }
    await context.close();
    console.log(`${width}-${lang}-${theme} passed`);
  }
  for (const width of [1100, 1024, 1000, 980, 970, 961, 960, 900, 768])
    for (const lang of ["en", "bg"]) {
      const { page, context } = await make(width, 900, lang, "light");
      await go(page, "/tasks");
      await registerGeometry(page);
      await filters(page);
      const result = await measure(page, ".task-row");
      assert.equal(result.scrollWidth, width);
      const grid = await page
        .locator(".task-row")
        .first()
        .evaluate((e) => ({
          columns: getComputedStyle(e).gridTemplateColumns,
          areas: getComputedStyle(e).gridTemplateAreas,
        }));
      await page.locator(".group-toggle").press("Space");
      await registerGeometry(page);
      report.boundaries.push({ lang, ...result, grid });
      await context.close();
    }
  assert.deepEqual(report.console, []);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  console.log(
    JSON.stringify({
      matrix: report.matrix.length,
      boundaries: report.boundaries.length,
      console: report.console,
      errors: report.errors,
      failure: report.failure,
    }),
  );
}
