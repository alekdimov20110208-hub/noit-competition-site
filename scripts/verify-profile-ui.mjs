// Real controlled development accounts/backend/PostgreSQL. Identity/transport
// fixtures are explicitly labelled. Credentials/cookies remain in memory.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readServerEnv } from "../server/src/config/env.ts";
const controlledConfig = readServerEnv();
assert.equal(controlledConfig.nodeEnv, "development");
// An owned rollback-only development fixture may inject credentials in memory.
// Ordinary runs keep the original controlled environment and HTTP destination.
const disposableFixture = globalThis[Symbol.for("budograph.profile.fixture")];
// Optional passive observer owned by the isolated verification helper.
const profileObserver = globalThis[Symbol.for("budograph.profile.observer")];
if (disposableFixture?.directTransport) {
  const frontend = new URL(disposableFixture.frontendOrigin);
  assert.ok(
    frontend.protocol === "http:" &&
      frontend.hostname === "127.0.0.1" &&
      frontend.port &&
      frontend.origin === disposableFixture.frontendOrigin,
    "Isolated frontend must use an explicit loopback origin",
  );
  assert.ok(
    controlledConfig.betterAuthUrl === disposableFixture.apiOrigin &&
      controlledConfig.publicAppUrl === disposableFixture.frontendOrigin &&
      new URL(controlledConfig.databaseUrl).hostname === "127.0.0.1",
    "Direct fixture configuration must match the isolated local endpoints",
  );
} else {
  assert.equal(
    new URL(controlledConfig.betterAuthUrl).origin,
    "http://127.0.0.1:3001",
  );
}
if (disposableFixture) {
  const target = new URL(disposableFixture.apiOrigin);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.protocol, "http:");
  assert.ok(target.port && !["3001", "5173"].includes(target.port));
  assert.equal(target.origin, disposableFixture.apiOrigin);
  assert.ok(
    disposableFixture.userId && disposableFixture.rollbackOnly === true,
  );
  assert.ok(disposableFixture.email.endsWith("@example.invalid"));
  assert.notEqual(
    disposableFixture.email,
    process.env.BUDOGRAPH_ORGANIZER_EMAIL,
  );
  assert.notEqual(disposableFixture.email, process.env.BUDOGRAPH_MEMBER_EMAIL);
  assert.notEqual(process.env.BUDOGRAPH_PROFILE_RECOVERY_SELF_TEST, "1");
}
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const browser = await chromium.launch({
  headless: true,
  // The harness owns interruption cleanup. Playwright's default signal
  // handler exits the process before the supported restoration can finish.
  handleSIGINT: false,
  handleSIGTERM: false,
  ignoreDefaultArgs: ["--hide-scrollbars"],
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const origin = disposableFixture?.frontendOrigin ?? "http://127.0.0.1:5173",
  out = disposableFixture?.outputDirectory ?? "tmp/profile-evidence/browser";
const apiOrigin = disposableFixture?.apiOrigin ?? origin;
mkdirSync(out, { recursive: true });
const report = {
  browser: browser.version(),
  checks: [],
  matrix: [],
  pageErrors: 0,
  passwordRestoration: { verified: false },
  authResponses: [],
  interruptionSelfTest:
    process.env.BUDOGRAPH_PROFILE_RECOVERY_SELF_TEST === "1",
};
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
const email = disposableFixture?.email ?? process.env.BUDOGRAPH_ORGANIZER_EMAIL,
  password =
    disposableFixture?.password ?? process.env.BUDOGRAPH_ORGANIZER_PASSWORD;
assert.ok(email && password, "Controlled development credentials required");
async function verifyDisposableIdentity(context) {
  if (!disposableFixture) return;
  const response = await context.request.get(`${apiOrigin}/api/me`);
  assert.equal(
    response.status(),
    200,
    "Disposable identity must be authenticated",
  );
  const user = (await response.json()).user;
  assert.ok(
    user.id === disposableFixture.userId && user.email === email,
    "Refuse account write outside the owned disposable identity",
  );
}
const contexts = [];
async function make() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    locale: "en-GB",
  });
  contexts.push(context);
  if (disposableFixture && !disposableFixture.directTransport) {
    // Transparent transport to the real isolated Fastify/Better Auth backend;
    // no success responses or authenticated identities are fabricated here.
    await context.route(`${origin}/api/**`, async (route) => {
      const url = new URL(route.request().url());
      const observation = profileObserver?.transportStarted(
        context,
        route.request(),
      );
      try {
        const response = await route.fetch({
          url: apiOrigin + url.pathname + url.search,
          maxRetries: 0,
        });
        profileObserver?.transportResponse(observation, response.status());
        await route.fulfill({ response });
        profileObserver?.transportCompleted(observation);
      } catch (error) {
        profileObserver?.transportFailed(observation, error);
        throw error;
      }
    });
  }
  await context.addInitScript(() => {
    if (location.href === "about:blank") return;
    if (!localStorage.getItem("budograph.preferences.v1"))
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language: "en", theme: "light" }),
      );
  });
  const page = await context.newPage();
  page.on("pageerror", () => report.pageErrors++);
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (
      [
        "/api/me",
        "/api/auth/sign-in/email",
        "/api/auth/change-password",
        "/api/auth/update-user",
      ].includes(path)
    )
      report.authResponses.push({ path, status: response.status() });
  });
  return { context, page };
}
const post = async (page, path, fields) => {
  if (["change-password", "update-user"].includes(path))
    await verifyDisposableIdentity(page.context());
  return page.evaluate(
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
};
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
  originalIdentityId,
  interrupted = false,
  changedPassword = false;
const temporaryPassword = randomBytes(20).toString("hex");
const { page, context } = await make();
async function freshSignIn(pass) {
  const fresh = await make();
  const response = await fresh.context.request.post(
    `${apiOrigin}/api/auth/sign-in/email`,
    {
      headers: { origin },
      data: { email, password: pass },
    },
  );
  return { ...fresh, status: response.status() };
}
async function verifyRestoration() {
  await new Promise((resolve) => setTimeout(resolve, 11_000));
  const restored = await freshSignIn(password);
  assert.equal(
    restored.status,
    200,
    "Original password fresh login must succeed",
  );
  const identity = await restored.context.request.get(`${apiOrigin}/api/me`);
  assert.equal(identity.status(), 200);
  const user = (await identity.json()).user;
  assert.ok(
    user.id === originalIdentityId && user.email === email,
    "Restored session must belong to the configured controlled identity",
  );
  const obsolete = await freshSignIn(temporaryPassword);
  assert.equal(
    obsolete.status,
    401,
    "Temporary password must be rejected after restoration",
  );
  report.passwordRestoration = {
    verified: true,
    originalPasswordFreshLogin: true,
    expectedIdentity: true,
    temporaryPasswordRejected: true,
  };
}
async function recoverPassword() {
  // A failed/lost UI response may follow a successful write. Resolve the actual
  // credential through fresh supported logins; never rewrite a database hash.
  await new Promise((resolve) => setTimeout(resolve, 11_000));
  const original = await freshSignIn(password);
  if (original.status !== 200) {
    assert.equal(
      original.status,
      401,
      "Unexpected restoration authentication status",
    );
    const temporary = await freshSignIn(temporaryPassword);
    assert.equal(
      temporary.status,
      200,
      "Controlled temporary credential recovery failed",
    );
    await verifyDisposableIdentity(temporary.context);
    const restored = await temporary.context.request.post(
      `${apiOrigin}/api/auth/change-password`,
      {
        headers: { origin },
        data: {
          currentPassword: temporaryPassword,
          newPassword: password,
          revokeOtherSessions: true,
        },
      },
    );
    assert.equal(
      restored.status(),
      200,
      "Supported controlled password restoration failed",
    );
  }
  await verifyRestoration();
  changedPassword = false;
}
const onInterrupt = () => {
  interrupted = true;
  // Closing only the workflow page rejects its outstanding waits, entering the
  // finally cleanup. Independent recovery contexts remain available.
  void page.close().catch(() => {});
};
process.on("SIGINT", onInterrupt);
process.on("SIGTERM", onInterrupt);
try {
  await page.goto(origin + "/account");
  await page.locator("#login-email").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("returnTo"), "/account");
  assert.equal(await page.locator(".profile-page").count(), 0);
  checked("anonymous /account is gated with safe login continuation");
  await login(page);
  const originalUser = (await me(page)).body.user;
  assert.ok(
    originalUser.email === email,
    "Configured Organizer identity must match",
  );
  originalIdentityId = originalUser.id;
  if (disposableFixture)
    assert.equal(originalIdentityId, disposableFixture.userId);
  originalName = originalUser.name;
  assert.equal(new URL(page.url()).pathname, "/account");
  assert.equal(
    await page.locator(".sidebar__nav a[href='/account']").count(),
    0,
  );
  assert.ok(
    (await page.locator("#profile-email").inputValue()) === email,
    "Canonical controlled email must remain read-only",
  );
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
  // The global account UI can be ready before its authorized workspace metadata.
  // Wait for the real scoped Dashboard link rather than racing its legacy href.
  const dashboardLink = page.locator(
    '.sidebar__nav a[href^="/events/"][href$="/dashboard"]',
  );
  await dashboardLink.waitFor();
  await dashboardLink.click();
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
    assert.equal(
      interrupted,
      false,
      "Interrupted verification cannot submit another credential write",
    );
    await verifyDisposableIdentity(page.context());
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
  profileObserver?.stage("group-7-await-visible-success", page);
  try {
    await page.locator("#profile-password-notice[role=status]").waitFor();
  } catch (error) {
    await profileObserver?.failure(page, {
      assertion: "#profile-password-notice[role=status] must become visible",
      timeoutMs: 30_000,
    });
    throw error;
  }
  profileObserver?.stage("group-7-visible-success-assertion-passed", page);
  assert.equal((await me(page)).status, 200);
  assert.equal((await me(second.page)).status, 401);
  if (report.interruptionSelfTest) {
    // Explicit verification-only fault, after the supported write is confirmed.
    // Exercise the same handler used by a graceful external interruption.
    process.emit("SIGINT");
    throw new Error(
      "Intentional interruption for controlled restoration self-test",
    );
  }
  await second.page.reload();
  await second.page.locator("#login-email").waitFor();
  const oldLogin = await post(second.page, "sign-in/email", {
    email,
    password,
  });
  assert.equal(oldLogin.status, 401);
  await new Promise((resolve) => setTimeout(resolve, 11_000));
  const temporarySession = await freshSignIn(temporaryPassword);
  assert.equal(
    temporarySession.status,
    200,
    "Temporary password fresh login must succeed before restoration",
  );
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
  await verifyRestoration();
  changedPassword = false;
  checked(
    "real password change rotates this browser, revokes the other browser, rejects old password; original fresh login and temporary rejection independently verify restoration",
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
    const response = await route.fetch(
      disposableFixture ? { url: `${apiOrigin}/api/me`, maxRetries: 0 } : {},
    );
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
        profileObserver?.assertion(page, {
          caseLabel: `profile-${key}`,
          width,
          height: 900,
          language,
          theme,
          requestedTextExpansion: false,
          predicate: "layout.overflow === false",
          originalObservation: layout,
        });
        assert.equal(layout.overflow, false);
        profileObserver?.predicate(page, "layout.inputs === true");
        assert.equal(layout.inputs, true);
        if (layout.sidebar) {
          profileObserver?.predicate(
            page,
            "layout.sidebar.scroll <= layout.sidebar.client + 1",
          );
          assert.ok(layout.sidebar.scroll <= layout.sidebar.client + 1);
        }
        await page.screenshot({
          path: `${out}/profile-${key}.png`,
          fullPage: false,
        });
        await page.evaluate(
          () => (document.documentElement.style.fontSize = "20px"),
        );
        // Reduced-motion transitions still run for 0.01ms. Inspect the actual
        // expanded layout after those transitions finish, not their first frame.
        await page.waitForFunction(() =>
          document
            .getAnimations()
            .every(
              (animation) =>
                !animation.pending && animation.playState !== "running",
            ),
        );
        const expanded = await inspect();
        profileObserver?.assertion(page, {
          caseLabel: `profile-${key}`,
          width,
          height: 900,
          language,
          theme,
          requestedTextExpansion: true,
          requestedRootFontPx: 20,
          predicate: "expanded.overflow === false",
          originalObservation: expanded,
        });
        assert.equal(expanded.overflow, false);
        profileObserver?.predicate(page, "expanded.inputs === true");
        assert.equal(expanded.inputs, true);
        await page.evaluate(
          () => (document.documentElement.style.fontSize = ""),
        );
        if (width === 1440 || width === 1080) {
          await page.setViewportSize({ width, height: 768 });
          // Font reset and short-height media-query spacing must have settled.
          // This wait never inspects overflow; the original predicate follows.
          await page.waitForFunction(() =>
            document
              .getAnimations()
              .every(
                (animation) =>
                  !animation.pending && animation.playState !== "running",
              ),
          );
          const short = await inspect();
          profileObserver?.assertion(page, {
            caseLabel: `profile-${key}-short-sidebar`,
            width,
            height: 768,
            language,
            theme,
            requestedTextExpansion: false,
            predicate: "short.sidebar.scroll <= short.sidebar.client + 1",
            originalObservation: short,
          });
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
  profileObserver?.clearAssertion(page);
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
  profileObserver?.assertion(page, {
    caseLabel: "group-10-mobile-profile-navigation",
    width: 390,
    height: 900,
    language: "en",
    theme: "light",
    requestedTextExpansion: false,
    predicate: "Tasks route focus must settle before opening the account menu",
  });
  // The Tasks DOM appears before its async read completes. The ensuing route
  // focus closes an already-open account menu through its normal blur handler.
  await page.waitForFunction(
    () => document.activeElement?.id === "main-content",
  );
  const mobileAccount = page.locator(".account-control--mobile");
  const mobileSummary = mobileAccount.locator("summary");
  assert.equal(await mobileAccount.count(), 1);
  assert.ok(await mobileSummary.isVisible());
  assert.ok(await mobileSummary.isEnabled());
  await mobileSummary.click();
  const mobileProfile = mobileAccount.locator("a[href='/account']");
  assert.equal(await mobileProfile.count(), 1);
  assert.ok(await mobileProfile.isVisible());
  assert.ok(await mobileProfile.isEnabled());
  profileObserver?.predicate(
    page,
    "visible, enabled mobile Profile entry must support a normal click",
  );
  await mobileProfile.click();
  await page.locator("#profile-name").waitFor();
  assert.equal(new URL(page.url()).pathname, "/account");
  profileObserver?.clearAssertion(page);
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
} catch (error) {
  report.failed = true;
  process.exitCode = 1;
  // Playwright call logs can include .fill() arguments; redact both credentials
  // before any diagnostics leave process memory.
  let diagnostic = String(error.stack ?? error);
  for (const value of [email, password, temporaryPassword])
    diagnostic = diagnostic.replaceAll(value, "[REDACTED]");
  console.error(diagnostic);
  // Capture before cleanup changes the DOM or closes the browser. Observer
  // failures must not prevent supported account restoration in finally.
  try {
    await profileObserver?.failure(page, { redactedStack: diagnostic });
  } catch {
    report.errorDiagnosticCaptureFailed = true;
  }
} finally {
  try {
    await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
    if (changedPassword) await recoverPassword();
    if (originalName) {
      const cleanup = await freshSignIn(password);
      assert.equal(
        cleanup.status,
        200,
        "Controlled account must remain accessible during cleanup",
      );
      await verifyDisposableIdentity(cleanup.context);
      const restoredName = await cleanup.context.request.post(
        `${apiOrigin}/api/auth/update-user`,
        {
          headers: { origin },
          data: { name: originalName },
        },
      );
      assert.equal(restoredName.status(), 200);
    }
  } catch {
    report.securitySensitiveBlocker = true;
    process.exitCode = 1;
    console.error(
      "Controlled account cleanup/restoration could not be verified; stop dependent suites. No credentials are disclosed.",
    );
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onInterrupt);
    writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
    for (const c of contexts) await c.close();
    await browser.close();
  }
}
