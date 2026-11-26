import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { id } from "./landing-stage1-1-data.mjs";

const runtime =
  process.env.BUDOGRAPH_RUNTIME_MODULES ??
  "C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules";
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(runtime, "playwright"));
const sharp = require(path.join(runtime, "sharp"));
const browser = await chromium.launch({
  executablePath:
    process.env.BUDOGRAPH_BROWSER_EXECUTABLE ??
    "C:/Users/Lenovo/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe",
});
const origin = "http://127.0.0.1:5193";
const out = "tmp/stage1-1/originals";
fs.mkdirSync(out, { recursive: true });
const assets = "public/landing/product";
fs.mkdirSync(assets, { recursive: true });
const routes = {
  tasks: `/events/${id(1)}/tasks`,
  kanban: `/events/${id(1)}/tasks?view=board`,
  calendar: `/events/${id(1)}/calendar?date=2026-11-25`,
  team: `/events/${id(1)}/team`,
  templates: `/events/${id(1)}/templates`,
  changes: `/events/${id(1)}/changes/${id(200)}`,
};
const report = {
  sourceCommit: "1199382616a34ee978b713e4393590e91eb62b22",
  syntheticTransport: true,
  syntheticAuthentication: true,
  phase14: false,
  viewport: [1600, 1050],
  deviceScaleFactor: 2,
  fixedInstant: "2026-11-25T10:00:00Z",
  cases: [],
  errors: [],
  unexpectedRequests: [],
};
try {
  for (const language of ["bg", "en"])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1600, height: 1050 },
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
      });
      await context.addCookies([
        { name: "showcase-demo", value: "1", url: origin },
        { name: "showcase-language", value: language, url: origin },
      ]);
      await context.addInitScript(
        ({ language, theme }) =>
          localStorage.setItem(
            "budograph.preferences.v1",
            JSON.stringify({ version: 1, language, theme }),
          ),
        { language, theme },
      );
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
      const page = await context.newPage();
      page.on("pageerror", (e) => report.errors.push(e.message));
      page.on("response", (response) => {
        if (response.status() >= 400)
          report.unexpectedRequests.push({
            url: response.url(),
            status: response.status(),
          });
      });
      await page.clock.setFixedTime(new Date(report.fixedInstant));
      for (const [module, route] of Object.entries(routes)) {
        await page.goto(origin + route);
        await page.waitForLoadState("networkidle");
        if (module === "templates") {
          await page.locator(".templates-library-tabs button").nth(1).click();
          await page.locator(".curated-library__row").first().waitFor();
        }
        if (module === "changes")
          await page.locator("#change-planB-title").waitFor();
        await page.evaluate(() => document.fonts.ready);
        const text = await page.locator("main").innerText();
        assert.ok(
          text.length > 300,
          `${module} populated application: ${text}; ${JSON.stringify(report.unexpectedRequests)}`,
        );
        if (
          module === "tasks" ||
          module === "kanban" ||
          module === "calendar" ||
          module === "team"
        )
          assert.ok(
            text.includes(
              language === "bg" ? "Потвърди достъпа" : "Confirm access",
            ),
            `${module} synthetic Tasks loaded`,
          );
        if (module === "templates")
          assert.ok(
            text.includes(language === "bg" ? "айкидо" : "Aikido"),
            "real curated catalog visible",
          );
        if (module === "changes") {
          await page
            .locator("#change-coordination-title")
            .evaluate((element) =>
              window.scrollTo(
                0,
                element.getBoundingClientRect().top + window.scrollY - 80,
              ),
            );
          await page.locator("#change-planB-title").waitFor();
        }
        const name = `${module}-${language}-${theme}`;
        const file = path.join(out, name + ".png");
        await page.screenshot({ path: file });
        const buffers = [];
        for (const width of [960, 1600, 3200]) {
          const target = path.join(
            assets,
            name + (width === 3200 ? "" : `-${width}`) + ".webp",
          );
          await sharp(file)
            .resize({ width })
            .webp({ quality: 86, effort: 5 })
            .toFile(target);
          buffers.push({
            file: target.replaceAll("\\", "/"),
            bytes: fs.statSync(target).size,
            sha256: createHash("sha256")
              .update(fs.readFileSync(target))
              .digest("hex"),
          });
        }
        report.cases.push({
          module,
          language,
          theme,
          route,
          original: file.replaceAll("\\", "/"),
          originalSha256: createHash("sha256")
            .update(fs.readFileSync(file))
            .digest("hex"),
          pixels: [3200, 2100],
          pageText: text,
          scrollY: await page.evaluate(() => scrollY),
          assets: buffers,
        });
        console.log("Captured", name);
      }
      await context.close();
    }
  assert.equal(report.errors.length, 0);
  assert.equal(
    report.unexpectedRequests.length,
    0,
    JSON.stringify(report.unexpectedRequests),
  );
} finally {
  fs.writeFileSync(
    "tmp/stage1-1/evidence/screenshot-provenance.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
