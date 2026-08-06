import type { I18nApi, MessageKey } from "../../i18n/index.ts";
import type {
  ChangeResponseStatus,
  ChangeSeverity,
  Task,
  TaskPriority,
} from "../../domain/types.ts";
import {
  HIGH_ACTIVE_LOAD_THRESHOLD,
  type TeamWorkload,
} from "../../domain/workspace.ts";
import { TASK_STATUS_MESSAGE_KEYS } from "../../domain/labels.ts";

export function taskPriorityTone(priority: TaskPriority) {
  if (priority === "critical") return "critical" as const;
  if (priority === "important") return "warning" as const;
  return "neutral" as const;
}

export function changeSeverityTone(severity: ChangeSeverity) {
  if (severity === "critical") return "critical" as const;
  if (severity === "medium") return "warning" as const;
  return "neutral" as const;
}

export function changeResponseTone(status: ChangeResponseStatus) {
  if (status === "resolved") return "success" as const;
  if (status === "in-progress") return "progress" as const;
  return "neutral" as const;
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
  overdue: boolean,
  i18n: I18nApi,
): string {
  if (task.status === "blocked") {
    const blocker = task.blockedBy ?? i18n.t(TASK_STATUS_MESSAGE_KEYS.blocked);
    return overdue
      ? `${blocker} · ${i18n.t("dashboard.attention.overdueDate", {
          date: i18n.formatDate(task.deadline),
        })}`
      : blocker;
  }
  if (overdue) {
    return i18n.t("dashboard.attention.overdueDate", {
      date: i18n.formatDate(task.deadline),
    });
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

export function workloadSignalTone(signal: WorkloadSignal) {
  if (signal === "blocked") return "blocked" as const;
  if (signal === "overdue" || signal === "high") return "warning" as const;
  if (signal === "clear") return "success" as const;
  return "neutral" as const;
}
