import assert from "node:assert/strict";
import test from "node:test";
import { AIKIDO_SEMINAR_STARTER as template } from "../../domain/eventTemplates.ts";
import { validateTaskFields } from "../../services/taskAuthoring.ts";
import type { TaskEvent } from "../../services/RemoteWorkspaceService.ts";
import type { TaskReadState } from "../../services/taskReadState.ts";
import { createI18n } from "../../i18n/createI18n.ts";
import {
  previewTemplateItem,
  templatePreviewEvent,
  toggleTemplateItem,
} from "./preview.ts";

const event: TaskEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Synthetic seminar",
  startDate: "2026-11-20",
  endDate: "2026-11-22",
  timezone: "Europe/Sofia",
  archived: false,
  membership: {
    id: "00000000-0000-4000-8000-000000000002",
    accessRole: "ORGANIZER",
  },
  version: 1,
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
};
const state: TaskReadState = {
  status: "ready",
  error: null,
  workspace: {
    currentEventId: event.id,
    events: [event],
    teamMembers: [],
    tasks: [],
  },
  accessibleEvents: [event],
};

test("selection toggles individual stable identities without changing catalog or input", () => {
  const before = JSON.stringify(template);
  const all = template.items.map((item) => item.id);
  assert.equal(new Set(all).size, 4);
  assert.equal(template.version, 1);
  let selected = toggleTemplateItem(template, all, all[0]);
  assert.equal(selected.length, 3);
  assert.equal(all.length, 4);
  assert.deepEqual(toggleTemplateItem(template, selected, all[0]), all);
  for (const id of all) selected = toggleTemplateItem(template, selected, id);
  assert.deepEqual(selected, [all[0]]);
  assert.deepEqual(toggleTemplateItem(template, selected, all[0]), []);
  assert.deepEqual(toggleTemplateItem(template, [], "unknown"), []);
  assert.equal(JSON.stringify(template), before);
});

test("only the ready, matching authorized Event supplies dates; stale context is hidden", () => {
  assert.equal(templatePreviewEvent(state, null), event);
  assert.equal(templatePreviewEvent(state, event.id), event);
  assert.equal(templatePreviewEvent(state, "another-event"), null);
  assert.equal(
    templatePreviewEvent({ ...state, status: "loading" }, event.id),
    null,
  );
  for (const error of [
    "forbidden",
    "not-found",
    "unavailable",
    "invalid",
    "unauthenticated",
  ] as const)
    assert.equal(
      templatePreviewEvent({ ...state, status: "error", error }, event.id),
      null,
    );
  assert.equal(
    templatePreviewEvent(
      { ...state, workspace: { ...state.workspace, events: [] } },
      null,
    ),
    null,
  );
  assert.equal(
    templatePreviewEvent(
      {
        ...state,
        workspace: { ...state.workspace, currentEventId: "another-event" },
      },
      event.id,
    ),
    null,
  );
});

test("Member and archived Events allow a read-only preview without changing records", () => {
  for (const variant of [
    event,
    { ...event, archived: true },
    {
      ...event,
      membership: { ...event.membership, accessRole: "MEMBER" as const },
    },
  ]) {
    const before = JSON.stringify(variant);
    const read = {
      ...state,
      workspace: { ...state.workspace, events: [variant] },
    };
    assert.equal(templatePreviewEvent(read, variant.id), variant);
    assert.equal(
      previewTemplateItem(template.items[0], variant).status,
      "ready",
    );
    assert.equal(JSON.stringify(variant), before);
  }
});

test("curated preview matches Task fields in both languages, with no reminders or assumed times", () => {
  const before = JSON.stringify(state);
  for (const language of ["bg", "en"] as const) {
    const i18n = createI18n(language);
    for (const item of template.items) {
      const preview = previewTemplateItem(item, event);
      assert.equal(preview.status, "ready");
      if (preview.status !== "ready") throw Error("Expected ready preview");
      assert.deepEqual(
        validateTaskFields({
          title: i18n.t(item.titleKey),
          category: i18n.t(item.categoryKey),
          context: i18n.t(item.contextKey),
          priority: item.priority,
          ...preview,
          reminderOffsets: [...item.reminderOffsets],
        }),
        {},
      );
      assert.deepEqual(item.reminderOffsets, []);
    }
  }
  assert.deepEqual(
    template.items.map((item) => previewTemplateItem(item, event)),
    [
      { status: "ready", deadline: "2026-11-13", deadlineTime: null },
      { status: "ready", deadline: "2026-11-19", deadlineTime: null },
      { status: "ready", deadline: "2026-11-19", deadlineTime: "15:00" },
      { status: "ready", deadline: "2026-11-20", deadlineTime: "08:30" },
    ],
  );
  assert.equal(JSON.stringify(state), before);
});

test("missing context, malformed dates and out-of-range previews are explicit", () => {
  const item = template.items[0];
  assert.deepEqual(previewTemplateItem(item, null), { status: "no-event" });
  for (const startDate of ["2026-02-29", "0001-01-01"])
    assert.deepEqual(previewTemplateItem(item, { ...event, startDate }), {
      status: "invalid",
    });
  assert.deepEqual(
    previewTemplateItem({ ...item, deadlineTime: "24:00" }, event),
    { status: "invalid" },
  );
});
