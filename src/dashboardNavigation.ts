// Transient UI context belongs to a Dashboard history entry, never workspace storage.
export interface DashboardReturnOrigin {
  taskId: string;
  focusKey: string | null;
  scrollY: number;
}

export interface DashboardNavigationContext {
  focusExpanded: boolean;
  origin?: DashboardReturnOrigin;
}

export function readDashboardContext(
  state: unknown,
): DashboardNavigationContext {
  if (
    typeof state !== "object" ||
    state === null ||
    !("budographDashboard" in state)
  ) {
    return { focusExpanded: false };
  }
  const context = state.budographDashboard;
  if (
    typeof context !== "object" ||
    context === null ||
    !("focusExpanded" in context) ||
    typeof context.focusExpanded !== "boolean"
  ) {
    return { focusExpanded: false };
  }
  const origin = "origin" in context ? context.origin : null;
  if (
    typeof origin === "object" &&
    origin !== null &&
    "taskId" in origin &&
    typeof origin.taskId === "string" &&
    origin.taskId.length > 0 &&
    "focusKey" in origin &&
    (origin.focusKey === null || typeof origin.focusKey === "string") &&
    "scrollY" in origin &&
    typeof origin.scrollY === "number" &&
    Number.isFinite(origin.scrollY) &&
    origin.scrollY >= 0
  ) {
    return {
      focusExpanded: context.focusExpanded,
      origin: {
        taskId: origin.taskId,
        focusKey: origin.focusKey,
        scrollY: origin.scrollY,
      },
    };
  }
  return { focusExpanded: context.focusExpanded };
}

export function withDashboardContext(
  state: unknown,
  context: DashboardNavigationContext,
) {
  return {
    ...(typeof state === "object" && state !== null ? state : {}),
    budographDashboard: context,
  };
}
