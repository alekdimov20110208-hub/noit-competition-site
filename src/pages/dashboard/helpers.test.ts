import assert from "node:assert/strict";
import test from "node:test";
import {
  HIGH_ACTIVE_LOAD_THRESHOLD,
  type TeamWorkload,
} from "../../domain/workspace.ts";
import type { EventChange, EventMilestone, Task } from "../../domain/types.ts";
import {
  buildPreparationTimeline,
  getActiveChanges,
  getPreparationWindow,
  getWorkloadSignal,
  partitionTeamPressure,
} from "./helpers.ts";

function workload(values: Partial<Omit<TeamWorkload, "member">>): TeamWorkload {
  return {
    member: {
      id: "member-test",
      name: "Test Member",
      role: "Test role",
      isOrganizer: false,
    },
    assigned: 0,
    completed: 0,
    active: 0,
    blocked: 0,
    overdue: 0,
    atRisk: 0,
    ...values,
  };
}

function task(values: Partial<Task> & Pick<Task, "id" | "deadline">): Task {
  return {
    eventId: "event-test",
    title: `Task ${values.id}`,
    category: "Test",
    ownerId: "member-test",
    deadlineTime: null,
    status: "not-started",
    priority: "normal",
    context: "Test context",
    acknowledged: false,
    updatedAt: "2026-08-12T09:00:00.000Z",
    ...values,
  };
}

function milestone(
  values: Partial<EventMilestone> & Pick<EventMilestone, "id" | "date">,
): EventMilestone {
  return {
    title: `Milestone ${values.id}`,
    status: "upcoming",
    ...values,
  };
}

function change(
  values: Partial<EventChange> & Pick<EventChange, "id" | "responseStatus">,
): EventChange {
  return {
    eventId: "event-test",
    title: `Change ${values.id}`,
    description: "Test change",
    severity: "low",
    reportedAt: "2026-08-12T09:00:00.000Z",
    affectedTaskIds: [],
    affectedAreas: [],
    ownerId: "member-test",
    response: "Test response",
    acknowledged: false,
    directContactRecommended: false,
    escalationRecommendation: "Test escalation",
    ...values,
  };
}

test("workload signals distinguish blockers, timing risk, load, and no work", () => {
  assert.equal(getWorkloadSignal(workload({ blocked: 1 })), "blocked");
  assert.equal(getWorkloadSignal(workload({ overdue: 1 })), "overdue");
  assert.equal(
    getWorkloadSignal(
      workload({
        assigned: HIGH_ACTIVE_LOAD_THRESHOLD,
        active: HIGH_ACTIVE_LOAD_THRESHOLD,
      }),
    ),
    "high",
  );
  assert.equal(getWorkloadSignal(workload({})), "unassigned");
  assert.equal(getWorkloadSignal(workload({ assigned: 1 })), "clear");
});

test("preparation windows use calendar-day boundaries", () => {
  const now = new Date("2026-08-12T19:30:00.000Z");
  assert.equal(getPreparationWindow("2026-08-11", now), "current");
  assert.equal(getPreparationWindow("2026-08-12", now), "today");
  assert.equal(getPreparationWindow("2026-08-19", now), "near");
  assert.equal(getPreparationWindow("2026-08-20", now), "later");
  assert.equal(getPreparationWindow("invalid", now), "later");
});

test("preparation windows follow the local day around non-UTC midnight", () => {
  const originalTimeZone = process.env.TZ;
  try {
    process.env.TZ = "Europe/Kyiv";
    const localAfterMidnight = new Date("2026-08-11T21:30:00.000Z");
    assert.equal(localAfterMidnight.getDate(), 12);
    assert.equal(
      getPreparationWindow("2026-08-11", localAfterMidnight),
      "current",
    );
    assert.equal(
      getPreparationWindow("2026-08-12", localAfterMidnight),
      "today",
    );

    const entries = buildPreparationTimeline(
      [
        task({ id: "previous-local-day", deadline: "2026-08-11" }),
        task({ id: "local-today", deadline: "2026-08-12" }),
      ],
      [],
      localAfterMidnight,
    );
    assert.deepEqual(
      entries.map(({ id, window }) => ({ id, window })),
      [{ id: "task:local-today", window: "today" }],
    );
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

test("preparation timeline combines open future tasks and active milestones in date order", () => {
  const now = new Date("2026-08-12T09:00:00.000Z");
  const entries = buildPreparationTimeline(
    [
      task({ id: "later", deadline: "2026-08-20" }),
      task({ id: "today", deadline: "2026-08-12" }),
      task({ id: "past", deadline: "2026-08-11" }),
      task({ id: "done", deadline: "2026-08-13", status: "completed" }),
    ],
    [
      milestone({ id: "near", date: "2026-08-15" }),
      milestone({ id: "done", date: "2026-08-14", status: "completed" }),
    ],
    now,
  );

  assert.deepEqual(
    entries.map(({ id, kind, window }) => ({ id, kind, window })),
    [
      { id: "task:today", kind: "task", window: "today" },
      { id: "milestone:near", kind: "milestone", window: "near" },
      { id: "task:later", kind: "task", window: "later" },
    ],
  );
  assert.deepEqual(buildPreparationTimeline([], [], new Date("invalid")), []);
});

test("active-change and team-pressure helpers remove resolved or quiet records", () => {
  assert.deepEqual(
    getActiveChanges([
      change({ id: "reported", responseStatus: "reported" }),
      change({ id: "active", responseStatus: "in-progress" }),
      change({ id: "resolved", responseStatus: "resolved" }),
    ]).map(({ id }) => id),
    ["reported", "active"],
  );

  const blocked = workload({ blocked: 1 });
  const overloaded = workload({
    assigned: HIGH_ACTIVE_LOAD_THRESHOLD,
    active: HIGH_ACTIVE_LOAD_THRESHOLD,
  });
  overloaded.member = {
    id: "member-overloaded",
    name: "Overloaded Member",
    role: "Test role",
    isOrganizer: false,
  };
  const quiet = workload({ assigned: 1 });
  quiet.member = {
    id: "member-quiet",
    name: "Quiet Member",
    role: "Test role",
    isOrganizer: false,
  };

  const partition = partitionTeamPressure([blocked, quiet, overloaded]);
  assert.deepEqual(
    partition.pressure.map(({ member }) => member.id),
    ["member-test", "member-overloaded"],
  );
  assert.deepEqual(
    partition.quiet.map(({ member }) => member.id),
    ["member-quiet"],
  );
});
