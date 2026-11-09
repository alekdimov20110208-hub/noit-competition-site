// Local UI fixture only: no auth client, credentials, cookies or backend calls.
// Optional dependency paths reuse installed tools without installing packages.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dependencies = resolve(process.env.BUDOGRAPH_DEPENDENCY_ROOT || root);
const require = createRequire(resolve(dependencies, "package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const bundle = await build({
  absWorkingDir: root,
  stdin: {
    resolveDir: root,
    loader: "tsx",
    contents: `
      import { StrictMode, useState } from "react";
      import { createRoot } from "react-dom/client";
      import { AppShell } from "./src/components/AppShell.tsx";
      import { PreferencesProvider } from "./src/preferences/index.ts";
      import "./src/styles.css";
      import "./src/auth/auth.css";
      window.__menuFixture = { calls: 0, navigations: [], complete: null };
      function Fixture() {
        const [path, setPath] = useState("/");
        return <PreferencesProvider><AppShell
          currentPath={path} event={null} persistenceError={null}
          onNavigate={(href) => {
            window.__menuFixture.navigations.push(href);
            history.pushState({}, "", href);
            setPath(href);
          }}
        ><h1>Account menu fixture</h1><button id="outside">Outside</button>
          <p id="outside-content" style={{ marginTop: 240 }}>Outside content</p>
        </AppShell></PreferencesProvider>;
      }
      createRoot(document.getElementById("root")).render(<StrictMode><Fixture /></StrictMode>);
    `,
  },
  bundle: true,
  write: false,
  outdir: "tmp/mobile-account-menu",
  nodePaths: [resolve(dependencies, "node_modules")],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "synthetic-auth-only",
      setup(builder) {
        builder.onResolve({ filter: /(?:^|\/)runtime\.ts$/ }, (args) => {
          if (
            resolve(args.resolveDir, args.path) ===
            resolve(root, "src/auth/runtime.ts")
          )
            return { path: "auth", namespace: "fixture" };
        });
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          resolveDir: root,
          contents: `
            export function useAuth() {
              return { status: "authenticated", accountBusy: false,
                user: { name: "Synthetic reviewer", email: "synthetic@example.invalid" } };
            }
            export const auth = { signOut() {
              window.__menuFixture.calls++;
              return new Promise(resolve => { window.__menuFixture.complete = resolve; });
            }};
          `,
        }));
      },
    },
  ],
});
const output = (extension) =>
  bundle.outputFiles.find((file) => file.path.endsWith(extension)).contents;
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  if (path === "/fixture.js" || path === "/fixture.css") {
    response.setHeader(
      "Content-Type",
      path.endsWith("js") ? "text/javascript" : "text/css",
    );
    response.end(output(path.endsWith("js") ? ".js" : ".css"));
  } else if (["/", "/account", "/login"].includes(path)) {
    response.setHeader("Content-Type", "text/html");
    response.end(
      '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script>',
    );
  } else if (path.startsWith("/brand/")) {
    response.setHeader("Content-Type", "image/svg+xml");
    // Only fixture artwork is allowed; never serve arbitrary local files.
    const name = path.split("/").at(-1);
    if (/^[a-z0-9-]+\.svg$/i.test(name)) {
      try {
        response.end(readFileSync(resolve(root, "public/brand", name)));
        return;
      } catch {
        /* 404 below */
      }
    }
    response.writeHead(404).end();
  } else response.writeHead(404).end();
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
      ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const unexpected = [],
    errors = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin && !url.pathname.startsWith("/api/"))
      return route.continue();
    unexpected.push(url.origin + url.pathname);
    return route.abort();
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "budograph.preferences.v1",
      JSON.stringify({ version: 1, language: "en", theme: "light" }),
    ),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  const menu = page.locator("details.account-control--mobile");
  const summary = menu.locator("summary");
  const profile = menu.locator('a[href="/account"]');
  const logout = menu.locator("button");
  const isOpen = () => menu.evaluate((element) => element.open);
  const open = async () => {
    await summary.tap();
    assert.equal(await isOpen(), true);
  };
  const checked = (name) => console.log(`PASS: ${name}`);
  const hitTarget = async (control) =>
    assert.equal(
      await control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.height >= 44 &&
          element.contains(
            document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            ),
          )
        );
      }),
      true,
      "Control must have a 44px target and receive pointer input",
    );

  // Reproduce Safari-like focus loss during a press, before click activation.
  // This is an injected event sequence, not physical Safari verification.
  async function nullBlurBeforeActivation(control) {
    await summary.focus();
    await control.evaluate((element) =>
      element.addEventListener(
        "pointerdown",
        () => {
          const focused = document.activeElement;
          focused?.dispatchEvent(
            new FocusEvent("focusout", { bubbles: true, relatedTarget: null }),
          );
          window.__menuFixture.openAfterBlur = element.closest("details").open;
        },
        { once: true },
      ),
    );
  }

  await open();
  await hitTarget(summary);
  await hitTarget(profile);
  await hitTarget(logout);
  checked(
    "mobile menu opens; controls have usable, unobstructed touch targets",
  );
  await nullBlurBeforeActivation(profile);
  await profile.tap();
  assert.equal(
    await page.evaluate(() => window.__menuFixture.openAfterBlur),
    true,
    "Null-relatedTarget blur must not close the menu before Profile activation",
  );
  assert.equal(new URL(page.url()).pathname, "/account");
  assert.deepEqual(
    await page.evaluate(() => window.__menuFixture.navigations),
    ["/account"],
  );
  assert.equal(await isOpen(), false);
  checked(
    "Profile survives null-relatedTarget blur and navigates to /account once",
  );

  await open();
  await nullBlurBeforeActivation(logout);
  await logout.tap();
  assert.equal(
    await page.evaluate(() => window.__menuFixture.openAfterBlur),
    true,
  );
  assert.equal(await page.evaluate(() => window.__menuFixture.calls), 1);
  assert.equal(await logout.isDisabled(), true);
  // Even duplicate programmatic click delivery cannot submit again while pending.
  await logout.dispatchEvent("click");
  assert.equal(await page.evaluate(() => window.__menuFixture.calls), 1);
  await page.evaluate(() => window.__menuFixture.complete("unavailable"));
  await menu.getByRole("alert").waitFor();
  assert.equal(await isOpen(), true);
  checked(
    "Logout survives null blur, submits once, disables pending action and retains retry error",
  );
  await logout.tap();
  assert.equal(await page.evaluate(() => window.__menuFixture.calls), 2);
  await page.evaluate(() => window.__menuFixture.complete(null));
  await page.waitForURL("**/login");
  checked("Logout retry invokes existing success navigation to /login");

  // An outside tap on non-focusable content must work without relying on blur.
  await page.locator("#outside-content").tap();
  assert.equal(await isOpen(), false);
  await open();
  await menu.locator(".account-control__identity").tap();
  assert.equal(await isOpen(), true);
  await summary.tap();
  assert.equal(await isOpen(), false);
  checked(
    "outside content closes; internal content stays open; summary toggles closed",
  );

  await summary.focus();
  await page.keyboard.press("Enter");
  assert.equal(await isOpen(), true);
  await page.keyboard.press("Tab");
  assert.equal(
    await profile.evaluate((e) => e === document.activeElement),
    true,
  );
  assert.equal(await isOpen(), true);
  await page.keyboard.press("Tab");
  assert.equal(
    await logout.evaluate((e) => e === document.activeElement),
    true,
  );
  assert.equal(await isOpen(), true);
  await page.keyboard.press("Escape");
  assert.equal(await isOpen(), false);
  assert.equal(
    await summary.evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Space");
  assert.equal(await isOpen(), true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  assert.equal(await isOpen(), false);
  checked(
    "Enter/Space, Tab within/outside, Escape and focus return remain accessible",
  );

  await page.goto(origin);
  await summary.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).pathname, "/account");
  assert.equal(await isOpen(), false);
  await summary.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => window.__menuFixture.calls), 1);
  await page.evaluate(() => window.__menuFixture.complete(null));
  await page.waitForURL("**/login");
  checked("keyboard activation reaches Profile and Logout");

  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(origin);
  await open();
  await hitTarget(profile);
  await hitTarget(logout);
  assert.equal(
    await menu.locator(".account-control__menu").evaluate((e) => {
      const rect = e.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    }),
    true,
  );
  checked(
    "320px dropdown remains within viewport and pointer targets remain unobstructed",
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktop = page.locator(".account-control--desktop");
  await desktop.locator('a[href="/account"]').click();
  assert.equal(new URL(page.url()).pathname, "/account");
  const before = await page.evaluate(() => window.__menuFixture.calls);
  await desktop.locator("button").click();
  assert.equal(
    await page.evaluate(() => window.__menuFixture.calls),
    before + 1,
  );
  assert.equal(await desktop.locator("button").isDisabled(), true);
  await page.evaluate(() => window.__menuFixture.complete(null));
  await page.waitForURL("**/login");
  checked("desktop Profile and Logout retain existing behavior");
  assert.deepEqual(
    unexpected,
    [],
    "No backend or external requests are allowed",
  );
  assert.deepEqual(errors, [], "No React/browser exceptions");
  console.log(
    `PASS: ${browser.version()}; synthetic local UI only; physical Safari/Firefox NOT VERIFIED`,
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
