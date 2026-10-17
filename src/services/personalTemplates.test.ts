import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  PersonalTemplateService,
  LibraryFailure,
  readPersonalTemplate,
  type PersonalTemplate,
} from "./personalTemplates.ts";
import {
  templateSelection,
  readTemplateReview,
  validTemplateAttempt,
} from "./templateApplications.ts";
const template: PersonalTemplate = {
  id: randomUUID(),
  version: 1,
  name: "Reviewed plan",
  description: "Private",
  createdAt: "2026-10-17T00:00:00Z",
  items: [
    {
      id: randomUUID(),
      title: "Reviewed title",
      category: "Logistics",
      context: "",
      priority: "important",
      dayOffset: 2,
      deadlineTime: "15:00",
    },
  ],
};
test("private DTO excludes operational fields and validates bounded persisted content", () => {
  assert.deepEqual(readPersonalTemplate(template), template);
  for (const items of [
    [],
    [{ ...template.items[0], dayOffset: 3661 }],
    [{ ...template.items[0], deadlineTime: "25:00" }],
    [{ ...template.items[0], title: "x".repeat(201) }],
    [template.items[0], template.items[0]],
  ])
    assert.throws(() => readPersonalTemplate({ ...template, items }));
});
test("private preview is checked against retrieved immutable blueprint and accepted calendar dates", () => {
  const selection = templateSelection(
      template.items.map((i) => i.id),
      "en",
      template,
    ),
    eventId = randomUUID();
  const item = template.items[0]!;
  const review = {
    ...selection,
    event: {
      id: eventId,
      name: "Destination",
      startDate: "2026-10-24",
      endDate: "2026-10-28",
      timezone: "Europe/Sofia",
      archived: false,
      version: 1,
      membership: { id: randomUUID(), accessRole: "ORGANIZER" },
      createdAt: "2026-10-17T00:00:00Z",
      updatedAt: "2026-10-17T00:00:00Z",
    },
    reviewRevision: "a".repeat(64),
    canApply: true,
    matchingTaskCount: 0,
    items: [
      {
        title: item.title,
        category: item.category,
        context: item.context,
        priority: item.priority,
        deadline: "2026-10-26",
        deadlineTime: "15:00",
        reminderOffsets: [],
        itemId: item.id,
        assignedMemberId: null,
        accepted: false,
        status: "not-started",
      },
    ],
  };
  assert.deepEqual(
    readTemplateReview(review, eventId, selection, template),
    review,
  );
  assert.throws(() =>
    readTemplateReview(
      { ...review, items: [{ ...review.items[0], deadline: "2026-10-25" }] },
      eventId,
      selection,
      template,
    ),
  );
  assert.equal(
    validTemplateAttempt({
      ...selection,
      operationId: randomUUID(),
      expectedEventVersion: 1,
      reviewRevision: "a".repeat(64),
      confirmed: true,
    }),
    true,
  );
});
test("Save transport retains key/payload across lost response and validates backend confirmation", async () => {
  const attempt = {
      eventId: randomUUID(),
      operationId: randomUUID(),
      body: {
        name: "Private",
        description: "",
        expectedEventVersion: 1,
        items: [
          {
            sourceTaskId: randomUUID(),
            expectedTaskVersion: 1,
            title: "Reviewed",
            category: "",
            context: "",
            contextReviewed: false,
            priority: "normal" as const,
          },
        ],
        confirmed: true as const,
      },
    },
    calls: RequestInit[] = [];
  const result = {
    operationId: attempt.operationId,
    templateId: randomUUID(),
    templateVersion: 1,
    itemCount: 1,
  };
  const service = new PersonalTemplateService(async (_url, options) => {
    calls.push(options!);
    if (calls.length === 1) throw Error("lost response");
    return Response.json(result, { status: 201 });
  });
  await assert.rejects(
    service.save(attempt),
    (e: unknown) => e instanceof LibraryFailure && e.code === "uncertain",
  );
  assert.deepEqual(await service.save(attempt), result);
  assert.equal(calls[0]!.body, calls[1]!.body);
  assert.deepEqual(calls[0]!.headers, calls[1]!.headers);
  assert.equal(calls[1]!.cache, "no-store");
});
