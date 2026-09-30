import assert from "node:assert/strict";
import test from "node:test";
import {
  closeMemberContext,
  freshTeamContext,
  readTeamContext,
  selectMemberContext,
  withTeamContext,
} from "./teamNavigation.ts";
import {
  createTaskDetailHistoryState,
  createTaskHref,
  parseAppLocation,
} from "./routes.ts";
import { TEAM_BG_MESSAGES, TEAM_EN_MESSAGES } from "./i18n/teamMessages.ts";
import { createI18n } from "./i18n/createI18n.ts";

test("direct Team and unrelated task entries have fresh collapsed transient state", () => {
  for (const state of [null, [], {}, createTaskDetailHistoryState("team:task")])
    assert.deepEqual(
      readTeamContext(state, "event"),
      freshTeamContext("event"),
    );
});

test("Team selection, disclosure, sheet and origin survive serialization without changing other history namespaces", () => {
  const context = {
    ...selectMemberContext(freshTeamContext("event"), "member", true),
    expanded: ["attention", "completed"] as const,
    pageScrollY: 750,
    detailScrollTop: 300,
    origin: {
      taskId: "задача /1",
      focusKey: "team:member:attention:task",
      section: "attention" as const,
    },
  };
  const saved = { ...context, expanded: [...context.expanded] };
  const entry = withTeamContext({ unrelated: 42 }, saved);
  assert.ok("unrelated" in entry);
  assert.equal(entry.unrelated, 42);
  assert.deepEqual(
    readTeamContext(JSON.parse(JSON.stringify(entry)), "event"),
    saved,
  );
  assert.deepEqual(
    readTeamContext(entry, "another-event"),
    freshTeamContext("another-event"),
  );
  const href = createTaskHref(saved.origin.taskId);
  assert.equal(
    parseAppLocation("/tasks", new URL(href, "https://example.test").search)
      .taskId,
    saved.origin.taskId,
  );
});

test("desktop selections replace context; member changes reset disclosure and scroll but same member keeps disclosure", () => {
  const previous = {
    ...freshTeamContext("event"),
    memberId: "first",
    expanded: ["attention" as const],
    detailScrollTop: 400,
  };
  const same = selectMemberContext(previous, "first", false);
  assert.equal(same.sheetEntry, false);
  assert.equal(same.detailOpen, true);
  assert.deepEqual(same.expanded, ["attention"]);
  const next = selectMemberContext(previous, "second", false);
  assert.deepEqual(next.expanded, []);
  assert.equal(next.detailScrollTop, 0);
  assert.equal(previous.detailScrollTop, 400);
});

test("sheet Back closes to roster; Forward restores independent open state; task entry does not leak Team state", () => {
  const sheet = selectMemberContext(freshTeamContext("event"), "member", true);
  const roster = closeMemberContext(sheet);
  assert.equal(roster.detailOpen, false);
  assert.equal(roster.sheetEntry, false);
  assert.equal(roster.returnToRoster, true);
  assert.equal(roster.memberId, "member");
  assert.equal(
    readTeamContext(withTeamContext({}, sheet), "event").detailOpen,
    true,
  );
  assert.deepEqual(
    readTeamContext(createTaskDetailHistoryState("team:task"), "event"),
    freshTeamContext("event"),
  );
});

test("malformed history is bounded to valid sections, finite scroll and safe context", () => {
  for (const value of [
    null,
    4,
    [],
    { eventId: "event", detailOpen: "true", memberId: "x" },
  ])
    assert.deepEqual(
      readTeamContext({ budographTeam: value }, "event"),
      freshTeamContext("event"),
    );
  const result = readTeamContext(
    {
      budographTeam: {
        ...freshTeamContext("event"),
        sheetEntry: true,
        expanded: ["attention", "attention", "untrusted", 1],
        pageScrollY: -4,
        detailScrollTop: Infinity,
        origin: { taskId: "x", focusKey: 3, section: "attention" },
      },
    },
    "event",
  );
  assert.equal(result.sheetEntry, false);
  assert.deepEqual(result.expanded, ["attention"]);
  assert.equal(result.pageScrollY, 0);
  assert.equal(result.detailScrollTop, 0);
  assert.equal(result.origin, undefined);
});

test("Team EN/BG catalogs expose translated messages with matching interpolation tokens", () => {
  assert.deepEqual(
    Object.keys(TEAM_BG_MESSAGES),
    Object.keys(TEAM_EN_MESSAGES),
  );
  for (const key of Object.keys(
    TEAM_EN_MESSAGES,
  ) as (keyof typeof TEAM_EN_MESSAGES)[]) {
    assert.notEqual(TEAM_EN_MESSAGES[key], TEAM_BG_MESSAGES[key]);
    assert.deepEqual(
      TEAM_EN_MESSAGES[key].match(/\{\w+\}/g),
      TEAM_BG_MESSAGES[key].match(/\{\w+\}/g),
    );
    for (const language of ["en", "bg"] as const) {
      const translated = createI18n(language).t(key, {
        name: "Test",
        count: "4",
        date: "7.9",
      });
      assert.notEqual(translated, key);
      assert.doesNotMatch(translated, /\{\w+\}/);
    }
  }
});
