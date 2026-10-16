import assert from "node:assert/strict";
import test from "node:test";
import { AIKIDO_SEMINAR_STARTER as client } from "../domain/eventTemplates.ts";
import { SEMINAR_BLUEPRINT as server } from "../../server/src/templates/catalog.ts";
import { resolveBlueprintDate } from "../../server/src/templates/model.ts";
import { resolveTemplateDate } from "../domain/templateDates.ts";
import { createI18n } from "../i18n/createI18n.ts";

test("authoritative server blueprint is exactly the accepted T1 v1 content in BG and EN", () => {
  assert.equal(server.id, client.id);
  assert.equal(server.version, client.version);
  assert.deepEqual(
    server.items.map((i) => i.id),
    client.items.map((i) => i.id),
  );
  client.items.forEach((item, index) => {
    const authoritative = server.items[index]!;
    for (const key of [
      "priority",
      "dayOffset",
      "deadlineTime",
      "reminderOffsets",
    ] as const)
      assert.deepEqual(authoritative[key], item[key]);
    for (const language of ["bg", "en"] as const) {
      const i18n = createI18n(language);
      assert.deepEqual(authoritative.text[language], {
        title: i18n.t(item.titleKey),
        category: i18n.t(item.categoryKey),
        context: i18n.t(item.contextKey),
      });
    }
  });
});
test("frontend/server date engines agree across calendar boundaries, DST dates and rejected extremes", () => {
  for (const date of [
    "0001-01-01",
    "0099-12-31",
    "1900-03-01",
    "2000-02-28",
    "2024-02-29",
    "2026-03-29",
    "2026-10-25",
    "2026-12-31",
    "9999-12-31",
  ])
    for (const offset of [-366, -7, -1, 0, 1, 7, 366]) {
      let expected: string;
      try {
        expected = resolveTemplateDate(date, offset);
      } catch {
        assert.throws(() => resolveBlueprintDate(date, offset));
        continue;
      }
      assert.equal(resolveBlueprintDate(date, offset), expected);
    }
});
