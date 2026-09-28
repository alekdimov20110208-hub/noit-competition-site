import assert from "node:assert/strict";
import test from "node:test";
import { TASK_STATUS_MESSAGE_KEYS } from "./labels.ts";
import { getAttentionReasons } from "./taskAttention.ts";
import {
  getCalendarDayNumber,
  getDeadlineTiming,
  isUpcomingTask,
} from "./taskTiming.ts";
import type { Task } from "./types.ts";
import {
  createDemoWorkspace,
  deserializeWorkspace,
  getAttentionTasks,
  getTaskCounts,
  getTeamWorkload,
  getUpcomingTasks,
  isTaskOverdue,
  workspaceReducer,
} from "./workspace.ts";
import {
  buildPreparationTimeline,
  getAttentionReason,
  getNextCheckpoint,
  getPreparationWindow,
} from "../pages/dashboard/helpers.ts";
import { compareOperationalTasks } from "../pages/tasks/helpers.ts";
import { createI18n } from "../i18n/createI18n.ts";

function task(values: Partial<Task> = {}): Task {
  return {
    id: "test",
    eventId: "event",
    title: "Synthetic test task",
    category: "Test",
    ownerId: "owner",
    deadline: "2026-08-20",
    status: "not-started",
    priority: "normal",
    context: "Test",
    acknowledged: true,
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...values,
  };
}
const NOW = new Date(2026, 7, 12, 12);

test("attention eligibility is explicit, open-only, and independent of dependency prose", () => {
  const cases: [Partial<Task>, string[]][] = [
    [{ deadline: "2026-08-11" }, ["overdue"]],
    [{ status: "blocked" }, ["blocked"]],
    [{ acknowledged: false }, ["not-accepted"]],
    [{ priority: "important" }, []],
    [{ priority: "critical" }, []],
    [{ priority: "critical", deadline: "2026-08-12" }, ["critical-deadline"]],
    [{ priority: "critical", deadline: "2026-08-13" }, ["critical-deadline"]],
    [{ priority: "critical", deadline: "2026-08-19" }, ["critical-deadline"]],
    [{ priority: "critical", deadline: "2026-08-20" }, []],
    [
      {
        status: "completed",
        priority: "critical",
        acknowledged: false,
        deadline: "2026-08-11",
      },
      [],
    ],
    [{ blockedBy: "Waiting for an answer" }, []],
    [
      { status: "blocked", deadline: "2026-08-11", acknowledged: false },
      ["blocked", "overdue", "not-accepted"],
    ],
    [
      { priority: "critical", deadline: "2026-08-19", acknowledged: false },
      ["not-accepted", "critical-deadline"],
    ],
  ];
  for (const [values, reasons] of cases) {
    const subject = task(values);
    assert.deepEqual(getAttentionReasons(subject, NOW), reasons);
    assert.equal(
      getAttentionTasks([subject], NOW).length,
      reasons.length ? 1 : 0,
    );
  }
});

test("attention classes share failure precedence, then deadline, reasons, acceptance, impact, ID", () => {
  const subjects = [
    task({ id: "late-critical", priority: "critical", deadline: "2026-08-13" }),
    task({ id: "early-overdue", deadline: "2026-08-01" }),
    task({
      id: "middle-blocked-overdue",
      status: "blocked",
      deadline: "2026-08-02",
    }),
    task({ id: "later-overdue", deadline: "2026-08-03" }),
    task({ id: "future-blocked", status: "blocked", deadline: "2026-09-01" }),
    task({
      id: "unaccepted-later",
      acknowledged: false,
      deadline: "2026-08-20",
    }),
  ];
  const expected = [
    "early-overdue",
    "middle-blocked-overdue",
    "later-overdue",
    "future-blocked",
    "late-critical",
    "unaccepted-later",
  ];
  assert.deepEqual(
    getAttentionTasks(subjects, NOW, 20).map(({ id }) => id),
    expected,
  );
  assert.deepEqual(
    getAttentionTasks([...subjects].reverse(), NOW, 20).map(({ id }) => id),
    expected,
  );
  // Same failure class/date: multiple reasons beat a lone high-impact problem.
  const tied = [
    task({ id: "critical", priority: "critical", deadline: "2026-08-01" }),
    task({
      id: "multiple",
      status: "blocked",
      acknowledged: false,
      deadline: "2026-08-01",
    }),
    task({ id: "z-normal", deadline: "2026-08-01" }),
    task({ id: "a-normal", deadline: "2026-08-01" }),
    task({ id: "unaccepted", acknowledged: false, deadline: "2026-08-01" }),
    task({ id: "blocked", status: "blocked", deadline: "2026-08-01" }),
  ];
  assert.deepEqual(
    getAttentionTasks(tied, NOW, 20).map(({ id }) => id),
    ["multiple", "unaccepted", "blocked", "critical", "a-normal", "z-normal"],
  );
  // Acceptance is a later tie-breaker when both tasks have one reason.
  assert.deepEqual(
    getAttentionTasks(
      [
        task({ id: "critical", priority: "critical", deadline: "2026-08-13" }),
        task({ id: "unaccepted", acknowledged: false, deadline: "2026-08-13" }),
      ],
      NOW,
    ).map(({ id }) => id),
    ["unaccepted", "critical"],
  );
});

test("all timing consumers agree at local calendar boundaries in positive and negative UTC offsets", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["Europe/Kyiv", "America/Los_Angeles", "UTC"]) {
      process.env.TZ = zone;
      const noon = new Date(2026, 7, 12, 12);
      for (const [date, expected] of [
        ["2026-08-11", "overdue"],
        ["2026-08-12", "today"],
        ["2026-08-13", "near"],
        ["2026-08-19", "near"],
        ["2026-08-20", "later"],
      ] as const) {
        assert.equal(
          getDeadlineTiming(date, noon),
          expected,
          `${zone} ${date}`,
        );
      }
      const subject = task({ deadline: "2026-08-12", priority: "critical" });
      const members = [
        { id: "owner", name: "Owner", role: "Test", isOrganizer: true },
      ];
      for (const [now, overdue] of [
        [new Date(2026, 7, 12, 23, 59, 59, 999), false],
        [new Date(2026, 7, 13, 0, 0, 0, 0), true],
      ] as const) {
        assert.equal(isTaskOverdue(subject, now), overdue, zone);
        assert.equal(isUpcomingTask(subject, now), !overdue, zone);
        assert.equal(getUpcomingTasks([subject], now).length, overdue ? 0 : 1);
        assert.equal(
          buildPreparationTimeline([subject], [], now).length,
          overdue ? 0 : 1,
        );
        assert.equal(
          getPreparationWindow(subject.deadline, now),
          overdue ? "current" : "today",
        );
        assert.equal(getTaskCounts([subject], now).overdue, Number(overdue));
        assert.equal(
          getTeamWorkload(members, [subject], now)[0]?.atRisk,
          Number(overdue),
        );
        assert.deepEqual(getAttentionReasons(subject, now), [
          overdue ? "overdue" : "critical-deadline",
        ]);
        const blocker = task({
          id: "blocker",
          status: "blocked",
          deadline: "2026-08-14",
        });
        assert.equal(
          Math.sign(compareOperationalTasks(subject, blocker, now)),
          overdue ? -1 : 1,
        );
        assert.equal(
          getNextCheckpoint([subject, blocker], now)?.id,
          overdue ? "blocker" : "test",
        );
      }
      // Day arithmetic remains calendar based over the DST jump.
      assert.equal(
        getDeadlineTiming("2026-03-30", new Date(2026, 2, 29, 0)),
        "near",
      );
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("invalid dates are never future or overdue; milestones retain their persisted lifecycle", () => {
  for (const date of [
    "invalid",
    "2026-02-30",
    "2026-13-01",
    "2026-08-12T00:00:00Z",
  ]) {
    assert.equal(getCalendarDayNumber(date), null);
    assert.equal(getDeadlineTiming(date, NOW), "invalid");
    assert.equal(isTaskOverdue(task({ deadline: date }), NOW), false);
    assert.equal(isUpcomingTask(task({ deadline: date }), NOW), false);
  }
  assert.equal(getDeadlineTiming("2026-08-12", new Date("invalid")), "invalid");
  const milestone = {
    id: "past-upcoming",
    title: "Test",
    date: "2026-08-11",
    status: "upcoming" as const,
  };
  const entries = buildPreparationTimeline([], [milestone], NOW);
  assert.equal(entries[0]?.window, "current");
  assert.equal(milestone.status, "upcoming");
});

test("reason presentation retains every reason in EN and BG without inventing blocked status", () => {
  for (const language of ["en", "bg"] as const) {
    const i18n = createI18n(language);
    const subject = task({
      status: "blocked",
      deadline: "2026-08-11",
      acknowledged: false,
      blockedBy: "Dependency detail",
    });
    const reason = getAttentionReason(subject, NOW, i18n);
    for (const part of [
      i18n.t("status.task.blocked"),
      "Dependency detail",
      i18n.t("taskDetails.overdue"),
      i18n.t("dashboard.attention.awaitingAcknowledgement"),
    ])
      assert.ok(reason.includes(part));
    const near = getAttentionReason(
      task({
        priority: "critical",
        deadline: "2026-08-19",
        acknowledged: false,
      }),
      NOW,
      i18n,
    );
    assert.ok(near.includes(i18n.t("dashboard.attention.criticalNear")));
    assert.ok(
      near.includes(i18n.t("dashboard.attention.awaitingAcknowledgement")),
    );
    assert.equal(
      getAttentionReason(task({ blockedBy: "Dependency detail" }), NOW, i18n),
      "",
    );
  }
});

test("at risk stays narrower than needs attention; acceptance and four lifecycle values persist independently", () => {
  const state = createDemoWorkspace();
  const base = state.tasks[0]!;
  for (const status of Object.keys(
    TASK_STATUS_MESSAGE_KEYS,
  ) as Task["status"][]) {
    const initial = { ...state, tasks: [{ ...base, acknowledged: false }] };
    const updated = workspaceReducer(initial, {
      type: "task/status",
      taskId: base.id,
      status,
    });
    assert.equal(updated.tasks[0]?.acknowledged, false);
    assert.equal(
      deserializeWorkspace(JSON.stringify(updated)).tasks[0]?.status,
      status,
    );
  }
  assert.deepEqual(Object.keys(TASK_STATUS_MESSAGE_KEYS), [
    "not-started",
    "in-progress",
    "blocked",
    "completed",
  ]);
  const invalid = { ...state, tasks: [{ ...base, status: "upcoming" }] };
  assert.deepEqual(
    deserializeWorkspace(JSON.stringify(invalid)),
    createDemoWorkspace(),
  );
  const subjects = [
    task({ id: "near", priority: "critical", deadline: "2026-08-13" }),
    task({ id: "unaccepted", acknowledged: false }),
  ];
  assert.equal(getAttentionTasks(subjects, NOW).length, 2);
  assert.equal(
    getTeamWorkload(
      [{ id: "owner", name: "Owner", role: "Test", isOrganizer: true }],
      subjects,
      NOW,
    )[0]?.atRisk,
    0,
  );
});
