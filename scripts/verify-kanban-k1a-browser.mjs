// Chromium exercises the normal UI and HTTP client against a loopback fixture.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { id } from "./calendar-fixtures.mjs";
import {
  activeEvent,
  archivedEvent,
  kanbanFixtureHost,
  workshopPath,
} from "./preview-kanban-k1a.mjs";

const { chromium } = await import(
  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const evidence = "tmp/kanban-k1a";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const faults = [];
const selector = ".task-board__card";
const headings = ".task-board__column h2";
const boardPath = workshopPath + "?view=board";
const archivePath = `/events/${archivedEvent.id}/tasks?view=board`;
const card = (page, taskId) =>
  page.locator(`[data-task-focus-key="task-board:${taskId}"]`);
const column = (page, status) =>
  page.locator(`.task-board__column:has(#task-board-${status})`);
const api = (eventId, taskId) =>
  `/api/events/${eventId}/tasks/${taskId}/status`;
const focusKey = (page) =>
  page.evaluate(() => document.activeElement?.dataset.taskFocusKey);

async function setup({ language = "en", theme = "light", width = 1366 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
    timezoneId: "Europe/Sofia",
  });
  await context.addInitScript(
    ({ language, theme }) => {
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language, theme }),
      );
    },
    { language, theme },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => faults.push(error.message));
  return { context, page };
}

async function choose(page, trigger, label) {
  await page.locator(trigger).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

async function patchStatus(page, eventId, taskId, expectedVersion) {
  return page.evaluate(
    async ({ url, expectedVersion }) => {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed", expectedVersion }),
      });
      return { status: response.status, body: await response.json() };
    },
    { url: api(eventId, taskId), expectedVersion },
  );
}

async function moveViaDrawer(page, taskId, status, label) {
  const expectedPath = api(activeEvent.id, taskId);
  const [command, refresh] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === expectedPath,
    ),
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/events/${activeEvent.id}/tasks` &&
        response.request().method() === "GET",
    ),
    choose(page, `#drawer-status-${taskId}-trigger`, label),
  ]);
  assert.equal(command.request().method(), "PATCH");
  assert.deepEqual(command.request().postDataJSON(), {
    status,
    expectedVersion: 1,
  });
  assert.equal(command.status(), 200);
  assert.equal((await command.json()).task.version, 2);
  assert.equal(
    (await refresh.json()).tasks.find(({ id }) => id === taskId).status,
    status,
  );
  await column(page, status).locator(card(page, taskId)).waitFor();
}

async function organizerScenarios(origin) {
  const { context, page } = await setup();
  try {
    await page.goto(origin + workshopPath);
    await page.getByRole("table").waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "List", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    const search = page.getByRole("searchbox", { name: "Search tasks" });
    await choose(page, "#owner-filter-trigger", "Synthetic Member");
    await choose(page, "#category-filter-trigger", "Logistics");
    await choose(page, "#status-filter-trigger", "Not started");
    await search.fill("venue");
    const list = await page.locator(".task-row__link").allTextContents();
    assert.deepEqual(list, ["Prepare venue"]);
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await page.getByRole("region", { name: "Task board" }).waitFor();
    assert.equal(
      new URL(page.url()).pathname + new URL(page.url()).search,
      boardPath,
    );
    assert.deepEqual(
      await page.locator(".task-board__link").allTextContents(),
      list,
    );
    assert.equal(await page.locator(".task-board__empty").count(), 3);
    await search.fill("no matching tasks");
    assert.equal(await page.locator(".task-board__empty").count(), 4);
    await search.fill("venue");
    await page.goBack();
    await page.getByRole("table").waitFor();
    assert.equal(await search.inputValue(), "venue");
    assert.deepEqual(
      await page.locator(".task-row__link").allTextContents(),
      list,
    );
    await page.goForward();
    await card(page, id(100)).waitFor();
    await page.getByRole("button", { name: "List", exact: true }).click();
    assert.deepEqual(
      await page.locator(".task-row__link").allTextContents(),
      list,
    );
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    assert.deepEqual(
      (await page.locator(headings).allTextContents()).map((text) =>
        text.trim(),
      ),
      ["Not started1", "In progress1", "Blocked1", "Completed1"],
    );
    assert.match(
      await column(page, "not-started").locator(selector).innerText(),
      /Important[\s\S]*09:30[\s\S]*Overdue[\s\S]*Synthetic Member[\s\S]*Not accepted/,
    );
    assert.match(
      await column(page, "in-progress").locator(selector).innerText(),
      /Synthetic Organizer[\s\S]*Accepted/,
    );
    assert.match(
      await column(page, "blocked").locator(selector).innerText(),
      /Unassigned/,
    );
    assert.doesNotMatch(
      await column(page, "completed").locator(selector).innerText(),
      /Overdue/,
    );
    await page.screenshot({ path: `${evidence}/desktop-en.png` });
    console.log(
      "PASS organizer List/Board, Back/Forward, filters, card metadata and empty columns",
    );

    const link = card(page, id(100));
    await link.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Prepare venue" });
    await dialog.waitFor();
    assert.equal(new URL(page.url()).searchParams.get("view"), "board");
    await moveViaDrawer(page, id(100), "completed", "Completed");
    assert.equal(
      await column(page, "not-started").locator(selector).count(),
      0,
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      (key) => document.activeElement?.dataset.taskFocusKey === key,
      `task-board:${id(100)}`,
    );
    await page.goForward();
    await dialog.waitFor();
    await page.reload();
    await dialog.waitFor();
    await page.getByRole("button", { name: "Close task details" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).search, "?view=board");
    await page.goto(origin + workshopPath + `?task=${id(100)}&view=board`);
    await dialog.waitFor();
    await page.getByRole("button", { name: "Close task details" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).search, "?view=board");
    console.log(
      "PASS organizer drawer, canonical PATCH/GET move, focus restoration and direct link",
    );

    await page.goto(origin + archivePath);
    await card(page, id(200)).waitFor();
    assert.equal(await page.locator(selector).count(), 1);
    await card(page, id(200)).click();
    await page.getByRole("dialog", { name: "Archive only" }).waitFor();
    assert.equal(
      await page
        .locator(".task-status-select, .task-assignment-select")
        .count(),
      0,
    );
    assert.equal(
      (await patchStatus(page, archivedEvent.id, id(200), 1)).status,
      403,
    );
    assert.equal(
      (await patchStatus(page, activeEvent.id, id(200), 1)).status,
      404,
    );
    await page.goto(
      origin +
        workshopPath.replace("/tasks", "/calendar") +
        "?view=week&date=2026-12-14",
    );
    await page.getByRole("button", { name: "Week", exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Week", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    console.log(
      "PASS archived read-only, Event isolation and Calendar query compatibility",
    );
  } finally {
    await context.close();
  }
}

async function memberScenarios(origin) {
  const { context, page } = await setup({
    language: "bg",
    theme: "dark",
    width: 320,
  });
  try {
    await page.goto(origin + workshopPath);
    const boardButton = page.getByRole("button", {
      name: "Табло",
      exact: true,
    });
    await boardButton.focus();
    await page.keyboard.press("Space");
    const board = page.getByRole("region", { name: "Табло със задачи" });
    await board.waitFor();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    assert.deepEqual(await page.locator(headings).allTextContents(), [
      "Незапочната1",
      "В процес1",
      "Блокирана1",
      "Завършена1",
    ]);
    assert.ok(
      await board.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      320,
    );
    await board.evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );
    await page.screenshot({ path: `${evidence}/mobile-bg-dark.png` });
    await board.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => document.querySelector(".task-board")?.scrollLeft > 0,
    );
    await card(page, id(101)).focus();
    await page.keyboard.press("Enter");
    const foreignDialog = page.getByRole("dialog", { name: "Book transport" });
    await foreignDialog.waitFor();
    assert.equal(
      await foreignDialog
        .locator(".task-status-select, .task-assignment-select")
        .count(),
      0,
    );
    assert.equal(
      (await patchStatus(page, activeEvent.id, id(101), 1)).status,
      403,
    );
    await page.keyboard.press("Escape");
    await foreignDialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      (key) => document.activeElement?.dataset.taskFocusKey === key,
      `task-board:${id(101)}`,
    );
    assert.equal(await focusKey(page), `task-board:${id(101)}`);
    assert.equal(
      (await patchStatus(page, archivedEvent.id, id(200), 1)).status,
      404,
    );

    await card(page, id(100)).focus();
    await page.keyboard.press("Enter");
    const ownDialog = page.getByRole("dialog", { name: "Prepare venue" });
    await ownDialog.waitFor();
    await moveViaDrawer(page, id(100), "completed", "Завършена");
    await page.keyboard.press("Escape");
    await ownDialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      (key) => document.activeElement?.dataset.taskFocusKey === key,
      `task-board:${id(100)}`,
    );
    const position = await card(page, id(100)).boundingBox();
    const bounds = await board.boundingBox();
    assert.ok(
      position.x >= bounds.x - 1 &&
        position.x + position.width <= bounds.x + bounds.width + 1,
      JSON.stringify({ position, bounds }),
    );
    console.log(
      "PASS Member 403 on another assignee, own move, BG dark 320px and keyboard focus",
    );
  } finally {
    await context.close();
  }
}

try {
  for (const [accessRole, scenarios] of [
    ["ORGANIZER", organizerScenarios],
    ["MEMBER", memberScenarios],
  ]) {
    const host = await kanbanFixtureHost({ accessRole, port: 5188 });
    try {
      await scenarios(host.origin);
    } finally {
      await host.close();
    }
  }
  assert.deepEqual(faults, []);
} finally {
  await browser.close();
}
