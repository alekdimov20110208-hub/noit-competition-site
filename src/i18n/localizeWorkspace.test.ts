import assert from "node:assert/strict";
import test from "node:test";
import { createDemoWorkspace } from "../data/demo.ts";
import { localizeWorkspace } from "./localizeWorkspace.ts";

test("Bulgarian localization overlays every visible demo field without mutating raw state", () => {
  const raw = createDemoWorkspace();
  const serializedBefore = JSON.stringify(raw);
  const localized = localizeWorkspace(raw, "bg");

  assert.notEqual(localized, raw);
  assert.equal(JSON.stringify(raw), serializedBefore);
  assert.deepEqual(
    localized.events.map((event) => event.id),
    raw.events.map((event) => event.id),
  );
  assert.deepEqual(
    localized.tasks.map((task) => [
      task.id,
      task.status,
      task.priority,
      task.acknowledged,
    ]),
    raw.tasks.map((task) => [
      task.id,
      task.status,
      task.priority,
      task.acknowledged,
    ]),
  );
  assert.deepEqual(
    localized.teamMembers.map((member) => member.name),
    raw.teamMembers.map((member) => member.name),
  );

  const rawEvent = raw.events[0];
  const localizedEvent = localized.events[0];
  assert.ok(rawEvent && localizedEvent);
  assert.notEqual(localizedEvent.name, rawEvent.name);
  assert.notEqual(localizedEvent.location, rawEvent.location);
  assert.notEqual(localizedEvent.guestInstructor, rawEvent.guestInstructor);
  localizedEvent.milestones.forEach((milestone, index) => {
    assert.notEqual(milestone.title, rawEvent.milestones[index]?.title);
  });

  localized.teamMembers.forEach((member, index) => {
    assert.notEqual(member.role, raw.teamMembers[index]?.role);
  });
  localized.tasks.forEach((task, index) => {
    const rawTask = raw.tasks[index];
    assert.ok(rawTask);
    assert.notEqual(task.title, rawTask.title);
    assert.notEqual(task.category, rawTask.category);
    assert.notEqual(task.context, rawTask.context);
    if (rawTask.blockedBy) assert.notEqual(task.blockedBy, rawTask.blockedBy);
    if (rawTask.blocks) assert.notEqual(task.blocks, rawTask.blocks);
  });

  const rawChange = raw.changes[0];
  const localizedChange = localized.changes[0];
  assert.ok(rawChange && localizedChange);
  assert.notEqual(localizedChange.title, rawChange.title);
  assert.notEqual(localizedChange.description, rawChange.description);
  assert.notEqual(localizedChange.response, rawChange.response);
  assert.notEqual(
    localizedChange.escalationRecommendation,
    rawChange.escalationRecommendation,
  );
  localizedChange.affectedAreas.forEach((area, index) => {
    assert.notEqual(area, rawChange.affectedAreas[index]);
  });

  const rawTemplate = raw.templates[0];
  const localizedTemplate = localized.templates[0];
  assert.ok(rawTemplate && localizedTemplate);
  assert.notEqual(localizedTemplate.name, rawTemplate.name);
  assert.notEqual(localizedTemplate.description, rawTemplate.description);
  localizedTemplate.areas.forEach((area, areaIndex) => {
    const rawArea = rawTemplate.areas[areaIndex];
    assert.ok(rawArea);
    assert.notEqual(area.name, rawArea.name);
    area.items.forEach((item, itemIndex) => {
      assert.notEqual(item, rawArea.items[itemIndex]);
    });
  });
});

test("English and non-demo workspaces retain their original references", () => {
  const raw = createDemoWorkspace();
  assert.equal(localizeWorkspace(raw, "en"), raw);

  const custom = { ...raw, demoLabel: "custom workspace" };
  assert.equal(localizeWorkspace(custom, "bg"), custom);
});
