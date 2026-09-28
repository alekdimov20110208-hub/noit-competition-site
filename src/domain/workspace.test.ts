import assert from "node:assert/strict";
import test from "node:test";
import { createDemoWorkspace } from "../data/demo.ts";
import { createStressWorkspace } from "../data/stress.ts";
import type { Task, TeamMember } from "./types.ts";
import {
  deserializeWorkspace,
  getAffectedTasks,
  getAttentionTasks,
  getReadinessPercent,
  getReadinessSummary,
  getTaskCounts,
  getTeamWorkload,
  getUpcomingTasks,
  isTaskOverdue,
  WORKSPACE_STORAGE_KEY,
  workspaceReducer,
} from "./workspace.ts";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-default",
    eventId: "event-test",
    title: "Test task",
    category: "Test",
    ownerId: "member-one",
    deadline: "2026-08-10",
    status: "not-started",
    priority: "normal",
    context: "Synthetic test fixture",
    acknowledged: true,
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2026-08-04T12:00:00.000Z");

test("readiness and task counts reflect task status and injected time", () => {
  const tasks = [
    makeTask({
      id: "task-complete",
      status: "completed",
      deadline: "2026-08-01",
    }),
    makeTask({
      id: "task-progress",
      status: "in-progress",
      deadline: "2026-08-03",
    }),
    makeTask({
      id: "task-blocked",
      status: "blocked",
      deadline: "2026-08-02",
    }),
    makeTask({ id: "task-not-started", deadline: "2026-08-10" }),
  ];

  assert.deepEqual(getReadinessSummary(tasks), {
    completed: 1,
    total: 4,
    percent: 25,
  });
  assert.equal(getReadinessPercent(tasks), 25);

  const counts = getTaskCounts(tasks, NOW);
  assert.deepEqual(counts, {
    completed: 1,
    active: 2,
    blocked: 1,
    overdue: 2,
    total: 4,
  });
  assert.equal(counts.completed + counts.active + counts.blocked, counts.total);
  assert.deepEqual(getReadinessSummary([]), {
    completed: 0,
    total: 0,
    percent: 0,
  });
  assert.equal(getReadinessPercent([]), 0);
});

test("overdue state is automatic, excludes completed work, and respects the due day", () => {
  assert.equal(isTaskOverdue(makeTask({ deadline: "2026-08-03" }), NOW), true);
  assert.equal(
    isTaskOverdue(
      makeTask({ deadline: "2026-08-03", status: "completed" }),
      NOW,
    ),
    false,
  );
  assert.equal(isTaskOverdue(makeTask({ deadline: "2026-08-04" }), NOW), false);
  assert.equal(isTaskOverdue(makeTask({ deadline: "not-a-date" }), NOW), false);
});

test("upcoming and attention selectors return bounded operational queues", () => {
  const tasks = [
    makeTask({
      id: "task-overdue",
      deadline: "2026-08-01",
      acknowledged: true,
    }),
    makeTask({
      id: "task-next",
      deadline: "2026-08-05",
      acknowledged: true,
    }),
    makeTask({
      id: "task-critical",
      deadline: "2026-08-06",
      priority: "critical",
      acknowledged: false,
    }),
    makeTask({
      id: "task-completed",
      deadline: "2026-08-05",
      status: "completed",
      priority: "critical",
      acknowledged: false,
    }),
  ];

  assert.deepEqual(
    getUpcomingTasks(tasks, NOW, 2).map((task) => task.id),
    ["task-next", "task-critical"],
  );
  assert.deepEqual(
    getAttentionTasks(tasks, NOW, 2).map((task) => task.id),
    ["task-overdue", "task-critical"],
  );
});

test("team workload counts assigned, completed, active, and at-risk work", () => {
  const members: TeamMember[] = [
    {
      id: "member-one",
      name: "Member One",
      role: "Organizer",
      isOrganizer: true,
    },
    {
      id: "member-two",
      name: "Member Two",
      role: "Helper",
      isOrganizer: false,
    },
  ];
  const tasks = [
    makeTask({ id: "task-done", status: "completed" }),
    makeTask({ id: "task-critical", priority: "critical" }),
    makeTask({ id: "task-late", deadline: "2026-08-01" }),
    makeTask({
      id: "task-blocked",
      ownerId: "member-two",
      status: "blocked",
      deadline: "2026-08-01",
    }),
  ];

  const workloads = getTeamWorkload(members, tasks, NOW);

  assert.deepEqual(
    workloads.map(({ member, ...counts }) => ({
      memberId: member.id,
      ...counts,
    })),
    [
      {
        memberId: "member-one",
        assigned: 3,
        completed: 1,
        active: 2,
        blocked: 0,
        overdue: 1,
        atRisk: 1,
      },
      {
        memberId: "member-two",
        assigned: 1,
        completed: 0,
        active: 0,
        blocked: 1,
        overdue: 1,
        atRisk: 1,
      },
    ],
  );

  for (const workload of workloads) {
    assert.equal(
      workload.completed + workload.active + workload.blocked,
      workload.assigned,
    );
    assert.ok(workload.atRisk <= workload.blocked + workload.overdue);
  }
});

test("workspace reducer applies task and change transitions without mutation", () => {
  const initial = createDemoWorkspace();
  const taskId = "task-guest-itinerary";
  const changeId = "change-flight-arrival-2026-08-03";
  const updatedAt = "2026-08-04T13:00:00.000Z";

  const withTaskStatus = workspaceReducer(initial, {
    type: "task/status",
    taskId,
    status: "in-progress",
    updatedAt,
  });
  assert.notEqual(withTaskStatus, initial);
  assert.equal(
    initial.tasks.find((task) => task.id === taskId)?.status,
    "blocked",
  );
  assert.deepEqual(
    withTaskStatus.tasks.find((task) => task.id === taskId),
    {
      ...initial.tasks.find((task) => task.id === taskId),
      status: "in-progress",
      updatedAt,
    },
  );
  assert.equal(
    withTaskStatus.tasks.find((task) => task.id === taskId)?.acknowledged,
    initial.tasks.find((task) => task.id === taskId)?.acknowledged,
  );

  const withTaskAcknowledged = workspaceReducer(withTaskStatus, {
    type: "task/toggle-acknowledgement",
    taskId,
    updatedAt,
  });
  assert.equal(
    withTaskAcknowledged.tasks.find((task) => task.id === taskId)?.acknowledged,
    true,
  );
  assert.equal(
    withTaskAcknowledged.tasks.find((task) => task.id === taskId)?.status,
    "in-progress",
  );

  const withChangeAcknowledged = workspaceReducer(withTaskAcknowledged, {
    type: "change/acknowledge",
    changeId,
  });
  assert.equal(
    withChangeAcknowledged.changes.find((change) => change.id === changeId)
      ?.acknowledged,
    true,
  );

  const resolved = workspaceReducer(withChangeAcknowledged, {
    type: "change/status",
    changeId,
    status: "resolved",
  });
  assert.equal(
    resolved.changes.find((change) => change.id === changeId)?.responseStatus,
    "resolved",
  );

  assert.deepEqual(
    workspaceReducer(resolved, { type: "workspace/reset" }),
    createDemoWorkspace(),
  );
});

test("affected-task lookup follows the change order and ignores unknown IDs", () => {
  const state = createDemoWorkspace();
  const change = {
    ...state.changes[0],
    affectedTaskIds: [
      "task-program-draft",
      "unknown-task",
      "task-airport-transfer",
    ],
  };

  assert.deepEqual(
    getAffectedTasks(change, state.tasks).map((task) => task.id),
    ["task-program-draft", "task-airport-transfer"],
  );
});

test("workspace deserialization rejects malformed, ambiguous, invalid-date, and wrong-version data", () => {
  const expected = createDemoWorkspace();
  const invalidDates = {
    ...expected,
    tasks: expected.tasks.map((task, index) =>
      index === 0 ? { ...task, deadline: "2026-02-30" } : task,
    ),
  };
  const invalidUpdatedAt = {
    ...expected,
    tasks: expected.tasks.map((task, index) =>
      index === 0 ? { ...task, updatedAt: "0" } : task,
    ),
  };
  const invalidReportedAt = {
    ...expected,
    changes: expected.changes.map((change, index) =>
      index === 0
        ? { ...change, reportedAt: "2026-02-30T00:00:00.000Z" }
        : change,
    ),
  };
  const invalidEventDate = {
    ...expected,
    events: expected.events.map((event, index) =>
      index === 0 ? { ...event, startDate: "2026-02-30" } : event,
    ),
  };
  const invalidMilestoneDate = {
    ...expected,
    events: expected.events.map((event, index) =>
      index === 0
        ? {
            ...event,
            milestones: event.milestones.map((milestone, milestoneIndex) =>
              milestoneIndex === 0
                ? { ...milestone, date: "2026-02-30" }
                : milestone,
            ),
          }
        : event,
    ),
  };
  const duplicateTaskIds = {
    ...expected,
    tasks: [...expected.tasks, { ...expected.tasks[0] }],
  };

  assert.deepEqual(deserializeWorkspace("{malformed"), expected);
  assert.deepEqual(
    deserializeWorkspace(JSON.stringify({ ...expected, version: 2 })),
    expected,
  );
  assert.deepEqual(deserializeWorkspace(null), expected);
  assert.deepEqual(deserializeWorkspace(JSON.stringify(expected)), expected);
  assert.deepEqual(
    deserializeWorkspace(JSON.stringify(invalidDates)),
    expected,
  );
  for (const invalidState of [
    invalidUpdatedAt,
    invalidReportedAt,
    invalidEventDate,
    invalidMilestoneDate,
    duplicateTaskIds,
  ]) {
    assert.deepEqual(
      deserializeWorkspace(JSON.stringify(invalidState)),
      expected,
    );
  }
});

test("demo seed is explicitly synthetic and covers the vertical-slice scenarios", () => {
  const state = createDemoWorkspace();

  assert.equal(state.teamMembers.length, 5);
  assert.ok(state.tasks.length >= 12);
  assert.match(state.demoLabel, /SYNTHETIC DEMO SEED/);
  assert.equal(state.templates.length, 1);
  assert.ok(
    state.changes.some(
      (change) =>
        change.severity === "critical" &&
        change.responseStatus !== "resolved" &&
        change.directContactRecommended,
    ),
  );
  assert.ok(
    state.tasks.some(
      (task) =>
        task.status === "blocked" &&
        task.priority === "critical" &&
        isTaskOverdue(task, NOW),
    ),
  );
});

test("stress fixture is fictional, dense, long, and storage-compatible", () => {
  const state = createStressWorkspace();
  const event = state.events.find((item) => item.id === state.currentEventId);

  assert.ok(event);
  assert.match(state.demoLabel, /SYNTHETIC STRESS FIXTURE.*FICTIONAL DATA/);
  assert.ok(event.name.length > 100);
  assert.ok(event.location.length > 70);
  assert.ok(event.milestones.length >= 18);
  assert.ok(event.milestones.some((milestone) => milestone.title.length > 70));
  assert.ok(state.teamMembers.some((member) => member.name.length > 45));
  assert.ok(state.tasks.length >= 40);
  assert.ok(state.tasks.some((task) => task.title.length > 150));
  assert.ok(state.tasks.some((task) => task.context.length > 220));
  assert.deepEqual(
    new Set(state.tasks.map((task) => task.status)),
    new Set(["completed", "not-started", "in-progress", "blocked"]),
  );

  const counts = getTaskCounts(state.tasks, NOW);
  assert.equal(counts.completed + counts.active + counts.blocked, counts.total);
  assert.deepEqual(deserializeWorkspace(JSON.stringify(state)), state);
});

test("workspace persistence key and task responsibility fields stay stable", () => {
  const state = createDemoWorkspace();
  const restored = deserializeWorkspace(JSON.stringify(state));
  const taskId = "task-guest-itinerary";

  assert.equal(WORKSPACE_STORAGE_KEY, "budograph.workspace.v1");
  assert.equal(
    restored.tasks.find((task) => task.id === taskId)?.status,
    state.tasks.find((task) => task.id === taskId)?.status,
  );
  assert.equal(
    restored.tasks.find((task) => task.id === taskId)?.acknowledged,
    state.tasks.find((task) => task.id === taskId)?.acknowledged,
  );
});
