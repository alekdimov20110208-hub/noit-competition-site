import assert from "node:assert/strict";
import { createDemoWorkspace } from "../src/data/demo.ts";

// Boundary cases run in isolated contexts supplied by the main browser harness.
export async function verifyTeamEdges({
  make,
  go,
  select,
  settle,
  geometry,
  focusView,
  report,
}) {
  for (const width of [967, 968]) {
    const { page, context } = await make(width, "bg", "dark");
    await go(page);
    const available = await page
      .locator(".team-workspace")
      .evaluate((e) => e.getBoundingClientRect().width);
    const compact = available < 660;
    assert.equal(
      await page.locator(".team-workspace").getAttribute("data-compact"),
      String(compact),
    );
    await select(page, "member-anton-ravin", compact);
    await geometry(page, width);
    report.extra.push({
      name: `actual-transition-${width}`,
      available,
      compact,
    });
    await context.close();
  }
  // Independent-review regression: engaging the default detail marks it viewed.
  const engaged = await make(1440, "en", "light");
  await go(engaged.page);
  await engaged.page.locator('[data-team-disclosure="completed"]').click();
  const initialHistory = await engaged.page.evaluate(() => history.length);
  await engaged.page.setViewportSize({ width: 720, height: 900 });
  await engaged.page.locator(".team-sheet").waitFor();
  await settle(engaged.page);
  assert.equal(await engaged.page.locator(".team-history[open]").count(), 1);
  assert.equal(
    await engaged.page.locator("#team-member-heading").innerText(),
    "Lina Moreva",
  );
  assert.equal(
    await engaged.page.evaluate(() => history.length),
    initialHistory,
  );
  await geometry(engaged.page, 720);
  await engaged.page.reload();
  await engaged.page.locator(".team-sheet").waitFor();
  assert.equal(await engaged.page.locator(".team-history[open]").count(), 1);
  await engaged.page.locator(".team-sheet__close").click();
  await engaged.page.locator(".team-sheet").waitFor({ state: "hidden" });
  assert.equal(
    await engaged.page.evaluate(() => history.length),
    initialHistory,
  );
  report.extra.push({
    name: "default-detail engagement + 200% reflow-equivalent viewport + sheet reload",
    result:
      "1440→720 CSS px retains selection/disclosure, no history push; close without marker replaces safely",
  });
  await engaged.context.close();

  // Accepting a task moves it to a different visible section; return follows its ID.
  const acceptedState = createDemoWorkspace();
  acceptedState.tasks = [
    {
      ...acceptedState.tasks[0],
      id: "synthetic-unaccepted",
      ownerId: acceptedState.teamMembers[0].id,
      title: "Synthetic acceptance transition",
      status: "not-started",
      acknowledged: false,
      deadline: "2026-09-20",
    },
  ];
  acceptedState.changes = [];
  const acceptance = await make(390, "en", "light", acceptedState);
  await go(acceptance.page);
  await select(acceptance.page, acceptedState.teamMembers[0].id, true);
  await acceptance.page.locator(".team-work-row__link").click();
  await acceptance.page.locator(".task-drawer__acceptance > button").click();
  await acceptance.page.keyboard.press("Escape");
  await acceptance.page.waitForFunction(() =>
    document.activeElement?.dataset.taskFocusKey?.includes(
      ":upcoming:synthetic-unaccepted",
    ),
  );
  assert.equal((await focusView(acceptance.page)).visible, true);
  assert.equal(
    await acceptance.page.locator("#team-attention-list").count(),
    0,
  );
  report.extra.push({
    name: "acceptance edit moves origin to upcoming",
    result: "same task in visible new section focused",
  });
  await acceptance.context.close();

  // Reload with changed local data simulates stale history without adding edit UI.
  for (const change of ["task", "member", "event"]) {
    const { page, context } = await make(390, "en", "light");
    await go(page);
    await select(page, "member-anton-ravin", true);
    await page.locator(".team-work-row__link").first().click();
    await page.locator(".task-drawer").waitFor();
    await page.evaluate((change) => {
      const state = JSON.parse(localStorage.getItem("budograph.workspace.v1"));
      if (change === "task")
        state.tasks = state.tasks.filter(
          (t) => t.id !== "task-guest-itinerary",
        );
      if (change === "member")
        state.teamMembers = state.teamMembers.filter(
          (m) => m.id !== "member-anton-ravin",
        );
      if (change === "event") {
        state.events.push({
          ...state.events[0],
          id: "new-event",
          name: "Synthetic other seminar",
        });
        state.currentEventId = "new-event";
      }
      localStorage.setItem("budograph.workspace.v1", JSON.stringify(state));
    }, change);
    await page.reload();
    await page.locator("main h1").waitFor();
    await page.goBack();
    await page.locator(".team-page").waitFor();
    await settle(page);
    if (change === "task") {
      assert.equal(
        await page.locator("#team-member-heading").innerText(),
        "Anton Ravin",
      );
      assert.equal((await focusView(page)).id, "team-member-heading");
    } else {
      assert.equal(await page.locator(".team-sheet").count(), 0);
      assert.equal(
        await page
          .locator(
            '[data-team-member="member-anton-ravin"][aria-pressed="true"]',
          )
          .count(),
        0,
      );
      assert.equal(
        await page.evaluate(() => document.getElementById("root").inert),
        false,
      );
    }
    report.extra.push({
      name: `stale-${change}-context`,
      result: "visible fallback, no stale member sheet or foreign event data",
    });
    await context.close();
  }
  const emptyState = createDemoWorkspace();
  emptyState.teamMembers = [];
  emptyState.tasks = [];
  emptyState.changes = [];
  const empty = await make(320, "bg", "dark", emptyState);
  await go(empty.page);
  assert.equal(await empty.page.locator("[data-team-member]").count(), 0);
  assert.match(
    await empty.page.locator(".team-page").innerText(),
    /Няма членове на екипа/,
  );
  await geometry(empty.page, 320);
  await empty.context.close();
  report.extra.push({
    name: "empty-roster",
    result: "honest empty state and no selected member",
  });
  const malformed = await make(390, "en", "light", null, "no-preference", {
    budographTeam: {
      eventId: createDemoWorkspace().currentEventId,
      memberId: 123,
      detailOpen: "yes",
      expanded: ["unknown"],
    },
  });
  await go(malformed.page);
  assert.equal(await malformed.page.locator(".team-sheet").count(), 0);
  assert.equal(
    await malformed.page
      .locator('[aria-pressed="true"][data-team-member]')
      .getAttribute("data-team-member"),
    "member-lina-moreva",
  );
  await malformed.context.close();
  report.extra.push({
    name: "malformed-history",
    result: "fresh deterministic roster",
  });
  const rotated = await make(1440, "en", "light");
  await go(rotated.page);
  await select(rotated.page, "member-anton-ravin", false);
  const origin = rotated.page.locator(".team-work-row__link").first();
  const key = await origin.getAttribute("data-task-focus-key");
  await origin.click();
  await rotated.page.locator(".task-drawer").waitFor();
  await rotated.page.setViewportSize({ width: 390, height: 900 });
  await rotated.page.goBack();
  await rotated.page.waitForFunction(
    (key) => document.activeElement?.dataset.taskFocusKey === key,
    key,
  );
  assert.equal(await rotated.page.locator(".team-sheet").count(), 1);
  await settle(rotated.page);
  assert.equal((await focusView(rotated.page)).visible, true);
  await rotated.context.close();
  report.extra.push({
    name: "resize-while-task-open",
    result: "task Back restores compact sheet and exact origin",
  });

  // Native accessibility tree spot checks and measured contrast of rendered Team text.
  for (const theme of ["light", "dark"]) {
    const { page, context } = await make(1440, "en", theme);
    await go(page);
    const cdp = await context.newCDPSession(page);
    let { nodes } = await cdp.send("Accessibility.getFullAXTree");
    assert.ok(
      nodes.some(
        (n) =>
          n.role?.value === "button" &&
          n.name?.value.includes("Lina Moreva") &&
          n.properties?.some(
            (p) => p.name === "pressed" && p.value.value === "true",
          ),
      ),
    );
    const contrast = await page.evaluate(() => {
      function rgb(value) {
        return value.match(/[\d.]+/g)?.map(Number) ?? [];
      }
      function luminance(color) {
        return color
          .slice(0, 3)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      }
      function ratio(a, b) {
        const x = luminance(a),
          y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      }
      return [
        ...document.querySelectorAll(
          ".team-page p, .team-page span, .team-page a, .team-page h1, .team-page h2, .team-page h3, .team-page dt, .team-page dd, .team-page small, .team-page summary",
        ),
      ]
        .filter(
          (e) =>
            e.getClientRects().length &&
            !e.closest("details:not([open]) :not(summary)") &&
            [...e.childNodes].some(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
            ),
        )
        .map((e) => {
          let parent = e,
            background = [];
          while (parent) {
            background = rgb(getComputedStyle(parent).backgroundColor);
            if (background.length === 3 || background[3] === 1) break;
            parent = parent.parentElement;
          }
          const style = getComputedStyle(e),
            color = rgb(style.color);
          return {
            text: e.textContent.slice(0, 55),
            ratio: ratio(color, background),
            minimum:
              parseFloat(style.fontSize) >= 24 ||
              (parseFloat(style.fontSize) >= 18.66 &&
                Number(style.fontWeight) >= 700)
                ? 3
                : 4.5,
          };
        });
    });
    assert.ok(contrast.length > 30);
    for (const item of contrast)
      assert.ok(item.ratio >= item.minimum, JSON.stringify(item));
    await page.locator('[data-team-disclosure="completed"]').focus();
    await page.keyboard.press("Enter");
    await page.locator(".team-history[open]").waitFor();
    ({ nodes } = await cdp.send("Accessibility.getFullAXTree"));
    assert.ok(
      nodes.some(
        (n) =>
          n.role?.value === "DisclosureTriangle" &&
          n.name?.value.includes("Completed work") &&
          n.properties?.some(
            (p) => p.name === "expanded" && p.value.value === true,
          ),
      ),
    );
    await page.setViewportSize({ width: 390, height: 900 });
    await page.locator(".team-sheet").waitFor();
    ({ nodes } = await cdp.send("Accessibility.getFullAXTree"));
    assert.ok(
      nodes.some(
        (n) =>
          n.role?.value === "dialog" &&
          n.name?.value === "Lina Moreva" &&
          n.properties?.some(
            (p) => p.name === "modal" && p.value.value === true,
          ),
      ),
    );
    assert.equal(nodes.filter((n) => n.role?.value === "navigation").length, 0);
    await page.locator("#team-member-heading").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator(".team-sheet__close")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    report.extra.push({
      name: `accessibility-contrast-${theme}`,
      measuredTextPairs: contrast.length,
      lowestRatio: Math.min(...contrast.map((v) => v.ratio)),
      result:
        "AA text contrast thresholds met; pressed/expanded/modal name exposed; inert navigation excluded; heading Tab to Close",
    });
    await cdp.detach();
    await context.close();
  }
}
