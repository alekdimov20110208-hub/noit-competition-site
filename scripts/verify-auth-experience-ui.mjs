// Read-only presentation fixtures. Real auth/onboarding is verified separately by
// verify-auth-ui.mjs and verify-invitations-ui.mjs. No accounts or bearer URLs saved.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = "http://127.0.0.1:5173";
const out = "tmp/auth-polish-evidence/presentation";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  // Exercise the layout with ordinary scrollbars rather than hiding them.
  ignoreDefaultArgs: ["--hide-scrollbars"],
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const report = {
  fixture: true,
  browser: browser.version(),
  matrix: [],
  checks: [],
  applicationErrors: 0,
  consoleErrors: 0,
};

async function inspect(page, surface, width, language, theme) {
  const layout = await page.evaluate(async () => {
    const root = document.documentElement;
    const body = document.body;
    const measure = () => ({
      innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      scrollX,
      visualViewport: {
        width: visualViewport.width,
        scale: visualViewport.scale,
        offsetLeft: visualViewport.offsetLeft,
      },
      outside: [...document.querySelectorAll("*")].flatMap((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width && (rect.left < 0 || rect.right > root.clientWidth)
          ? [
              {
                tag: node.tagName,
                className: node.className,
                left: rect.left,
                right: rect.right,
              },
            ]
          : [];
      }),
      workspace: (() => {
        const rect = document
          .querySelector(".auth-workspace")
          .getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      })(),
    });
    const rendered = measure();
    const bodyStyle = body.getAttribute("style");
    const rootStyle = root.getAttribute("style");
    const y = scrollY;
    let unclipped;
    try {
      // A passing test must not depend on the pre-existing global body clipping.
      body.style.overflowX = "visible";
      root.style.scrollBehavior = "auto";
      scrollTo(0, y);
      unclipped = measure();
      scrollTo(10000, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      unclipped.panRight = scrollX;
      scrollTo(-10000, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      unclipped.panLeft = scrollX;
    } finally {
      scrollTo(0, y);
      if (bodyStyle === null) body.removeAttribute("style");
      else body.setAttribute("style", bodyStyle);
      if (rootStyle === null) root.removeAttribute("style");
      else root.setAttribute("style", rootStyle);
    }
    return { rendered, unclipped };
  });
  await page.mouse.move(width / 2, 100);
  await page.mouse.wheel(1000, 0);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const wheelPan = await page.evaluate(() => scrollX);
  report.matrix.push({ surface, width, language, theme, layout, wheelPan });
  for (const measurement of [layout.rendered, layout.unclipped]) {
    assert.ok(
      measurement.scrollWidth <= measurement.clientWidth,
      `${surface}: document overflow`,
    );
    assert.ok(
      measurement.bodyScrollWidth <= measurement.clientWidth,
      `${surface}: body overflow`,
    );
    assert.deepEqual(measurement.outside, [], `${surface}: off-screen content`);
    assert.equal(measurement.scrollX, 0);
    assert.equal(measurement.visualViewport.scale, 1);
    assert.equal(measurement.visualViewport.offsetLeft, 0);
    const { left, right } = measurement.workspace;
    assert.ok(
      Math.abs(left - (measurement.clientWidth - right)) <= 1,
      `${surface}: shell gutters`,
    );
  }
  assert.equal(layout.unclipped.panRight, 0);
  assert.equal(layout.unclipped.panLeft, 0);
  assert.equal(wheelPan, 0);
  const metrics = await page.evaluate(() => {
    const main = document.querySelector("main");
    const visible = (node) => node.getClientRects().length > 0;
    const controls = [...document.querySelectorAll("button, input")].filter(
      visible,
    );
    const rgb = (value) =>
      value
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    const luminance = (value) =>
      rgb(value)
        .map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const background = (node) => {
      while (node) {
        const color = getComputedStyle(node).backgroundColor;
        if (!color.endsWith(", 0)") && color !== "transparent") return color;
        node = node.parentElement;
      }
      return getComputedStyle(document.documentElement).getPropertyValue(
        "--canvas",
      );
    };
    const text = [
      ...main.querySelectorAll("h1, h2, p, dt, dd, label, button"),
    ].filter(visible);
    const contrasts = text.map((node) => {
      const style = getComputedStyle(node),
        fg = luminance(style.color),
        bg = luminance(background(node));
      const large =
        parseFloat(style.fontSize) >= 24 ||
        (parseFloat(style.fontSize) >= 18.66 &&
          parseInt(style.fontWeight) >= 700);
      return {
        ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
        minimum: large ? 3 : 4.5,
      };
    });
    return {
      overflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      headings: main.querySelectorAll("h1").length,
      targets: controls.map((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
      labelled: [...main.querySelectorAll("input")].every(
        (node) => node.labels?.length > 0,
      ),
      contrasts,
    };
  });
  assert.equal(metrics.overflow, false);
  assert.equal(metrics.headings, surface === "loading" ? 0 : 1);
  assert.equal(metrics.labelled, true);
  assert.ok(
    metrics.targets.every(
      (target) => target.height >= 44 && target.width >= 44,
    ),
  );
  assert.ok(
    metrics.contrasts.every((text) => text.ratio >= text.minimum),
    "auth text contrast",
  );
  const storage = await page.evaluate(() => [
    ...Object.keys(localStorage),
    ...Object.keys(sessionStorage),
  ]);
  assert.deepEqual(storage, ["budograph.preferences.v1"]);
  Object.assign(report.matrix.at(-1), {
    overflow: false,
    labelled: true,
    targets: true,
    minimumContrast: Math.min(...metrics.contrasts.map((text) => text.ratio)),
  });
  await page.screenshot({
    path: `${out}/${surface}-${width}-${language}-${theme}.png`,
    fullPage: true,
  });
}

try {
  for (const width of [1440, 1080, 768, 390, 320])
    for (const language of ["en", "bg"])
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: { width, height: width <= 390 ? 844 : 900 },
          reducedMotion: "reduce",
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
        let wrong = false;
        let releaseLoading;
        const loading = new Promise((resolve) => {
          releaseLoading = resolve;
        });
        await page.route("**/api/me", async (route) => {
          await loading;
          return route.fulfill(
            wrong
              ? {
                  json: {
                    user: {
                      id: "SYNTHETIC_VISUAL_USER",
                      name: "Visual user",
                      email: "other@example.invalid",
                    },
                  },
                }
              : { status: 401, json: { code: "UNAUTHENTICATED" } },
          );
        });
        await page.goto(origin + "/login");
        await page
          .locator(".auth-check [role=status], .auth-check[role=status]")
          .waitFor();
        await inspect(page, "loading", width, language, theme);
        releaseLoading();
        await page.locator("#login-email").waitFor();
        await page.waitForFunction(
          () => document.activeElement?.id === "login-title",
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator("#login-email")
            .evaluate((node) => node === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator("#login-password")
            .evaluate((node) => node === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator(".login-submit")
            .evaluate((node) => node === document.activeElement),
          true,
        );
        await page.keyboard.press("Escape");
        assert.equal(new URL(page.url()).pathname, "/login");
        assert.equal(
          await page
            .locator('a[href*="signup"], a[href*="forgot"], #invite-name')
            .count(),
          0,
        );
        await page.locator("#login-title").focus();
        assert.equal(await page.getByRole("alert").count(), 0);
        await inspect(page, "login", width, language, theme);

        const token = randomBytes(32).toString("base64url");
        let state = "pending",
          registrationRequests = 0;
        const invitation = {
          state: "pending",
          eventName:
            language === "bg"
              ? "Семинар по айкидо — Варна, есен 2026"
              : "Aikido seminar — Varna, autumn 2026",
          email: "invited-member@example.invalid",
          expiresAt: "2026-11-01T12:00:00.000Z",
        };
        await page.route("**/api/invitations/*", (route) =>
          route.fulfill(
            state === "invalid"
              ? { status: 404, json: { code: "INVALID_INVITATION" } }
              : { json: state === "pending" ? invitation : { state } },
          ),
        );
        await page.route("**/api/invitations/*/register", async (route) => {
          registrationRequests++;
          await new Promise((resolve) => setTimeout(resolve, 250));
          await route.fulfill({
            status: 500,
            json: { code: "REGISTRATION_FAILED" },
          });
        });
        await page.goto(origin + `/invite/${token}`);
        await page.locator("#invitation-title").waitFor();
        await page.waitForFunction(
          () => document.activeElement?.id === "invitation-title",
        );
        await inspect(page, "invitation", width, language, theme);
        const create = page.getByRole("button", {
          name: language === "en" ? "Create account" : "Създай акаунт",
          exact: true,
        });
        await create.click();
        assert.equal(
          await page
            .locator("#invite-name")
            .evaluate((node) => node === document.activeElement),
          true,
        );
        assert.equal(
          await page.locator("#invite-email").getAttribute("readonly"),
          "",
        );
        assert.equal(
          await page.locator("#invite-password").getAttribute("minlength"),
          "8",
        );
        assert.equal(
          await page.locator("#invite-password").getAttribute("maxlength"),
          "128",
        );
        await inspect(page, "registration", width, language, theme);
        await page.locator('form button[type="button"]').click();
        assert.equal(
          await create.evaluate((node) => node === document.activeElement),
          true,
        );
        if (width === 390 && language === "bg") {
          await create.click();
          await page.setViewportSize({ width, height: 420 });
          await page.locator("#invite-password").focus();
          await page.keyboard.press("Tab");
          assert.equal(
            await page
              .locator('form button[type="submit"]')
              .evaluate((node) => {
                const rect = node.getBoundingClientRect();
                return (
                  node === document.activeElement &&
                  rect.bottom <= innerHeight &&
                  rect.top >= 0
                );
              }),
            true,
          );
          await page.setViewportSize({ width, height: 844 });
          await page
            .locator("#invite-name")
            .fill("Synthetic presentation member");
          await page
            .locator("#invite-password")
            .fill(randomBytes(12).toString("hex"));
          await page.locator("form").evaluate((form) => {
            form.requestSubmit();
            form.requestSubmit();
          });
          await page.waitForFunction(
            () =>
              document.querySelector("form")?.getAttribute("aria-busy") ===
              "true",
          );
          assert.equal(
            await page.locator('form button[type="submit"]').isDisabled(),
            true,
          );
          await page.locator("#invite-page-error").waitFor();
          assert.equal(registrationRequests, 1);
          assert.equal(await page.locator("#invite-password").inputValue(), "");
          assert.equal(
            await page
              .locator("#invite-page-error")
              .evaluate((node) => node === document.activeElement),
            true,
          );
          assert.equal(
            await page.locator("#invite-name").getAttribute("aria-describedby"),
            "invite-page-error",
          );
          await inspect(page, "registration-error", width, language, theme);
        }
        const originalEmail = invitation.email;
        invitation.email = `${"i".repeat(64)}@${"d".repeat(63)}.${"e".repeat(63)}.invalid`;
        await page.goto(origin + `/invite/${token}`);
        await page.locator("#invitation-title").waitFor();
        await inspect(page, "long-email", width, language, theme);
        invitation.email = originalEmail;
        wrong = true;
        await page.goto(origin + `/invite/${token}`);
        await page.getByRole("alert").waitFor();
        assert.equal(await page.locator("#invite-name").count(), 0);
        await inspect(page, "wrong-account", width, language, theme);
        const switchAccount = page.locator(".invite-entry button").first();
        await switchAccount.focus();
        const recheck = page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/me",
        );
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await recheck;
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        assert.equal(
          await switchAccount.evaluate(
            (node) => node === document.activeElement,
          ),
          true,
        );
        wrong = false;
        for (state of [
          "expired",
          "revoked",
          "accepted",
          "unavailable",
          "invalid",
        ]) {
          await page.goto(origin + `/invite/${token}`);
          await page
            .locator(
              state === "invalid"
                ? "#invite-page-error"
                : ".invite-entry [role=status]",
            )
            .waitFor();
          assert.equal(
            await page
              .locator("#invite-name, #invite-email, #invite-event-title")
              .count(),
            0,
          );
          assert.equal(
            await page
              .getByRole("button", {
                name: language === "en" ? "Create account" : "Създай акаунт",
                exact: true,
              })
              .count(),
            0,
          );
          await inspect(page, state, width, language, theme);
        }
        report.checks.push({
          width,
          language,
          theme,
          keyboard: true,
          entryFocus: true,
          cancelRestoration: true,
        });
        await context.close();
        console.log(`PASS presentation: ${width} ${language} ${theme}`);
      }
  assert.equal(report.applicationErrors, 0);
  assert.equal(report.consoleErrors, 0);
} catch (error) {
  report.failed = true;
  console.error(
    `FAIL presentation (${error.name}): ${String(error.message)
      .split("\n")[0]
      .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]")}`,
  );
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
