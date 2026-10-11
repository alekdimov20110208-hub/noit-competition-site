// Real backend/PostgreSQL workflow. Synthetic development records are retained.
// Transport/long-name fixtures are labeled. No credentials, cookies or bearer URLs saved.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  getEventChanges,
  getPersonalChangeAttention,
} from "../src/domain/changeCoordination.ts";
import { getAttentionTasks } from "../src/domain/workspace.ts";
import { mapTaskRead } from "../src/services/RemoteWorkspaceService.ts";
import { eventCalendarNow } from "../src/services/taskReadState.ts";
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = "http://127.0.0.1:5173",
  out = "tmp/p3c-evidence/browser",
  run = randomUUID().slice(0, 8);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ignoreDefaultArgs: ["--hide-scrollbars"],
  ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
    ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
    : {}),
});
const report = {
  checks: [],
  matrix: [],
  stressFixtures: [],
  contrast: [],
  events: [],
  changes: [],
  applicationErrors: 0,
  consoleErrors: 0,
  expectedResourceErrors: 0,
  step: "start",
};
const contexts = [];
let lastLogin = 0,
  observed;
function checked(label) {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
}
async function account(label) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    timezoneId: "Pacific/Honolulu",
  });
  contexts.push(context);
  await context.addInitScript(() => {
    if (location.href === "about:blank") return;
    localStorage.setItem(
      "budograph.preferences.v1",
      JSON.stringify({ version: 1, language: "en", theme: "light" }),
    );
  });
  const page = await context.newPage();
  page.on("pageerror", () => report.applicationErrors++);
  page.on("console", (m) => {
    if (m.type() === "error") {
      if (/Failed to load resource|net::ERR/.test(m.text()))
        report.expectedResourceErrors++;
      else report.consoleErrors++;
    }
  });
  await page.goto(origin + "/");
  await page.locator("#login-email").waitFor();
  const delay = 11000 - (Date.now() - lastLogin);
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  await page
    .locator("#login-email")
    .fill(process.env[`BUDOGRAPH_${label}_EMAIL`]);
  await page
    .locator("#login-password")
    .fill(process.env[`BUDOGRAPH_${label}_PASSWORD`]);
  lastLogin = Date.now();
  await page.locator("button[type=submit]").click();
  await page.locator(".app-shell").waitFor();
  return { context, page };
}
async function api(
  who,
  path,
  method = "GET",
  data,
  status = method === "POST" ? 201 : 200,
) {
  const response = await who.context.request.fetch(origin + path, {
    method,
    headers: { origin },
    ...(data ? { data } : {}),
  });
  assert.equal(
    response.status(),
    status,
    path.includes("invitations")
      ? "Invitation request status"
      : `${method} ${path}`,
  );
  return response.json();
}
async function fresh(who, label) {
  const { event } = await api(who, "/api/events", "POST", {
    name: `P3C ${label} ${run}`,
    startDate: "2099-11-02",
    endDate: "2099-11-03",
    timezone: "Europe/Sofia",
  });
  report.events.push(event.id);
  return event;
}
async function join(organizer, member, event) {
  const invitation = await api(
    organizer,
    `/api/events/${event.id}/invitations`,
    "POST",
    { email: process.env.BUDOGRAPH_MEMBER_EMAIL },
  );
  const token = invitation.developmentInvitePath.split("/").at(-1);
  await api(member, `/api/invitations/${token}/accept`, "POST", {}, 200);
  return (await api(member, "/api/events")).events.find(
    (e) => e.id === event.id,
  );
}
async function data(who, eventId) {
  const event = (await api(who, "/api/events")).events.find(
    (e) => e.id === eventId,
  );
  const tasks = await api(who, `/api/events/${eventId}/tasks`);
  const { changes } = await api(who, `/api/events/${eventId}/changes`);
  return { event, ...tasks, changes };
}
async function dashboard(who, event) {
  observed = who.page;
  await who.page.goto(origin + `/events/${event.id}/dashboard`);
  await who.page.locator("#event-overview-title").waitFor();
  assert.equal(
    await who.page.locator("#event-overview-title").innerText(),
    event.name,
  );
}
async function verifyDashboard(who, event) {
  const values = await data(who, event.id),
    changes = getEventChanges(values.changes, event.id);
  assert.deepEqual(
    await who.page
      .locator(".change-impact__entry")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.changeId)),
    changes.map((c) => c.id),
  );
  assert.deepEqual(
    await who.page.locator(".change-impact__title-link").allTextContents(),
    changes.map((c) => c.title),
  );
  assert.deepEqual(
    await who.page
      .locator(".change-impact__title-link")
      .evaluateAll((nodes) => nodes.map((n) => new URL(n.href).pathname)),
    changes.map((c) => `/events/${event.id}/changes/${c.id}`),
  );
  const mapped = mapTaskRead(values.event, values),
    now = eventCalendarNow(new Date(), values.event.timezone);
  const taskAttention = getAttentionTasks(
    mapped.tasks,
    now,
    mapped.tasks.length,
  );
  const coordination = getPersonalChangeAttention(changes, values.event);
  const button = who.page.locator(".operational-focus button[aria-expanded]");
  if (await button.count())
    if ((await button.getAttribute("aria-expanded")) === "false")
      await button.click();
  assert.deepEqual(
    await who.page
      .locator(".focus-item[data-task-focus-key] strong")
      .allTextContents(),
    taskAttention.map((t) => t.title),
  );
  assert.deepEqual(
    await who.page
      .locator("[data-change-attention-id]")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.changeAttentionId)),
    coordination.map((i) => i.change.id),
  );
  assert.equal(
    new Set(coordination.map((i) => i.change.id)).size,
    coordination.length,
  );
  for (const change of changes) {
    const row = who.page.locator(
      `.change-impact__entry[data-change-id="${change.id}"]`,
    );
    assert.ok(
      (
        await row.locator(".change-impact__affected span").textContent()
      ).includes(String(change.impact.taskCount)),
    );
    if (change.responseOwner)
      assert.ok(
        (await row.locator(".change-impact__meta").textContent()).includes(
          change.responseOwner.name,
        ),
      );
  }
  return { values, coordination, taskAttention };
}
async function detail(who, event, change) {
  observed = who.page;
  await who.page.goto(origin + `/events/${event.id}/changes/${change.id}`);
  await who.page.locator(".change-detail").waitFor();
}
async function edit(who, event, change, fields, ownerName) {
  await detail(who, event, change);
  await who.page
    .getByRole("button", { name: "Edit change", exact: true })
    .click();
  if (ownerName) {
    await who.page.locator("#change-owner-trigger").click();
    await who.page
      .getByRole("option", { name: ownerName, exact: true })
      .click();
  }
  for (const [key, value] of Object.entries(fields))
    await who.page.locator(`#change-${key}`).fill(value);
  const pending = who.page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname ===
        `/api/events/${event.id}/changes/${change.id}` &&
      r.request().method() === "PATCH",
  );
  await who.page.locator(".change-form button[type=submit]").click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const updated = (await response.json()).change;
  await who.page.locator(".change-detail").waitFor();
  return updated;
}
async function returnDashboard(who, event) {
  const read = who.page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === `/api/events/${event.id}/changes` &&
      r.request().method() === "GET",
  );
  await who.page
    .locator(`.sidebar a[href="/events/${event.id}/dashboard"]`)
    .click();
  await read;
  await who.page.locator("#event-overview-title").waitFor();
  return verifyDashboard(who, event);
}
async function preferences(page, language, theme) {
  await page
    .locator(".preference-group")
    .first()
    .locator("button")
    .nth(language === "bg" ? 0 : 1)
    .click();
  await page
    .locator(".preference-group")
    .nth(1)
    .locator("button")
    .nth(theme === "light" ? 1 : 2)
    .click();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    );
  });
}
async function layout(page, key) {
  const measured = await page.evaluate(async () => {
    const root = document.documentElement,
      body = document.body;
    const sample = () => ({
      client: root.clientWidth,
      scroll: root.scrollWidth,
      body: body.scrollWidth,
      outside: [...document.querySelectorAll(".app-main *")].flatMap((n) => {
        const r = n.getBoundingClientRect();
        return r.width && (r.left < -0.5 || r.right > root.clientWidth + 0.5)
          ? [{ tag: n.tagName, left: r.left, right: r.right }]
          : [];
      }),
    });
    const normal = sample(),
      style = body.getAttribute("style"),
      y = scrollY;
    let unclipped;
    try {
      body.style.overflowX = "visible";
      unclipped = sample();
      scrollTo(10000, y);
      await new Promise((r) => requestAnimationFrame(r));
      unclipped.rightPan = scrollX;
      scrollTo(-10000, y);
      await new Promise((r) => requestAnimationFrame(r));
      unclipped.leftPan = scrollX;
    } finally {
      scrollTo(0, y);
      if (style === null) body.removeAttribute("style");
      else body.setAttribute("style", style);
    }
    const targets = [
      ...document.querySelectorAll(
        ".page--dashboard .focus-item,.page--dashboard .change-impact__title-link,.page--dashboard .text-button,.page--changes button,.change-register__title,.change-task-title",
      ),
    ]
      .filter((n) => n.getBoundingClientRect().height)
      .map((n) => ({
        tag: n.tagName,
        height: n.getBoundingClientRect().height,
      }));
    return {
      normal,
      unclipped,
      targets,
      visualViewport: {
        width: visualViewport.width,
        scale: visualViewport.scale,
        offsetLeft: visualViewport.offsetLeft,
      },
    };
  });
  for (const value of [measured.normal, measured.unclipped]) {
    assert.ok(value.scroll <= value.client, key);
    assert.ok(value.body <= value.client, key);
    assert.equal(value.outside.length, 0, key);
  }
  assert.equal(measured.unclipped.rightPan, 0, key);
  assert.equal(measured.unclipped.leftPan, 0, key);
  assert.ok(
    measured.targets.every((t) => t.height >= 43.9),
    key,
  );
  return measured;
}
async function contrast(page, selector) {
  const result = await page.evaluate((selector) => {
    const rgba = (value) => value.match(/[\d.]+/g).map(Number);
    const over = (foreground, background) =>
      foreground
        .slice(0, 3)
        .map(
          (value, index) =>
            value * (foreground[3] ?? 1) +
            background[index] * (1 - (foreground[3] ?? 1)),
        );
    const luminance = (color) =>
      color
        .slice(0, 3)
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const ratio = (foreground, background) => {
      const values = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a,
      );
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const backgroundOf = (node) => {
      const ancestors = [];
      for (let current = node; current; current = current.parentElement)
        ancestors.push(current);
      return ancestors
        .reverse()
        .reduce(
          (color, ancestor) =>
            over(rgba(getComputedStyle(ancestor).backgroundColor), color),
          [255, 255, 255],
        );
    };
    const samples = [...document.querySelectorAll(selector)].flatMap((node) => {
      if (
        !node.getBoundingClientRect().height ||
        node.matches(":disabled") ||
        ![...node.childNodes].some(
          (child) =>
            child.nodeType === Node.TEXT_NODE && child.textContent.trim(),
        )
      )
        return [];
      const style = getComputedStyle(node),
        background = backgroundOf(node);
      const color = over(rgba(style.color), background),
        size = parseFloat(style.fontSize);
      const minimum =
        size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
          ? 3
          : 4.5;
      return [
        {
          tag: node.tagName,
          className: node.className,
          ratio: ratio(color, background),
          minimum,
        },
      ];
    });
    const controls = [
      ...document.querySelectorAll(
        "#change-title,#change-context,#change-decision,#change-response,#change-planB",
      ),
    ].map((node) => {
      const style = getComputedStyle(node),
        background = backgroundOf(node);
      return {
        id: node.id,
        borderContrast: ratio(rgba(style.borderTopColor), background),
        ...(node === document.activeElement
          ? {
              outlineStyle: style.outlineStyle,
              outlineContrast: ratio(rgba(style.outlineColor), background),
            }
          : {}),
      };
    });
    return {
      controls,
      count: samples.length,
      minimumRatio: Math.min(...samples.map((sample) => sample.ratio)),
      failures: samples.filter(
        (sample) => sample.ratio + 0.01 < sample.minimum,
      ),
    };
  }, selector);
  assert.ok(result.count >= 10);
  assert.deepEqual(result.failures, []);
  for (const control of result.controls) {
    assert.ok(control.borderContrast >= 3, control.id);
    if (control.outlineContrast !== undefined) {
      assert.notEqual(control.outlineStyle, "none");
      assert.ok(control.outlineContrast >= 3);
    }
  }
  return result;
}
async function clarity(page) {
  assert.deepEqual(
    await page
      .locator(".change-detail h2,.change-detail h3")
      .evaluateAll((nodes) =>
        nodes
          .filter(
            (n) =>
              n.id === "change-owner-title" ||
              n.id === "change-impact-title" ||
              n.id === "change-decision-title" ||
              n.id === "change-response-title" ||
              n.id === "change-planB-title",
          )
          .map((n) => n.id),
      ),
    [
      "change-impact-title",
      "change-owner-title",
      "change-decision-title",
      "change-response-title",
      "change-planB-title",
    ],
  );
  for (const id of [
    "change-owner-description",
    "change-decision-description",
    "change-response-description",
    "change-planB-description",
  ]) {
    assert.ok((await page.locator(`#${id}`).innerText()).trim());
    assert.equal(await page.locator(`[aria-describedby="${id}"]`).count(), 1);
  }
  assert.equal(
    await page.locator(".change-detail .status-badge").count(),
    await page.locator(".change-impact-task").count(),
  );
}
try {
  const organizer = await account("ORGANIZER"),
    member = await account("MEMBER");
  const event = await fresh(organizer, "coordination"),
    empty = await fresh(organizer, "empty");
  await join(organizer, member, event);
  await join(organizer, member, empty);
  await dashboard(organizer, empty);
  assert.equal(
    await organizer.page.locator(".change-impact__entry").count(),
    0,
  );
  assert.match(
    await organizer.page.locator(".change-impact").innerText(),
    /No changes recorded/,
  );
  const { task } = await api(
    organizer,
    `/api/events/${event.id}/tasks`,
    "POST",
    {
      title: `P3C linked work ${run}`,
      deadline: "2099-10-30",
      deadlineTime: null,
      priority: "normal",
    },
  );
  const beforeTasks = (await api(organizer, `/api/events/${event.id}/tasks`))
    .tasks;
  let change = (
    await api(organizer, `/api/events/${event.id}/changes`, "POST", {
      title: `P3C delayed arrival ${run}`,
      context: "Review pickup and hotel coordination.",
      affectedTaskIds: [task.id],
    })
  ).change;
  report.changes.push(change.id);
  report.step = "real operational row and unowned attention";
  await dashboard(organizer, event);
  let shown = await verifyDashboard(organizer, event);
  assert.deepEqual(
    shown.coordination.map((i) => i.reason),
    ["needs-owner"],
  );
  assert.equal(shown.taskAttention.length, 1);
  await organizer.page.locator(".change-impact__title-link").click();
  await organizer.page.locator(".change-detail").waitFor();
  assert.equal(
    new URL(organizer.page.url()).pathname,
    `/events/${event.id}/changes/${change.id}`,
  );
  await organizer.page.reload();
  await organizer.page.locator(".change-detail").waitFor();
  await clarity(organizer.page);
  const ownName = (await api(organizer, "/api/me")).user.name;
  change = await edit(organizer, event, change, {}, ownName);
  shown = await returnDashboard(organizer, event);
  assert.deepEqual(
    shown.coordination.map((i) => i.reason),
    ["needs-decision"],
  );
  const priorVersion = change.version;
  change = await edit(organizer, event, change, {
    decision: "Move pickup to the revised arrival time.",
  });
  assert.equal(change.version, priorVersion + 1);
  shown = await returnDashboard(organizer, event);
  assert.deepEqual(
    shown.coordination.map((i) => i.reason),
    ["needs-response"],
  );
  change = await edit(organizer, event, change, {
    response: "Driver and hotel are coordinating the revised arrival.",
  });
  shown = await returnDashboard(organizer, event);
  assert.deepEqual(shown.coordination, []);
  assert.equal(change.planB, null);
  change = await edit(organizer, event, change, {
    planB: "If the flight is cancelled, coordinate an airport hotel night.",
  });
  shown = await returnDashboard(organizer, event);
  assert.deepEqual(shown.coordination, []);
  assert.deepEqual(
    (await api(organizer, `/api/events/${event.id}/tasks`)).tasks,
    beforeTasks,
  );
  checked(
    "Real Organizer row/detail/refresh and owner → Decision → Response → optional Plan B authoring; attention progresses and clears without changing Tasks or Task attention",
  );

  report.step = "A-G deterministic canonical fixtures";
  const memberEvent = (await api(member, "/api/events")).events.find(
    (e) => e.id === event.id,
  );
  const owner = event.membership.id,
    memberId = memberEvent.membership.id;
  const definitions = [
    ["A unowned", {}],
    ["B own decision pending", { responseOwnerMemberId: owner }],
    [
      "C own response pending",
      { responseOwnerMemberId: owner, decision: "Agreed approach" },
    ],
    [
      "D response without Plan B",
      {
        responseOwnerMemberId: owner,
        decision: "Agreed",
        response: "Underway",
      },
    ],
    [
      "E prepared fallback",
      {
        responseOwnerMemberId: owner,
        decision: "Agreed",
        response: "Underway",
        planB: "Explicit fallback",
      },
    ],
    ["F another owner", { responseOwnerMemberId: memberId }],
    [
      "Промяна в пристигането на инструктора и координацията с хотела. "
        .repeat(4)
        .slice(0, 190),
      { responseOwnerMemberId: memberId },
    ],
  ];
  const scenarios = [];
  for (const [title, fields] of definitions) {
    const value = (
      await api(organizer, `/api/events/${event.id}/changes`, "POST", {
        title: `${title} ${run}`.slice(0, 200),
        ...fields,
      })
    ).change;
    scenarios.push(value);
    report.changes.push(value.id);
  }
  await dashboard(organizer, event);
  shown = await verifyDashboard(organizer, event);
  assert.equal(shown.coordination.length, 3);
  assert.equal(shown.taskAttention.length, 1);
  assert.equal(
    await organizer.page.locator(".change-impact__entry:visible").count(),
    1,
  );
  await organizer.page.locator(".change-impact summary").click();
  assert.equal(
    await organizer.page.locator(".change-impact__entry:visible").count(),
    8,
  );
  await dashboard(member, event);
  shown = await verifyDashboard(member, event);
  assert.equal(shown.coordination.length, 2);
  assert.ok(shown.coordination.every((i) => i.reason === "needs-decision"));
  const owned = scenarios.at(-1);
  await member.page.locator(`[data-change-attention-id="${owned.id}"]`).click();
  await member.page.locator(".change-detail").waitFor();
  assert.equal(
    await member.page
      .getByRole("button", { name: "Edit change", exact: true })
      .count(),
    0,
  );
  assert.equal(await member.page.locator(".change-form").count(), 0);
  await api(
    member,
    `/api/events/${event.id}/changes/${owned.id}`,
    "PATCH",
    { expectedVersion: owned.version, decision: "Denied Member authoring" },
    403,
  );
  await clarity(member.page);
  for (const who of [organizer, member])
    for (const value of [
      scenarios[0],
      scenarios[2],
      scenarios[3],
      scenarios[4],
    ]) {
      await detail(who, event, value);
      await clarity(who.page);
      assert.equal(await who.page.locator("#change-decision-title").count(), 1);
      if (!value.decision)
        assert.match(
          await who.page.locator(".change-detail").innerText(),
          /No decision recorded yet/,
        );
      if (!value.response)
        assert.match(
          await who.page.locator(".change-detail").innerText(),
          /No response recorded yet/,
        );
      if (!value.planB)
        assert.match(
          await who.page.locator(".change-detail").innerText(),
          /No Plan B recorded/,
        );
    }
  checked(
    "A-G real fixtures: one personal item per applicable Change, no missing-Plan-B attention, Member owners read only, independent Task attention, four partial detail states and causal heading/microcopy order",
  );

  report.step = "Event switching and late reads";
  for (const who of [organizer, member]) {
    await dashboard(who, event);
    await who.page.locator("#event-switcher").selectOption(empty.id);
    await who.page
      .locator("#event-overview-title")
      .getByText(empty.name, { exact: true })
      .waitFor();
    assert.equal(await who.page.locator(".change-impact__entry").count(), 0);
    assert.equal(
      await who.page.locator("[data-change-attention-id]").count(),
      0,
    );
    await who.page.goBack();
    await who.page
      .locator("#event-overview-title")
      .getByText(event.name, { exact: true })
      .waitFor();
    await verifyDashboard(who, event);
    await who.page.goForward();
    await who.page
      .locator("#event-overview-title")
      .getByText(empty.name, { exact: true })
      .waitFor();
  }
  await api(member, `/api/events/${event.id}/changes/${change.id}`);
  const foreign = await fresh(organizer, "foreign");
  await api(member, `/api/events/${foreign.id}/changes`, "GET", undefined, 404);
  let release, entered;
  const hold = new Promise((r) => (release = r)),
    waiting = new Promise((r) => (entered = r));
  const delayed = async (route) => {
    entered();
    await hold;
    try {
      await route.continue();
    } catch {}
  };
  await organizer.page.route(`**/api/events/${event.id}/changes`, delayed, {
    times: 1,
  });
  const navigation = organizer.page.goto(
    origin + `/events/${event.id}/dashboard`,
  );
  await waiting;
  await organizer.page.locator("#event-switcher").selectOption(empty.id);
  release();
  await navigation;
  await organizer.page
    .locator("#event-overview-title")
    .getByText(empty.name, { exact: true })
    .waitFor();
  assert.equal(
    await organizer.page.locator(".change-impact__entry").count(),
    0,
  );
  checked(
    "Real Event switching/back/forward, foreign Event denial and labeled held old-Event Change response never leak previous operational/attention rows",
  );

  report.step = "safe Change-only failure";
  for (const failure of [500, "network"]) {
    const pattern = `**/api/events/${event.id}/changes`,
      handler = (route) =>
        failure === "network"
          ? route.abort("failed")
          : route.fulfill({
              status: 500,
              json: { private: "PRIVATE_P3_DATABASE_DETAIL" },
            });
    await organizer.page.route(pattern, handler);
    await dashboard(organizer, event);
    await organizer.page
      .locator("[data-change-read-state=error]")
      .first()
      .waitFor();
    assert.equal(
      await organizer.page.locator(".change-impact__entry").count(),
      0,
    );
    const text = await organizer.page.locator(".page--dashboard").innerText();
    assert.doesNotMatch(
      text,
      /PRIVATE_|No changes recorded|Nothing needs immediate attention/,
    );
    assert.equal(
      await organizer.page.locator(".focus-item[data-task-focus-key]").count(),
      1,
    );
    await organizer.page.unroute(pattern, handler);
    await organizer.page
      .locator(".change-impact")
      .getByRole("button", { name: "Try again", exact: true })
      .click();
    await organizer.page.locator(".change-impact__entry").first().waitFor();
    await verifyDashboard(organizer, event);
  }
  checked(
    "Labeled server/network failures expose safe retry in both P3 sections, clear Change content, preserve Task signals and never claim fake zero data",
  );

  report.step = "real role/language/theme/width matrix";
  for (const [role, who] of [
    ["organizer", organizer],
    ["member", member],
  ])
    for (const width of [1440, 1080, 768, 390, 320])
      for (const language of ["bg", "en"])
        for (const theme of ["light", "dark"]) {
          await who.page.setViewportSize({ width, height: 900 });
          for (const surface of ["dashboard", "detail", "list"]) {
            if (surface === "dashboard") await dashboard(who, event);
            else if (surface === "detail") await detail(who, event, owned);
            else {
              await who.page.goto(origin + `/events/${event.id}/changes`);
              await who.page.locator(".change-register").waitFor();
            }
            await preferences(who.page, language, theme);
            if (surface === "dashboard") {
              await verifyDashboard(who, event);
              await who.page.locator(".change-impact summary").click();
            }
            if (surface === "detail") await clarity(who.page);
            if (surface === "list") {
              assert.equal(
                await who.page.locator(".change-register__state").count(),
                8,
              );
              assert.equal(
                await who.page
                  .locator(".change-register .status-badge")
                  .count(),
                0,
              );
            }
            const key = `${surface}-${role}-${width}-${language}-${theme}`;
            if (width === 1440)
              report.contrast.push({
                surface,
                role,
                language,
                theme,
                ...(await contrast(
                  who.page,
                  surface === "dashboard"
                    ? ".change-impact *, .focus-item[data-change-attention-id] *"
                    : ".page--changes *",
                )),
              });
            report.matrix.push({
              surface,
              role,
              width,
              language,
              theme,
              ...(await layout(who.page, key)),
            });
            await who.page.screenshot({
              path: `${out}/${key}.png`,
              fullPage: true,
            });
          }
          console.log(`PASS: ${role} ${width} ${language} ${theme}`);
        }
  checked(
    "120 real Dashboard/detail/list cases: Organizer/Member × BG/EN × Light/Dark × five widths; expanded rows, long BG title, associated descriptions, unclipped overflow and 44px links/controls",
  );
  checked(
    "24 real role/surface BG/EN Light/Dark text contrast cases include all new P3 Dashboard and clarity copy",
  );
  report.step = "labeled long-member-name fixtures";
  const canonical = (await api(organizer, `/api/events/${event.id}/changes`))
    .changes;
  const longNames = canonical.map((change) => ({
    ...change,
    responseOwner: change.responseOwner
      ? {
          ...change.responseOwner,
          name:
            "Координатор на реакцията с много дълго име ".repeat(5) +
            "НепрекъснатоИме".repeat(15),
        }
      : null,
  }));
  const pattern = `**/api/events/${event.id}/changes`,
    nameFixture = (route) => route.fulfill({ json: { changes: longNames } });
  await organizer.page.route(pattern, nameFixture);
  for (const width of [390, 320])
    for (const theme of ["light", "dark"]) {
      await organizer.page.setViewportSize({ width, height: 900 });
      await dashboard(organizer, event);
      await preferences(organizer.page, "bg", theme);
      await organizer.page.locator(".change-impact summary").click();
      report.stressFixtures.push({
        presentationFixture: true,
        width,
        language: "bg",
        theme,
        ...(await layout(organizer.page, `long-name-${width}-${theme}`)),
      });
      await organizer.page.screenshot({
        path: `${out}/stress-dashboard-${width}-bg-${theme}.png`,
        fullPage: true,
      });
    }
  await organizer.page.unroute(pattern, nameFixture);
  checked(
    "Four explicitly labeled long Bulgarian/unbroken response-owner name fixtures at 390/320 in both themes wrap without clipping or overflow",
  );
  report.step = "keyboard and focused read-only review";
  await organizer.page.setViewportSize({ width: 1440, height: 900 });
  await dashboard(organizer, event);
  await preferences(organizer.page, "en", "light");
  const first = organizer.page.locator(".change-impact__title-link").first();
  // Establish actual keyboard modality before programmatically selecting the target.
  // Pointer-driven focus correctly need not match :focus-visible in Chromium.
  await organizer.page.keyboard.press("Tab");
  await first.focus();
  assert.equal(await first.evaluate((n) => document.activeElement === n), true);
  assert.notEqual(
    await first.evaluate((n) => getComputedStyle(n).outlineStyle),
    "none",
  );
  await organizer.page.keyboard.press("Enter");
  await organizer.page.locator(".change-detail").waitFor();
  await organizer.page.goBack();
  await organizer.page.locator("#event-overview-title").waitFor();
  await verifyDashboard(organizer, event);
  const attention = organizer.page
    .locator("[data-change-attention-id]")
    .first();
  await attention.focus();
  await organizer.page.keyboard.press("Enter");
  await organizer.page.locator(".change-detail").waitFor();
  await clarity(organizer.page);
  assert.equal(
    await organizer.page.locator("a a,a button,button a").count(),
    0,
  );
  checked(
    "Keyboard Enter/focus on operational and personal links, durable Back navigation, no nested interactive controls and fresh read-only semantic clarity review",
  );
  assert.equal(report.applicationErrors, 0);
  assert.equal(report.consoleErrors, 0);
} catch (error) {
  console.log("Failed step:", report.step);
  if (observed)
    await observed
      .screenshot({ path: `${out}/failure.png`, fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  for (const context of contexts) {
    await context.request
      .post(origin + "/api/auth/sign-out", { headers: { origin }, data: {} })
      .catch(() => {});
    await context.close();
  }
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
