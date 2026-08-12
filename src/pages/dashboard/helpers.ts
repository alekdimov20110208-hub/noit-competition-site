import type { I18nApi, MessageKey } from "../../i18n/index.ts";
import type { EventChange, EventMilestone, Task } from "../../domain/types.ts";
import {
  HIGH_ACTIVE_LOAD_THRESHOLD,
  type TeamWorkload,
} from "../../domain/workspace.ts";
import { TASK_STATUS_MESSAGE_KEYS } from "../../domain/labels.ts";

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
  overdue: boolean,
  i18n: I18nApi,
): string {
  if (task.status === "blocked") {
    const blocker = task.blockedBy ?? i18n.t(TASK_STATUS_MESSAGE_KEYS.blocked);
    return overdue
      ? `${blocker} · ${i18n.t("dashboard.attention.deadlineMissed")}`
      : blocker;
  }
  if (overdue) {
    return i18n.t("dashboard.attention.deadlineMissed");
  }
  if (!task.acknowledged) {
    return i18n.t("dashboard.attention.awaitingAcknowledgement");
  }
  return i18n.t(TASK_STATUS_MESSAGE_KEYS[task.status]);
}

export function getNextCheckpoint(tasks: Task[], now: Date): Task | undefined {
  const sorted = tasks
    .filter((task) => task.status !== "completed")
    .sort(
      (first, second) =>
        first.deadline.localeCompare(second.deadline) ||
        first.id.localeCompare(second.id),
    );
  const currentTime = now.getTime();
  return (
    sorted.find(
      (task) => Date.parse(`${task.deadline}T23:59:59.999Z`) >= currentTime,
    ) ?? sorted[0]
  );
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

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function getLocalDayTimestamp(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDateOnlyTimestamp(value: string): number | null {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getPreparationWindow(
  date: string,
  now: Date,
): PreparationWindow {
  const timestamp = getDateOnlyTimestamp(date);
  if (timestamp === null || !Number.isFinite(now.getTime())) return "later";

  const dayDifference = Math.round(
    (timestamp - getLocalDayTimestamp(now)) / DAY_IN_MILLISECONDS,
  );
  if (dayDifference < 0) return "current";
  if (dayDifference === 0) return "today";
  if (dayDifference <= 7) return "near";
  return "later";
}

export function buildPreparationTimeline(
  tasks: Task[],
  milestones: EventMilestone[],
  now: Date,
): PreparationTimelineEntry[] {
  if (!Number.isFinite(now.getTime())) return [];

  const currentDay = getLocalDayTimestamp(now);
  const taskEntries: PreparationTimelineEntry[] = tasks.flatMap((task) => {
    const timestamp = getDateOnlyTimestamp(task.deadline);
    if (
      timestamp === null ||
      timestamp < currentDay ||
      task.status === "completed"
    ) {
      return [];
    }
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
        getDateOnlyTimestamp(milestone.date) === null
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
