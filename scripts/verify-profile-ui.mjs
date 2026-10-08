// Real controlled development accounts/backend/PostgreSQL. Identity/transport
// fixtures are explicitly labelled. Credentials/cookies remain in memory.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ignoreDefaultArgs: ["--hide-scrollbars"],
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const origin = "http://127.0.0.1:5173",
  out = "tmp/profile-evidence/browser";
mkdirSync(out, { recursive: true });
const report = {
  browser: browser.version(),
  checks: [],
  matrix: [],
  pageErrors: 0,
};
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
const email = process.env.BUDOGRAPH_ORGANIZER_EMAIL,
  password = process.env.BUDOGRAPH_ORGANIZER_PASSWORD;
assert.ok(email && password, "Controlled development credentials required");
const contexts = [];
async function make() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    locale: "en-GB",
  });
  contexts.push(context);
  await context.addInitScript(() => {
    if (!localStorage.getItem("budograph.preferences.v1"))
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language: "en", theme: "light" }),
      );
  });
  const page = await context.newPage();
  page.on("pageerror", () => report.pageErrors++);
  return { context, page };
}
const post = (page, path, fields) =>
  page.evaluate(
    async ({ path, fields }) => {
      const response = await fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, fields },
  );
async function login(page, pass = password) {
  await page.goto(origin + "/account");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(pass);
  await page.locator("button[type=submit]").click();
  await page.locator("#profile-name").waitFor();
}
async function me(page) {
  return page.evaluate(async () => {
    const r = await fetch("/api/me", { cache: "no-store" });
    return { status: r.status, body: r.ok ? await r.json() : null };
  });
}
let originalName,
  changedPassword = false;
const temporaryPassword = randomBytes(20).toString("hex");
const { page, context } = await make();
try {
  await page.goto(origin + "/account");
  await page.locator("#login-email").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("returnTo"), "/account");
  assert.equal(await page.locator(".profile-page").count(), 0);
  checked("anonymous /account is gated with safe login continuation");
  await login(page);
  originalName = (await me(page)).body.user.name;
  assert.equal(new URL(page.url()).pathname, "/account");
  assert.equal(
    await page.locator(".sidebar__nav a[href='/account']").count(),
    0,
  );
  assert.equal(await page.locator("#profile-email").inputValue(), email);
  assert.ok(
    (await page.locator("#profile-email").getAttribute("readonly")) !== null,
  );
  checked(
    "real global account route, read-only canonical email and primary navigation boundary",
  );
  assert.ok(
    await page
      .locator(".profile-field input")
      .evaluateAll((inputs) =>
        inputs.every((input) =>
          document.querySelector(`label[for='${input.id}']`),
        ),
      ),
  );
  assert.equal(
    await page.locator("#profile-currentPassword").getAttribute("autocomplete"),
    "current-password",
  );
  assert.equal(
    await page.locator("#profile-newPassword").getAttribute("autocomplete"),
    "new-password",
  );
  await page.locator(".sidebar__nav a").first().click();
  await page.locator("#event-overview-title").waitFor();
  const workspaceHref = page.url();
  await page.locator(".account-control--desktop a[href='/account']").click();
  await page.locator("#profile-name").waitFor();
  assert.equal(new URL(page.url()).pathname, "/account");
  await page.waitForFunction(
    () => document.activeElement?.id === "main-content",
  );
  await page.goBack();
  await page.locator("#event-overview-title").waitFor();
  assert.equal(page.url(), workspaceHref);
  await page.goForward();
  await page.locator("#profile-name").waitFor();
  checked(
    "desktop profile navigation remains global; Back/Forward restore workspace/account with main focus and labelled inputs",
  );
  await page.locator("#profile-name").fill("  Иван Георги Петров  ");
  await page
    .locator(".profile-form")
    .first()
    .locator("button[type=submit]")
    .click();
  await page.locator("#profile-name-notice[role=status]").waitFor();
  assert.equal((await me(page)).body.user.name, "Иван Георги Петров");
  assert.equal(
    await page
      .locator(".account-control--desktop .account-control__name")
      .innerText(),
    "Иван Георги Петров",
  );
  assert.equal(await page.locator(".account-avatar--large").innerText(), "ИП");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator(".account-control--mobile summary").click();
  assert.equal(
    await page
      .locator(".account-control--mobile .account-control__name")
      .innerText(),
    "Иван Георги Петров",
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator(".account-control--mobile").getAttribute("open"),
    null,
  );
  await page.locator(".account-control--mobile summary").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".account-control--mobile a")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).pathname, "/account");
  checked(
    "real trimmed name update synchronizes desktop/mobile/profile/initials; keyboard menu and Escape work",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  // Restore the controlled account name through the same supported endpoint.
  assert.equal(
    (await post(page, "update-user", { name: originalName })).status,
    200,
  );
  await page.reload();
  await page.locator("#profile-name").waitFor();
  const security = page.locator("form").nth(1);
  async function passwordForm(current, next, confirm = next) {
    await page.locator("#profile-currentPassword").fill(current);
    await page.locator("#profile-newPassword").fill(next);
    await page.locator("#profile-confirmation").fill(confirm);
    await security.locator("button[type=submit]").click();
  }
  await passwordForm(password, temporaryPassword, "synthetic-mismatch");
  await page.locator("#profile-password-notice[role=alert]").waitFor();
  assert.match(
    await page.locator("#profile-password-notice").innerText(),
    /do not match/,
  );
  checked(
    "password confirmation mismatch is accessible and prevents the write",
  );
  await passwordForm("synthetic-wrong", temporaryPassword);
  await page.locator("#profile-password-notice[role=alert]").waitFor();
  assert.match(
    await page.locator("#profile-password-notice").innerText(),
    /incorrect/,
  );
  assert.equal(await page.locator("#profile-currentPassword").inputValue(), "");
  checked(
    "real incorrect current password is rejected and submitted password inputs clear",
  );
  await new Promise((resolve) => setTimeout(resolve, 11_000));
  const second = await make();
  await login(second.page);
  // Schedule cleanup before submitting: a lost UI confirmation may follow a
  // successful credential write. Cleanup must still try the supported API.
  changedPassword = true;
  await passwordForm(password, temporaryPassword);
  await page.locator("#profile-password-notice[role=status]").waitFor();
  assert.equal((await me(page)).status, 200);
  assert.equal((await me(second.page)).status, 401);
  await second.page.reload();
  await second.page.locator("#login-email").waitFor();
  const oldLogin = await post(second.page, "sign-in/email", {
    email,
    password,
  });
  assert.equal(oldLogin.status, 401);
  assert.equal(
    (
      await post(page, "change-password", {
        currentPassword: temporaryPassword,
        newPassword: password,
        revokeOtherSessions: true,
      })
    ).status,
    200,
  );
  changedPassword = false;
  checked(
    "real password change rotates this browser, revokes the other browser, rejects old password; controlled password restored",
  );
  await page.reload();
  await page.locator("#profile-name").waitFor();
  await page
    .locator(".profile-preferences [aria-label='Use Bulgarian']")
    .click();
  assert.equal(
    await page
      .locator(".app-header .preference-group")
      .first()
      .locator("button")
      .first()
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .locator(".app-header .preference-group")
    .first()
    .locator("button")
    .nth(1)
    .click();
  assert.equal(
    await page
      .locator(".profile-preferences [aria-label='Use English']")
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .locator(".profile-preferences [aria-label='Use dark theme']")
    .click();
  assert.equal(
    await page
      .locator(".app-header [aria-label='Use dark theme']")
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .locator(".profile-preferences [aria-label='Use system theme']")
    .click();
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  checked(
    "profile/header preferences synchronize both directions and follow live system theme",
  );
  await page.route("**/api/me", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.user.name = "Дълго Екранно Име " + "А".repeat(70);
    body.user.email = "long-address-" + "x".repeat(150) + "@example.invalid";
    await route.fulfill({ response, json: body });
  });
  for (const width of [1440, 1080, 768, 390, 320])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          ({ language, theme }) =>
            localStorage.setItem(
              "budograph.preferences.v1",
              JSON.stringify({ version: 1, language, theme }),
            ),
          { language, theme },
        );
        await page.reload();
        await page.locator("#profile-name").waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(
          ({ language, theme }) =>
            document.documentElement.lang === language &&
            document.documentElement.dataset.theme === theme,
          { language, theme },
        );
        await page.waitForFunction(
          () => document.querySelector("#event-switcher")?.value,
        );
        const key = `${width}-${language}-${theme}`;
        const inspect = () =>
          page.evaluate(() => {
            const root = document.documentElement;
            const old = document.body.style.overflowX;
            document.body.style.overflowX = "visible";
            const overflow = root.scrollWidth > root.clientWidth;
            document.body.style.overflowX = old;
            const inputs = [
              ...document.querySelectorAll(".profile-field input"),
            ].every((e) => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.left >= 0 && r.right <= root.clientWidth;
            });
            const sidebar = document.querySelector(".sidebar");
            return {
              overflow,
              inputs,
              sidebar:
                getComputedStyle(sidebar).display !== "none"
                  ? {
                      client: sidebar.clientHeight,
                      scroll: sidebar.scrollHeight,
                    }
                  : null,
            };
          });
        const layout = await inspect();
        assert.equal(layout.overflow, false);
        assert.equal(layout.inputs, true);
        if (layout.sidebar)
          assert.ok(layout.sidebar.scroll <= layout.sidebar.client + 1);
        await page.screenshot({
          path: `${out}/profile-${key}.png`,
          fullPage: false,
        });
        await page.evaluate(
          () => (document.documentElement.style.fontSize = "20px"),
        );
        const expanded = await inspect();
        assert.equal(expanded.overflow, false);
        assert.equal(expanded.inputs, true);
        await page.evaluate(
          () => (document.documentElement.style.fontSize = ""),
        );
        if (width === 1440 || width === 1080) {
          await page.setViewportSize({ width, height: 768 });
          const short = await inspect();
          assert.ok(short.sidebar.scroll <= short.sidebar.client + 1);
          await page.setViewportSize({ width, height: 900 });
        }
        report.matrix.push({
          width,
          language,
          theme,
          syntheticLongIdentity: true,
          layout,
          textExpansion: true,
        });
        console.log(`PASS: profile ${key}`);
      }
  await page.unroute("**/api/me");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() =>
    localStorage.setItem(
      "budograph.preferences.v1",
      JSON.stringify({ version: 1, language: "en", theme: "light" }),
    ),
  );
  await page.reload();
  await page.locator("#profile-name").waitFor();
  let releaseFailure;
  let pendingRequests = 0;
  const failureHold = new Promise((resolve) => {
    releaseFailure = resolve;
  });
  await page.route("**/api/auth/update-user", async (route) => {
    pendingRequests++;
    await failureHold;
    await route.fulfill({ status: 503, json: { status: "error" } });
  });
  await page.locator("#profile-name").fill("Not saved");
  await page.locator("form").first().locator("button[type=submit]").click();
  await page.waitForFunction(
    () =>
      document.querySelector(".profile-form")?.getAttribute("aria-busy") ===
      "true",
  );
  assert.ok(await page.locator(".account-control--mobile button").isDisabled());
  const focusRefresh = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/me",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await focusRefresh;
  assert.ok(await page.locator(".account-control--mobile button").isDisabled());
  await page
    .locator("form")
    .first()
    .evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
    });
  assert.equal(pendingRequests, 1);
  releaseFailure();
  await page.locator("#profile-name-notice[role=alert]").waitFor();
  assert.equal(
    await page
      .locator("#profile-name-notice")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  assert.equal((await me(page)).body.user.name, originalName);
  assert.equal(
    await page.locator("#profile-name-notice[role=status]").count(),
    0,
  );
  await page.unroute("**/api/auth/update-user");
  checked(
    "labelled held/failing transport prevents duplicates and logout races, focuses errors and keeps canonical identity",
  );
  let releaseRemount;
  let remountRequests = 0;
  const remountHold = new Promise((resolve) => {
    releaseRemount = resolve;
  });
  await page.route("**/api/auth/update-user", async (route) => {
    remountRequests++;
    await remountHold;
    await route.fulfill({ status: 503, json: { status: "error" } });
  });
  await page.locator("#profile-name").fill("Not saved during navigation");
  await page.locator("form").first().locator("button[type=submit]").click();
  await page.waitForFunction(
    () =>
      document.querySelector(".profile-form")?.getAttribute("aria-busy") ===
      "true",
  );
  await page.locator(".mobile-nav a").nth(1).click();
  await page.locator(".page--tasks").waitFor();
  await page.locator(".account-control--mobile summary").click();
  await page.locator(".account-control--mobile a[href='/account']").click();
  await page.locator("#profile-name").waitFor();
  await page.locator("#profile-name").fill("Not saved after navigation");
  await page.locator("form").first().locator("button[type=submit]").click();
  await page.locator("#profile-name-notice[role=alert]").waitFor();
  assert.match(
    await page.locator("#profile-name-notice").innerText(),
    /already in progress/,
  );
  assert.equal(remountRequests, 1);
  assert.ok(await page.locator(".account-control--mobile button").isDisabled());
  releaseRemount();
  await page.waitForFunction(
    () => !document.querySelector(".account-control--mobile button")?.disabled,
  );
  assert.equal((await me(page)).body.user.name, originalName);
  assert.equal(
    await page.locator("#profile-name-notice[role=status]").count(),
    0,
  );
  await page.unroute("**/api/auth/update-user");
  checked(
    "labelled pending write survives page navigation; remounted profile cannot submit or enable logout early",
  );
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 503, json: { status: "error" } }),
  );
  await page.locator("#profile-name").fill("Refresh recovery verification");
  await page.locator("form").first().locator("button[type=submit]").click();
  await page.locator("#profile-name-notice[role=alert]").waitFor();
  assert.match(
    await page.locator("#profile-name-notice").innerText(),
    /saved.*could not be refreshed/,
  );
  await page.unroute("**/api/me");
  assert.equal(
    (await me(page)).body.user.name,
    "Refresh recovery verification",
  );
  await page
    .getByRole("button", { name: "Reload account", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#profile-name")?.value ===
      "Refresh recovery verification",
  );
  await page.locator("#profile-name-notice").waitFor({ state: "detached" });
  assert.equal(await page.locator("#profile-name-notice").count(), 0);
  assert.equal(
    (await post(page, "update-user", { name: originalName })).status,
    200,
  );
  await page.reload();
  await page.locator("#profile-name").waitFor();
  const browserStorage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  assert.equal(browserStorage.includes(password), false);
  assert.equal(browserStorage.includes(temporaryPassword), false);
  assert.equal(browserStorage.includes(email), false);
  checked(
    "real saved name with labelled refresh failure recovers canonical identity; no credentials or profile identity persisted in browser storage",
  );
  await page.route("**/api/events", (route) =>
    route.fulfill({ json: { events: [] } }),
  );
  await page.reload();
  await page.locator("#profile-name").waitFor();
  assert.equal(new URL(page.url()).pathname, "/account");
  await page.unroute("**/api/events");
  checked("labelled no-Event fixture preserves independent account access");
  await page.locator(".account-control--mobile summary").click();
  await page.locator(".account-control--mobile button").click();
  await page.locator("#login-email").waitFor();
  assert.equal(await page.locator(".profile-page").count(), 0);
  checked(
    "existing mobile logout hides profile and clears authenticated identity",
  );
  assert.equal(report.pageErrors, 0);
} finally {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  // Recovery remains supported API-only; never directly rewrite a credential hash.
  if (changedPassword) {
    const restored = await post(page, "change-password", {
      currentPassword: temporaryPassword,
      newPassword: password,
      revokeOtherSessions: true,
    });
    assert.equal(
      restored.status,
      200,
      "Controlled account password restoration failed",
    );
  }
  if (originalName && (await me(page)).status === 200)
    await post(page, "update-user", { name: originalName });
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  for (const c of contexts) await c.close();
  await browser.close();
}
