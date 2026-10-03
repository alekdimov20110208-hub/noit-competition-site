// Real browser/backend verification. Credentials are read only from the ignored
// environment; no storageState, HAR, trace, cookie jar or session dump is saved.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = "http://127.0.0.1:5173";
const out = "tmp/p1d-evidence/browser";
mkdirSync(out, { recursive: true });
const report = {
  checks: [],
  matrix: [],
  consoleErrors: 0,
  applicationErrors: 0,
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
report.browser = browser.version();
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
if (process.argv.includes("--backend-unavailable")) {
  try {
    const { context, page } = await make();
    await page.goto(origin + "/team");
    await page.getByRole("alert").waitFor();
    assert.equal(
      await page.getByRole("alert").innerText(),
      "BudoGraph cannot reach the server. Please try again shortly.",
    );
    assert.equal(await page.locator(".app-main").count(), 0);
    assert.equal(new URL(page.url()).pathname, "/login");
    await page.locator("#login-email").fill("unknown@example.invalid");
    await page.locator("#login-password").fill("synthetic-invalid-input");
    await page.locator("button[type=submit]").click();
    await page.waitForFunction(
      () => !document.querySelector("button[type=submit]").disabled,
    );
    assert.equal(
      await page.getByRole("alert").innerText(),
      "BudoGraph cannot reach the server. Please try again shortly.",
    );
    await page.screenshot({ path: `${out}/backend-unavailable.png` });
    checked(
      "actual stopped backend: bootstrap and submission show understandable safe errors; protected content remains hidden",
    );
    await context.close();
  } finally {
    writeFileSync(
      `${out}/unavailable-report.json`,
      JSON.stringify(report, null, 2),
    );
    await browser.close();
  }
  process.exit(0);
}
let lastSignIn = 0;
async function make(width = 1440, language = "en", theme = "light") {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: language === "bg" ? "bg-BG" : "en-GB",
  });
  const page = await context.newPage();
  page.on("pageerror", () => report.applicationErrors++);
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !msg.text().includes("Failed to load resource")
    )
      report.consoleErrors++;
  });
  await page.addInitScript(
    ({ language, theme }) =>
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language, theme }),
      ),
    { language, theme },
  );
  return { context, page };
}
async function signIn(page, label) {
  // Respect the real auth limiter; do not weaken it for verification.
  const remaining = 11_000 - (Date.now() - lastSignIn);
  if (remaining > 0)
    await new Promise((resolve) => setTimeout(resolve, remaining));
  lastSignIn = Date.now();
  const email = process.env[`BUDOGRAPH_${label}_EMAIL`];
  const password = process.env[`BUDOGRAPH_${label}_PASSWORD`];
  if (!email || !password)
    throw new Error("Controlled development account inputs are required.");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator("button[type=submit]").click();
  await page.locator(".app-main").waitFor();
}
async function logout(page) {
  if (await page.locator(".account-control--desktop").isVisible())
    await page.locator(".account-control--desktop button").click();
  else {
    await page.locator(".account-control--mobile summary").click();
    await page.locator(".account-control--mobile button").click();
  }
  await page.locator("#login-email").waitFor();
  assert.equal(await page.locator(".app-main").count(), 0);
}
async function me(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/me", { cache: "no-store" });
    return {
      status: response.status,
      body: response.ok ? await response.json() : null,
    };
  });
}

try {
  const { context, page } = await make();
  let release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/me", async (route) => {
    await hold;
    await route.continue();
  });
  await page.goto(origin + "/tasks?task=task-transport");
  await page.getByRole("status").waitFor();
  assert.equal(await page.locator(".app-main").count(), 0);
  checked("bootstrap loading hides protected content");
  release();
  await page.locator("#login-email").waitFor();
  await page.unroute("**/api/me");
  assert.equal(new URL(page.url()).pathname, "/login");
  assert.equal(
    new URL(page.url()).searchParams.get("returnTo"),
    "/tasks?task=task-transport",
  );
  assert.equal(
    await page.locator("input[type=email][autocomplete=username]").count(),
    1,
  );
  assert.equal(
    await page
      .locator("input[type=password][autocomplete=current-password]")
      .count(),
    1,
  );
  assert.equal(
    await page
      .locator('a[href*="signup"], a[href*="sign-up"], a[href*="forgot"]')
      .count(),
    0,
  );
  checked(
    "unauthenticated direct task route redirects; Login semantics and scope",
  );

  await page.locator("#login-email").fill("unknown@example.invalid");
  await page.locator("#login-password").fill("synthetic-invalid-input");
  await page.locator("#login-password").press("Enter");
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("alert").innerText(),
    "Email or password is incorrect. Please try again.",
  );
  assert.equal(await page.locator("#login-password").inputValue(), "");
  assert.equal(
    await page.getByRole("alert").evaluate((e) => e === document.activeElement),
    true,
  );
  checked(
    "invalid credentials are generic; keyboard submission; accessible focused error",
  );

  let commands = 0;
  let finish;
  let started;
  const requestStarted = new Promise((resolve) => {
    started = resolve;
  });
  const delay = new Promise((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/auth/sign-in/email", async (route) => {
    commands++;
    started();
    await delay;
    await route.continue();
  });
  await page
    .locator("#login-email")
    .fill(process.env.BUDOGRAPH_ORGANIZER_EMAIL);
  await page
    .locator("#login-password")
    .fill(process.env.BUDOGRAPH_ORGANIZER_PASSWORD);
  await page.locator("form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await page.waitForFunction(
    () => document.querySelector("button[type=submit]").disabled,
  );
  assert.equal(await page.locator("form").getAttribute("aria-busy"), "true");
  await requestStarted;
  lastSignIn = Date.now();
  finish();
  await page.locator(".app-main").waitFor();
  await page.unroute("**/api/auth/sign-in/email");
  assert.equal(commands, 1);
  assert.equal(new URL(page.url()).pathname, "/tasks");
  const organizer = await me(page);
  assert.ok(
    organizer.status === 200 &&
      organizer.body.user.email === process.env.BUDOGRAPH_ORGANIZER_EMAIL,
    "Organizer identity matches configured account",
  );
  assert.deepEqual(Object.keys(organizer.body.user).sort(), [
    "email",
    "id",
    "name",
  ]);
  checked(
    "real Organizer login; duplicate-submit prevention; intended route; /api/me identity",
  );
  await page.reload();
  await page.locator(".app-main").waitFor();
  assert.ok(
    (await me(page)).body.user.id === organizer.body.user.id,
    "Organizer persists across refresh",
  );
  await page.goto(origin + "/login");
  await page.locator(".app-main").waitFor();
  assert.equal(new URL(page.url()).pathname, "/");
  checked(
    "Organizer refresh persistence; authenticated Login redirects to workspace",
  );

  const authCookies = (await context.cookies()).filter((cookie) =>
    /session/i.test(cookie.name),
  );
  assert.ok(
    authCookies.length > 0 &&
      authCookies.every(
        (cookie) => cookie.httpOnly && cookie.sameSite === "Lax",
      ),
    "Server-controlled HttpOnly session cookies",
  );
  assert.ok(
    await page.evaluate(() => !document.cookie.includes("session_token")),
    "Session token unavailable to document.cookie",
  );
  const storage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  assert.ok(
    [...storage.local, ...storage.session].every(
      ([key, value]) =>
        !/session_token|bearer|password|better.auth/i.test(key + value),
    ),
    "No auth material in visible storage",
  );
  checked(
    "HttpOnly session cookies; no auth tokens in document.cookie/localStorage/sessionStorage",
  );
  await logout(page);
  assert.equal((await me(page)).status, 401);
  await page.goto(origin + "/team");
  await page.locator("#login-email").waitFor();
  assert.equal(new URL(page.url()).pathname, "/login");
  await page.goBack();
  await page.locator("#login-email").waitFor();
  assert.equal(await page.locator(".app-main").count(), 0);
  checked(
    "real Organizer logout invalidates server session and protected navigation/history",
  );

  await signIn(page, "MEMBER");
  const member = await me(page);
  assert.ok(
    member.status === 200 &&
      member.body.user.email === process.env.BUDOGRAPH_MEMBER_EMAIL &&
      member.body.user.id !== organizer.body.user.id,
    "Independent Member identity",
  );
  await page.reload();
  await page.locator(".app-main").waitFor();
  assert.ok(
    (await me(page)).body.user.id === member.body.user.id,
    "Member persists across refresh",
  );
  await logout(page);
  assert.equal((await me(page)).status, 401);
  checked(
    "real independent Member login, identity, refresh persistence and logout",
  );

  await signIn(page, "ORGANIZER");
  const revoked = await page.evaluate(
    async () =>
      (
        await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ).ok,
  );
  assert.equal(revoked, true);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.locator("#login-email").waitFor();
  assert.equal(await page.locator(".account-control").count(), 0);
  assert.equal(await page.locator(".app-main").count(), 0);
  assert.equal(new URL(page.url()).searchParams.get("reason"), "expired");
  checked(
    "real server-invalidated session recheck removes identity and protected shell",
  );

  await page.route("**/api/auth/sign-in/email", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "DO_NOT_EXPOSE_RAW_DETAILS" }),
    }),
  );
  await page.locator("#login-email").fill("unknown@example.invalid");
  await page.locator("#login-password").fill("synthetic-invalid-input");
  await page.locator("button[type=submit]").click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("alert").innerText(),
    "BudoGraph cannot reach the server. Please try again shortly.",
  );
  await page.unroute("**/api/auth/sign-in/email");
  checked("sanitized server error (explicitly injected failure)");

  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"invalid":"DO_NOT_EXPOSE_RAW_DETAILS"}',
    }),
  );
  await page.reload();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("alert").innerText(),
    "Sign-in could not be completed. Please try again.",
  );
  await page.unroute("**/api/me");
  checked(
    "malformed identity fails closed with a safe error (explicitly injected)",
  );
  await page.goto(origin + "/login?returnTo=https://attacker.example.invalid");
  await signIn(page, "MEMBER");
  assert.equal(new URL(page.url()).origin, origin);
  assert.equal(new URL(page.url()).pathname, "/");
  await logout(page);
  checked("external returnTo is rejected without a redirect loop");
  const signupStatus = await page.evaluate(
    async () =>
      (
        await fetch("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ).status,
  );
  assert.equal(signupStatus, 404);
  checked("real public signup remains closed");
  await context.close();

  for (const width of [1440, 1024, 768, 390, 320])
    for (const language of ["en", "bg"])
      for (const theme of ["light", "dark"]) {
        const { context, page } = await make(width, language, theme);
        await page.goto(origin + "/login");
        await page.locator("#login-email").waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        const controls = await page
          .locator(".auth-header button, .login-field input, .login-submit")
          .evaluateAll((elements) =>
            elements.map((e) => {
              const r = e.getBoundingClientRect();
              return { width: r.width, height: r.height };
            }),
          );
        assert.ok(
          controls.every((r) => r.height >= 44 && r.width >= 44),
          "44px authentication controls",
        );
        await page.locator("#login-email").focus();
        assert.ok(
          await page
            .locator("#login-email")
            .evaluate((e) => getComputedStyle(e).outlineStyle !== "none"),
          "Visible keyboard focus",
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator("#login-password")
            .evaluate((e) => e === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator(".login-submit")
            .evaluate((e) => e === document.activeElement),
          true,
        );
        await page.screenshot({
          path: `${out}/login-${width}-${language}-${theme}.png`,
          fullPage: true,
        });
        report.matrix.push({
          width,
          language,
          theme,
          overflow: false,
          keyboard: true,
          touchTargets: true,
        });
        await context.close();
      }
  checked(
    "20 desktop/tablet/mobile/narrow Login cases; BG/EN; light/dark; keyboard; 44px targets; no overflow",
  );
  const mobile = await make(320);
  await mobile.page.goto(origin + "/login");
  await mobile.page.locator("#login-email").waitFor();
  await signIn(mobile.page, "MEMBER");
  for (const width of [768, 390, 320]) {
    await mobile.page.setViewportSize({ width, height: 900 });
    assert.equal(
      await mobile.page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await mobile.page.locator(".account-control--mobile summary").focus();
    await mobile.page.keyboard.press("Enter");
    assert.equal(
      await mobile.page
        .locator(".account-control--mobile")
        .getAttribute("open"),
      "",
    );
    await mobile.page.keyboard.press("Tab");
    assert.equal(
      await mobile.page
        .locator(".account-control--mobile button")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await mobile.page.locator(".account-control--mobile summary").click();
  }
  await logout(mobile.page);
  await mobile.context.close();
  checked(
    "real Member mobile account menu, keyboard access and logout; no shell overflow",
  );
  assert.equal(report.applicationErrors, 0);
  assert.equal(report.consoleErrors, 0);
} catch (error) {
  report.failure =
    error instanceof Error ? error.message : "Browser verification failed.";
  throw error;
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
