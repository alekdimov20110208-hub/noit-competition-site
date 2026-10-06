// Presentation/network fixtures only. Real Better Auth/PostgreSQL is checked by
// account-safety.integration.test.ts. No email leaves this browser suite.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const origin = "http://127.0.0.1:5173",
  out = "tmp/p4a-evidence/browser",
  report = { fixture: true, matrix: [], checks: [], pageErrors: 0 };
mkdirSync(out, { recursive: true });
async function fixture(width = 390, language = "en", theme = "light") {
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
  page.on("pageerror", () => report.pageErrors++);
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, json: { status: "error" } }),
  );
  await page.route("**/api/auth/**", (route) =>
    route.fulfill({ json: { status: true } }),
  );
  return { context, page };
}
try {
  for (const width of [1440, 1080, 768, 390, 320])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark", "system"]) {
        const { context, page } = await fixture(width, language, theme);
        for (const [surface, path] of [
          ["forgot", "/forgot-password"],
          ["reset", "/reset-password?token=syntheticResetToken123456"],
          ["verify", "/verify-email?pending=1"],
          ["verified", "/verify-email?status=verified"],
          ["invalidVerify", "/verify-email?error=INVALID_TOKEN"],
          ["invalidReset", "/reset-password?error=INVALID_TOKEN"],
        ]) {
          await page.goto(origin + path);
          await page.locator("#safety-title").waitFor();
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          assert.equal(
            await page
              .locator("#safety-title")
              .evaluate((e) => document.activeElement === e),
            true,
          );
          assert.equal(
            await page
              .locator("button, .auth-secondary-link, input")
              .evaluateAll((nodes) =>
                nodes
                  .filter((n) => n.getClientRects().length)
                  .every((n) => n.getBoundingClientRect().height >= 44),
              ),
            true,
          );
          assert.equal(
            await page
              .locator(".auth-entry")
              .innerText()
              .then((s) => s.includes("safety.")),
            false,
          );
          if (surface === "reset") assert.equal(new URL(page.url()).search, "");
          report.matrix.push({
            width,
            language,
            theme,
            surface,
            overflow: false,
            focus: true,
            targets: true,
          });
          if (
            [390, 1440].includes(width) &&
            theme !== "system" &&
            ["forgot", "reset", "verify"].includes(surface)
          )
            await page
              .locator(".auth-screen")
              .screenshot({
                path: `${out}/${surface}-${width}-${language}-${theme}.png`,
              });
        }
        await context.close();
      }
  const { context, page } = await fixture();
  await page.goto(origin + "/login?returnTo=%2Finvite%2F" + "a".repeat(43));
  await page.locator("#login-email").waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Forgot password?" }).count(),
    1,
  );
  await page.route("**/api/auth/sign-in/email", (route) =>
    route.fulfill({ status: 403, json: { code: "EMAIL_NOT_VERIFIED" } }),
  );
  await page.locator("#login-email").fill("synthetic@example.invalid");
  await page.locator("#login-password").fill("syntheticPassword");
  await page.locator("button[type=submit]").click();
  await page.locator("#safety-title").waitFor();
  assert.equal(
    await page.locator("#safety-email").inputValue(),
    "synthetic@example.invalid",
  );
  await page.locator("button[type=submit]").click();
  await page.getByRole("heading", { name: "Check your inbox" }).waitFor();
  assert.equal(
    await page
      .locator('[role="status"]')
      .evaluate((e) => document.activeElement === e),
    true,
  );
  await page.goto(origin + "/forgot-password");
  await page.locator("#safety-email").fill("missing@example.invalid");
  await page.locator("button[type=submit]").click();
  await page.getByRole("heading", { name: "Check your inbox" }).waitFor();
  await page.goto(origin + "/reset-password?token=syntheticResetToken123456");
  await page.locator("#reset-password").fill("syntheticPassword");
  await page.locator("#reset-confirm").fill("differentPassword");
  await page.locator("button[type=submit]").click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("alert").innerText(),
    "The passwords do not match.",
  );
  await page.locator("#reset-confirm").fill("syntheticPassword");
  await page.locator("button[type=submit]").click();
  await page.getByRole("heading", { name: "Password changed" }).waitFor();
  await page.goto(origin + "/verify-email?pending=1");
  await page.route("**/api/auth/send-verification-email", (route) =>
    route.fulfill({ status: 429, json: { status: "error" } }),
  );
  await page.locator("#safety-email").fill("synthetic@example.invalid");
  await page.locator("button[type=submit]").click();
  await page.getByRole("alert").waitFor();
  assert.match(await page.getByRole("alert").innerText(), /15 minutes/);
  assert.equal(
    await page.evaluate(() =>
      Object.keys(localStorage).every(
        (key) => key === "budograph.preferences.v1",
      ),
    ),
    true,
  );
  await page.keyboard.press("Tab");
  report.checks.push(
    "secondary login recovery; verified-email-needed continuation; generic request; password mismatch/success; rate-limit feedback; focus transitions; tokens absent from storage",
  );
  await context.close();
  assert.equal(report.pageErrors, 0);
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(
  `PASS: P4A ${report.matrix.length} BG/EN/theme/width/state presentation cases and recovery interactions (mock HTTP).`,
);
