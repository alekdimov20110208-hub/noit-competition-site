import type { I18nApi, MessageKey } from "../../i18n/index.ts";
import type { EventChange, EventMilestone, Task } from "../../domain/types.ts";
import {
  HIGH_ACTIVE_LOAD_THRESHOLD,
  type TeamWorkload,
} from "../../domain/workspace.ts";
import { getAttentionReasons } from "../../domain/taskAttention.ts";
import {
  compareDeadlineDates,
  getCalendarDayNumber,
  getDeadlineTiming,
  isUpcomingTask,
} from "../../domain/taskTiming.ts";
import { TASK_STATUS_MESSAGE_KEYS } from "../../domain/labels.ts";
import type { OverviewEvent } from "../../services/workspaceViews.ts";

export function eventDateMilestones(
  event: OverviewEvent,
  now: Date,
  startTitle: string,
  endTitle: string,
): EventMilestone[] {
  if (event.milestones) return event.milestones;
  return [
    { id: `${event.id}:start`, title: startTitle, date: event.startDate },
    { id: `${event.id}:end`, title: endTitle, date: event.endDate },
  ].map((milestone) => ({
    ...milestone,
    status:
      getDeadlineTiming(milestone.date, now) === "overdue"
        ? "completed"
        : getDeadlineTiming(milestone.date, now) === "today"
          ? "current"
          : "upcoming",
  }));
}

export function getAttentionActionKey(
  task: Task,
  overdue: boolean,
): MessageKey {
  if (task.status === "blocked") {
    return "dashboard.attention.action.resolveBlocker";
  }
  if (overdue) return "dashboard.attention.action.reviewOverdue";
  if (!task.acknowledged) {
    return "dashboard.attention.action.acknowledge";
  }
  return "dashboard.attention.action.reviewCritical";
}

export function getAttentionReason(
  task: Task,
  now: Date,
  i18n: I18nApi,
): string {
  return getAttentionReasons(task, now)
    .map((reason) => {
      switch (reason) {
        case "blocked":
          return `${i18n.t(TASK_STATUS_MESSAGE_KEYS.blocked)}${task.blockedBy ? `: ${task.blockedBy}` : ""}`;
        case "overdue":
          return i18n.t("taskDetails.overdue");
        case "not-accepted":
          return i18n.t("dashboard.attention.awaitingAcknowledgement");
        case "critical-deadline":
          return i18n.t(
            getDeadlineTiming(task.deadline, now) === "today"
              ? "dashboard.attention.criticalToday"
              : "dashboard.attention.criticalNear",
          );
      }
    })
    .join(" · ");
}

export function getNextCheckpoint(tasks: Task[], now: Date): Task | undefined {
  const sorted = tasks
    .filter(
      (task) =>
        task.status !== "completed" &&
        getCalendarDayNumber(task.deadline) !== null,
    )
    .sort(
      (first, second) =>
        compareDeadlineDates(first.deadline, second.deadline) ||
        first.id.localeCompare(second.id),
    );
  return sorted.find((task) => isUpcomingTask(task, now)) ?? sorted[0];
}

export type WorkloadSignal =
  "blocked" | "overdue" | "high" | "unassigned" | "clear";

export function getWorkloadSignal(workload: TeamWorkload): WorkloadSignal {
  if (workload.blocked > 0) return "blocked";
  if (workload.overdue > 0) return "overdue";
  if (workload.active >= HIGH_ACTIVE_LOAD_THRESHOLD) return "high";
  if (workload.assigned === 0) return "unassigned";
  return "clear";
}

export type PreparationWindow = "current" | "today" | "near" | "later";

export type PreparationTimelineEntry =
  | {
      id: string;
      kind: "task";
      date: string;
      task: Task;
      window: PreparationWindow;
    }
  | {
      id: string;
      kind: "milestone";
      date: string;
      milestone: EventMilestone;
      window: PreparationWindow;
    };

export function getPreparationWindow(
  date: string,
  now: Date,
): PreparationWindow {
  const timing = getDeadlineTiming(date, now);
  if (timing === "overdue") return "current";
  return timing === "invalid" ? "later" : timing;
}

export function buildPreparationTimeline(
  tasks: Task[],
  milestones: EventMilestone[],
  now: Date,
): PreparationTimelineEntry[] {
  if (!Number.isFinite(now.getTime())) return [];

  const taskEntries: PreparationTimelineEntry[] = tasks.flatMap((task) => {
    if (!isUpcomingTask(task, now)) return [];
    return [
      {
        id: `task:${task.id}`,
        kind: "task" as const,
        date: task.deadline,
        task,
        window: getPreparationWindow(task.deadline, now),
      },
    ];
  });
  const milestoneEntries: PreparationTimelineEntry[] = milestones.flatMap(
    (milestone) => {
      if (
        milestone.status === "completed" ||
        getCalendarDayNumber(milestone.date) === null
      ) {
        return [];
      }
      return [
        {
          id: `milestone:${milestone.id}`,
          kind: "milestone" as const,
          date: milestone.date,
          milestone,
          window: getPreparationWindow(milestone.date, now),
        },
      ];
    },
  );

  return [...taskEntries, ...milestoneEntries].sort(
    (first, second) =>
      first.date.localeCompare(second.date) ||
      first.id.localeCompare(second.id),
  );
}

export function getActiveChanges(changes: EventChange[]): EventChange[] {
  return changes.filter((change) => change.responseStatus !== "resolved");
}

export interface TeamPressurePartition {
  pressure: TeamWorkload[];
  quiet: TeamWorkload[];
}

export function partitionTeamPressure(
  workloads: TeamWorkload[],
): TeamPressurePartition {
  return workloads.reduce<TeamPressurePartition>(
    (partition, workload) => {
      const signal = getWorkloadSignal(workload);
      if (signal === "blocked" || signal === "overdue" || signal === "high") {
        partition.pressure.push(workload);
      } else {
        partition.quiet.push(workload);
      }
      return partition;
    },
    { pressure: [], quiet: [] },
  );
}
