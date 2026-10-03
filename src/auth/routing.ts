import {
  APP_ROUTES,
  createTaskHref,
  parseAppLocation,
  eventHref,
  eventEditHref,
} from "../routes.ts";

export function safeReturnTo(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/";
  try {
    const url = new URL(value, "https://budograph.invalid");
    if (url.origin !== "https://budograph.invalid" || url.hash) return "/";
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const location = parseAppLocation(path, url.search);
    if (path === "/events/new") return path;
    if (location.eventId) {
      return location.eventMode === "edit"
        ? eventEditHref(location.eventId)
        : eventHref(location.eventId, location.path, location.taskId);
    }
    if (!APP_ROUTES.some((route) => route.path === path)) return "/";
    return location.path === "/tasks" && location.taskId
      ? createTaskHref(location.taskId)
      : location.path;
  } catch {
    return "/";
  }
}

export function loginHref(returnTo: string, expired = false): string {
  const params = new URLSearchParams();
  const safe = safeReturnTo(returnTo);
  if (safe !== "/") params.set("returnTo", safe);
  if (expired) params.set("reason", "expired");
  return `/login${params.size ? `?${params}` : ""}`;
}

export function isLoginPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === "/login";
}

export function replaceAuthLocation(href: string) {
  window.history.replaceState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
