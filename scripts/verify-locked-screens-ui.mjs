// Frozen synthetic transport data verifies locked interiors, not real auth.
// Original Stage 1 PNG references are read-only. No baseline generation exists.
// Only the approved header's height is restored during interior capture so its
// 44px layout change cannot alter the raster origin of otherwise identical text.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createDemoWorkspace } from "../src/data/demo.ts";
import { localizeWorkspace } from "../src/i18n/localizeWorkspace.ts";
import { DEMO_REFERENCE_TIMESTAMP } from "../src/data/demoTime.ts";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const { default: sharp } = await import(
  process.env.BUDOGRAPH_SHARP_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_SHARP_MODULE).href
    : "sharp"
);
const baseline =
  process.env.BUDOGRAPH_LOCKED_BASELINE ?? "tmp/event-management-stage1/locked";
const origin = process.env.BUDOGRAPH_BASE_URL ?? "http://127.0.0.1:5173";
const out = "tmp/event-management-stage1/recovery/locked-protection";
mkdirSync(out, { recursive: true });
const references = JSON.parse(
  readFileSync(`${baseline}/report.json`, "utf8"),
).report;
assert.equal(
  references.length,
  112,
  "All original Stage 1 reference cases are required",
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const report = {
  synthetic: true,
  referencesRegenerated: false,
  cases: [],
  negativeControls: [],
  errors: 0,
  consoleErrors: 0,
};
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = (data) => createHash("sha256").update(data).digest("hex");
async function compare(a, b) {
  const before = await sharp(a).raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(
    after.info,
    before.info,
    "Locked capture dimensions must match",
  );
  let changedChannels = 0,
    maxDelta = 0;
  for (let i = 0; i < before.data.length; i++) {
    const delta = Math.abs(before.data[i] - after.data[i]);
    if (delta) changedChannels++;
    maxDelta = Math.max(maxDelta, delta);
  }
  return { changedChannels, maxDelta, pixelsIdentical: changedChannels === 0 };
}
try {
  for (const width of [1440, 1024, 960, 768, 390, 360, 320])
    for (const language of ["bg", "en"])
      for (const theme of ["light", "dark"]) {
        const state = localizeWorkspace(createDemoWorkspace(), language),
          event = state.events[0];
        const members = state.teamMembers.map((m, i) => ({
          id: id(i + 10),
          name: m.name,
          role: m.role,
        }));
        const memberIds = new Map(
          state.teamMembers.map((m, i) => [m.id, members[i].id]),
        );
        const tasks = state.tasks.map((task, i) => ({
          id: id(100 + i),
          title: task.title,
          category: task.category,
          context: task.context,
          deadline: task.deadline,
          deadlineTime: null,
          reminderOffsets: [],
          status: task.status,
          priority: task.priority,
          assignedMemberId: memberIds.get(task.ownerId) ?? null,
          accepted: task.acknowledged,
          acceptedByMemberId: task.acknowledged
            ? memberIds.get(task.ownerId)
            : null,
          acceptedAt: task.acknowledged ? task.updatedAt : null,
          version: 1,
          updatedAt: task.updatedAt,
          blockedBy: task.blockedBy ?? "",
          blocks: task.blocks ?? "",
        }));
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        try {
          await context.addInitScript(
            ({ language, theme }) => {
              if (location.href === "about:blank") return;
              localStorage.setItem(
                "budograph.preferences.v1",
                JSON.stringify({ version: 1, language, theme }),
              );
            },
            { language, theme },
          );
          const page = await context.newPage();
          page.on("pageerror", () => report.errors++);
          page.on("console", (message) => {
            if (message.type() === "error") report.consoleErrors++;
          });
          await page.clock.setFixedTime(new Date(DEMO_REFERENCE_TIMESTAMP));
          await page.route("**/api/me", (route) =>
            route.fulfill({
              json: {
                user: {
                  id: "SYNTHETIC_VISUAL_USER",
                  name: "Visual user",
                  email: "visual@example.invalid",
                },
              },
            }),
          );
          await page.route("**/api/events", (route) =>
            route.fulfill({
              json: {
                events: [
                  {
                    id: id(1),
                    name: event.name,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    timezone: "Europe/Sofia",
                    version: 1,
                    createdAt: DEMO_REFERENCE_TIMESTAMP,
                    updatedAt: DEMO_REFERENCE_TIMESTAMP,
                    archived: false,
                    membership: { id: members[0].id, accessRole: "ORGANIZER" },
                  },
                ],
              },
            }),
          );
          for (const [path, json] of [
            ["tasks", { tasks, members }],
            ["members", { members }],
            ["changes", { changes: [] }],
            ["notifications", { notifications: [], unreadCount: 0 }],
            ["invitations", { invitations: [] }],
          ])
            await page.route(`**/api/events/*/${path}`, (route) =>
              route.fulfill({ json }),
            );
          for (const [name, selector, ready] of [
            ["dashboard", ".page--dashboard", "#event-overview-title"],
            ["tasks", ".page--tasks", ".task-row"],
            ["team", ".team-workspace", ".team-roster__member"],
            ["changes", ".page--changes", '.page--changes[aria-busy="false"]'],
          ]) {
            const reference = references.find(
              (r) =>
                r.name === name &&
                r.width === width &&
                r.language === language &&
                r.theme === theme,
            );
            assert.ok(reference, "The exact original reference must exist");
            const key = `${name}-${width}-${language}-${theme}`;
            const referencePath = `${baseline}/baseline-${key}.png`;
            const referenceBuffer = readFileSync(referencePath),
              originalHash = hash(referenceBuffer);
            await page.goto(`${origin}/events/${id(1)}/${name}`);
            await page.locator(ready).first().waitFor();
            await page.evaluate(async () => {
              await document.fonts.ready;
              document.activeElement?.blur();
            });
            await page.mouse.move(0, 0);
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
              ),
              false,
            );
            const actualHeaderHeight = await page
              .locator(".app-header")
              .evaluate((header) => header.getBoundingClientRect().height);
            const referenceHeaderHeight =
              reference.headerGeometry[0].header.height;
            // These three exclusions are exactly the existing PNG protocol's
            // shared chrome, outside the locked page. No interior pixel is masked.
            const captureStyle = `.app-header,.mobile-nav,.sidebar{visibility:hidden!important}.app-header{height:${referenceHeaderHeight}px!important}`;
            const output = `${out}/current-${key}.png`;
            await page.locator(selector).screenshot({
              path: output,
              animations: "disabled",
              style: captureStyle,
            });
            const result = await compare(referenceBuffer, output);
            assert.equal(
              hash(readFileSync(referencePath)),
              originalHash,
              "Original baseline must stay byte-identical",
            );
            report.cases.push({
              name,
              width,
              language,
              theme,
              originalBaselineSha256: originalHash,
              actualHeaderHeight,
              referenceHeaderHeight,
              ...result,
            });
            // Demonstrate that strict equality still rejects an interior change.
            if (
              width === 320 &&
              language === "bg" &&
              theme === "light" &&
              ["dashboard", "changes"].includes(name)
            ) {
              const controlPath = `${out}/negative-${key}.png`;
              await page.locator(selector).screenshot({
                path: controlPath,
                animations: "disabled",
                style: `${captureStyle}${selector} h1{color:#ff00ff!important}`,
              });
              const negative = await compare(referenceBuffer, controlPath);
              assert.equal(
                negative.pixelsIdentical,
                false,
                "Deliberate locked-interior changes must be detected",
              );
              report.negativeControls.push({ name, ...negative });
            }
          }
        } finally {
          await context.close();
        }
        console.log(
          `Completed strict locked comparison: ${width} ${language} ${theme}`,
        );
      }
  assert.equal(report.errors, 0);
  assert.equal(report.consoleErrors, 0);
  assert.equal(report.cases.length, 112);
  assert.equal(
    report.cases.filter((r) => !r.pixelsIdentical).length,
    0,
    "Every locked interior must match its original pixels exactly",
  );
  assert.equal(report.negativeControls.length, 2);
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
