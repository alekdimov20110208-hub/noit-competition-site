import type {
  ChangeResponseStatus,
  ChangeSeverity,
  TaskPriority,
  TaskStatus,
} from "./types.ts";
import type { MessageKey } from "../i18n/messages.ts";

export const TASK_STATUS_MESSAGE_KEYS: Record<TaskStatus, MessageKey> = {
  "not-started": "status.task.notStarted",
  "in-progress": "status.task.inProgress",
  blocked: "status.task.blocked",
  completed: "status.task.completed",
};

export const TASK_PRIORITY_MESSAGE_KEYS: Record<TaskPriority, MessageKey> = {
  normal: "priority.normal",
  important: "priority.important",
  critical: "priority.critical",
};

export const CHANGE_STATUS_MESSAGE_KEYS: Record<
  ChangeResponseStatus,
  MessageKey
> = {
  reported: "status.change.reported",
  "in-progress": "status.change.inProgress",
  resolved: "status.change.resolved",
};

export const CHANGE_SEVERITY_MESSAGE_KEYS: Record<ChangeSeverity, MessageKey> =
  {
    low: "severity.low",
    medium: "severity.medium",
    critical: "severity.critical",
  };
