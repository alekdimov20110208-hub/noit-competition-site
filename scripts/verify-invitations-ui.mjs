// Real browser + PostgreSQL evidence. Credentials/bearer links stay in memory.
// UI-created disposable Events/tasks/accounts are retained; no reset or deletion.
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createDatabasePool } from "../server/src/db/pool.ts";
import { readDatabaseEnv } from "../server/src/config/env.ts";
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = "http://127.0.0.1:5173",
  out = "tmp/p2c-evidence/browser",
  run = randomUUID().slice(0, 8);
mkdirSync(out, { recursive: true });
const config = readDatabaseEnv();
assert.equal(config.nodeEnv, "development");
const pool = createDatabasePool(config, () => {}),
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
      ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
      : {}),
  });
const report = {
    checks: [],
    matrix: [],
    dialogMatrix: [],
    events: [],
    tasks: [],
    applicationErrors: 0,
    step: "start",
  },
  contexts = [];
const checked = (label) => {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function context() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  contexts.push(context);
  await context.addInitScript(() =>
    localStorage.setItem(
      "budograph.preferences.v1",
      JSON.stringify({ version: 1, language: "en", theme: "light" }),
    ),
  );
  const page = await context.newPage();
  page.on("pageerror", () => report.applicationErrors++);
  return { context, page };
}
async function login(account, label, invitation = false) {
  await account.page
    .locator("#login-email")
    .fill(process.env[`BUDOGRAPH_${label}_EMAIL`]);
  await account.page
    .locator("#login-password")
    .fill(process.env[`BUDOGRAPH_${label}_PASSWORD`]);
  await account.page.locator("button[type=submit]").click();
  await account.page
    .locator(invitation ? ".invite-entry" : ".app-shell")
    .waitFor();
}
async function event(account, name) {
  const response = await account.context.request.post(origin + "/api/events", {
    headers: { origin },
    data: {
      name,
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      timezone: "Europe/Sofia",
    },
  });
  assert.equal(response.status(), 201);
  const event = (await response.json()).event;
  report.events.push(event.id);
  return event;
}
async function invite(account, event, email) {
  await account.page.goto(`${origin}/events/${event.id}/team`);
  await account.page
    .getByRole("button", { name: "Invite member", exact: true })
    .click();
  await account.page.locator("#invited-email").fill(email);
  await account.page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const input = account.page.locator("#development-invite-link");
  await input.waitFor();
  const url = await input.inputValue(),
    token = new URL(url).pathname.split("/").at(-1);
  const row = (
    await pool.query(
      "SELECT * FROM public.event_invitation WHERE event_id=$1 AND invited_email=$2 ORDER BY created_at DESC LIMIT 1",
      [event.id, email.trim().toLowerCase()],
    )
  ).rows[0];
  assert.equal(
    row.token_hash,
    createHash("sha256").update(token).digest("hex"),
  );
  assert.equal(JSON.stringify(row).includes(token), false);
  assert.equal(row.accepted_at, null);
  assert.ok(
    await account.page
      .getByText("Development invitation link —", { exact: false })
      .count(),
  );
  return { url, token, id: row.id };
}
async function accept(account, event) {
  const response = account.page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname.endsWith("/accept") &&
      r.request().method() === "POST",
  );
  await account.page
    .getByRole("button", { name: "Join Event", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await account.page.locator(".app-shell").waitFor();
  await account.page.waitForURL(`**/events/${event.id}/dashboard`);
}
async function member(account, event) {
  const response = await account.context.request.get(origin + "/api/events");
  assert.equal(response.status(), 200);
  const joined = (await response.json()).events.find((e) => e.id === event.id);
  assert.equal(joined.membership.accessRole, "MEMBER");
  return joined.membership.id;
}
async function safe(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /token_hash|PostgreSQL|stack trace|BETTER_AUTH_SECRET/,
  );
}
let organizer,
  existing,
  created,
  invitedEvent,
  existingInvite,
  newInvite,
  newMember;
try {
  report.step = "organizer and existing invitation";
  organizer = await context();
  await organizer.page.goto(origin + "/team");
  await login(organizer, "ORGANIZER");
  invitedEvent = await event(organizer, `P2C invitation verification ${run}`);
  existingInvite = await invite(
    organizer,
    invitedEvent,
    process.env.BUDOGRAPH_MEMBER_EMAIL,
  );
  // Explicitly exercise clipboard failure and the selectable manual-copy fallback.
  await organizer.page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Blocked clipboard fixture");
        },
      },
    }),
  );
  await organizer.page
    .getByRole("button", {
      name: "Copy development invitation link",
      exact: true,
    })
    .click();
  await organizer.page
    .getByText("Copy failed. Select and copy the link manually.", {
      exact: true,
    })
    .waitFor();
  await organizer.page.locator("#development-invite-link").focus();
  assert.equal(
    await organizer.page
      .locator("#development-invite-link")
      .evaluate((n) => n.selectionEnd - n.selectionStart === n.value.length),
    true,
  );
  await organizer.page.keyboard.press("Escape");
  await organizer.page.locator("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await organizer.page
      .getByRole("button", { name: "Invite member", exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await organizer.page.goto(existingInvite.url);
  await organizer.page
    .getByText("This invitation belongs to another email address.", {
      exact: false,
    })
    .waitFor();
  const wrong = await organizer.context.request.post(
    origin + `/api/invitations/${existingInvite.token}/accept`,
    { headers: { origin }, data: {} },
  );
  assert.equal(wrong.status(), 403);
  checked(
    "Organizer creation, DB hash-only storage, pending record, Escape/focus restoration and wrong-account denial",
  );
  existing = await context();
  await existing.page.goto(existingInvite.url);
  await existing.page
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await wait(11_000);
  await login(existing, "MEMBER", true);
  await existing.page.waitForURL(existingInvite.url);
  await existing.page.reload();
  await existing.page
    .getByRole("button", { name: "Join Event", exact: true })
    .waitFor();
  await accept(existing, invitedEvent);
  await member(existing, invitedEvent);
  await existing.page.goto(`${origin}/events/${invitedEvent.id}/team`);
  await existing.page.locator(".team-roster__member").first().waitFor();
  assert.equal(
    await existing.page
      .getByRole("button", { name: "Invite member", exact: true })
      .count(),
    0,
  );
  const memberList = await existing.context.request.get(
    origin + `/api/events/${invitedEvent.id}/invitations`,
  );
  assert.equal(memberList.status(), 403);
  checked(
    "Existing account sign-in return, direct refresh, explicit join, Team/switcher membership and Organizer-control privacy",
  );
  report.step = "new invitation registration";
  const email = `p2c-${run}@example.invalid`,
    password = randomBytes(24).toString("base64url"),
    name = `P2C new Member ${run}`;
  newInvite = await invite(organizer, invitedEvent, email);
  created = await context();
  await created.page.goto(newInvite.url);
  await created.page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  assert.equal(
    await created.page.locator("#invite-email").getAttribute("readonly"),
    "",
  );
  await created.page.locator("#invite-name").fill(name);
  await created.page.locator("#invite-password").fill(password);
  await wait(11_000);
  await created.page.locator("form button[type=submit]").click();
  await created.page
    .getByRole("button", { name: "Join Event", exact: true })
    .waitFor();
  assert.equal(
    (
      await pool.query(
        'SELECT id FROM public.event_member WHERE event_id=$1 AND user_id=(SELECT id FROM public."user" WHERE email=$2)',
        [invitedEvent.id, email],
      )
    ).rows.length,
    0,
  );
  await accept(created, invitedEvent);
  newMember = await member(created, invitedEvent);
  const record = (
    await pool.query(
      "SELECT access_role,operational_role,active FROM public.event_member WHERE id=$1",
      [newMember],
    )
  ).rows[0];
  assert.deepEqual(record, {
    access_role: "MEMBER",
    operational_role: "",
    active: true,
  });
  const account = (
    await pool.query(
      'SELECT provider_id FROM (SELECT "providerId" AS provider_id FROM public.account WHERE "userId"=(SELECT id FROM public."user" WHERE email=$1)) a',
      [email],
    )
  ).rows[0];
  assert.equal(account.provider_id, "credential");
  await created.page.goto(`${origin}/events/${invitedEvent.id}/team`);
  await created.page.getByRole("button", { name: new RegExp(name) }).waitFor();
  assert.equal(
    await created.page
      .getByRole("button", { name: "Invite member", exact: true })
      .count(),
    0,
  );
  checked(
    "Invite-only Better Auth account creation, fixed email, normal session, separate explicit acceptance, real MEMBER and Team visibility",
  );
  report.step = "new member responsibility";
  await organizer.page.goto(`${origin}/events/${invitedEvent.id}/tasks`);
  await organizer.page
    .getByRole("button", { name: "Create task", exact: true })
    .click();
  await organizer.page
    .locator("#task-author-title")
    .fill(`P2C task assignment ${run}`);
  await organizer.page.locator("#task-author-deadline").fill("2026-11-01");
  await organizer.page.locator("#task-author-assignedMemberId-trigger").click();
  await organizer.page.getByRole("option", { name, exact: true }).click();
  const save = organizer.page.waitForResponse(
    (r) =>
      r.url().endsWith(`/events/${invitedEvent.id}/tasks`) &&
      r.request().method() === "POST",
  );
  await organizer.page
    .locator(".task-authoring-form button[type=submit]")
    .click();
  const response = await save;
  assert.equal(response.status(), 201);
  const task = (await response.json()).task;
  report.tasks.push(task.id);
  assert.equal(task.assignedMemberId, newMember);
  assert.equal(task.accepted, false);
  await created.page.bringToFront();
  await created.page.goto(
    `${origin}/events/${invitedEvent.id}/tasks?task=${task.id}`,
  );
  await created.page.locator(".task-drawer__identity").waitFor();
  await created.page.waitForLoadState("networkidle");
  await created.page
    .getByRole("button", { name: "Accept responsibility", exact: true })
    .click();
  await created.page
    .getByRole("button", { name: "Withdraw acceptance", exact: true })
    .waitFor();
  await organizer.page.goto(
    `${origin}/events/${invitedEvent.id}/tasks?task=${task.id}`,
  );
  await organizer.page.locator(".task-drawer__identity").waitFor();
  const current = (
    await (
      await organizer.context.request.get(
        origin + `/api/events/${invitedEvent.id}/tasks/${task.id}`,
      )
    ).json()
  ).task;
  assert.equal(current.accepted, true);
  assert.equal(current.acceptedByMemberId, newMember);
  checked(
    "Organizer UI assigns real Task to new Member; assignment is unaccepted; Member explicitly accepts; Organizer observes canonical acceptance",
  );
  report.step = "multi-role and races";
  const own = await event(created, `P2C member-owned Event ${run}`);
  assert.equal(own.membership.accessRole, "ORGANIZER");
  await created.page.goto(`${origin}/events/${own.id}/team`);
  await created.page
    .getByRole("button", { name: "Invite member", exact: true })
    .waitFor();
  await created.page.goto(`${origin}/events/${invitedEvent.id}/team`);
  await created.page.locator(".team-roster__member").first().waitFor();
  assert.equal(
    await created.page
      .getByRole("button", { name: "Invite member", exact: true })
      .count(),
    0,
  );
  const duplicate = await Promise.all(
    [1, 2].map(() =>
      created.context.request.post(
        origin + `/api/invitations/${newInvite.token}/accept`,
        { headers: { origin }, data: {} },
      ),
    ),
  );
  assert.ok(duplicate.every((r) => r.status() === 200));
  const raceEvent = await event(organizer, `P2C race Event ${run}`),
    raceInvite = await invite(organizer, raceEvent, email);
  const race = await Promise.all(
    [1, 2].map(() =>
      created.context.request.post(
        origin + `/api/invitations/${raceInvite.token}/accept`,
        { headers: { origin }, data: {} },
      ),
    ),
  );
  assert.ok(race.every((r) => r.status() === 200));
  assert.equal(
    (
      await pool.query(
        'SELECT id FROM public.event_member WHERE event_id=$1 AND user_id=(SELECT id FROM public."user" WHERE email=$2)',
        [raceEvent.id, email],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM public.activity_entry WHERE target_id=$1 AND action_type='invitation.accepted'",
        [raceInvite.id],
      )
    ).rows.length,
    1,
  );
  const races = await Promise.all(
    [1, 2].map(() =>
      organizer.context.request.post(
        origin + `/api/events/${raceEvent.id}/invitations`,
        { headers: { origin }, data: { email: `race-${run}@example.invalid` } },
      ),
    ),
  );
  assert.deepEqual(races.map((r) => r.status()).sort(), [201, 409]);
  checked(
    "Real concurrent accept/create races serialize, one membership/history, repeat acceptance idempotent, Member-in-A/Organizer-in-B isolation",
  );
  report.step = "revocation expiration and security";
  const revoked = await invite(
    organizer,
    invitedEvent,
    `revoke-${run}@example.invalid`,
  );
  await organizer.page
    .getByRole("button", {
      name: `Revoke revoke-${run}@example.invalid`,
      exact: true,
    })
    .click();
  await organizer.page
    .locator("#development-invite-link")
    .waitFor({ state: "hidden" });
  const anonymous = await context();
  await anonymous.page.goto(revoked.url);
  await anonymous.page
    .getByText("This invitation has been revoked.", { exact: false })
    .waitFor();
  assert.equal(
    await anonymous.page
      .getByRole("button", { name: "Join Event", exact: true })
      .count(),
    0,
  );
  const expired = await invite(
    organizer,
    invitedEvent,
    `expire-${run}@example.invalid`,
  );
  // Only this newly-created disposable invitation receives test-time expiry.
  await pool.query(
    "UPDATE public.event_invitation SET created_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day' WHERE id=$1 AND event_id=$2 AND accepted_at IS NULL",
    [expired.id, invitedEvent.id],
  );
  await anonymous.page.goto(expired.url);
  await anonymous.page
    .getByText("This invitation has expired.", { exact: false })
    .waitFor();
  for (const token of [revoked.token, expired.token, "guessed"]) {
    const attempt = await anonymous.context.request.post(
      origin + `/api/invitations/${token}/register`,
      {
        headers: { origin },
        data: { name: "Disposable", password: randomBytes(16).toString("hex") },
      },
    );
    assert.ok([404, 410].includes(attempt.status()));
  }
  const unavailable = await created.context.request.get(
    origin + `/api/events/${randomUUID()}/invitations`,
  );
  assert.equal(unavailable.status(), 404);
  const forged = await created.context.request.post(
    origin + `/api/invitations/${newInvite.token}/accept`,
    {
      headers: { origin },
      data: { accessRole: "ORGANIZER", userId: "forged" },
    },
  );
  assert.equal(forged.status(), 400);
  const foreign = await organizer.context.request.post(
    origin + `/api/events/${own.id}/invitations/${expired.id}/revoke`,
    { headers: { origin }, data: {} },
  );
  assert.equal(foreign.status(), 404);
  const publicSignup = await anonymous.context.request.post(
    origin + "/api/auth/sign-up/email",
    {
      headers: { origin },
      data: {
        name: "Forbidden",
        email: `closed-${run}@example.invalid`,
        password: randomBytes(16).toString("hex"),
      },
    },
  );
  assert.equal(publicSignup.status(), 404);
  const noOrigin = await created.context.request.post(
    origin + `/api/invitations/${newInvite.token}/accept`,
    { data: {} },
  );
  assert.equal(noOrigin.status(), 403);
  checked(
    "Real revocation/expiration screens and registration denial; IDOR, guessed tokens, forged role/identity, Origin and closed public signup",
  );
  await anonymous.page.goto(origin + "/invite/invalid");
  await anonymous.page
    .getByRole("alert")
    .filter({ hasText: "The invitation or input is invalid or unavailable." })
    .waitFor();
  assert.equal(
    await anonymous.page
      .getByRole("button", { name: "Create account", exact: true })
      .count(),
    0,
  );
  report.step = "new UI responsive accessibility";
  const matrixInvite = await invite(
    organizer,
    invitedEvent,
    `long-${run}${"x".repeat(110)}@example.invalid`,
  );
  await organizer.page.keyboard.press("Escape");
  for (const width of [1440, 1024, 768, 390, 320])
    for (const language of ["en", "bg"])
      for (const theme of ["light", "dark"]) {
        const fixture = await context();
        await fixture.page.setViewportSize({ width, height: 900 });
        await fixture.page.addInitScript(
          ({ language, theme }) =>
            localStorage.setItem(
              "budograph.preferences.v1",
              JSON.stringify({ version: 1, language, theme }),
            ),
          { language, theme },
        );
        await fixture.page.goto(matrixInvite.url);
        await fixture.page
          .getByRole("button", {
            name: language === "en" ? "Create account" : "Създай акаунт",
            exact: true,
          })
          .waitFor();
        await safe(fixture.page);
        const controls = await fixture.page
          .locator(".invite-entry button")
          .evaluateAll((nodes) =>
            nodes.map((n) => ({
              h: n.getBoundingClientRect().height,
              label: n.textContent,
            })),
          );
        assert.ok(controls.length >= 2 && controls.every((c) => c.h >= 44));
        await fixture.page
          .getByRole("button", {
            name: language === "en" ? "Create account" : "Създай акаунт",
            exact: true,
          })
          .click();
        await fixture.page.locator("#invite-name").waitFor();
        await safe(fixture.page);
        if ([1440, 390].includes(width))
          await fixture.page.screenshot({
            path: `${out}/recipient-${width}-${language}-${theme}.png`,
            fullPage: true,
          });
        report.matrix.push({
          width,
          language,
          theme,
          overflow: false,
          touchTargets: true,
        });
        await fixture.context.close();
      }
  await organizer.page.goto(`${origin}/events/${invitedEvent.id}/team`);
  await organizer.page
    .getByRole("button", { name: "Invite member", exact: true })
    .click();
  await organizer.page.locator("#invited-email").waitFor();
  await organizer.page
    .getByRole("button", { name: "Create invitation", exact: true })
    .waitFor();
  await organizer.page
    .locator(".invitation-pending li")
    .filter({ hasText: `long-${run}` })
    .waitFor();
  assert.equal(
    await organizer.page
      .locator("#invited-email")
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await organizer.page.keyboard.press("Escape");
  for (const language of ["en", "bg"])
    for (const theme of ["light", "dark"]) {
      await organizer.page
        .locator(".preference-group")
        .first()
        .locator("button")
        .nth(language === "en" ? 1 : 0)
        .click();
      await organizer.page
        .locator(".preference-group")
        .nth(1)
        .locator("button")
        .nth(theme === "light" ? 1 : 2)
        .click();
      await organizer.page
        .getByRole("button", {
          name: language === "en" ? "Invite member" : "Покани участник",
          exact: true,
        })
        .click();
      await organizer.page
        .locator(".invitation-pending li")
        .filter({ hasText: `long-${run}` })
        .waitFor();
      for (const width of [1440, 1024, 768, 390, 320]) {
        await organizer.page.setViewportSize({ width, height: 900 });
        await safe(organizer.page);
        const size = await organizer.page
          .locator("dialog")
          .evaluate((n) => ({ w: n.scrollWidth, c: n.clientWidth }));
        assert.ok(size.w <= size.c);
        const targets = await organizer.page
          .locator("dialog button")
          .evaluateAll((nodes) =>
            nodes.map((n) => n.getBoundingClientRect().height),
          );
        assert.ok(targets.length >= 3 && targets.every((h) => h >= 44));
        const revokeLabels = await organizer.page
          .locator(".invitation-pending li > button")
          .evaluateAll((nodes) =>
            nodes.map((n) => {
              const range = document.createRange();
              range.selectNodeContents(n);
              return {
                width: n.getBoundingClientRect().width,
                lines: range.getClientRects().length,
              };
            }),
          );
        assert.ok(
          revokeLabels.every((label) => label.width >= 44 && label.lines === 1),
        );
        for (let i = 0; i < targets.length + 3; i++) {
          await organizer.page.keyboard.press("Tab");
          assert.equal(
            await organizer.page
              .locator("dialog")
              .evaluate((n) => n.contains(document.activeElement)),
            true,
          );
        }
        await organizer.page.locator("#invited-email").focus();
        await organizer.page.keyboard.press("Shift+Tab");
        assert.equal(
          await organizer.page
            .locator("dialog button")
            .last()
            .evaluate((n) => n === document.activeElement),
          true,
        );
        await organizer.page.keyboard.press("Tab");
        assert.equal(
          await organizer.page
            .locator("#invited-email")
            .evaluate((n) => n === document.activeElement),
          true,
        );
        report.dialogMatrix.push({
          width,
          language,
          theme,
          overflow: false,
          touchTargets: true,
          focusContained: true,
        });
        if ([1440, 390].includes(width))
          await organizer.page.locator("dialog").screenshot({
            path: `${out}/organizer-dialog-${width}-${language}-${theme}.png`,
            animations: "disabled",
          });
      }
      await organizer.page.keyboard.press("Escape");
    }
  checked(
    "20 recipient and 20 loaded-dialog BG/EN/light/dark/desktop/narrow/tablet/mobile cases, long email, 44px buttons; focus containment and safe screenshots",
  );
  assert.equal(report.applicationErrors, 0);
} catch (error) {
  report.failed = true;
  if (created?.page) {
    report.failureUi = {
      shell: await created.page.locator(".app-shell").count(),
      drawer: await created.page.locator(".task-drawer").count(),
      accept: await created.page
        .getByRole("button", { name: "Accept responsibility", exact: true })
        .count(),
      alerts: await created.page.getByRole("alert").allTextContents(),
    };
    await created.page
      .screenshot({
        path: `${out}/recipient-failure.png`,
        mask: [
          created.page.locator("input[type=password]"),
          created.page.locator("#development-invite-link"),
        ],
      })
      .catch(() => {});
  }
  console.error(`FAIL: ${report.step} (${error.name})`);
  console.error(
    String(error.message)
      .split("\n")[0]
      .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]"),
  );
  console.error(
    String(error.stack)
      .split("\n")
      .find((line) => line.includes("verify-invitations-ui.mjs:"))
      ?.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
  await pool.end();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
