import {
  ClipboardCheck,
  LayoutDashboard,
  RefreshCcw,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "./i18n/index.ts";

export type AppPath =
  | "/"
  | "/tasks"
  | "/team"
  | "/changes"
  | "/templates"
  | "/account"
  | "/events"
  | "/history";

export function isGlobalAppPath(path: AppPath): boolean {
  return path === "/account" || path === "/events";
}

export type AppLocation = (
  | {
      path: "/tasks";
      taskId: string | null;
    }
  | {
      path: Exclude<AppPath, "/tasks">;
      taskId: null;
    }
) & {
  eventId: string | null;
  eventMode: "workspace" | "create" | "edit";
  changeId?: string | null;
};

export interface AppRoute {
  path: AppPath;
  labelKey: MessageKey;
  mobileLabelKey: MessageKey;
  icon: LucideIcon;
}

export const APP_ROUTES: AppRoute[] = [
  {
    path: "/",
    labelKey: "nav.dashboard",
    mobileLabelKey: "nav.dashboard.mobile",
    icon: LayoutDashboard,
  },
  {
    path: "/tasks",
    labelKey: "nav.tasks",
    mobileLabelKey: "nav.tasks",
    icon: ClipboardCheck,
  },
  {
    path: "/team",
    labelKey: "nav.team",
    mobileLabelKey: "nav.team",
    icon: Users,
  },
  {
    path: "/changes",
    labelKey: "nav.changes",
    mobileLabelKey: "nav.changes.mobile",
    icon: ShieldAlert,
  },
  {
    path: "/templates",
    labelKey: "nav.templates",
    mobileLabelKey: "nav.templates",
    icon: RefreshCcw,
  },
];

function decodeQueryPart(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

function getTaskId(search: string): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  if (!query) return null;

  const taskValues: Array<string | null> = [];

  for (const part of query.split("&")) {
    const separatorIndex = part.indexOf("=");
    const rawKey = separatorIndex >= 0 ? part.slice(0, separatorIndex) : part;
    const key = decodeQueryPart(rawKey);

    if (key !== "task") continue;

    const rawValue = separatorIndex >= 0 ? part.slice(separatorIndex + 1) : "";
    taskValues.push(decodeQueryPart(rawValue));
  }

  if (taskValues.length !== 1) return null;

  const taskId = taskValues[0];
  return taskId && taskId.trim().length > 0 ? taskId : null;
}

export function normalizePath(pathname: string): AppPath {
  const withoutTrailingSlash = pathname.replace(/\/+$/, "");
  const normalized = withoutTrailingSlash || "/";
  if (normalized === "/account" || normalized === "/events") return normalized;
  const route = APP_ROUTES.find((candidate) => candidate.path === normalized);
  return route?.path ?? "/";
}

export function parseAppLocation(
  pathname: string,
  search: string,
): AppLocation {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const changeDetail =
    /^\/events\/([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})\/changes\/([^/]+)$/i.exec(
      normalized,
    );
  if (changeDetail) {
    return {
      path: "/changes",
      taskId: null,
      eventId: changeDetail[1].toLowerCase(),
      eventMode: "workspace",
      changeId: changeDetail[2].toLowerCase(),
    };
  }
  if (normalized === "/events/new")
    return { path: "/", taskId: null, eventId: null, eventMode: "create" };
  const scoped =
    /^\/events\/([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})\/(dashboard|tasks|team|changes|templates|edit|history)$/i.exec(
      normalized,
    );
  const eventId = scoped?.[1]?.toLowerCase() ?? null;
  const eventMode =
    scoped?.[2]?.toLowerCase() === "edit" ? "edit" : "workspace";
  const page = scoped?.[2]?.toLowerCase();
  const path = scoped
    ? page === "dashboard" || page === "edit"
      ? "/"
      : (`/${page}` as AppPath)
    : normalizePath(pathname);

  if (path === "/tasks") {
    return { path, taskId: getTaskId(search), eventId, eventMode };
  }

  return { path, taskId: null, eventId, eventMode };
}

export function eventHref(
  eventId: string,
  path: AppPath = "/",
  taskId?: string | null,
): string {
  if (isGlobalAppPath(path)) return path;
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(eventId)
  )
    throw new Error("Invalid Event route.");
  const base = `/events/${eventId.toLowerCase()}/${path === "/" ? "dashboard" : path.slice(1)}`;
  return path === "/tasks" && taskId?.trim()
    ? `${base}?task=${encodeURIComponent(taskId)}`
    : base;
}

export function eventEditHref(eventId: string): string {
  return eventHref(eventId).replace(/\/dashboard$/, "/edit");
}

export function changeHref(eventId: string, changeId: string): string {
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(changeId)
  )
    throw new Error("Invalid Change route.");
  return `${eventHref(eventId, "/changes")}/${changeId.toLowerCase()}`;
}

export function createTaskHref(
  taskId: string,
  eventId?: string | null,
): string {
  if (eventId) return eventHref(eventId, "/tasks", taskId);
  return taskId.trim().length > 0
    ? `/tasks?task=${encodeURIComponent(taskId)}`
    : "/tasks";
}

export interface TaskRouteTarget {
  id: string;
  eventId: string;
}

export interface TaskDetailHistoryState {
  budographTaskDetail: true;
  taskFocusKey?: string;
}

export function createTaskDetailHistoryState(
  taskFocusKey: string | null,
): TaskDetailHistoryState {
  return {
    budographTaskDetail: true,
    ...(taskFocusKey ? { taskFocusKey } : {}),
  };
}

export const TASK_DETAIL_HISTORY_STATE: TaskDetailHistoryState = Object.freeze(
  createTaskDetailHistoryState(null),
);

export function isTaskDetailHistoryState(
  value: unknown,
): value is TaskDetailHistoryState {
  const taskFocusKey =
    typeof value === "object" && value !== null && "taskFocusKey" in value
      ? value.taskFocusKey
      : undefined;
  return (
    typeof value === "object" &&
    value !== null &&
    "budographTaskDetail" in value &&
    value.budographTaskDetail === true &&
    (taskFocusKey === undefined || typeof taskFocusKey === "string")
  );
}

export type TaskRouteResolution<TTask extends TaskRouteTarget> =
  | {
      status: "none";
      taskId: null;
      task: null;
    }
  | {
      status: "valid";
      taskId: string;
      task: TTask;
    }
  | {
      status: "invalid";
      reason: "unknown-task" | "wrong-event";
      taskId: string;
      task: null;
    };

export function resolveTaskLocation<TTask extends TaskRouteTarget>(
  location: AppLocation,
  tasks: readonly TTask[],
  currentEventId: string,
): TaskRouteResolution<TTask> {
  if (location.path !== "/tasks" || location.taskId === null) {
    return { status: "none", taskId: null, task: null };
  }
  if (location.eventId && location.eventId !== currentEventId) {
    return {
      status: "invalid",
      reason: "wrong-event",
      taskId: location.taskId,
      task: null,
    };
  }

  const matchingTasks = tasks.filter((task) => task.id === location.taskId);
  const currentEventTask = matchingTasks.find(
    (task) => task.eventId === currentEventId,
  );

  if (currentEventTask) {
    return {
      status: "valid",
      taskId: location.taskId,
      task: currentEventTask,
    };
  }

  return {
    status: "invalid",
    reason: matchingTasks.length === 0 ? "unknown-task" : "wrong-event",
    taskId: location.taskId,
    task: null,
  };
}
