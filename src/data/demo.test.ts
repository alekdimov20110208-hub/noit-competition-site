import assert from "node:assert/strict";
import test from "node:test";
import { getAttentionReasons } from "../domain/taskAttention.ts";
import {
  getCalendarDaysFromNow,
  getDeadlineTiming,
} from "../domain/taskTiming.ts";
import {
  deserializeWorkspace,
  getAffectedTasks,
  getAttentionTasks,
  getTaskCounts,
  getTeamWorkload,
  workspaceReducer,
} from "../domain/workspace.ts";
import { createI18n } from "../i18n/createI18n.ts";
import { localizeWorkspace } from "../i18n/localizeWorkspace.ts";
import {
  buildPreparationTimeline,
  getNextCheckpoint,
  partitionTeamPressure,
} from "../pages/dashboard/helpers.ts";
import { createDemoWorkspace } from "./demo.ts";
import {
  DEMO_REFERENCE_DATE,
  DEMO_REFERENCE_TIMESTAMP,
  DEMO_TIME_ZONE,
  getDemoReferenceNow,
} from "./demoTime.ts";

test("demo reference stays explicit and eleven days before the seminar regardless of the real clock", (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2035, 0, 1) });
  assert.equal(DEMO_REFERENCE_DATE, "2026-09-07");
  const baseline = createDemoWorkspace();
  const event = baseline.events[0]!;
  assert.equal(event.startDate, "2026-09-18");
  assert.equal(event.endDate, "2026-09-20");
  assert.equal(
    getCalendarDaysFromNow(event.startDate, getDemoReferenceNow()),
    11,
  );
  const first = getDemoReferenceNow();
  context.mock.timers.setTime(Date.UTC(2040, 6, 1));
  assert.equal(getDemoReferenceNow().getTime(), first.getTime());
  assert.deepEqual(createDemoWorkspace(), baseline);
  first.setFullYear(2050);
  assert.equal(getDemoReferenceNow().getFullYear(), 2026);
});

test("demo timing, relative labels and Varna timestamp presentation are stable across host timezones", () => {
  const originalZone = process.env.TZ;
  let expected: unknown;
  try {
    for (const zone of [
      "Europe/Sofia",
      "UTC",
      "America/Los_Angeles",
      "Pacific/Kiritimati",
      "Pacific/Pago_Pago",
    ]) {
      process.env.TZ = zone;
      const now = getDemoReferenceNow();
      const state = createDemoWorkspace();
      const result = {
        counts: getTaskCounts(state.tasks, now),
        timing: state.tasks.map((task) =>
          getDeadlineTiming(task.deadline, now),
        ),
        focus: getAttentionTasks(state.tasks, now, state.tasks.length).map(
          (task) => task.id,
        ),
        copy: (["bg", "en"] as const).map((language) => {
          const i18n = createI18n(language, { timeZone: DEMO_TIME_ZONE });
          return [
            i18n.formatDate(DEMO_REFERENCE_DATE),
            i18n.formatRelativeDate(state.events[0]!.startDate, now),
            i18n.formatDateTime(state.changes[0]!.reportedAt),
            i18n.formatDateTime(DEMO_REFERENCE_TIMESTAMP),
          ];
        }),
      };
      if (expected === undefined) expected = result;
      else assert.deepEqual(result, expected, zone);
    }
  } finally {
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  }
});

test("preparation has distinct timing, task status, priority and responsibility states", () => {
  const { tasks } = createDemoWorkspace();
  const now = getDemoReferenceNow();
  const open = tasks.filter((task) => task.status !== "completed");
  assert.ok(open.length > 0 && open.length < tasks.length);
  assert.deepEqual(
    new Set(tasks.map((task) => task.status)),
    new Set(["completed", "blocked", "in-progress", "not-started"]),
  );
  assert.deepEqual(
    new Set(tasks.map((task) => task.priority)),
    new Set(["critical", "important", "normal"]),
  );
  assert.deepEqual(
    new Set(open.map((task) => task.acknowledged)),
    new Set([true, false]),
  );
  assert.deepEqual(
    new Set(open.map((task) => getDeadlineTiming(task.deadline, now))),
    new Set(["overdue", "today", "near", "later"]),
  );
  const focus = getAttentionTasks(tasks, now, tasks.length);
  assert.ok(focus.length > 5 && focus.length < open.length);
  assert.equal(getAttentionTasks(tasks, now).length, 5);
  assert.deepEqual(
    new Set(focus.flatMap((task) => getAttentionReasons(task, now))),
    new Set(["blocked", "overdue", "not-accepted", "critical-deadline"]),
  );
  assert.ok(focus.some((task) => getAttentionReasons(task, now).length > 1));
  assert.ok(
    focus.some((task) => !getAttentionReasons(task, now).includes("overdue")),
  );
  assert.ok(
    open.some(
      (task) =>
        task.priority === "critical" &&
        getDeadlineTiming(task.deadline, now) === "later" &&
        getAttentionReasons(task, now).length === 0,
    ),
  );
  // The same domain helpers still honor arbitrary real-calendar reference days.
  assert.equal(
    getTaskCounts(tasks, new Date(2026, 8, 28, 12)).overdue,
    open.length,
  );
});

test("milestones and future tasks form a coherent preparation sequence", () => {
  const state = createDemoWorkspace();
  const event = state.events[0]!;
  const now = getDemoReferenceNow();
  for (const milestone of event.milestones) {
    assert.ok(milestone.date <= event.startDate);
    if (milestone.status === "upcoming")
      assert.ok(getCalendarDaysFromNow(milestone.date, now)! >= 0);
    if (milestone.status === "completed")
      assert.ok(getCalendarDaysFromNow(milestone.date, now)! <= 0);
  }
  const entries = buildPreparationTimeline(state.tasks, event.milestones, now);
  const upcomingTasks = entries.filter((entry) => entry.kind === "task");
  assert.deepEqual(
    new Set(upcomingTasks.map((entry) => entry.window)),
    new Set(["today", "near", "later"]),
  );
  assert.ok(upcomingTasks.every((entry) => entry.date < event.startDate));
  const brief = state.tasks.find(
    (task) => task.id === "task-participant-brief",
  )!;
  assert.equal(
    brief.deadline,
    event.milestones.find(
      (milestone) => milestone.id === "milestone-registration-brief",
    )!.date,
  );
  for (const id of ["task-program-draft", "task-accessibility-route"]) {
    assert.ok(
      state.tasks.find((task) => task.id === id)!.deadline < brief.deadline,
    );
  }
});

test("owned travel change and next checkpoint belong to the snapshot, with localized equivalent content", () => {
  const state = createDemoWorkspace();
  const change = state.changes[0]!;
  const affected = getAffectedTasks(change, state.tasks);
  assert.equal(affected.length, 4);
  assert.ok(
    state.teamMembers.some(
      (member) => member.id === change.ownerId && member.isOrganizer,
    ),
  );
  assert.equal(change.responseStatus, "in-progress");
  assert.ok(change.directContactRecommended);
  assert.equal(change.reportedAt.slice(0, 10), DEMO_REFERENCE_DATE);
  assert.ok(change.reportedAt < DEMO_REFERENCE_TIMESTAMP);
  for (const task of state.tasks)
    assert.ok(task.updatedAt <= DEMO_REFERENCE_TIMESTAMP);
  for (const task of affected) {
    assert.ok(task.updatedAt >= change.reportedAt);
    assert.ok(
      task.deadline >= DEMO_REFERENCE_DATE &&
        task.deadline < state.events[0]!.startDate,
    );
  }
  const checkpoint = getNextCheckpoint(affected, getDemoReferenceNow())!;
  assert.equal(checkpoint.id, "task-guest-itinerary");
  assert.equal(
    getDeadlineTiming(checkpoint.deadline, getDemoReferenceNow()),
    "today",
  );
  for (const language of ["bg", "en"] as const) {
    const localized = localizeWorkspace(state, language).changes[0]!;
    assert.match(localized.description, /18/);
    assert.match(localized.description, /14:00/);
    assert.match(localized.description, /18:30/);
    assert.equal(localized.reportedAt, change.reportedAt);
    assert.deepEqual(localized.affectedTaskIds, change.affectedTaskIds);
  }
});

test("team pressure distinguishes risk from responsibility and does not imply spare capacity", () => {
  const state = createDemoWorkspace();
  const workloads = getTeamWorkload(
    state.teamMembers,
    state.tasks,
    getDemoReferenceNow(),
  );
  const { pressure, quiet } = partitionTeamPressure(workloads);
  assert.ok(pressure.some((person) => person.blocked > 0));
  assert.ok(
    pressure.some((person) => person.overdue > 0 && person.blocked === 0),
  );
  assert.ok(
    quiet.length > 0 &&
      quiet.every((person) => person.atRisk === 0 && person.active > 0),
  );
  assert.ok(
    quiet.some((person) =>
      state.tasks.some(
        (task) => task.ownerId === person.member.id && !task.acknowledged,
      ),
    ),
  );
});

test("saved v1 workspaces are preserved until explicit reset restores an independent snapshot", () => {
  const saved = createDemoWorkspace();
  saved.tasks[3]!.deadline = "2026-08-06";
  saved.tasks[3]!.status = "completed";
  saved.tasks[3]!.updatedAt = "2026-09-28T10:00:00.000Z";
  saved.events[0]!.milestones[2]!.date = "2026-09-04";
  const serialized = JSON.stringify(saved);
  const loaded = deserializeWorkspace(serialized);
  assert.equal(JSON.stringify(loaded), serialized);
  const reset = workspaceReducer(loaded, { type: "workspace/reset" });
  assert.deepEqual(reset, createDemoWorkspace());
  assert.equal(JSON.stringify(loaded), serialized);
  reset.tasks[3]!.status = "completed";
  assert.notEqual(createDemoWorkspace().tasks[3]!.status, "completed");
});
