// Real accounts/backend/PostgreSQL. Intentional development Events/tasks/Changes
// are retained. Transport-error and long-text fixtures are explicitly labeled.
// Credentials, cookies and invitation bearer URLs stay in memory.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const origin = "http://127.0.0.1:5173",
  readChecksOnly = process.argv.includes("--read-checks"),
  out =
    process.env.BUDOGRAPH_EVIDENCE_DIR ??
    `tmp/p3b-evidence/${readChecksOnly ? "read-checks" : "browser"}`,
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
  events: [],
  tasks: [],
  changes: [],
  applicationErrors: 0,
  consoleErrors: 0,
  expectedResourceErrors: 0,
  step: "start",
};
const contexts = [];
let lastLogin = 0;
const checked = (message) => {
  report.checks.push(message);
  console.log(`PASS: ${message}`);
};
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
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (/Failed to load resource|net::ERR/.test(message.text()))
        report.expectedResourceErrors++;
      else report.consoleErrors++;
    }
  });
  await page.goto(origin + "/changes");
  await page.locator("#login-email").waitFor();
  const delay = 11000 - (Date.now() - lastLogin);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
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
  account,
  path,
  method = "GET",
  data,
  expected = method === "POST" ? 201 : 200,
) {
  const response = await account.context.request.fetch(origin + path, {
    method,
    headers: { origin },
    ...(data ? { data } : {}),
  });
  assert.equal(response.status(), expected, `${method} ${path}`);
  return response.json();
}
const changePath = (event, change) =>
  `/api/events/${event}/changes${change ? `/${change}` : ""}`;
const href = (event, change) =>
  `/events/${event}/changes${change ? `/${change}` : ""}`;
async function open(account, event, change) {
  await account.page.goto(origin + href(event, change));
  await account.page.locator(".page--changes:not([aria-busy=true])").waitFor();
  if (change) await account.page.locator(".change-detail").waitFor();
}
async function nextAction(page, text) {
  const guidance = page.getByRole("region", {
    name: "What needs to happen next?",
    exact: true,
  });
  await guidance.getByText(text, { exact: true }).waitFor();
  return guidance;
}

async function verifyOperationalImpact(organizer, member, event, memberId) {
  const tasks = [];
  for (const [title, deadline, status] of [
    ["Delayed venue access", "2020-10-01", "blocked"],
    ["Late signage", "2020-10-02", "not-started"],
    ["Open rehearsal", "2099-10-01", "not-started"],
    ["Confirmed venue booking", "2020-10-03", "completed"],
  ]) {
    const task = (
      await api(organizer, `/api/events/${event.id}/tasks`, "POST", {
        title: `${title} ${run}`,
        deadline,
        priority: "normal",
        assignedMemberId: memberId,
      })
    ).task;
    if (status !== "not-started")
      await api(
        organizer,
        `/api/events/${event.id}/tasks/${task.id}/status`,
        "PATCH",
        {
          expectedVersion: task.version,
          status,
        },
      );
    tasks.push(task);
    report.tasks.push(task.id);
  }
  const { change } = await api(organizer, changePath(event.id), "POST", {
    title: `Operational briefing ${run}`,
    responseOwnerMemberId: memberId,
    affectedTaskIds: tasks.map(({ id }) => id),
  });
  report.changes.push(change.id);
  await open(member, event.id, change.id);
  const guidance = await nextAction(
    member.page,
    "Coordinate and record a decision.",
  );
  await guidance
    .getByText("Coordinate with an Organizer to record this step in Changes.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await member.page
      .getByRole("button", { name: "Edit change", exact: true })
      .count(),
    0,
  );

  await open(organizer, event.id, change.id);
  const { page } = organizer;
  const counts = () =>
    page.locator(".change-impact-breakdown dd").allTextContents();
  assert.deepEqual(await counts(), ["1", "1", "1", "1"]);
  assert.equal(await page.locator(".change-impact-task").count(), tasks.length);
  const row = (group, task) =>
    page
      .locator(`[aria-labelledby="change-impact-${group}"] .change-impact-task`)
      .filter({ hasText: task.title });
  await row("blocked", tasks[0])
    .getByText("Blocked", { exact: true })
    .waitFor();
  await row("blocked", tasks[0])
    .getByText("Overdue", { exact: true })
    .waitFor();
  await row("overdue", tasks[1])
    .getByText("Overdue", { exact: true })
    .waitFor();
  await row("incomplete", tasks[2]).waitFor();
  assert.equal(
    await row("completed", tasks[3])
      .getByText("Overdue", { exact: true })
      .count(),
    0,
  );

  const link = row("blocked", tasks[0]).getByRole("link");
  const href = await link.getAttribute("href");
  assert.equal(href, `/events/${event.id}/tasks?task=${tasks[0].id}`);
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(origin + href);
  await page
    .locator(".task-drawer__identity")
    .getByText(tasks[0].title, { exact: true })
    .waitFor();
  await page.goBack();
  await page.locator(".change-detail").waitFor();
  const path = `/api/events/${event.id}/tasks/${tasks[0].id}`;
  const { task } = await api(member, path);
  await api(member, path + "/status", "PATCH", {
    expectedVersion: task.version,
    status: "completed",
  });
  await page
    .getByRole("button", { name: "Refresh impact", exact: true })
    .click();
  await row("completed", task).waitFor();
  assert.deepEqual(await counts(), ["0", "1", "1", "2"]);
  assert.equal(
    await row("completed", task).getByText("Overdue", { exact: true }).count(),
    0,
  );
  const refreshed = (await api(organizer, changePath(event.id, change.id)))
    .change;
  assert.equal(refreshed.version, change.version);
  assert.equal(refreshed.impact.taskCount, tasks.length);
  checked(
    "C1-A Member owner guidance, exclusive Task groups with dual labels, keyboard Task Drawer link, and cross-session canonical status refresh",
  );
}
async function form(page, edit = false) {
  await page
    .getByRole("button", {
      name: edit ? "Edit change" : "Record change",
      exact: true,
    })
    .click();
  await page.locator(".change-form").waitFor();
  await page.waitForFunction(
    () => document.activeElement?.id === "change-title",
  );
}
async function save(page, event, change, expected = change ? 200 : 201) {
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === changePath(event, change) &&
      r.request().method() === (change ? "PATCH" : "POST"),
  );
  await page.locator(".change-form button[type=submit]").click();
  const result = await response;
  assert.equal(result.status(), expected);
  return expected < 300 ? (await result.json()).change : null;
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
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}
async function layout(page, surface, width, language, theme, stress = false) {
  const measure = await page.evaluate(async () => {
    const root = document.documentElement,
      body = document.body;
    const sample = () => ({
      client: root.clientWidth,
      scroll: root.scrollWidth,
      body: body.scrollWidth,
      x: scrollX,
      outside: [...document.querySelectorAll(".page--changes *")].flatMap(
        (node) => {
          const box = node.getBoundingClientRect();
          return box.width &&
            (box.left < -0.5 || box.right > root.clientWidth + 0.5)
            ? [
                {
                  tag: node.tagName,
                  className: node.className,
                  left: box.left,
                  right: box.right,
                },
              ]
            : [];
        },
      ),
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
    return {
      normal,
      unclipped,
      visualViewport: {
        width: visualViewport.width,
        scale: visualViewport.scale,
        offsetLeft: visualViewport.offsetLeft,
      },
      controls: [
        ...document.querySelectorAll(
          ".page--changes button,.change-choice,.change-back,.change-task-title,.change-register__title",
        ),
      ]
        .filter((node) => node.getBoundingClientRect().height)
        .map((node) => ({
          tag: node.tagName,
          height: node.getBoundingClientRect().height,
        })),
    };
  });
  for (const sample of [measure.normal, measure.unclipped]) {
    assert.ok(
      sample.scroll <= sample.client,
      JSON.stringify({ width, surface, sample }),
    );
    assert.ok(sample.body <= sample.client);
    assert.equal(sample.outside.length, 0, JSON.stringify(sample.outside));
  }
  assert.equal(measure.unclipped.rightPan, 0);
  assert.equal(measure.unclipped.leftPan, 0);
  assert.ok(measure.controls.every((control) => control.height >= 43.9));
  (stress ? report.stressFixtures : report.matrix).push({
    surface,
    width,
    language,
    theme,
    ...measure,
  });
  await page.screenshot({
    path: `${out}/${stress ? "stress-" : ""}${surface}-${width}-${language}-${theme}.png`,
    fullPage: true,
  });
}
async function fresh(account, name) {
  const event = (
    await api(account, "/api/events", "POST", {
      name,
      startDate: "2026-11-02",
      endDate: "2026-11-03",
      timezone: "Europe/Sofia",
    })
  ).event;
  report.events.push(event.id);
  return event;
}
async function contrast(page) {
  const result = await page.evaluate(() => {
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
    const samples = [...document.querySelectorAll(".page--changes *")].flatMap(
      (node) => {
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
      },
    );
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
  });
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
async function verifyReadChecks() {
  const organizer = await account("ORGANIZER");
  const events = (await api(organizer, "/api/events")).events;
  let selected;
  for (const event of events.filter(
    (event) => event.membership.accessRole === "ORGANIZER",
  )) {
    const changes = (await api(organizer, changePath(event.id))).changes;
    const change = changes.find((change) => change.affectedTasks.length >= 2);
    if (change) {
      selected = { event, change };
      break;
    }
  }
  assert.ok(selected, "Run the complete Changes verifier before read checks");
  const { event, change } = selected;
  report.contrast = [];
  report.step = "read and draft accessibility checks";
  for (const language of ["bg", "en"])
    for (const theme of ["light", "dark"]) {
      await open(organizer, event.id, change.id);
      await preferences(organizer.page, language, theme);
      report.contrast.push({
        language,
        theme,
        surface: "detail",
        ...(await contrast(organizer.page)),
      });
      await organizer.page.locator(".change-back").click();
      await organizer.page.locator(".change-register").waitFor();
      report.contrast.push({
        language,
        theme,
        surface: "list",
        ...(await contrast(organizer.page)),
      });
      await organizer.page
        .locator(".page-header__actions .button--primary")
        .click();
      await organizer.page.locator(".change-form").waitFor();
      await organizer.page.locator(".change-form button[type=submit]").click();
      assert.equal(
        await organizer.page
          .locator("#change-title")
          .getAttribute("aria-describedby"),
        "change-error-title",
      );
      assert.equal(
        await organizer.page
          .locator("#change-title")
          .evaluate((node) => node === document.activeElement),
        true,
      );
      report.contrast.push({
        language,
        theme,
        surface: "form-error",
        ...(await contrast(organizer.page)),
      });
      await organizer.page.keyboard.press("Escape");
    }
  checked(
    "12 real BG/EN Light/Dark list/detail/form-error text contrast cases, field boundary/focus contrast and associated validation focus",
  );
  await preferences(organizer.page, "en", "light");
  await form(organizer.page);
  const draft = "Unsaved transport failure draft";
  await organizer.page.locator("#change-title").fill(draft);
  await organizer.page.locator("#change-decision").fill("Unsaved decision");
  await organizer.page.locator("#change-response").fill("Unsaved response");
  await organizer.page.locator("#change-planB").fill("Unsaved fallback");
  for (const status of [500, "network"]) {
    const path = `**${changePath(event.id)}`;
    const handler = (route) =>
      route.request().method() !== "POST"
        ? route.continue()
        : status === "network"
          ? route.abort("failed")
          : route.fulfill({ status, json: { private: "PRIVATE_ERROR" } });
    await organizer.page.route(path, handler);
    await organizer.page.locator(".change-form button[type=submit]").click();
    await organizer.page.locator(".change-form [role=alert]").waitFor();
    await organizer.page.waitForFunction(() =>
      document.activeElement?.matches(".change-form [role=alert]"),
    );
    assert.equal(
      await organizer.page.locator("#change-title").inputValue(),
      draft,
    );
    for (const [key, value] of [
      ["decision", "Unsaved decision"],
      ["response", "Unsaved response"],
      ["planB", "Unsaved fallback"],
    ])
      assert.equal(
        await organizer.page.locator(`#change-${key}`).inputValue(),
        value,
      );
    assert.ok(
      !(await organizer.page.locator(".change-form").innerText()).includes(
        "PRIVATE_ERROR",
      ),
    );
    assert.equal(
      await organizer.page
        .locator(".change-form button[type=submit]")
        .isEnabled(),
      true,
    );
    await organizer.page.unroute(path, handler);
  }
  await organizer.page.keyboard.press("Escape");
  checked(
    "explicit failed-save transport doubles retain and announce the draft without replay or private error details",
  );
  report.step = "invalid Change detail projection";
  await open(organizer, event.id, change.id);
  const detailPath = `**${changePath(event.id, change.id)}`;
  const invalidProjection = (route) =>
    route.fulfill({
      json: { change: { ...change, affectedTasks: [null] } },
    });
  await organizer.page.route(detailPath, invalidProjection);
  await organizer.page
    .getByRole("button", { name: "Refresh impact", exact: true })
    .click();
  const alert = organizer.page.locator(".page--changes").getByRole("alert");
  await alert
    .getByText("The change could not be verified. Refresh and try again.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await organizer.page.locator(".change-detail").count(), 0);
  await organizer.page.unroute(detailPath, invalidProjection);
  await alert.getByRole("button", { name: "Try again", exact: true }).click();
  await organizer.page.locator(".change-detail").waitFor();
  checked(
    "malformed Change GET suppresses guidance and impact until a verified retry",
  );
  assert.equal(report.applicationErrors, 0);
  assert.equal(report.consoleErrors, 0);
}
try {
  if (readChecksOnly) {
    await verifyReadChecks();
  } else {
    report.step = "accounts";
    const organizer = await account("ORGANIZER"),
      member = await account("MEMBER");
    const events = (await api(organizer, "/api/events")).events,
      memberEvents = (await api(member, "/api/events")).events;
    const event = events.find(
      (event) =>
        !event.archived &&
        event.membership.accessRole === "ORGANIZER" &&
        memberEvents.some(
          (candidate) =>
            candidate.id === event.id &&
            candidate.membership.accessRole === "MEMBER",
        ),
    );
    assert.ok(event);
    const memberId = memberEvents.find((candidate) => candidate.id === event.id)
      .membership.id;
    report.step = "empty zero task";
    const empty = await fresh(organizer, `P3A zero-task development ${run}`);
    await open(organizer, empty.id);
    await organizer.page
      .getByText("No changes recorded", { exact: true })
      .waitFor();
    await form(organizer.page);
    await organizer.page
      .getByText("This event has no tasks yet.", { exact: false })
      .waitFor();
    await organizer.page.locator(".change-form button[type=submit]").click();
    assert.equal(
      await organizer.page
        .locator("#change-title")
        .getAttribute("aria-invalid"),
      "true",
    );
    assert.equal(
      await organizer.page
        .locator("#change-title")
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await organizer.page.keyboard.press("Escape");
    assert.equal(
      await organizer.page
        .getByRole("button", { name: "Record change", exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await form(organizer.page);
    await organizer.page
      .locator("#change-title")
      .fill(`Venue access changed ${run}`);
    const zero = await save(organizer.page, empty.id);
    report.changes.push(zero.id);
    assert.equal(zero.impact.taskCount, 0);
    await organizer.page.locator(".change-detail").waitFor();
    assert.equal(zero.decision, null);
    assert.equal(zero.response, null);
    assert.equal(zero.planB, null);
    await organizer.page
      .getByText("No decision recorded yet.", { exact: true })
      .waitFor();
    await organizer.page
      .getByText("No response recorded yet.", { exact: true })
      .waitFor();
    await organizer.page
      .getByText("No Plan B recorded.", { exact: true })
      .waitFor();
    await nextAction(
      organizer.page,
      "Assign a response owner to coordinate this change.",
    );
    await organizer.page
      .getByText("No affected tasks selected.", { exact: true })
      .waitFor();
    checked(
      "Organizer empty state, validation/focus/Escape and zero-Task Change creation",
    );

    report.step = "shared change";
    const taskFields = {
      category: "Preparation",
      context: "Controlled P3A development verification",
      priority: "normal",
      deadline: "2026-11-02",
      deadlineTime: null,
      assignedMemberId: memberId,
    };
    const taskA = (
      await api(organizer, `/api/events/${event.id}/tasks`, "POST", {
        ...taskFields,
        title: `Airport pickup P3A ${run}`,
      })
    ).task;
    const taskB = (
      await api(organizer, `/api/events/${event.id}/tasks`, "POST", {
        ...taskFields,
        title: `Hotel check-in P3A ${run}`,
        deadline: "2026-11-03",
        deadlineTime: null,
      })
    ).task;
    report.tasks.push(taskA.id, taskB.id);
    await api(
      member,
      `/api/events/${event.id}/tasks/${taskA.id}/acceptance`,
      "PUT",
      { expectedVersion: taskA.version, accepted: true },
    );
    await open(organizer, event.id);
    await form(organizer.page);
    await organizer.page
      .locator("#change-title")
      .fill(`Instructor arrival delayed ${run}`);
    await organizer.page
      .locator("#change-context")
      .fill("Flight changed. Review airport pickup and hotel check-in.");
    await organizer.page.locator("#change-owner-trigger").click();
    await organizer.page
      .getByRole("option", {
        name:
          event.membership.id === memberId
            ? "impossible"
            : (
                await api(organizer, `/api/events/${event.id}/members`)
              ).members.find((person) => person.id === event.membership.id)
                .name,
        exact: true,
      })
      .click();
    const boxA = organizer.page.locator(
      `.change-choice input[value="${taskA.id}"]`,
    );
    await boxA.focus();
    await organizer.page.keyboard.press("Space");
    assert.equal(await boxA.isChecked(), true);
    await organizer.page
      .locator(`.change-choice input[value="${taskB.id}"]`)
      .check();
    let change = await save(organizer.page, event.id);
    report.changes.push(change.id);
    await organizer.page.locator(".change-detail").waitFor();
    assert.equal(change.impact.taskCount, 2);
    assert.deepEqual(
      change.impact.people.map((person) => person.id),
      [memberId],
    );
    assert.equal(change.responseOwner.id, event.membership.id);
    await nextAction(organizer.page, "Coordinate and record a decision.");
    assert.equal(
      await organizer.page.locator(".change-impact-task").count(),
      2,
    );
    await organizer.page
      .locator(`time[datetime="2026-11-02"]`)
      .first()
      .waitFor();
    checked(
      "Organizer creates real two-Task impact, keyboard selection, response owner and distinct people/deadlines",
    );

    report.step = "P3B authoring and partial states";
    const taskState = (await api(organizer, `/api/events/${event.id}/tasks`))
      .tasks;
    const p3b = {
      decision: "Move pickup to 20:30 and postpone the welcome meeting.",
      response:
        "Driver and hotel informed. Revised arrival coordination is in place.",
      planB:
        "If the flight is cancelled, reserve one airport hotel night and welcome the instructor tomorrow.",
    };
    for (const key of ["decision", "response", "planB"]) {
      await form(organizer.page, true);
      await organizer.page.locator(`#change-${key}`).fill(p3b[key]);
      const previous = change.version;
      change = await save(organizer.page, event.id, change.id);
      await organizer.page.locator(".change-detail").waitFor();
      assert.equal(change.version, previous + 1);
      await organizer.page.getByText(p3b[key], { exact: true }).waitFor();
      assert.deepEqual(
        (await api(organizer, `/api/events/${event.id}/tasks`)).tasks,
        taskState,
      );
      if (key === "decision") {
        await nextAction(
          organizer.page,
          "Record the operational response to the decision.",
        );
        assert.equal(change.decision.authoredBy.id, event.membership.id);
        assert.equal(change.response, null);
        assert.equal(change.planB, null);
        await organizer.page
          .getByText("No response recorded yet.", { exact: true })
          .waitFor();
      }
      if (key === "response") {
        await nextAction(
          organizer.page,
          "Review the affected tasks and follow through on the agreed response.",
        );
        assert.equal(change.planB, null);
        await organizer.page
          .getByText("No Plan B recorded.", { exact: true })
          .waitFor();
      }
      if (key === "planB") {
        const fallback = organizer.page.getByRole("region", {
          name: "Plan B",
          exact: true,
        });
        await fallback
          .getByText("Fallback text recorded.", { exact: true })
          .waitFor();
        assert.equal(await fallback.getByRole("button").count(), 0);
      }
    }
    await organizer.page.reload();
    await organizer.page.locator(".change-detail").waitFor();
    assert.deepEqual(
      (await api(organizer, changePath(event.id, change.id))).change,
      change,
    );
    const decisionCreatedAt = change.decision.createdAt;
    await form(organizer.page, true);
    await organizer.page
      .locator("#change-decision")
      .fill("Move pickup to 21:00. Hotel confirmed late check-in.");
    change = await save(organizer.page, event.id, change.id);
    await organizer.page.locator(".change-detail").waitFor();
    assert.equal(change.decision.createdAt, decisionCreatedAt);
    assert.equal(change.response, p3b.response);
    assert.equal(change.planB, p3b.planB);
    assert.deepEqual(
      (await api(organizer, `/api/events/${event.id}/tasks`)).tasks,
      taskState,
    );
    await form(organizer.page, true);
    await organizer.page.locator("#change-decision").fill("   ");
    await organizer.page.locator(".change-form button[type=submit]").click();
    assert.equal(
      await organizer.page
        .locator("#change-decision")
        .getAttribute("aria-invalid"),
      "true",
    );
    assert.equal(
      await organizer.page
        .locator("#change-decision")
        .getAttribute("aria-describedby"),
      "change-decision-help change-error-decision",
    );
    assert.equal(
      await organizer.page
        .locator("#change-decision")
        .evaluate((n) => n === document.activeElement),
      true,
    );
    await organizer.page.keyboard.press("Escape");
    const authoredState = () => ({
      decision: change.decision,
      response: change.response,
      planB: change.planB,
      version: change.version,
    });
    const restoreState = {
      decision: change.decision.text,
      response: change.response,
      planB: change.planB,
    };
    await form(organizer.page, true);
    for (const key of ["decision", "response", "planB"])
      await organizer.page.locator(`#change-${key}`).fill("");
    change = await save(organizer.page, event.id, change.id);
    await organizer.page.locator(".change-detail").waitFor();
    assert.equal(change.decision, null);
    assert.equal(change.response, null);
    assert.equal(change.planB, null);
    await form(organizer.page, true);
    for (const key of ["decision", "response", "planB"])
      await organizer.page.locator(`#change-${key}`).fill(restoreState[key]);
    change = await save(organizer.page, event.id, change.id);
    await organizer.page.locator(".change-detail").waitFor();
    assert.deepEqual(
      (await api(organizer, `/api/events/${event.id}/tasks`)).tasks,
      taskState,
    );
    const beforeTaskResponse = authoredState();
    checked(
      "P3B real Organizer Decision/Response/Plan B authoring, partial states, refresh, Decision edit, server provenance, whitespace validation and unchanged Tasks",
    );

    report.step = "task deadline UI";
    await organizer.page
      .locator(".change-task-title")
      .filter({ hasText: taskA.title })
      .click();
    await organizer.page.locator(".task-drawer__identity").waitFor();
    await organizer.page
      .getByRole("button", { name: "Edit task details", exact: true })
      .click();
    await organizer.page.locator("#task-author-deadline").fill("2026-11-05");
    const taskSave = organizer.page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith(`/tasks/${taskA.id}`) &&
        r.request().method() === "PATCH",
    );
    await organizer.page
      .locator(".task-authoring-form button[type=submit]")
      .click();
    assert.equal((await taskSave).status(), 200);
    await organizer.page.goBack();
    await organizer.page.locator(".change-detail").waitFor();
    await organizer.page
      .locator("time[datetime='2026-11-05']")
      .first()
      .waitFor();
    const currentTask = (
      await api(organizer, `/api/events/${event.id}/tasks/${taskA.id}`)
    ).task;
    assert.equal(currentTask.accepted, true);
    const reassigned = (
      await api(
        organizer,
        `/api/events/${event.id}/tasks/${taskA.id}/assignment`,
        "POST",
        {
          assignedMemberId: event.membership.id,
          expectedVersion: currentTask.version,
        },
        200,
      )
    ).task;
    assert.equal(reassigned.accepted, false);
    await organizer.page
      .getByRole("button", { name: "Refresh impact", exact: true })
      .click();
    await organizer.page.locator(".change-detail").waitFor();
    change = (await api(organizer, changePath(event.id, change.id))).change;
    assert.deepEqual(authoredState(), beforeTaskResponse);
    assert.equal(change.impact.people.length, 2);
    const back = (
      await api(
        organizer,
        `/api/events/${event.id}/tasks/${taskA.id}/assignment`,
        "POST",
        { assignedMemberId: memberId, expectedVersion: reassigned.version },
        200,
      )
    ).task;
    assert.equal(back.accepted, false);
    await api(
      member,
      `/api/events/${event.id}/tasks/${taskA.id}/status`,
      "PATCH",
      { expectedVersion: back.version, status: "in-progress" },
    );
    await organizer.page.reload();
    await organizer.page.locator(".change-detail").waitFor();
    assert.equal(
      (
        await api(organizer, changePath(event.id, change.id))
      ).change.affectedTasks.find((task) => task.id === taskA.id).status,
      "in-progress",
    );
    checked(
      "Task deadline edited in UI and current reassignment/status refetched; assignment/acceptance and assign-back remain separate",
    );

    change = (await api(organizer, changePath(event.id, change.id))).change;
    assert.deepEqual(authoredState(), beforeTaskResponse);
    report.step = "P3B two-tab stale response draft";
    await form(organizer.page, true);
    const responseDraft = {
      decision: "Local unsaved decision",
      response: "Local unsaved response",
      planB: "Local unsaved Plan B",
    };
    for (const key of ["decision", "response", "planB"])
      await organizer.page.locator(`#change-${key}`).fill(responseDraft[key]);
    const secondPage = await organizer.context.newPage();
    secondPage.on("pageerror", () => report.applicationErrors++);
    await open({ page: secondPage }, event.id, change.id);
    await form(secondPage, true);
    await secondPage
      .locator("#change-decision")
      .fill("Second tab canonical decision");
    change = await save(secondPage, event.id, change.id);
    await secondPage.locator(".change-detail").waitFor();
    await save(organizer.page, event.id, change.id, 409);
    await organizer.page.locator(".change-form [role=alert]").waitFor();
    for (const key of ["decision", "response", "planB"])
      assert.equal(
        await organizer.page.locator(`#change-${key}`).inputValue(),
        responseDraft[key],
      );
    assert.equal(
      await organizer.page
        .locator(".change-form button[type=submit]")
        .isDisabled(),
      true,
    );
    await organizer.page
      .getByRole("button", { name: "Load latest version", exact: true })
      .click();
    await organizer.page
      .getByText("Latest version loaded.", { exact: false })
      .waitFor();
    assert.equal(
      await organizer.page.locator("#change-decision").inputValue(),
      change.decision.text,
    );
    assert.equal(
      await organizer.page.locator("#change-planB").inputValue(),
      change.planB,
    );
    await organizer.page.keyboard.press("Escape");
    await secondPage.close();
    checked(
      "P3B two real browser tabs: 409 retains all three drafts, blocks save, and explicit reload loads canonical response state without replay",
    );

    report.step = "409 and owner edit";
    await form(organizer.page, true);
    await organizer.page
      .locator("#change-title")
      .fill("Stale draft must not overwrite");
    change = (
      await api(organizer, changePath(event.id, change.id), "PATCH", {
        expectedVersion: change.version,
        context: "Canonical concurrent context",
      })
    ).change;
    await save(organizer.page, event.id, change.id, 409);
    await organizer.page.locator(".change-form [role=alert]").waitFor();
    assert.equal(
      await organizer.page.locator("#change-title").inputValue(),
      "Stale draft must not overwrite",
    );
    assert.equal(
      await organizer.page
        .locator(".change-form button[type=submit]")
        .isDisabled(),
      true,
    );
    assert.equal(
      await organizer.page
        .locator(".change-form [role=alert]")
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await organizer.page
      .getByRole("button", { name: "Load latest version", exact: true })
      .click();
    await organizer.page
      .getByText("Latest version loaded.", { exact: false })
      .waitFor();
    assert.equal(
      await organizer.page.locator("#change-title").inputValue(),
      change.title,
    );
    const beforeOwner = (await api(organizer, `/api/events/${event.id}/tasks`))
      .tasks;
    const responseBeforeOwner = {
      decision: change.decision,
      response: change.response,
      planB: change.planB,
    };
    await organizer.page.locator("#change-owner-trigger").click();
    await organizer.page
      .getByRole("option", { name: "Response unassigned", exact: true })
      .click();
    change = await save(organizer.page, event.id, change.id);
    await organizer.page.locator(".change-detail").waitFor();
    assert.deepEqual(
      {
        decision: change.decision,
        response: change.response,
        planB: change.planB,
      },
      responseBeforeOwner,
    );
    assert.deepEqual(
      (await api(organizer, `/api/events/${event.id}/tasks`)).tasks,
      beforeOwner,
    );
    checked(
      "real stale 409 announces/focuses conflict, preserves draft, blocks overwrite and explicitly reloads; owner edit leaves Tasks unchanged",
    );

    report.step = "member and navigation";
    change = (
      await api(organizer, changePath(event.id, change.id), "PATCH", {
        expectedVersion: change.version,
        responseOwnerMemberId: memberId,
      })
    ).change;
    await open(member, event.id, change.id);
    for (const text of [change.decision.text, change.response, change.planB])
      await member.page.getByText(text, { exact: true }).waitFor();
    assert.equal(await member.page.locator(".change-form").count(), 0);
    for (const key of ["decision", "response", "planB"])
      await api(
        member,
        changePath(event.id, change.id),
        "PATCH",
        { expectedVersion: change.version, [key]: "Denied" },
        403,
      );
    assert.equal(
      await member.page
        .getByRole("button", { name: "Edit change", exact: true })
        .count(),
      0,
    );
    await api(member, changePath(event.id), "POST", { title: "Denied" }, 403);
    await api(
      member,
      changePath(event.id, change.id),
      "PATCH",
      { expectedVersion: change.version, title: "Denied" },
      403,
    );
    await open(organizer, event.id, change.id);
    await organizer.page.locator(".change-back").click();
    await organizer.page.locator(".change-register").waitFor();
    await organizer.page.goBack();
    await organizer.page.locator(".change-detail").waitFor();
    await organizer.page.goForward();
    await organizer.page.locator(".change-register").waitFor();
    await open(organizer, event.id, change.id);
    await organizer.page.reload();
    await organizer.page.locator(".change-detail").waitFor();
    await organizer.page.locator("#event-switcher").selectOption(empty.id);
    await organizer.page.waitForURL(`**/events/${empty.id}/changes`);
    await organizer.page
      .locator(".page--changes:not([aria-busy=true])")
      .waitFor();
    assert.equal(
      await organizer.page.getByText(change.title, { exact: true }).count(),
      0,
    );
    await organizer.page.goto(origin + href(empty.id, change.id));
    await organizer.page.locator(".page--changes [role=alert]").waitFor();
    assert.equal(await organizer.page.locator(".change-detail").count(), 0);
    checked(
      "Member read-only and server denial; direct/refresh/back/forward; Event switch drops Change ID and foreign detail fails safely",
    );

    report.step = "new invitation member";
    const joined = await fresh(
      organizer,
      `P3A invited-member development ${run}`,
    );
    const invitation = await api(
      organizer,
      `/api/events/${joined.id}/invitations`,
      "POST",
      {
        email: process.env.BUDOGRAPH_MEMBER_EMAIL,
      },
    );
    // Existing API intentionally returns its development bearer URL only on create.
    const inviteUrl = origin + invitation.developmentInvitePath;
    assert.ok(inviteUrl, "Development invitation URL required");
    await member.page.goto(inviteUrl);
    await member.page
      .getByRole("button", { name: "Join Event", exact: true })
      .click();
    await member.page.locator(".app-shell").waitFor();
    await open(member, joined.id);
    await member.page
      .getByText("No changes recorded", { exact: true })
      .waitFor();
    assert.equal(
      await member.page
        .getByRole("button", { name: "Record change", exact: true })
        .count(),
      0,
    );
    const invitationChange = (
      await api(organizer, changePath(joined.id), "POST", {
        title: `Transport changed ${run}`,
      })
    ).change;
    report.changes.push(invitationChange.id);
    await open(member, joined.id, invitationChange.id);
    assert.equal(
      await member.page
        .getByRole("button", { name: "Edit change", exact: true })
        .count(),
      0,
    );
    checked(
      "newly invited active Member sees empty state and Change detail without authoring permissions",
    );

    report.step = "transport errors";
    await open(organizer, event.id, change.id);
    for (const status of [500, "network"]) {
      const path = `**${changePath(event.id, change.id)}`;
      const handler = (route) =>
        status === "network"
          ? route.abort("failed")
          : route.fulfill({ status, json: { private: "PRIVATE_ERROR" } });
      await organizer.page.route(path, handler);
      await organizer.page
        .getByRole("button", { name: "Refresh impact", exact: true })
        .click();
      await organizer.page.locator(".page--changes [role=alert]").waitFor();
      assert.equal(await organizer.page.locator(".change-detail").count(), 0);
      assert.ok(
        !(await organizer.page.locator(".page--changes").innerText()).includes(
          "PRIVATE_ERROR",
        ),
      );
      await organizer.page.unroute(path, handler);
      await organizer.page
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await organizer.page.locator(".change-detail").waitFor();
    }
    checked(
      "explicit transport mocks: server/network failure clears stale data, shows safe retry and never substitutes demo content",
    );

    report.step = "real BG EN light dark matrix";
    for (const width of [1440, 1080, 768, 390, 320])
      for (const language of ["bg", "en"])
        for (const theme of ["light", "dark"]) {
          await organizer.page.setViewportSize({ width, height: 900 });
          await open(organizer, event.id, change.id);
          await preferences(organizer.page, language, theme);
          await layout(organizer.page, "detail", width, language, theme);
          await organizer.page.locator(".change-back").click();
          await organizer.page.locator(".change-register").waitFor();
          await layout(organizer.page, "list", width, language, theme);
          await organizer.page
            .locator(".page-header__actions .button--primary")
            .click();
          await organizer.page.locator(".change-form").waitFor();
          await layout(organizer.page, "form", width, language, theme);
          await organizer.page.keyboard.press("Escape");
        }
    checked(
      "60 real list/detail/form cases at 1440/1080/768/390/320 in BG/EN light/dark; unclipped overflow/panning and 44px targets",
    );

    report.step = "long BG stress fixtures";
    await organizer.page.setViewportSize({ width: 390, height: 740 });
    const stress = structuredClone(change),
      name =
        "Много дълго име на отговорник за подготовката и транспорта ".repeat(4);
    stress.decision.text =
      "Отлагаме посрещането и координираме транспорта с хотела. "
        .repeat(32)
        .slice(0, 2000);
    stress.response =
      "Шофьорът и хотелът са уведомени за променения час на пристигане. ".repeat(
        45,
      );
    stress.planB =
      "Ако полетът бъде отменен, резервираме хотел до летището и преместваме официалното посрещане за следващата сутрин. ".repeat(
        40,
      );
    stress.title =
      "Промяна в пристигането на инструктора и организацията на транспорта "
        .repeat(3)
        .slice(0, 200);
    for (const task of stress.affectedTasks) {
      task.title = "Задача с дълго българско заглавие ".repeat(5);
      if (task.assignedMember) task.assignedMember.name = name;
    }
    for (const person of stress.impact.people) person.name = name;
    await organizer.page.route(
      `**${changePath(event.id, change.id)}`,
      (route) => route.fulfill({ json: { change: stress } }),
    );
    for (const width of [390, 320])
      for (const theme of ["light", "dark"]) {
        await organizer.page.setViewportSize({ width, height: 740 });
        await open(organizer, event.id, change.id);
        await preferences(organizer.page, "bg", theme);
        await layout(organizer.page, "long-detail", width, "bg", theme, true);
      }
    await organizer.page.unroute(`**${changePath(event.id, change.id)}`);
    checked(
      "four explicitly mocked long Bulgarian Task/title/member-name mobile detail cases",
    );
    report.step = "C1-A operational impact";
    await organizer.page.setViewportSize({ width: 320, height: 900 });
    await verifyOperationalImpact(organizer, member, event, memberId);

    report.step = "C1-A archived detail";
    const archive = await organizer.context.request.post(
      origin + `/api/events/${empty.id}/archive`,
      {
        headers: { origin, "Idempotency-Key": randomUUID() },
        data: { expectedVersion: empty.version, confirmationName: empty.name },
      },
    );
    assert.equal(archive.status(), 200);
    await open(organizer, empty.id, zero.id);
    const archivedGuidance = await nextAction(
      organizer.page,
      "Assign a response owner to coordinate this change.",
    );
    await archivedGuidance
      .getByText("This event is archived. Use this guidance for review.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await organizer.page
        .getByRole("button", { name: "Edit change", exact: true })
        .count(),
      0,
    );
    await api(
      organizer,
      changePath(empty.id, zero.id),
      "PATCH",
      { expectedVersion: zero.version, title: "Denied" },
      403,
    );
    checked(
      "C1-A archived Event keeps review guidance and denies editing in the UI and API",
    );
    assert.equal(report.applicationErrors, 0);
    assert.equal(report.consoleErrors, 0);
  }
} catch (error) {
  report.failureKind = error instanceof Error ? error.name : "Unknown";
  report.failureAt =
    error instanceof Error
      ? error.stack?.match(/verify-changes-ui\.mjs:\d+:\d+/)?.[0]
      : undefined;
  throw new Error(
    `Change browser verification did not complete at ${report.step}; raw errors and bearer data omitted.`,
  );
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  for (const context of contexts) {
    await context.request
      .post(origin + "/api/auth/sign-out", { headers: { origin }, data: {} })
      .catch(() => {});
    await context.close();
  }
  await browser.close();
}
