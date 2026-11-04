import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { id } from "./calendar-fixtures.mjs";
import {
  activeEvent,
  archivedEvent,
  kanbanFixtureHost,
  workshopPath,
} from "./preview-kanban-k1a.mjs";

export const handle = (page, taskId) =>
  page.locator(`#task-board-move-${taskId}`);
const board = (page) => page.locator(".task-board");
const column = (page, status) =>
  page.locator(`[aria-labelledby="task-board-${status}"]`);
const card = (page, status, taskId) =>
  column(page, status).locator(`[data-task-focus-key="task-board:${taskId}"]`);
const statusPath = (taskId) => `/api${workshopPath}/${taskId}/status`;
const respondToStatus = (page, taskId) =>
  page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === statusPath(taskId) &&
      response.request().method() === "PATCH",
  );

async function pickUpWithKeyboard(page, taskId) {
  await handle(page, taskId).focus();
  await page.keyboard.press("Space");
  await page.locator(".task-board__preview").waitFor();
  // dnd-kit attaches the keyboard listener on the following task.
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}

export async function dragCard(
  page,
  taskId,
  destination,
  { highlight = true } = {},
) {
  const grip = handle(page, taskId);
  await grip.scrollIntoViewIfNeeded();
  const start = await grip.boundingBox();
  const target = await (
    destination ? column(page, destination) : board(page)
  ).boundingBox();
  assert.ok(start && target);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(
      start.x + start.width / 2 - 9,
      start.y + start.height / 2,
      { steps: 3 },
    );
    await page.locator(".task-board__preview").waitFor();
    await page.mouse.move(
      target.x + target.width / 2,
      destination ? target.y + Math.min(42, target.height / 2) : target.y - 12,
      { steps: 12 },
    );
    if (destination && highlight) {
      await column(page, destination)
        .and(page.locator("[data-drop-target=true]"))
        .waitFor();
    } else {
      await page
        .locator("[data-drop-target=true]")
        .waitFor({ state: "hidden" });
    }
  } finally {
    await page.mouse.up();
  }
}

async function launchBrowser() {
  const { chromium } = await import(
    process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
      ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
      : "playwright"
  );
  return chromium.launch();
}

async function setup(browser, { mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: mobile ? 320 : 1440, height: 900 },
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.addInitScript(
    (mobile) =>
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({
          version: 1,
          language: mobile ? "bg" : "en",
          theme: mobile ? "dark" : "light",
        }),
      ),
    mobile,
  );
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  return { context, page };
}

async function organizer(browser, origin) {
  const { context, page } = await setup(browser);
  const writes = [];
  let mode = "pass";
  let failReads = false;
  let release;
  const pending = new Promise((done) => {
    release = done;
  });
  try {
    await page.route("**/api/events/**/tasks**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (
        request.method() === "GET" &&
        failReads &&
        path === "/api" + workshopPath
      )
        return route.fulfill({ status: 503, json: {} });
      if (request.method() !== "PATCH" || !path.endsWith("/status"))
        return route.continue();
      writes.push(request.postDataJSON());
      if (mode === "pending") await pending;
      if (mode === "unavailable")
        return route.fulfill({ status: 503, json: {} });
      if (mode === "conflict") {
        failReads = true;
        return route.fulfill({
          status: 409,
          json: { code: "TASK_VERSION_CONFLICT" },
        });
      }
      return route.continue();
    });
    await page.goto(origin + workshopPath + "?view=board");
    await card(page, "blocked", id(102)).waitFor();
    await dragCard(page, id(102), "blocked", { highlight: false });
    await dragCard(page, id(102), null);
    await card(page, "blocked", id(102)).click();
    await page.getByRole("dialog", { name: "Print signs" }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(writes.length, 0);
    console.log(
      "PASS no write for same column, outside drop or Task Drawer click",
    );

    mode = "pending";
    const committed = respondToStatus(page, id(102));
    await dragCard(page, id(102), "in-progress");
    await page
      .getByText("Saving and refreshing task…", { exact: true })
      .waitFor();
    assert.equal(
      await handle(page, id(100)).getAttribute("aria-disabled"),
      "true",
    );
    await card(page, "blocked", id(102)).waitFor();
    assert.equal(await card(page, "in-progress", id(102)).count(), 0);
    release();
    assert.equal((await committed).status(), 200);
    await card(page, "in-progress", id(102)).waitFor();
    await handle(page, id(100))
      .and(page.locator('[aria-disabled="false"]'))
      .waitFor();
    assert.deepEqual(writes, [{ status: "in-progress", expectedVersion: 1 }]);
    console.log(
      "PASS pending retains canonical column and disables other moves; HTTP 200 moves the card",
    );

    mode = "unavailable";
    const unavailable = respondToStatus(page, id(102));
    await dragCard(page, id(102), "completed");
    assert.equal((await unavailable).status(), 503);
    await page
      .getByRole("alert")
      .filter({ hasText: "The change could not be confirmed" })
      .waitFor();
    await card(page, "in-progress", id(102)).waitFor();
    assert.equal(await card(page, "completed", id(102)).count(), 0);
    assert.deepEqual(writes[1], { status: "completed", expectedVersion: 2 });
    console.log(
      "PASS failed request retains the canonical card and displays feedback",
    );

    mode = "conflict";
    const conflict = respondToStatus(page, id(102));
    await dragCard(page, id(102), "completed");
    assert.equal((await conflict).status(), 409);
    const refresh = page.getByRole("button", {
      name: "Refresh task",
      exact: true,
    });
    await refresh.waitFor();
    await card(page, "in-progress", id(102)).waitFor();
    assert.equal(
      await handle(page, id(102)).getAttribute("aria-disabled"),
      "true",
    );
    await handle(page, id(102)).focus();
    await page.keyboard.press("Space");
    assert.equal(await page.locator(".task-board__preview").count(), 0);
    assert.equal(writes.length, 3);
    failReads = false;
    mode = "pass";
    await refresh.click();
    await handle(page, id(102))
      .and(page.locator('[aria-disabled="false"]'))
      .waitFor();
    console.log(
      "PASS version conflict blocks new moves until explicit refresh",
    );

    await pickUpWithKeyboard(page, id(102));
    await page.keyboard.press("ArrowRight");
    await column(page, "blocked")
      .and(page.locator("[data-drop-target=true]"))
      .waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".task-board__preview").waitFor({ state: "hidden" });
    assert.equal(writes.length, 3);

    await page.locator("#status-filter-trigger").click();
    await page
      .getByRole("option", { name: "In progress", exact: true })
      .click();
    await pickUpWithKeyboard(page, id(102));
    await page.keyboard.press("ArrowRight");
    await column(page, "blocked")
      .and(page.locator("[data-drop-target=true]"))
      .waitFor();
    const keyboardMove = respondToStatus(page, id(102));
    await page.keyboard.press("Space");
    assert.equal((await keyboardMove).status(), 200);
    await handle(page, id(102)).waitFor({ state: "detached" });
    await page.waitForFunction(() =>
      document.activeElement?.classList.contains("task-board"),
    );
    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.getByRole("table").waitFor();
    assert.equal(
      await page.locator(".task-row__link").getByText("Print signs").count(),
      0,
    );
    console.log(
      "PASS keyboard cancel and move, active filter parity and focus restoration",
    );

    await page.goto(`${origin}/events/${archivedEvent.id}/tasks?view=board`);
    await card(page, "not-started", id(200)).waitFor();
    assert.equal(await page.locator(".task-board__handle").count(), 0);
    console.log("PASS archived event exposes no drag controls");
  } finally {
    release();
    await context.close();
  }
}

async function mobileMember(browser, origin) {
  const { context, page } = await setup(browser, { mobile: true });
  try {
    await page.goto(origin + workshopPath + "?view=board");
    await handle(page, id(100)).scrollIntoViewIfNeeded();
    assert.equal(await page.locator(".task-board__handle").count(), 1);
    assert.equal(await handle(page, id(101)).count(), 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      320,
    );

    const touch = await context.newCDPSession(page);
    const point = (type, x, y) =>
      touch.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      });
    const grip = await handle(page, id(100)).boundingBox();
    const bounds = await board(page).boundingBox();
    const x = Math.round(grip.x + grip.width / 2);
    const y = Math.round(grip.y + grip.height / 2);
    await point("touchStart", x, y);
    await point("touchMove", x - 14, y);
    await page.locator(".task-board__preview").waitFor();
    await point("touchMove", Math.round(bounds.x + bounds.width - 9), y);
    await page.waitForFunction(
      () => document.querySelector(".task-board").scrollLeft > 235,
    );
    const dest = await column(page, "blocked").boundingBox();
    await point(
      "touchMove",
      Math.round(Math.min(bounds.x + bounds.width - 36, dest.x + 45)),
      y,
    );
    await column(page, "blocked")
      .and(page.locator("[data-drop-target=true]"))
      .waitFor();
    const committed = respondToStatus(page, id(100));
    await point("touchEnd");
    assert.equal((await committed).status(), 200);
    await card(page, "blocked", id(100)).waitFor();
    assert.equal(await card(page, "not-started", id(100)).count(), 0);
    console.log(
      "PASS 320px BG/dark touch drag across scrolled columns, assigned Member only",
    );
  } finally {
    await context.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const browser = await launchBrowser();
  try {
    for (const [accessRole, verify] of [
      ["ORGANIZER", organizer],
      ["MEMBER", mobileMember],
    ]) {
      const host = await kanbanFixtureHost({ accessRole, port: 5192 });
      try {
        await verify(browser, host.origin);
      } finally {
        await host.close();
      }
    }
  } finally {
    await browser.close();
  }
}
