import type {
  ChangeResponseStatus,
  ChangeSeverity,
  TaskPriority,
  TaskStatus,
} from "./types.ts";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  normal: "Normal",
  important: "Important",
  critical: "Critical",
};

export const CHANGE_STATUS_LABELS: Record<ChangeResponseStatus, string> = {
  reported: "Reported",
  "in-progress": "Response in progress",
  resolved: "Resolved",
};

export const CHANGE_SEVERITY_LABELS: Record<ChangeSeverity, string> = {
  low: "Low",
  medium: "Medium",
  critical: "Critical",
};
