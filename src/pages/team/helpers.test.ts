import assert from "node:assert/strict";
import test from "node:test";
import { createDemoWorkspace } from "../../data/demo.ts";
import { getDemoReferenceNow } from "../../data/demoTime.ts";
import {
  compareAttentionTasks,
  getAttentionReasons,
} from "../../domain/taskAttention.ts";
import type { Task, TeamMember } from "../../domain/types.ts";
import {
  getMemberSummary,
  getPreviewLimits,
  getTeamRoster,
  partitionMemberTasks,
  selectTeamMember,
} from "./helpers.ts";

const now = getDemoReferenceNow();
const member: TeamMember = {
  id: "test-owner",
  name: "Owner",
  role: "Seminar logistics",
  isOrganizer: false,
};
function task(values: Partial<Task> = {}): Task {
  return {
    id: "test",
    eventId: "event",
    title: "Synthetic transfer responsibility",
    category: "Transport",
    ownerId: member.id,
    deadline: "2026-09-20",
    deadlineTime: null,
    status: "not-started",
    priority: "normal",
    acknowledged: true,
    context: "Isolated test",
    updatedAt: "2026-09-07T09:00:00.000Z",
    ...values,
  };
}

test("Team reuses canonical attention eligibility and ordering with deterministic injected time", () => {
  const tasks = [
    task({ id: "future-critical", priority: "critical" }),
    task({ id: "blocked", status: "blocked" }),
    task({ id: "overdue", deadline: "2026-09-01" }),
    task({ id: "unaccepted", acknowledged: false }),
    task({ id: "near", priority: "critical", deadline: "2026-09-14" }),
    task({ id: "today", priority: "critical", deadline: "2026-09-07" }),
    task({ id: "prose", blockedBy: "Awaiting instructor confirmation" }),
    task({
      id: "done",
      status: "completed",
      deadline: "2026-09-01",
      deadlineTime: null,
      acknowledged: false,
    }),
  ];
  const expected = tasks
    .filter((value) => getAttentionReasons(value, now).length)
    .sort((a, b) => compareAttentionTasks(a, b, now));
  assert.deepEqual(partitionMemberTasks(tasks, now).attention, expected);
  assert.deepEqual(
    partitionMemberTasks([...tasks].reverse(), now).attention,
    expected,
  );
  assert.deepEqual(
    expected.map(({ id }) => id),
    ["overdue", "blocked", "today", "near", "unaccepted"],
  );
});

test("factual counts count blocked/overdue union once and exclude completed acknowledgement from pressure", () => {
  const tasks = [
    task({
      id: "both",
      status: "blocked",
      deadline: "2026-09-01",
      deadlineTime: null,
      acknowledged: false,
    }),
    task({ id: "late", deadline: "2026-09-06" }),
    task({ id: "critical", deadline: "2026-09-08", priority: "critical" }),
    task({ id: "unaccepted", acknowledged: false }),
    task({ id: "progress", status: "in-progress" }),
    task({
      id: "completed",
      status: "completed",
      deadline: "2026-09-01",
      deadlineTime: null,
      acknowledged: false,
    }),
  ];
  const summary = getMemberSummary(member, tasks, now);
  assert.equal(summary.assigned, 6);
  assert.equal(summary.open, 5);
  assert.equal(summary.blocked, 1);
  assert.equal(summary.overdue, 2);
  assert.equal(summary.atRisk, 2);
  assert.equal(summary.notAccepted, 2);
  assert.equal(summary.attention.length, 4);
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.criticalDeadline, 1);
  assert.deepEqual(summary.categories, ["Transport"]);
  for (const invented of [
    "capacity",
    "score",
    "performance",
    "hours",
    "utilization",
  ])
    assert.equal(invented in summary, false);
});

test("attention, upcoming, completed and invalid-date fallback own each task exactly once", () => {
  const tasks = [
    task({ id: "blocked-today", deadline: "2026-09-07", status: "blocked" }),
    task({ id: "today", deadline: "2026-09-07" }),
    task({ id: "near", deadline: "2026-09-08" }),
    task({ id: "later" }),
    task({ id: "completed", status: "completed" }),
    task({ id: "invalid", deadline: "invalid" }),
  ];
  const sections = partitionMemberTasks(tasks, now);
  assert.deepEqual(
    sections.attention.map(({ id }) => id),
    ["blocked-today"],
  );
  assert.deepEqual(
    sections.upcoming.map(({ id }) => id),
    ["today", "near", "later"],
  );
  assert.deepEqual(
    sections.completed.map(({ id }) => id),
    ["completed"],
  );
  assert.deepEqual(
    sections.other.map(({ id }) => id),
    ["invalid"],
  );
  assert.equal(
    new Set(
      Object.values(sections)
        .flat()
        .map(({ id }) => id),
    ).size,
    tasks.length,
  );
});

test("roster groups operational failures, other attention, dated open work, then no open work", () => {
  const state = createDemoWorkspace();
  state.teamMembers = [
    "none",
    "done",
    "later",
    "soon",
    "unaccepted",
    "critical",
    "blocked",
    "overdue",
  ].map((id) => ({ ...member, id }));
  state.tasks = [
    task({
      id: "done",
      ownerId: "done",
      status: "completed",
      deadline: "2026-01-01",
      deadlineTime: null,
    }),
    task({ id: "later", ownerId: "later" }),
    task({ id: "soon", ownerId: "soon", deadline: "2026-09-08" }),
    task({ id: "unaccepted", ownerId: "unaccepted", acknowledged: false }),
    task({
      id: "critical",
      ownerId: "critical",
      priority: "critical",
      deadline: "2026-09-07",
      deadlineTime: null,
    }),
    task({ id: "blocked", ownerId: "blocked", status: "blocked" }),
    task({ id: "overdue", ownerId: "overdue", deadline: "2026-09-01" }),
  ];
  state.currentEventId = "event";
  assert.deepEqual(
    getTeamRoster(state, now).map(({ member }) => member.id),
    [
      "overdue",
      "blocked",
      "critical",
      "unaccepted",
      "soon",
      "later",
      "none",
      "done",
    ],
  );
});

test("representative is strongest canonical task, not a sum of assignments or reasons", () => {
  const tasks = [
    task({ id: "future", priority: "critical" }),
    task({ id: "early", deadline: "2026-09-01" }),
    task({
      id: "many-reasons",
      status: "blocked",
      acknowledged: false,
      deadline: "2026-09-02",
      deadlineTime: null,
    }),
  ];
  assert.equal(
    getMemberSummary(member, tasks, now).representative?.id,
    "early",
  );
  assert.equal(
    getMemberSummary(member, tasks.slice(0, 1), now).representative?.id,
    "future",
  );
});

test("comparable attention tasks use canonical task ID tie-break; open-date ties retain member source order", () => {
  const state = createDemoWorkspace();
  state.currentEventId = "event";
  state.teamMembers = [
    { ...member, id: "z-owner" },
    { ...member, id: "a-owner" },
  ];
  state.tasks = [
    task({ id: "z-task", ownerId: "z-owner" }),
    task({ id: "a-task", ownerId: "a-owner" }),
  ];
  assert.deepEqual(
    getTeamRoster(state, now).map(({ member }) => member.id),
    ["z-owner", "a-owner"],
  );
  state.tasks = state.tasks.map((value) => ({ ...value, acknowledged: false }));
  assert.deepEqual(
    getTeamRoster(state, now).map(({ member }) => member.id),
    ["a-owner", "z-owner"],
  );
});

test("initial selection uses roster order; valid saved selection survives changes; missing selection falls back", () => {
  const state = createDemoWorkspace();
  const roster = getTeamRoster(state, now);
  assert.equal(selectTeamMember(roster, null), roster[0]);
  assert.equal(roster[0].member.id, "member-lina-moreva");
  assert.equal(
    selectTeamMember(roster, roster.at(-1)!.member.id),
    roster.at(-1),
  );
  assert.equal(selectTeamMember(roster, "removed"), roster[0]);
  assert.equal(selectTeamMember([], "removed"), undefined);
});

test("zero-task members are truthful and current-event filtering prevents unrelated pressure", () => {
  const summary = getMemberSummary(member, [], now);
  assert.equal(summary.open, 0);
  assert.equal(summary.assigned, 0);
  assert.equal(summary.group, 3);
  assert.equal(summary.representative, undefined);
  const state = createDemoWorkspace();
  state.teamMembers = [member];
  state.tasks = [task({ eventId: "another-event", status: "blocked" })];
  assert.equal(getTeamRoster(state, now)[0].assigned, 0);
});

test("five-row preview reallocates unused slots to attention first and keeps full counts", () => {
  for (const [a, u, expected] of [
    [10, 10, [3, 2]],
    [1, 10, [1, 4]],
    [10, 1, [4, 1]],
    [10, 0, [5, 0]],
    [0, 10, [0, 5]],
    [1, 1, [1, 1]],
    [0, 0, [0, 0]],
  ] as const)
    assert.deepEqual(getPreviewLimits(a, u), {
      attention: expected[0],
      upcoming: expected[1],
    });
});

test("100-task stress counts include every task without a completed-heavy history dominating attention", () => {
  const tasks = Array.from({ length: 100 }, (_, index) =>
    task({
      id: `stress-${index}`,
      status: index < 80 ? "completed" : index < 90 ? "blocked" : "not-started",
      acknowledged: index < 85,
    }),
  );
  const summary = getMemberSummary(member, tasks, now);
  assert.equal(summary.completed.length, 80);
  assert.equal(summary.open, 20);
  assert.equal(summary.attention.length, 20);
  assert.equal(summary.blocked, 10);
  assert.equal(summary.notAccepted, 15);
  assert.equal(summary.atRisk, 10);
  assert.equal(summary.representative?.status, "blocked");
});
