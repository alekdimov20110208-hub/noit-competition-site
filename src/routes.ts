import {
  ClipboardCheck,
  LayoutDashboard,
  RefreshCcw,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AppRoute {
  path: string;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
}

export const APP_ROUTES: AppRoute[] = [
  {
    path: "/",
    label: "Dashboard",
    mobileLabel: "Home",
    icon: LayoutDashboard,
  },
  {
    path: "/tasks",
    label: "Tasks",
    mobileLabel: "Tasks",
    icon: ClipboardCheck,
  },
  {
    path: "/team",
    label: "Team",
    mobileLabel: "Team",
    icon: Users,
  },
  {
    path: "/changes",
    label: "Changes & Plan B",
    mobileLabel: "Plan B",
    icon: ShieldAlert,
  },
  {
    path: "/templates",
    label: "Templates",
    mobileLabel: "Templates",
    icon: RefreshCcw,
  },
];

export function normalizePath(pathname: string): string {
  const withoutTrailingSlash = pathname.replace(/\/+$/, "");
  const normalized = withoutTrailingSlash || "/";
  return APP_ROUTES.some((route) => route.path === normalized)
    ? normalized
    : "/";
}
