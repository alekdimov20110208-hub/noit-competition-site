import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createLandingPreview } from "./preview-landing-l1.mjs";

const [
  playwrightModule,
  browserExecutable,
  evidenceDirectory = "tmp/landing-l1",
] = process.argv.slice(2);
const { chromium } = await import(
  playwrightModule
    ? pathToFileURL(resolve(playwrightModule)).href
    : "playwright"
);
const app = createLandingPreview();
const origin = await app.listen({ host: "127.0.0.1", port: 0 });
const out = resolve(evidenceDirectory);
mkdirSync(out, { recursive: true });
const report = { apiFixtures: true, layouts: [], checks: [], pageErrors: [] };
const eventId = "12345678-1234-4234-8234-123456789abc";
const memberId = "12345678-1234-4234-8234-123456789abd";
const taskId = "12345678-1234-4234-8234-123456789abe";
const changeId = "12345678-1234-4234-8234-123456789abf";
const eventPath = `/events/${eventId}`;
const members = [{ id: memberId, name: "Browser fixture", role: "Organizer" }];
const invitation = "/invite/" + "a".repeat(43);
const user = {
  id: "landing-fixture",
  name: "Browser fixture",
  email: "landing@example.invalid",
};
const timestamp = "2026-04-02T12:00:00Z";
const event = {
  id: eventId,
  name: "Browser fixture event",
  startDate: "2026-04-18",
  endDate: "2026-04-19",
  timezone: "Europe/Sofia",
  archived: false,
  membership: { id: memberId, accessRole: "ORGANIZER" },
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};
let browser;

async function open(
  {
    width = 1440,
    locale = "en",
    theme = "light",
    reducedMotion = "reduce",
    api,
  } = {},
  check,
) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    locale: locale === "bg" ? "bg-BG" : "en-US",
    colorScheme: "light",
    reducedMotion,
  });
  await context.addInitScript(
    ({ locale, theme }) => {
      if (!localStorage.getItem("budograph.preferences.v1"))
        localStorage.setItem(
          "budograph.preferences.v1",
          JSON.stringify({ version: 1, language: locale, theme }),
        );
    },
    { locale, theme },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  const requests = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/")) requests.push(path);
  });
  if (api) await page.route("**/api/**", api);
  try {
    await check(page, requests);
  } finally {
    await context.close();
  }
}

const pathOf = (route) => new URL(route.request().url()).pathname;
const visit = (page, path = "/") => page.goto(origin + path);
const check = (label) => report.checks.push(label);
const login = (page) =>
  page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
const guestOnly = (requests) =>
  assert.deepEqual([...new Set(requests)].sort(), [
    "/api/me",
    "/api/registration",
  ]);

try {
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  });
  for (const width of [320, 390, 768, 1440])
    for (const locale of ["bg", "en"])
      for (const theme of ["light", "dark"])
        await open({ width, locale, theme }, async (page, requests) => {
          await visit(page);
          await page
            .locator(".landing-cta")
            .getByText(
              locale === "bg"
                ? /Публичната регистрация/
                : /Public registration/,
            )
            .waitFor();
          assert.equal(await page.locator("html").getAttribute("lang"), locale);
          assert.equal(
            await page.locator("html").getAttribute("data-theme"),
            theme,
          );
          assert.equal(await page.locator("main h1").count(), 1);
          assert.match(
            await page.locator("h1").innerText(),
            locale === "bg" ? /Бойните изкуства/ : /Your focus is martial arts/,
          );
          assert.equal(await page.locator(".landing-feature").count(), 6);
          assert.equal(await page.locator("summary").count(), 7);
          assert.equal(
            await page.locator(".landing a[href='/signup']").count(),
            0,
          );
          assert.equal(await page.locator(".app-shell").count(), 0);
          guestOnly(requests);
          const accessibility = await page.evaluate(() => {
            const luminance = (color) => {
              const values = color
                .match(/[\d.]+/g)
                .slice(0, 3)
                .map((x) => Number(x) / 255);
              return values
                .map((x) =>
                  x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
                )
                .reduce(
                  (sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i],
                  0,
                );
            };
            const lowContrast = [];
            for (const selector of [
              ".landing-header .brand-wordmark__text",
              ".landing-nav a",
              ".landing-kicker",
              ".landing-hero h1 span",
              ".landing-hero-lead",
              ".landing-hero .button--primary",
              ".landing-workspace-caption",
              ".landing-feature > p",
              ".landing-feature-example figcaption",
              ".landing-questions summary",
              ".landing-cta p",
              ".landing-cta .button--primary",
            ]) {
              for (const node of document.querySelectorAll(selector)) {
                if (!node.getClientRects().length) continue;
                let background = node;
                while (
                  getComputedStyle(background).backgroundColor ===
                  "rgba(0, 0, 0, 0)"
                )
                  background = background.parentElement;
                const values = [
                  luminance(getComputedStyle(node).color),
                  luminance(getComputedStyle(background).backgroundColor),
                ].sort((a, b) => b - a);
                if ((values[0] + 0.05) / (values[1] + 0.05) < 4.5)
                  lowContrast.push(selector);
              }
            }
            const shortTargets = [
              ...document.querySelectorAll(
                ".landing a:not(.landing-skip), .landing button, .landing summary",
              ),
            ]
              .filter(
                (node) =>
                  node.getClientRects().length &&
                  node.getBoundingClientRect().height < 44,
              )
              .map((node) => node.textContent.trim());
            return {
              overflow: document.documentElement.scrollWidth > innerWidth,
              shortTargets,
              lowContrast,
            };
          });
          assert.deepEqual(
            accessibility,
            { overflow: false, shortTargets: [], lowContrast: [] },
            `${width}/${locale}/${theme}`,
          );
          const layout = await page.evaluate(() => {
            const rect = (selector) =>
              document.querySelector(selector).getBoundingClientRect();
            const viewportOverflow = [
              ...document.querySelectorAll(".landing *"),
            ]
              .filter(
                (node) =>
                  node instanceof HTMLElement &&
                  node.getClientRects().length &&
                  !node.classList.contains("sr-only"),
              )
              .filter((node) => {
                const box = node.getBoundingClientRect();
                return box.left < -1 || box.right > innerWidth + 1;
              })
              .map((node) => node.className);
            const signIn = rect(".landing-header-login");
            const brand = rect(".landing-header .landing-brand");
            const menu = rect(".landing-menu");
            const board = rect(".landing-sample-board");
            const boardRows = [
              ...document.querySelectorAll(".landing-sample-board > div"),
            ].map((node) => node.getBoundingClientRect());
            const clippedText = [...document.querySelectorAll(".landing *")]
              .filter(
                (node) =>
                  node instanceof HTMLElement &&
                  node.clientWidth > 0 &&
                  node.getClientRects().length,
              )
              .filter(
                (node) =>
                  !node.classList.contains("sr-only") &&
                  !node.classList.contains("landing-menu-label"),
              )
              .filter((node) => node.scrollWidth > node.clientWidth + 1)
              .map((node) => node.className);
            const splitWords = [];
            for (const node of document.querySelectorAll(
              ".landing-sample-board-task strong",
            )) {
              for (const match of node.textContent.matchAll(/\S+/g)) {
                const range = document.createRange();
                range.setStart(node.firstChild, match.index);
                range.setEnd(node.firstChild, match.index + match[0].length);
                if (range.getClientRects().length > 1)
                  splitWords.push(match[0]);
              }
            }
            return {
              viewportOverflow,
              clippedText,
              splitWords,
              signInRowAligned:
                Math.abs(
                  signIn.top +
                    signIn.height / 2 -
                    (brand.top + brand.height / 2),
                ) < 1,
              headerOverlaps:
                brand.right > menu.left || menu.right > signIn.left,
              narrowBoardStacked:
                board.width > 360 ||
                boardRows.every(
                  (row) => Math.abs(row.width - (board.width - 16)) < 1,
                ),
            };
          });
          assert.deepEqual(
            layout.viewportOverflow,
            [],
            "No element extends beyond the viewport",
          );
          assert.deepEqual(
            layout.clippedText,
            [],
            "Essential content is not clipped",
          );
          assert.deepEqual(
            layout.splitWords,
            [],
            "Kanban task words remain intact",
          );
          assert.equal(layout.narrowBoardStacked, true);
          if (width <= 390) {
            assert.equal(
              layout.signInRowAligned,
              true,
              "Mobile Sign in stays beside the brand",
            );
            assert.equal(layout.headerOverlaps, false);
          }
          if (locale === "bg" && theme === "dark" && width <= 390) {
            const menu = page.getByRole("button", {
              name: "Секции",
              exact: true,
            });
            await menu.click();
            await page.locator(".landing-header").screenshot({
              path: resolve(out, "mobile-nav-" + width + "-bg-dark.png"),
            });
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
              ),
              false,
            );
            await menu.click();
            await page
              .locator(".landing-feature")
              .nth(1)
              .screenshot({
                path: resolve(out, "kanban-" + width + "-bg-dark.png"),
              });
            await page.evaluate(() => scrollTo(0, 0));
          }
          const screenshot = `landing-${width}-${locale}-${theme}.png`;
          await page.screenshot({
            path: resolve(out, screenshot),
            fullPage: true,
            animations: "disabled",
          });
          report.layouts.push({ width, locale, theme, screenshot, layout });
        });

  await open({ width: 390, theme: "system" }, async (page) => {
    await visit(page);
    await page.keyboard.press("Tab");
    const skip = page.locator(".landing-skip");
    assert.equal(
      await skip.evaluate((node) => document.activeElement === node),
      true,
    );
    await page.keyboard.press("Enter");
    assert.equal(
      await page
        .locator("main")
        .evaluate((node) => document.activeElement === node),
      true,
    );
    const menu = page.getByRole("button", { name: "Sections" });
    await menu.focus();
    await page.keyboard.press("Enter");
    assert.equal(await menu.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("#landing-nav a")
        .first()
        .evaluate((node) => document.activeElement === node),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
    assert.equal(
      await menu.evaluate((node) => document.activeElement === node),
      true,
    );
    await menu.click();
    await page.locator("#landing-nav a[href='#faq']").click();
    await page.waitForURL(/#faq$/);
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
    const question = page.locator("summary").first();
    await question.focus();
    await page.keyboard.press("Space");
    assert.equal(await page.locator("details[open]").count(), 1);
    const cdp = await page.context().newCDPSession(page);
    try {
      const { root } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: ".landing-questions summary",
      });
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", {
        nodeId,
        fetchRelatives: false,
      });
      assert.ok(
        nodes[0].properties.some(
          ({ name, value }) => name === "expanded" && value.value === true,
        ),
      );
    } finally {
      await cdp.detach();
    }
    const access = page.locator("summary").last();
    await access.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("details[open]").count(), 1);
    assert.match(
      await page.locator("details[open]").innerText(),
      /Public registration is currently closed/,
    );
    assert.ok(
      await access
        .locator("svg")
        .evaluate(
          (node) =>
            Number.parseFloat(getComputedStyle(node).transitionDuration) <=
            0.00001,
        ),
    );
    assert.equal(
      await page
        .locator("html")
        .evaluate((node) => getComputedStyle(node).scrollBehavior),
      "auto",
    );
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await page.getByRole("button", { name: "Use Bulgarian" }).click();
    assert.equal(await page.locator("html").getAttribute("lang"), "bg");
    assert.match(
      await page.locator("details[open]").innerText(),
      /Публичната регистрация/,
    );
    await page
      .locator("#faq")
      .screenshot({ path: resolve(out, "faq-390-bg-dark-expanded.png") });
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("lang"), "bg");
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    check(
      "Mobile menu keyboard, Escape, anchors, skip link, FAQ expanded semantics, reduced motion and persisted system/BG preferences",
    );
  });

  await open(
    {
      api: async (route) => {
        if (pathOf(route) === "/api/me") {
          await new Promise((done) => setTimeout(done, 1800));
          return route.fulfill({ status: 503, json: {} });
        }
        return route.fulfill({ status: 503, json: {} });
      },
    },
    async (page, requests) => {
      let checked = false;
      const session = page
        .waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/me",
        )
        .then(() => {
          checked = true;
        });
      await visit(page);
      await page.locator(".landing h1").waitFor();
      assert.equal(checked, false);
      await session;
      assert.equal(new URL(page.url()).pathname, "/");
      assert.equal(
        await page.locator(".app-shell, .landing a[href='/signup']").count(),
        0,
      );
      guestOnly(requests);
      check(
        "Landing renders while session is pending, stays public on 503 and fails closed for registration",
      );
    },
  );

  await open(
    {
      width: 320,
      locale: "bg",
      api: (route) =>
        route.fulfill(
          pathOf(route) === "/api/registration"
            ? { json: { enabled: true } }
            : { status: 401, json: {} },
        ),
    },
    async (page) => {
      await visit(page);
      await page.locator(".landing-cta a[href='/signup']").waitFor();
      assert.equal(await page.locator(".landing a[href='/signup']").count(), 2);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.locator("summary").last().click();
      assert.match(
        await page.locator("details[open]").innerText(),
        /Можете също да създадете акаунт/,
      );
      await page.locator(".landing-cta a[href='/signup']").click();
      await page.locator("#signup-name").waitFor();
      check(
        "Explicit capability true exposes two signup links, correct FAQ and existing signup form",
      );
    },
  );

  await open({}, async (page) => {
    await visit(page, "/signup");
    await page
      .getByRole("heading", { name: "Registration is currently closed" })
      .waitFor();
    await visit(page);
    await page.locator(".landing-hero a[href='#how-it-works']").click();
    await page.waitForURL(/#how-it-works$/);
    await page.locator(".landing-hero a[href='/login']").click();
    await login(page);
    await page.goBack();
    await page.locator(".landing h1").waitFor();
    check("Direct signup OFF, hero anchor, Login CTA and Back to public root");
  });

  await open({}, async (page, requests) => {
    const paths = [
      "/account",
      "/events",
      eventPath + "/dashboard",
      eventPath + "/tasks?task=" + taskId + "&view=board",
      eventPath + "/calendar?view=week&date=2026-04-18",
      eventPath + "/changes/" + changeId,
    ];
    for (const path of paths) {
      await visit(page, path);
      await page.waitForURL((url) => url.pathname === "/login");
      await login(page);
      assert.equal(new URL(page.url()).searchParams.get("returnTo"), path);
      assert.equal(await page.locator(".app-shell, .landing").count(), 0);
    }
    await visit(page, "/login?returnTo=https%3A%2F%2Fexample.invalid%2F");
    await login(page);
    assert.ok(
      requests.every((path) => ["/api/me", "/api/registration"].includes(path)),
    );
    check(
      "Guest Event/Task/Kanban/Calendar/Change/account deep links preserve safe returnTo without workspace requests",
    );
  });

  let signedIn = false;
  let events = [event];
  await open(
    {
      api: (route) => {
        const path = pathOf(route);
        if (path === "/api/me")
          return route.fulfill(
            signedIn ? { json: { user } } : { status: 401, json: {} },
          );
        if (path === "/api/auth/sign-in/email") {
          signedIn = true;
          return route.fulfill({ json: { user, token: "fixture" } });
        }
        if (path === "/api/events") return route.fulfill({ json: { events } });
        if (path === `/api${eventPath}/tasks`)
          return route.fulfill({ json: { tasks: [], members } });
        if (path === `/api${eventPath}/members`)
          return route.fulfill({ json: { members } });
        if (path.endsWith("/changes"))
          return route.fulfill({ json: { changes: [] } });
        return route.continue();
      },
    },
    async (page) => {
      await visit(page, eventPath + "/calendar?view=week&date=2026-04-18");
      await login(page);
      await page.locator("#login-email").fill(user.email);
      await page.locator("#login-password").fill("SyntheticPassword123");
      await page.locator(".login-submit").click();
      await page.waitForURL((url) => url.pathname === eventPath + "/calendar");
      await page.locator(".app-shell").waitFor();
      assert.equal(new URL(page.url()).search, "?view=week&date=2026-04-18");
      await visit(page);
      await page.waitForURL((url) => url.pathname === eventPath + "/dashboard");
      await page.locator(".app-shell").waitFor();
      assert.equal(await page.locator(".landing").count(), 0);
      await page.screenshot({
        path: resolve(out, "authenticated-dashboard-fixture.png"),
      });
      signedIn = false;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForURL((url) => url.pathname === "/login");
      assert.equal(new URL(page.url()).searchParams.get("reason"), "expired");
      assert.equal(
        new URL(page.url()).searchParams.get("returnTo"),
        eventPath + "/dashboard",
      );
      signedIn = true;
      events = [];
      await visit(page);
      await page
        .locator(".app-main")
        .getByRole("link", { name: "Create event" })
        .waitFor();
      assert.equal(new URL(page.url()).pathname, "/");
      assert.equal(await page.locator(".landing").count(), 0);
      await visit(page, "/login?returnTo=https%3A%2F%2Fexample.invalid%2F");
      await page.waitForURL(origin + "/");
      assert.equal(new URL(page.url()).origin, origin);
      check(
        "Authenticated entry restores deep link, preserves populated and empty Dashboard, handles expiry and rejects external returnTo",
      );
    },
  );

  await open(
    {
      api: (route) => {
        const path = pathOf(route);
        if (path.startsWith("/api/invitations/"))
          return route.fulfill({
            json: {
              state: "pending",
              eventName: "Invited event",
              email: user.email,
              expiresAt: "2027-04-18T12:00:00Z",
            },
          });
        if (path === "/api/auth/request-password-reset")
          return route.fulfill({ json: { status: true } });
        if (path === "/api/auth/reset-password")
          return route.fulfill({ status: 400, json: {} });
        return route.continue();
      },
    },
    async (page) => {
      await visit(page, invitation);
      await page
        .getByRole("heading", { name: "Event invitation", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Create account" }).waitFor();
      await page.getByRole("button", { name: "Sign in" }).click();
      await login(page);
      assert.equal(
        new URL(page.url()).searchParams.get("returnTo"),
        invitation,
      );
      await visit(
        page,
        "/verify-email?status=verified&returnTo=" +
          encodeURIComponent(invitation),
      );
      await page.getByRole("heading", { name: "Email verified" }).waitFor();
      assert.equal(
        new URL(
          await page
            .getByRole("link", { name: "Back to sign in" })
            .getAttribute("href"),
          origin,
        ).searchParams.get("returnTo"),
        invitation,
      );
      await visit(page, "/forgot-password");
      await page.getByRole("heading", { name: "Forgot password?" }).waitFor();
      await page.locator("input[type='email']").fill(user.email);
      await page.getByRole("button", { name: "Request reset link" }).click();
      await page.getByRole("heading", { name: "Check your inbox" }).waitFor();
      await visit(page, "/reset-password?token=synthetic-reset-token");
      await page.getByRole("heading", { name: "Reset password" }).waitFor();
      await page.waitForURL(origin + "/reset-password");
      for (const input of await page.locator("input[type='password']").all())
        await input.fill("SyntheticPassword123");
      await page.getByRole("button", { name: "Save new password" }).click();
      await page
        .getByText("This reset link is invalid, expired or already used.", {
          exact: false,
        })
        .waitFor();
      check(
        "Invite-only entry with signup OFF, verification continuation, recovery and reset token cleanup",
      );
    },
  );

  const api404 = await fetch(origin + "/api/l1-missing", {
    headers: { accept: "text/html" },
  });
  assert.equal(api404.status, 404);
  assert.match(api404.headers.get("content-type"), /json/);
  const html = await fetch(origin + "/", { headers: { accept: "text/html" } });
  assert.match(
    html.headers.get("content-security-policy"),
    /default-src 'self'/,
  );
  assert.equal(html.headers.get("referrer-policy"), "no-referrer");
  assert.equal(html.headers.get("cache-control"), "no-store");
  check("Built SPA via Fastify with security headers and JSON API 404");
  assert.deepEqual(report.pageErrors, []);
  console.log(
    `${report.layouts.length} layouts, ${report.checks.length} scenario groups passed. Evidence: ${out}`,
  );
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await browser?.close();
  await app.close();
  writeFileSync(
    resolve(out, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
