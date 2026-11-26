import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { once } from "node:events";
import { createShowcasePreview } from "./preview-landing-stage1-1.mjs";

const runtime =
  process.env.BUDOGRAPH_RUNTIME_MODULES ??
  "C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules";
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(runtime, "playwright"));
const sharp = require(path.join(runtime, "sharp"));
const out = "tmp/stage1-1/evidence/browser";
fs.mkdirSync(out, { recursive: true });
const server = createShowcasePreview(),
  baselineServer = createShowcasePreview({
    frontendRoot: "tmp/stage1-1/baseline-dist",
  });
server.listen(0, "127.0.0.1");
baselineServer.listen(0, "127.0.0.1");
await Promise.all([
  once(server, "listening"),
  once(baselineServer, "listening"),
]);
const origin = `http://127.0.0.1:${server.address().port}`,
  beforeOrigin = `http://127.0.0.1:${baselineServer.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.BUDOGRAPH_BROWSER_EXECUTABLE ??
    "C:/Users/Lenovo/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe",
});
const modules = ["tasks", "kanban", "calendar", "team", "templates", "changes"];
const sections = [
  ".landing-header",
  ".landing-hero",
  "#why-budograph",
  ".landing-features-intro",
  "#how-it-works",
  "#faq",
  ".landing-cta",
  ".landing-footer",
];
const report = {
  baseline: "1199382616a34ee978b713e4393590e91eb62b22",
  browser: browser.version(),
  fixtureTransport: true,
  selections: [],
  preservation: [],
  checks: [],
  errors: [],
  consoleErrors: [],
  unexpectedResponses: [],
  expectedImageFailures: [],
};
async function open({
  width = 1440,
  language = "en",
  theme = "light",
  motion = "reduce",
  recording = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 },
    reducedMotion: motion,
    colorScheme: "light",
    ...(recording
      ? {
          recordVideo: {
            dir: out + "/recording",
            size: { width, height: width < 600 ? 844 : 1000 },
          },
        }
      : {}),
  });
  await context.addInitScript(
    ({ language, theme }) => {
      if (!localStorage.getItem("budograph.preferences.v1"))
        localStorage.setItem(
          "budograph.preferences.v1",
          JSON.stringify({ version: 1, language, theme }),
        );
    },
    { language, theme },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("401") &&
      !message.text().includes("404") &&
      !message.text().includes("net::ERR_FAILED")
    )
      report.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      !response.url().endsWith("/api/me") &&
      !response.url().includes("/calendar-en-light-")
    )
      report.unexpectedResponses.push({
        url: response.url(),
        status: response.status(),
      });
  });
  await context.route("**/*", (route) =>
    [origin, beforeOrigin].includes(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort(),
  );
  return { context, page };
}
const image = (page) => page.locator(".landing-product-image-link img");
async function ready(page, module, language) {
  await page.waitForFunction(
    ({ module, language }) => {
      const img = document.querySelector(".landing-product-image-link img");
      return (
        img?.classList.contains("is-ready") &&
        img.currentSrc.includes(`/${module}-${language}-light-`) &&
        img.complete &&
        img.naturalWidth > 0
      );
    },
    { module, language },
  );
}
const button = (page, module) =>
  page.locator(
    `.landing-product-module[aria-labelledby="landing-module-${module}"]`,
  );
const geometry = (page) =>
  page.locator(".landing-product-image-frame").evaluate((element) => {
    const r = element.getBoundingClientRect();
    return { width: r.width, height: r.height, top: r.top + scrollY };
  });
try {
  for (const width of [320, 390, 768, 1440])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"]) {
        const { context, page } = await open({ width, language, theme });
        const requests = [];
        page.on("request", (request) => {
          if (request.url().includes("/landing/product/"))
            requests.push(new URL(request.url()).pathname);
        });
        const prefix = `${width}-${language}-${theme}`;
        const unchanged = [];
        await page.goto(beforeOrigin);
        await page.locator(".landing-product-figure").scrollIntoViewIfNeeded();
        await image(page).evaluate((img) => img.decode());
        await page.screenshot({
          path: `${out}/before-${prefix}.png`,
          fullPage: true,
        });
        for (const selector of sections)
          unchanged.push(await page.locator(selector).screenshot());
        await page.goto(origin);
        await page.locator(".landing-product-figure").scrollIntoViewIfNeeded();
        await ready(page, "tasks", language);
        assert.equal(
          await page.locator("html").getAttribute("data-theme"),
          theme,
        );
        assert.ok(
          requests.filter((url) => !url.includes("tasks-")).length === 0,
          "unselected screenshots are not preloaded",
        );
        assert.ok(
          requests.every((url) => /-(960|1600)\.webp$/.test(url)),
          "no eager full resolution requests",
        );
        requests.length = 0;
        const initial = await geometry(page);
        for (const module of modules) {
          await button(page, module).click();
          await ready(page, module, language);
          assert.equal(
            await page
              .locator('.landing-product-module[aria-pressed="true"]')
              .count(),
            1,
          );
          assert.equal(
            await button(page, module).getAttribute("aria-pressed"),
            "true",
          );
          assert.equal(
            await page
              .locator(".landing-product-figure figcaption a")
              .getAttribute("href"),
            `/landing/product/${module}-${language}-light.webp`,
          );
          assert.ok(
            (await image(page).getAttribute("alt")).includes(
              await button(page, module)
                .innerText()
                .then((text) => text.split("\n")[0]),
            ),
          );
          assert.deepEqual(
            await geometry(page),
            initial,
            "fixed image geometry during switching",
          );
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          const visible = await page
            .locator(".landing-product-image-frame")
            .evaluate((element) => {
              const r = element.getBoundingClientRect();
              return r.top >= 0 && r.bottom <= innerHeight;
            });
          if (width < 1100)
            assert.ok(
              visible,
              `selected screenshot immediately visible: ${prefix} ${module} ${JSON.stringify(await page.locator(".landing-product-image-frame").boundingBox())}`,
            );
          await page.mouse.move(0, 0);
          if (width === 390 || width === 1440)
            await page
              .locator("#features")
              .screenshot({ path: `${out}/${prefix}-${module}.png` });
          report.selections.push({
            width,
            language,
            theme,
            module,
            image: await image(page).evaluate((img) => img.currentSrc),
            visible,
            geometry: initial,
          });
        }
        assert.ok(
          requests.every((url) => /-(960|1600)\.webp$/.test(url)),
          "full-size images remain on demand",
        );
        await button(page, "tasks").click();
        await ready(page, "tasks", language);
        await page.mouse.move(0, 0);
        for (const [index, selector] of sections.entries()) {
          const after = await page.locator(selector).screenshot();
          const a = await sharp(unchanged[index])
            .raw()
            .toBuffer({ resolveWithObject: true });
          const b = await sharp(after)
            .raw()
            .toBuffer({ resolveWithObject: true });
          const identical =
            a.info.width === b.info.width &&
            a.info.height === b.info.height &&
            a.data.equals(b.data);
          report.preservation.push({
            width,
            language,
            theme,
            selector,
            identical,
          });
          if (!identical) {
            fs.writeFileSync(`${out}/mismatch-before.png`, unchanged[index]);
            fs.writeFileSync(`${out}/mismatch-after.png`, after);
            console.log(
              "Mismatch geometry",
              selector,
              a.info,
              b.info,
              await page.locator(".landing-product-showcase").boundingBox(),
            );
          }
          assert.ok(identical, `unchanged section ${prefix} ${selector}`);
        }
        await page.screenshot({
          path: `${out}/after-${prefix}.png`,
          fullPage: true,
        });
        await context.close();
        console.log("Matrix passed", prefix);
      }
  report.checks.push(
    "96 module selections; BG/EN; light/dark landing; 320/390/768/1440; fixed geometry; visible mobile images; responsive downloads; 128 unchanged section comparisons",
  );

  for (const language of ["bg", "en"])
    for (const width of [390, 1440]) {
      const { context, page } = await open({ language, width });
      await page.goto(origin);
      await page.locator(".landing-product-figure").scrollIntoViewIfNeeded();
      await ready(page, "tasks", language);
      await button(page, "tasks").focus();
      assert.equal(
        await button(page, "tasks").evaluate(
          (el) => getComputedStyle(el).outlineStyle,
        ),
        "solid",
      );
      for (const module of modules.slice(1)) {
        await page.keyboard.press("ArrowDown");
        await ready(page, module, language);
        assert.ok(
          await button(page, module).evaluate(
            (el) => el === document.activeElement,
          ),
        );
      }
      await page.keyboard.press("Home");
      await ready(page, "tasks", language);
      await page.keyboard.press("End");
      await ready(page, "changes", language);
      await page.keyboard.press("ArrowRight");
      await ready(page, "tasks", language);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Space");
      await ready(page, "kanban", language);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await ready(page, "calendar", language);
      assert.equal(
        await image(page).evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      await page.waitForTimeout(1000);
      assert.equal(
        await button(page, "calendar").getAttribute("aria-pressed"),
        "true",
      );
      await context.close();
    }
  report.checks.push(
    "Keyboard: all modules, arrows, Home/End, Tab, Space, Enter, visible focus; reduced motion; no auto rotation (BG/EN, mobile/desktop)",
  );

  const { context, page } = await open({
    motion: "no-preference",
    recording: true,
  });
  await page.goto(origin);
  await page.locator("#features").scrollIntoViewIfNeeded();
  await ready(page, "tasks", "en");
  for (const module of modules) {
    await button(page, module).click();
    await ready(page, module, "en");
    await page.waitForTimeout(850);
  }
  assert.equal(
    await image(page).evaluate((el) => getComputedStyle(el).animationDuration),
    "0.18s",
  );
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator(".landing-product-figure figcaption a").click(),
  ]);
  await popup.waitForLoadState();
  assert.ok(popup.url().endsWith("/changes-en-light.webp"));
  assert.equal(
    await popup.locator("img").evaluate((img) => img.naturalWidth),
    3200,
  );
  await popup.close();
  const recording = page.video();
  await context.close();
  await recording.saveAs(`${out}/module-switching-desktop.webm`);
  report.checks.push(
    "180ms normal-motion crossfade; recorded all six switches; full-size opens genuine 3200px image",
  );

  for (const language of ["bg", "en"]) {
    const { context, page } = await open({ width: 390, language });
    await page.goto(origin);
    await page.locator(".landing-product-figure").scrollIntoViewIfNeeded();
    await ready(page, "tasks", language);
    const size = await geometry(page);
    const failureGlob = `**/calendar-${language}-light-*.webp`;
    await page.route(failureGlob, (route) => {
      report.expectedImageFailures.push(route.request().url());
      return route.abort("failed");
    });
    await button(page, "calendar").click();
    await page.locator(".landing-product-image-error").waitFor();
    assert.equal(
      await page.locator(".landing-product-image-previous").count(),
      0,
      "failure cannot masquerade as previous module",
    );
    assert.deepEqual(await geometry(page), size);
    await page.screenshot({
      path: `${out}/image-failure-${language}.png`,
      fullPage: true,
    });
    await page.unroute(failureGlob);
    await page.locator(".landing-product-image-error button").click();
    await ready(page, "calendar", language);
    await context.close();
  }
  report.checks.push(
    "BG/EN image failures: localized error/retry, no wrong-image fallback, no layout shift, recovery",
  );

  const race = await open();
  await race.page.goto(origin);
  await race.page.locator(".landing-product-figure").scrollIntoViewIfNeeded();
  await ready(race.page, "tasks", "en");
  let release;
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  await race.page.route("**/calendar-en-light-*.webp", async (route) => {
    await delayed;
    try {
      await route.continue();
    } catch {
      /* obsolete request can be cancelled by Chromium */
    }
  });
  await button(race.page, "calendar").click();
  await race.page.locator(".landing-product-image-status").waitFor();
  await button(race.page, "team").click();
  await ready(race.page, "team", "en");
  release();
  await race.page.waitForTimeout(300);
  await ready(race.page, "team", "en");
  await race.context.close();
  report.checks.push(
    "Slow image load, rapid selection and stale-load cancellation",
  );
  const preferences = await open();
  await preferences.page.goto(origin);
  for (const module of modules) {
    await button(preferences.page, module).click();
    await ready(preferences.page, module, "en");
    await preferences.page
      .locator(".preference-group")
      .nth(0)
      .locator("button")
      .nth(0)
      .click();
    await preferences.page
      .locator(".landing-product-figure")
      .scrollIntoViewIfNeeded();
    await ready(preferences.page, module, "bg");
    await preferences.page
      .locator(".preference-group")
      .nth(1)
      .locator("button")
      .nth(2)
      .click();
    assert.equal(
      await preferences.page.locator("html").getAttribute("data-theme"),
      "dark",
    );
    await preferences.page
      .locator(".landing-product-figure")
      .scrollIntoViewIfNeeded();
    await ready(preferences.page, module, "bg");
    await preferences.page
      .locator(".preference-group")
      .nth(0)
      .locator("button")
      .nth(1)
      .click();
    await preferences.page
      .locator(".landing-product-figure")
      .scrollIntoViewIfNeeded();
    await ready(preferences.page, module, "en");
    assert.equal(
      await button(preferences.page, module).getAttribute("aria-pressed"),
      "true",
    );
    await preferences.page
      .locator(".preference-group")
      .nth(1)
      .locator("button")
      .nth(1)
      .click();
  }
  await preferences.context.close();
  report.checks.push(
    "Live BG/EN and Light/Dark preference switching preserves each selected module and Light screenshot direction",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.unexpectedResponses, []);
  console.log(
    "PASS",
    report.selections.length,
    "selections;",
    report.preservation.length,
    "pixel-identical section comparisons",
  );
} finally {
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
  baselineServer.close();
}
