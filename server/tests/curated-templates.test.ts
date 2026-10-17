import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import {
  CURATED_TEMPLATES,
  curatedCatalogResponse,
  validateCuratedCatalog,
} from "../src/templates/curated.ts";
import {
  parseTemplateSelection,
  resolveBlueprint,
} from "../src/templates/model.ts";
import { createTemplateApplicationService } from "../src/templates/service.ts";
import { templateHistoryOrigin } from "../src/templates/history.ts";
import {
  templateFixture,
  user,
  eventId,
  operationId,
} from "./helpers/template-fixture.ts";

test("curated editorial catalog: 12 unique v1 plans, 108 purposeful bilingual items, immutable bounded content", () => {
  assert.equal(CURATED_TEMPLATES.length, 12);
  assert.equal(
    CURATED_TEMPLATES.reduce((n, t) => n + t.items.length, 0),
    108,
  );
  validateCuratedCatalog(CURATED_TEMPLATES);
  assert.equal(new Set(CURATED_TEMPLATES.map((t) => t.id)).size, 12);
  assert.deepEqual(
    new Set(CURATED_TEMPLATES.map((t) => t.difficulty)),
    new Set(["beginner", "standard", "advanced"]),
  );
  for (const entry of CURATED_TEMPLATES) {
    assert.ok(Object.isFrozen(entry));
    assert.ok(entry.items.length >= 6 && entry.items.length <= 18);
    assert.equal(
      new Set(entry.items.map((i) => i.text.bg.title)).size,
      entry.items.length,
    );
    assert.equal(
      new Set(entry.items.map((i) => i.text.en.title)).size,
      entry.items.length,
    );
    for (const item of entry.items) {
      assert.equal(item.deadlineTime, null);
      assert.notEqual(item.text.bg.context, item.text.en.context);
      assert.notEqual(item.text.bg.category, item.text.en.category);
      assert.notEqual(item.priority, "critical");
    }
    const broken = structuredClone(entry);
    broken.items[0]!.id = broken.items[1]!.id;
    assert.throws(() => validateCuratedCatalog([broken]));
    broken.items[0]!.id = "valid";
    broken.description.bg = broken.description.en;
    assert.throws(() => validateCuratedCatalog([broken]));
  }
});

for (const template of CURATED_TEMPLATES)
  test(`${template.id}: canonical BG/EN selection, calendar dates, shared atomic Apply and safe provenance`, async () => {
    const f = templateFixture(),
      service = createTemplateApplicationService(f.pool);
    const selection = {
      templateId: template.id,
      templateVersion: 1,
      itemIds: template.items.map((i) => i.id),
      language: "bg",
    };
    const canonical = parseTemplateSelection({
      ...selection,
      itemIds: [...selection.itemIds].reverse(),
    });
    assert.deepEqual(canonical, selection);
    for (const language of ["bg", "en"] as const) {
      const review = await service.preview(user, eventId, {
        ...selection,
        language,
      });
      assert.equal(review.items.length, template.items.length);
      assert.deepEqual(
        review.items.map((i) => i.title),
        template.items.map((i) => i.text[language].title),
      );
      assert.ok(
        review.items.every(
          (i) =>
            i.deadlineTime === null &&
            !i.accepted &&
            i.assignedMemberId === null &&
            !i.reminderOffsets.length,
        ),
      );
    }
    assert.throws(() =>
      parseTemplateSelection({ ...selection, templateVersion: 2 }),
    );
    assert.throws(() =>
      parseTemplateSelection({ ...selection, itemIds: ["invented"] }),
    );
    assert.throws(() =>
      parseTemplateSelection({ ...selection, templateId: "curated-unknown" }),
    );
    for (const start of [
      "2026-01-01",
      "2024-02-29",
      "2026-03-29",
      "2026-10-25",
      "2026-12-31",
    ]) {
      const result = resolveBlueprint(canonical, start);
      assert.equal(result.length, template.items.length);
    }
    assert.throws(() => resolveBlueprint(canonical, "2026-02-29"));
    const review = await service.preview(user, eventId, selection);
    const command = {
      ...selection,
      expectedEventVersion: review.event.version,
      reviewRevision: review.reviewRevision,
      confirmed: true,
    };
    const result = await service.apply(user, eventId, operationId, command);
    assert.equal(result.createdCount, template.items.length);
    assert.deepEqual(
      await service.apply(user, eventId, operationId, command),
      result,
    );
    assert.deepEqual(
      templateHistoryOrigin({
        templateId: template.id,
        templateVersion: 1,
        operationId,
      }),
      { templateId: template.id, templateVersion: 1, operationId },
    );
    assert.equal(
      templateHistoryOrigin({
        templateId: "curated-unknown",
        templateVersion: 1,
        operationId,
      }),
      undefined,
    );
  });

test("curated read API authenticates, rejects extra query fields and exposes only system content with no-store", async () => {
  let active = false;
  const f = templateFixture();
  const app = createApp({
    checkDatabase: async () => {},
    templates: createTemplateApplicationService(f.pool),
    authentication: {
      baseURL: "http://localhost:3001",
      auth: {
        handler: async () => new Response(),
        api: {
          getSession: async () =>
            active ? { user: { ...user, active: true } } : null,
        },
      },
    },
  });
  try {
    assert.equal((await app.inject("/api/templates/curated")).statusCode, 401);
    active = true;
    assert.equal(
      (await app.inject("/api/templates/curated?owner=forged")).statusCode,
      400,
    );
    const response = await app.inject("/api/templates/curated");
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(response.json(), curatedCatalogResponse());
    assert.equal(f.calls.length, 0);
    assert.ok(!/ownerUserId|sourceTaskId|createdAt|@/.test(response.body));
  } finally {
    await app.close();
  }
});
