// Browser presentation fixtures only. Native auth + SQL is exercised separately
// by public-signup.integration.test.ts, including its real browser continuation.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createApp } from "../server/src/app.ts";
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const server = createApp({
  frontendRoot: resolve("dist"),
  checkDatabase: async () => {},
});
const origin = await server.listen({ host: "127.0.0.1", port: 0 });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const out = resolve(`tmp/d5-b1-ui-${randomUUID()}`);
mkdirSync(out);
const report = { fixture: true, cases: [], checks: [], pageErrors: [] };
async function fixture(
  width = 390,
  language = "en",
  theme = "dark",
  enabled = true,
) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    ({ language, theme }) =>
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language, theme }),
      ),
    { language, theme },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      status: path === "/api/me" ? 401 : 200,
      json: path === "/api/registration" ? { enabled } : { status: true },
    });
  });
  return { context, page };
}
const fill = async (page) => {
  await page.locator("#signup-name").fill("Synthetic browser");
  await page.locator("#signup-email").fill("synthetic@example.invalid");
  await page.locator("#signup-password").fill("SyntheticPassword123");
  await page.locator("#signup-confirm").fill("SyntheticPassword123");
};
try {
  for (const width of [1440, 768, 390, 320])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"]) {
        const { context, page } = await fixture(width, language, theme);
        await page.goto(origin + "/signup");
        await page.locator("#signup-name").waitFor();
        assert.equal(
          await page
            .locator("#signup-title")
            .evaluate((e) => document.activeElement === e),
          true,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        assert.deepEqual(
          await page
            .locator("input, button, .auth-secondary-link")
            .evaluateAll((nodes) =>
              nodes
                .filter(
                  (n) =>
                    n.getClientRects().length &&
                    n.getBoundingClientRect().height < 44,
                )
                .map((n) => ({
                  id: n.id,
                  text: n.textContent,
                  height: n.getBoundingClientRect().height,
                })),
            ),
          [],
        );
        assert.equal(
          await page
            .locator("input")
            .evaluateAll((nodes) =>
              nodes.every(
                (n) => !!document.querySelector(`label[for="${n.id}"]`),
              ),
            ),
          true,
        );
        assert.doesNotMatch(await page.locator("main").innerText(), /signup\./);
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator("#signup-name")
            .evaluate((e) => document.activeElement === e),
          true,
        );
        await fill(page);
        await page.locator(".signup-visibility").click();
        assert.equal(
          await page.locator("#signup-password").getAttribute("type"),
          "text",
        );
        await page.keyboard.press("Space");
        assert.equal(
          await page.locator("#signup-password").getAttribute("type"),
          "password",
        );
        if ([390, 1440].includes(width))
          await page.screenshot({
            path: `${out}/signup-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
        report.cases.push({
          width,
          language,
          theme,
          overflow: false,
          labels: true,
          focus: true,
          keyboard: true,
          targets: true,
        });
        await context.close();
      }
  for (const language of ["bg", "en"]) {
    const { context, page } = await fixture(320, language, "dark");
    let submissions = 0;
    await page.route("**/api/registration", (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: { enabled: true } });
      submissions++;
      assert.equal(
        route.request().postDataJSON().email,
        `${"a".repeat(64)}@example.invalid`,
      );
      return route.fulfill({ json: { status: true } });
    });
    await page.goto(origin + "/signup");
    await fill(page);
    await page
      .locator("#signup-email")
      .fill(`${"a".repeat(65)}@example.invalid`);
    assert.equal(
      await page.locator("#signup-email").evaluate((e) => e.validity.valid),
      true,
      "Exercise the custom limit missing from native email validation",
    );
    await page.locator("#signup-confirm").press("Enter");
    const alert = page.getByRole("alert");
    await alert.waitFor();
    assert.equal(
      await alert.innerText(),
      language === "bg"
        ? "Въведете валиден имейл адрес."
        : "Enter a valid email address.",
    );
    assert.equal(
      await alert.evaluate((e) => document.activeElement === e),
      true,
    );
    assert.equal(
      await page.locator("#signup-email").getAttribute("aria-invalid"),
      "true",
    );
    assert.equal(
      await page.locator("#signup-email").getAttribute("aria-describedby"),
      "signup-error",
    );
    assert.equal(
      await page.locator("#signup-password").inputValue(),
      "SyntheticPassword123",
    );
    assert.equal(
      await page.locator("#signup-confirm").inputValue(),
      "SyntheticPassword123",
    );
    assert.equal(submissions, 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `${out}/email-limit-320-${language}.png`,
      fullPage: true,
    });
    await page
      .locator("#signup-email")
      .fill(`${"A".repeat(64)}@EXAMPLE.invalid`);
    await page.locator("#signup-confirm").press("Enter");
    await page.locator("#safety-title").waitFor();
    assert.equal(submissions, 1);
    assert.equal(
      await page.locator("#safety-email").inputValue(),
      `${"a".repeat(64)}@example.invalid`,
    );
    report.checks.push(
      `${language}: 320px email 65/64 boundary, localized focused alert, retained fields, keyboard correction and verification continuation`,
    );
    await context.close();
  }
  for (const enabled of [false, true]) {
    const { context, page } = await fixture(390, "en", "dark", enabled);
    await page.goto(origin + "/login");
    await page.locator("#login-title").waitFor();
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
    );
    assert.equal(
      await page.getByRole("link", { name: "Create your account" }).count(),
      enabled ? 1 : 0,
    );
    await page.goto(origin + "/signup");
    await page
      .getByRole("heading", {
        name: enabled
          ? "Create your account"
          : "Registration is currently closed",
      })
      .waitFor();
    assert.equal(await page.locator("form").count(), enabled ? 1 : 0);
    await context.close();
  }
  const { context, page } = await fixture();
  let submissions = 0,
    release;
  await page.route("**/api/registration", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { enabled: true } });
    submissions++;
    await new Promise((r) => {
      release = r;
    });
    await route.fulfill({ json: { status: true } });
  });
  const returnTo = "/invite/" + "a".repeat(43);
  await page.goto(origin + "/signup?returnTo=" + encodeURIComponent(returnTo));
  await fill(page);
  await page.locator("#signup-confirm").fill("DifferentPassword123");
  await page.locator("button[type=submit]").click();
  await page.getByRole("alert").waitFor();
  assert.equal(submissions, 0);
  assert.equal(
    await page.getByRole("alert").evaluate((e) => document.activeElement === e),
    true,
  );
  await page.locator("#signup-confirm").fill("SyntheticPassword123");
  const request = page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      new URL(r.url()).pathname === "/api/registration",
  );
  await page.locator("button[type=submit]").click();
  const sent = await request;
  assert.equal(sent.postDataJSON().returnTo, returnTo);
  await page.locator("form").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  assert.equal(await page.locator("button[type=submit]").isDisabled(), true);
  assert.equal(submissions, 1);
  release();
  await page.locator("#safety-title").waitFor();
  assert.equal(
    await page.locator("#safety-email").inputValue(),
    "synthetic@example.invalid",
  );
  await page.locator("button[type=submit]").click();
  await page.getByRole("heading", { name: "Check your inbox" }).waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        Object.keys(localStorage).every(
          (k) => k === "budograph.preferences.v1",
        ) && sessionStorage.length === 0,
    ),
    true,
  );
  assert.doesNotMatch(page.url(), /SyntheticPassword|example.invalid/);
  report.checks.push(
    "gate OFF and gated login link",
    "mismatch focus",
    "single pending submit",
    "in-memory invitation continuation",
    "generic success and resend",
    "no credentials in URL/browser storage",
  );
  for (const [status, text] of [
    [429, "Too many requests"],
    [503, "temporarily unavailable"],
    [400, "could not be completed"],
    [404, "currently closed"],
  ]) {
    await page.unroute("**/api/registration");
    await page.route("**/api/registration", (route) =>
      route.fulfill({
        status: route.request().method() === "GET" ? 200 : status,
        json:
          route.request().method() === "GET"
            ? { enabled: true }
            : { status: "error" },
      }),
    );
    await page.goto(origin + "/signup");
    await fill(page);
    await page.locator("button[type=submit]").click();
    await page.getByRole("alert").waitFor();
    assert.ok((await page.getByRole("alert").innerText()).includes(text));
    assert.equal(await page.locator("#signup-password").inputValue(), "");
    assert.equal(await page.locator("#signup-confirm").inputValue(), "");
  }
  report.checks.push(
    "generic rate-limit/storage/input/gate errors; passwords cleared after attempts",
  );
  await context.close();
  assert.deepEqual(report.pageErrors, []);
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
}
console.log(
  `PASS: ${report.cases.length} BG/EN/width/theme cases and signup interactions; fixtures only. Evidence: ${out}`,
);
