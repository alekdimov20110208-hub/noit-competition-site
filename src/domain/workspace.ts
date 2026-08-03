import { createDemoWorkspace } from "../data/demo.ts";
import type {
  ChangeResponseStatus,
  ChangeSeverity,
  Event,
  EventChange,
  EventMilestone,
  EventMilestoneStatus,
  EventStatus,
  EventTemplate,
  EventTemplateArea,
  Task,
  TaskPriority,
  TaskStatus,
  TeamMember,
  WorkspaceState,
} from "./types.ts";

export { createDemoWorkspace };

export const WORKSPACE_STORAGE_KEY = "budograph.workspace.v1";

const EVENT_STATUSES: readonly EventStatus[] = [
  "planning",
  "ready",
  "completed",
];
const MILESTONE_STATUSES: readonly EventMilestoneStatus[] = [
  "completed",
  "current",
  "upcoming",
];
const TASK_STATUSES: readonly TaskStatus[] = [
  "not-started",
  "in-progress",
  "blocked",
  "completed",
];
const TASK_PRIORITIES: readonly TaskPriority[] = [
  "normal",
  "important",
  "critical",
];
const CHANGE_SEVERITIES: readonly ChangeSeverity[] = [
  "low",
  "medium",
  "critical",
];
const CHANGE_RESPONSE_STATUSES: readonly ChangeResponseStatus[] = [
  "reported",
  "in-progress",
  "resolved",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isDateOnly(value: unknown): value is string {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === (month ?? 0) - 1 &&
    parsed.getUTCDate() === day
  );
}

function isDateTime(value: unknown): value is string {
  if (
    !isString(value) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isAllowedValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
): value is T {
  return isString(value) && allowedValues.includes(value as T);
}

function isEventMilestone(value: unknown): value is EventMilestone {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isDateOnly(value.date) &&
    isAllowedValue(value.status, MILESTONE_STATUSES)
  );
}

function isEvent(value: unknown): value is Event {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.location) &&
    isDateOnly(value.startDate) &&
    isDateOnly(value.endDate) &&
    isAllowedValue(value.status, EVENT_STATUSES) &&
    isString(value.leadOrganizerId) &&
    isString(value.guestInstructor) &&
    Array.isArray(value.milestones) &&
    value.milestones.every(isEventMilestone)
  );
}

function isTeamMember(value: unknown): value is TeamMember {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.role) &&
    isBoolean(value.isOrganizer)
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.eventId) &&
    isString(value.title) &&
    isString(value.category) &&
    isString(value.ownerId) &&
    isDateOnly(value.deadline) &&
    isAllowedValue(value.status, TASK_STATUSES) &&
    isAllowedValue(value.priority, TASK_PRIORITIES) &&
    isString(value.context) &&
    isOptionalString(value.blockedBy) &&
    isOptionalString(value.blocks) &&
    isBoolean(value.acknowledged) &&
    isDateTime(value.updatedAt)
  );
}

function isEventChange(value: unknown): value is EventChange {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.eventId) &&
    isString(value.title) &&
    isString(value.description) &&
    isAllowedValue(value.severity, CHANGE_SEVERITIES) &&
    isDateTime(value.reportedAt) &&
    isStringArray(value.affectedTaskIds) &&
    isStringArray(value.affectedAreas) &&
    isString(value.ownerId) &&
    isString(value.response) &&
    isAllowedValue(value.responseStatus, CHANGE_RESPONSE_STATUSES) &&
    isBoolean(value.acknowledged) &&
    isBoolean(value.directContactRecommended) &&
    isString(value.escalationRecommendation)
  );
}

function isEventTemplateArea(value: unknown): value is EventTemplateArea {
  return isRecord(value) && isString(value.name) && isStringArray(value.items);
}

function isEventTemplate(value: unknown): value is EventTemplate {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.description) &&
    typeof value.durationDays === "number" &&
    Number.isInteger(value.durationDays) &&
    value.durationDays > 0 &&
    Array.isArray(value.areas) &&
    value.areas.every(isEventTemplateArea)
  );
}

function isWorkspaceState(value: unknown): value is WorkspaceState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isString(value.currentEventId) &&
    isString(value.demoLabel) &&
    Array.isArray(value.events) &&
    value.events.length > 0 &&
    value.events.every(isEvent) &&
    value.events.some((event) => event.id === value.currentEventId) &&
    Array.isArray(value.teamMembers) &&
    value.teamMembers.every(isTeamMember) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask) &&
    Array.isArray(value.changes) &&
    value.changes.every(isEventChange) &&
    Array.isArray(value.templates) &&
    value.templates.every(isEventTemplate)
  );
}

export function deserializeWorkspace(
  serialized: string | null | undefined,
): WorkspaceState {
  if (!serialized) return createDemoWorkspace();

  try {
    const parsed: unknown = JSON.parse(serialized);
    return isWorkspaceState(parsed) ? parsed : createDemoWorkspace();
  } catch {
    return createDemoWorkspace();
  }
}

function getDeadlineTimestamp(deadline: string): number | null {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(deadline)
    ? `${deadline}T23:59:59.999Z`
    : deadline;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isTaskOverdue(task: Task, now = new Date()): boolean {
  if (task.status === "completed") return false;

  const deadline = getDeadlineTimestamp(task.deadline);
  const currentTime = now.getTime();
  return (
    deadline !== null && Number.isFinite(currentTime) && deadline < currentTime
  );
}

export function getReadinessPercent(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => task.status === "completed").length;
  return Math.round((completed / tasks.length) * 100);
}

export interface TaskCounts {
  completed: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  total: number;
}

export function getTaskCounts(tasks: Task[], now = new Date()): TaskCounts {
  return {
    completed: tasks.filter((task) => task.status === "completed").length,
    inProgress: tasks.filter((task) => task.status === "in-progress").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    overdue: tasks.filter((task) => isTaskOverdue(task, now)).length,
    total: tasks.length,
  };
}

function normalizeLimit(limit: number): number {
  return Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
}

function compareTaskDeadlines(first: Task, second: Task): number {
  const firstDeadline =
    getDeadlineTimestamp(first.deadline) ?? Number.POSITIVE_INFINITY;
  const secondDeadline =
    getDeadlineTimestamp(second.deadline) ?? Number.POSITIVE_INFINITY;
  return firstDeadline - secondDeadline || first.id.localeCompare(second.id);
}

export function getUpcomingTasks(
  tasks: Task[],
  now = new Date(),
  limit = 5,
): Task[] {
  const currentTime = now.getTime();
  if (!Number.isFinite(currentTime)) return [];

  return tasks
    .filter((task) => {
      const deadline = getDeadlineTimestamp(task.deadline);
      return (
        task.status !== "completed" &&
        deadline !== null &&
        deadline >= currentTime
      );
    })
    .sort(compareTaskDeadlines)
    .slice(0, normalizeLimit(limit));
}

function getAttentionScore(task: Task, now: Date): number {
  let score = 0;
  if (task.priority === "critical") score += 16;
  if (isTaskOverdue(task, now)) score += 8;
  if (task.status === "blocked") score += 4;
  if (!task.acknowledged) score += 2;
  if (task.priority === "important") score += 1;
  return score;
}

export function getAttentionTasks(
  tasks: Task[],
  now = new Date(),
  limit = 5,
): Task[] {
  return tasks
    .filter(
      (task) =>
        task.status !== "completed" &&
        (task.priority === "critical" ||
          task.status === "blocked" ||
          isTaskOverdue(task, now) ||
          !task.acknowledged),
    )
    .sort((first, second) => {
      const scoreDifference =
        getAttentionScore(second, now) - getAttentionScore(first, now);
      return scoreDifference || compareTaskDeadlines(first, second);
    })
    .slice(0, normalizeLimit(limit));
}

export interface TeamWorkload {
  member: TeamMember;
  assigned: number;
  completed: number;
  atRisk: number;
  active: number;
}

export function getTeamWorkload(
  members: TeamMember[],
  tasks: Task[],
  now = new Date(),
): TeamWorkload[] {
  return members.map((member) => {
    const assignedTasks = tasks.filter((task) => task.ownerId === member.id);
    const activeTasks = assignedTasks.filter(
      (task) => task.status !== "completed",
    );

    return {
      member,
      assigned: assignedTasks.length,
      completed: assignedTasks.filter((task) => task.status === "completed")
        .length,
      atRisk: activeTasks.filter(
        (task) => task.status === "blocked" || isTaskOverdue(task, now),
      ).length,
      active: activeTasks.length,
    };
  });
}

export function getAffectedTasks(change: EventChange, tasks: Task[]): Task[] {
  const tasksById = new Map(
    tasks
      .filter((task) => task.eventId === change.eventId)
      .map((task) => [task.id, task]),
  );

  return change.affectedTaskIds.flatMap((taskId) => {
    const task = tasksById.get(taskId);
    return task ? [task] : [];
  });
}

export type WorkspaceAction =
  | {
      type: "task/status";
      taskId: string;
      status: TaskStatus;
      updatedAt?: string;
    }
  | {
      type: "task/toggle-acknowledgement";
      taskId: string;
      updatedAt?: string;
    }
  | { type: "change/acknowledge"; changeId: string }
  | {
      type: "change/status";
      changeId: string;
      status: ChangeResponseStatus;
    }
  | { type: "workspace/reset" };

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case "task/status": {
      const taskIndex = state.tasks.findIndex(
        (task) => task.id === action.taskId,
      );
      if (taskIndex < 0 || state.tasks[taskIndex]?.status === action.status) {
        return state;
      }

      return {
        ...state,
        tasks: state.tasks.map((task, index) =>
          index === taskIndex
            ? {
                ...task,
                status: action.status,
                updatedAt: action.updatedAt ?? task.updatedAt,
              }
            : task,
        ),
      };
    }

    case "task/toggle-acknowledgement": {
      const taskIndex = state.tasks.findIndex(
        (task) => task.id === action.taskId,
      );
      if (taskIndex < 0) return state;

      return {
        ...state,
        tasks: state.tasks.map((task, index) =>
          index === taskIndex
            ? {
                ...task,
                acknowledged: !task.acknowledged,
                updatedAt: action.updatedAt ?? task.updatedAt,
              }
            : task,
        ),
      };
    }

    case "change/acknowledge": {
      const changeIndex = state.changes.findIndex(
        (change) => change.id === action.changeId,
      );
      if (changeIndex < 0 || state.changes[changeIndex]?.acknowledged) {
        return state;
      }

      return {
        ...state,
        changes: state.changes.map((change, index) =>
          index === changeIndex ? { ...change, acknowledged: true } : change,
        ),
      };
    }

    case "change/status": {
      const changeIndex = state.changes.findIndex(
        (change) => change.id === action.changeId,
      );
      if (
        changeIndex < 0 ||
        state.changes[changeIndex]?.responseStatus === action.status
      ) {
        return state;
      }

      return {
        ...state,
        changes: state.changes.map((change, index) =>
          index === changeIndex
            ? { ...change, responseStatus: action.status }
            : change,
        ),
      };
    }

    case "workspace/reset":
      return createDemoWorkspace();
  }
}
