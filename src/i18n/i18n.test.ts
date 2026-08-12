import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeDate,
  formatShortDate,
} from "./formatters.ts";
import {
  BG_MESSAGES,
  EN_MESSAGES,
  translate,
  type MessageKey,
} from "./messages.ts";
import { createI18n, selectPluralMessage } from "./createI18n.ts";

test("English and Bulgarian catalogs expose exactly the same typed keys", () => {
  const englishKeys = Object.keys(EN_MESSAGES).sort();
  const bulgarianKeys = Object.keys(BG_MESSAGES).sort();
  assert.deepEqual(bulgarianKeys, englishKeys);
  assert.ok(englishKeys.length > 200);
});

test("translation switches languages and interpolates named values", () => {
  assert.equal(translate("en", "nav.dashboard"), "Dashboard");
  assert.equal(translate("bg", "nav.dashboard"), "Табло");
  assert.equal(
    translate("bg", "tasks.resultCount", { visible: 3, total: 16 }),
    "3 от 16 задачи",
  );
  assert.equal(
    translate("en", "common.openTaskNamed", { title: "A long task" }),
    "Open task details for A long task",
  );
});

test("plural selection and count formatting are locale-aware", () => {
  const keys = {
    one: "changes.active.one",
    other: "changes.active.other",
  } satisfies { one: MessageKey; other: MessageKey };
  assert.equal(selectPluralMessage("en", 1, keys), "changes.active.one");
  assert.equal(selectPluralMessage("bg", 2, keys), "changes.active.other");
  assert.equal(createI18n("en").plural(1, keys), "1 active change");
  assert.equal(createI18n("bg").count(2, keys), "2 активни промени");
});

test("date, range, number, percent, and relative-date formatters use the selected locale", () => {
  const date = "2026-09-18";
  assert.notEqual(formatDate("en", date), formatDate("bg", date));
  assert.notEqual(formatShortDate("en", date), formatShortDate("bg", date));
  assert.notEqual(
    formatDateTime("en", "2026-09-18T16:30:00.000Z"),
    formatDateTime("bg", "2026-09-18T16:30:00.000Z"),
  );
  assert.notEqual(formatNumber("en", 12_345.5), formatNumber("bg", 12_345.5));
  assert.match(formatPercent("en", 25), /25/);
  assert.match(formatPercent("bg", 25), /25/);
  assert.notEqual(
    formatDateRange("en", "2026-09-18", "2026-09-20"),
    formatDateRange("bg", "2026-09-18", "2026-09-20"),
  );
  const now = new Date("2026-09-17T09:00:00.000Z");
  assert.equal(formatRelativeDate("en", date, now), "tomorrow");
  assert.equal(formatRelativeDate("bg", date, now), "утре");
});

test("invalid dates have a localized safe fallback", () => {
  assert.equal(formatDate("en", "not-a-date"), "Invalid date");
  assert.equal(formatDate("bg", "not-a-date"), "Невалидна дата");
  assert.equal(
    formatDateRange("bg", "not-a-date", "2026-09-20"),
    "Невалидна дата",
  );
});

test("task acceptance wording stays distinct from change acknowledgement", () => {
  assert.equal(translate("en", "taskDetails.acknowledged"), "Accepted");
  assert.equal(translate("en", "taskDetails.acknowledge"), "Accept task");
  assert.equal(translate("bg", "taskDetails.acknowledged"), "Приета");
  assert.equal(
    translate("bg", "taskDetails.acknowledge"),
    "Приемане на задачата",
  );
  assert.equal(translate("en", "changes.acknowledged"), "Acknowledged");
  assert.equal(translate("bg", "changes.acknowledged"), "Потвърдена");
});
