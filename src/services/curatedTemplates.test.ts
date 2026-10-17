import assert from "node:assert/strict";
import test from "node:test";
import { curatedCatalogResponse } from "../../server/src/templates/curated.ts";
import { createTemplateApplicationService } from "../../server/src/templates/service.ts";
import {
  templateFixture,
  user,
  eventId,
  operationId,
} from "../../server/tests/helpers/template-fixture.ts";
import { filterCuratedTemplates } from "../domain/curatedTemplates.ts";
import { resolveTemplateDeadline } from "../domain/templateDates.ts";
import { resolveBlueprintDate } from "../../server/src/templates/model.ts";
import { fetchCuratedCatalog, readCuratedCatalog } from "./curatedTemplates.ts";
import {
  templateSelection,
  readTemplateReview,
  validTemplateAttempt,
  TemplateApplicationService,
  rememberTemplateAttempt,
  readTemplateAttempt,
  forgetTemplateAttempt,
} from "./templateApplications.ts";
import { TemplateApplicationController } from "./templateApplicationState.ts";

test("authoritative catalog API validates every field, BG/EN text, IDs, counts, version and bounded items", () => {
  const response = curatedCatalogResponse(),
    templates = readCuratedCatalog(response);
  assert.deepEqual(templates, response.templates);
  for (const mutate of [
    (r: typeof response) => {
      r.catalogVersion = 2;
    },
    (r: typeof response) => {
      r.templates[0]!.itemCount = 1;
    },
    (r: typeof response) => {
      r.templates[0]!.version = 2;
    },
    (r: typeof response) => {
      r.templates[0]!.name.bg = r.templates[0]!.name.en;
    },
    (r: typeof response) => {
      r.templates[0]!.items[0]!.text.bg.context =
        r.templates[0]!.items[0]!.text.en.context;
    },
    (r: typeof response) => {
      r.templates[0]!.items[0]!.dayOffset = 0.5;
    },
    (r: typeof response) => {
      r.templates[0]!.items[0]!.deadlineTime = "24:00";
    },
    (r: typeof response) => {
      r.templates[1]!.id = r.templates[0]!.id;
    },
    (r: typeof response) => {
      r.templates[0]!.items[1]!.id = r.templates[0]!.items[0]!.id;
    },
    (r: typeof response) => {
      r.templates[0]!.id = "11111111-1111-4111-8111-111111111111";
    },
  ]) {
    const broken = structuredClone(response);
    mutate(broken);
    assert.throws(() => readCuratedCatalog(broken));
  }
  assert.throws(() => readCuratedCatalog({ ...response, owner: "private" }));
  assert.deepEqual(
    readCuratedCatalog({ catalogVersion: 1, templates: [] }),
    [],
  );
});
test("catalog search uses localized names, audience and actual Task context and intersects real filters", () => {
  const templates = readCuratedCatalog(curatedCatalogResponse());
  assert.equal(filterCuratedTemplates(templates, "", "", "", "bg").length, 12);
  assert.equal(
    filterCuratedTemplates(templates, "", "aikido", "beginner", "en").length,
    1,
  );
  assert.equal(
    filterCuratedTemplates(templates, "  KYU examination  ", "", "", "en")[0]
      ?.id,
    "curated-aikido-kyu-examination",
  );
  assert.equal(
    filterCuratedTemplates(
      templates,
      "протоколите",
      "examinations",
      "standard",
      "bg",
    ).length,
    1,
  );
  assert.equal(
    filterCuratedTemplates(
      templates,
      "scoreboards",
      "tournaments",
      "advanced",
      "en",
    ).length,
    1,
  );
  assert.equal(
    filterCuratedTemplates(templates, "непознат-резултат", "", "", "bg").length,
    0,
  );
  assert.equal(
    filterCuratedTemplates(templates, "", "camps", "beginner", "en").length,
    0,
  );
});
test("catalog transport uses auth/no-store/abort and reports invalid, unavailable and unauthenticated responses", async () => {
  const signal = new AbortController().signal;
  const result = await fetchCuratedCatalog(signal, async (url, init) => {
    assert.equal(url, "/api/templates/curated");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.signal, signal);
    return Response.json(curatedCatalogResponse());
  });
  assert.equal(result.length, 12);
  for (const [status, code] of [
    [401, "unauthenticated"],
    [503, "unavailable"],
  ] as const)
    await assert.rejects(
      fetchCuratedCatalog(signal, async () => new Response("", { status })),
      { code },
    );
  await assert.rejects(
    fetchCuratedCatalog(signal, async () => Response.json({})),
    { code: "invalid" },
  );
});
test("all curated plans validate actual server Review in both languages and recover bounded ID-only attempts", async () => {
  const f = templateFixture(),
    service = createTemplateApplicationService(f.pool);
  for (const template of readCuratedCatalog(curatedCatalogResponse()))
    for (const language of ["bg", "en"] as const) {
      const selection = templateSelection(
        template.items.map((i) => i.id).reverse(),
        language,
        template,
      );
      const value = await service.preview(user, eventId, selection),
        review = readTemplateReview(value, eventId, selection, template);
      assert.deepEqual(review.items, value.items);
      const attempt = {
        ...selection,
        operationId,
        expectedEventVersion: review.event.version,
        reviewRevision: review.reviewRevision,
        confirmed: true as const,
      };
      assert.ok(validTemplateAttempt(attempt));
      assert.ok(!validTemplateAttempt({ ...attempt, templateVersion: 2 }));
      assert.ok(
        !validTemplateAttempt({ ...attempt, templateId: "curated-../private" }),
      );
      assert.ok(
        !validTemplateAttempt({
          ...attempt,
          itemIds: ["11111111-1111-4111-8111-111111111111"],
        }),
      );
      assert.ok(!validTemplateAttempt({ ...attempt, title: "forged" }));
      rememberTemplateAttempt(user.id, eventId, attempt);
      assert.deepEqual(readTemplateAttempt(user.id, eventId), attempt);
      assert.equal(
        readTemplateAttempt(user.id, "22222222-2222-4222-8222-222222222222"),
        null,
      );
      forgetTemplateAttempt(user.id, eventId);
      const forged = structuredClone(value);
      forged.items[0]!.context = "forged";
      assert.throws(() =>
        readTemplateReview(forged, eventId, selection, template),
      );
      assert.throws(() =>
        readTemplateReview(
          value,
          eventId,
          selection,
          readCuratedCatalog(curatedCatalogResponse()).find(
            (t) => t.id !== template.id,
          ),
        ),
      );
    }
});
test("all curated calendar offsets agree at rollovers, leap day and DST; duration never changes start-relative dates", () => {
  const templates = readCuratedCatalog(curatedCatalogResponse());
  for (const date of [
    "2026-01-01",
    "2024-02-29",
    "2026-03-29",
    "2026-10-25",
    "2026-12-31",
  ])
    for (const template of templates)
      for (const item of template.items) {
        assert.deepEqual(
          resolveTemplateDeadline(date, item.dayOffset, item.deadlineTime),
          {
            deadline: resolveBlueprintDate(date, item.dayOffset),
            deadlineTime: null,
          },
        );
      }
  for (const invalid of ["2026-02-29", "2026-04-31", "0000-01-01"])
    assert.throws(() => resolveTemplateDeadline(invalid, -7, null));
  assert.equal(
    resolveTemplateDeadline("2026-12-31", 3, null).deadline,
    "2027-01-03",
  );
});
test("late curated review is discarded on controller disposal; a changed template cannot borrow the previous Review", async () => {
  const f = templateFixture(),
    server = createTemplateApplicationService(f.pool),
    templates = readCuratedCatalog(curatedCatalogResponse());
  let finish!: () => void;
  const controller = new TemplateApplicationController(
    user.id,
    eventId,
    {
      preview: async (_event, selection) => {
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return readTemplateReview(
          await server.preview(user, eventId, selection),
          eventId,
          selection,
          templates[0],
        );
      },
      apply: new TemplateApplicationService().apply,
    },
    async () => {},
    () => {},
  );
  const pending = controller.review(
    templateSelection(
      templates[0]!.items.map((i) => i.id),
      "en",
      templates[0],
    ),
  );
  controller.dispose();
  finish();
  await pending;
  assert.equal(controller.getSnapshot().review, null);
});
