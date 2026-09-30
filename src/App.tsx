import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell.tsx";
import {
  readDashboardContext,
  withDashboardContext,
} from "./dashboardNavigation.ts";
import { getDemoReferenceNow } from "./data/demoTime.ts";
import { useWorkspace } from "./hooks/useWorkspace.ts";
import { localizeWorkspace, useI18n } from "./i18n/index.ts";
import { ChangesPage } from "./pages/ChangesPage.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { TasksPage } from "./pages/TasksPage.tsx";
import { TeamPage } from "./pages/TeamPage.tsx";
import { TemplatesPage } from "./pages/TemplatesPage.tsx";
import { usePreferences } from "./preferences/index.ts";
import { isVisibleFocusTarget, revealFocusTarget } from "./navigationFocus.ts";
import {
  createTaskDetailHistoryState,
  createTaskHref,
  isTaskDetailHistoryState,
  parseAppLocation,
  resolveTaskLocation,
} from "./routes.ts";

interface NavigationOptions {
  replace?: boolean;
  scroll?: boolean;
  state?: unknown;
}

interface PendingTaskFocus {
  focusKey: string | null;
  taskId: string | null;
  trigger: HTMLElement | null;
  scrollY?: number;
}

export default function App() {
  const [now] = useState(getDemoReferenceNow);
  const { language } = usePreferences();
  const { t } = useI18n();
  const [currentLocation, setCurrentLocation] = useState(() =>
    parseAppLocation(window.location.pathname, window.location.search),
  );
  const [dashboardContext, setDashboardContext] = useState(() =>
    readDashboardContext(window.history.state),
  );
  // Team remounts from its own history-entry context, including same-route sheets.
  const [teamEntry, setTeamEntry] = useState(0);
  const pendingTaskFocusRef = useRef<PendingTaskFocus | null>(
    currentLocation.path === "/" && dashboardContext.origin
      ? { ...dashboardContext.origin, trigger: null }
      : null,
  );
  const {
    state,
    persistenceError,
    updateTaskStatus,
    toggleTaskAcknowledgement,
    acknowledgeChange,
    updateChangeStatus,
    resetWorkspace,
  } = useWorkspace();
  const localizedState = useMemo(
    () => localizeWorkspace(state, language),
    [language, state],
  );

  useEffect(() => {
    function handlePopState() {
      const nextLocation = parseAppLocation(
        window.location.pathname,
        window.location.search,
      );
      const historyState = window.history.state;
      if (nextLocation.path === "/team") {
        pendingTaskFocusRef.current = null;
        setTeamEntry((entry) => entry + 1);
      }
      const dashboard = readDashboardContext(historyState);
      setDashboardContext(dashboard);
      if (nextLocation.path === "/") {
        pendingTaskFocusRef.current = dashboard.origin
          ? { ...dashboard.origin, trigger: null }
          : null;
      }
      if (
        nextLocation.path === "/tasks" &&
        nextLocation.taskId !== null &&
        isTaskDetailHistoryState(historyState)
      ) {
        pendingTaskFocusRef.current = {
          focusKey: historyState.taskFocusKey ?? null,
          taskId: nextLocation.taskId,
          trigger: null,
        };
      }
      setCurrentLocation(nextLocation);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback(
    (href: string, options: NavigationOptions = {}) => {
      const targetUrl = new URL(href, window.location.origin);
      const nextLocation = parseAppLocation(
        targetUrl.pathname,
        targetUrl.search,
      );
      const normalizedHref = `${nextLocation.path}${targetUrl.search}`;
      const currentHref = `${window.location.pathname}${window.location.search}`;

      if (options.replace || currentHref === normalizedHref) {
        window.history.replaceState(options.state ?? {}, "", normalizedHref);
      } else {
        window.history.pushState(options.state ?? {}, "", normalizedHref);
      }

      setDashboardContext(readDashboardContext(options.state));
      if (nextLocation.path === "/team") setTeamEntry((entry) => entry + 1);
      setCurrentLocation(nextLocation);
      if (options.scroll !== false) {
        pendingTaskFocusRef.current = null;
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    },
    [],
  );
  const openTask = useCallback(
    (taskId: string) => {
      const trigger =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const focusKey = trigger?.dataset.taskFocusKey ?? null;
      if (window.location.pathname === "/") {
        window.history.replaceState(
          withDashboardContext(window.history.state, {
            ...readDashboardContext(window.history.state),
            origin: { focusKey, taskId, scrollY: window.scrollY },
          }),
          "",
        );
      }
      pendingTaskFocusRef.current = {
        focusKey,
        taskId,
        trigger,
      };
      navigate(createTaskHref(taskId), {
        scroll: false,
        state: createTaskDetailHistoryState(focusKey),
      });
    },
    [navigate],
  );
  const closeTask = useCallback(() => {
    const historyState = window.history.state;
    if (!pendingTaskFocusRef.current) {
      const location = parseAppLocation(
        window.location.pathname,
        window.location.search,
      );
      pendingTaskFocusRef.current = {
        focusKey: isTaskDetailHistoryState(historyState)
          ? (historyState.taskFocusKey ?? null)
          : null,
        taskId: location.path === "/tasks" ? location.taskId : null,
        trigger: null,
      };
    }
    if (isTaskDetailHistoryState(historyState)) {
      window.history.back();
      return;
    }
    navigate("/tasks", { replace: true, scroll: false });
  }, [navigate]);

  useEffect(() => {
    if (currentLocation.path === "/team") {
      pendingTaskFocusRef.current = null;
      return;
    }
    if (currentLocation.path === "/tasks" && currentLocation.taskId !== null) {
      return;
    }

    const pendingFocus = pendingTaskFocusRef.current;
    if (!pendingFocus) return;

    const animationFrame = window.requestAnimationFrame(() => {
      pendingTaskFocusRef.current = null;
      const taskHref = pendingFocus.taskId
        ? createTaskHref(pendingFocus.taskId)
        : null;
      const remountedExactTrigger = pendingFocus.focusKey
        ? [
            ...document.querySelectorAll<HTMLElement>("[data-task-focus-key]"),
          ].find(
            (element) => element.dataset.taskFocusKey === pendingFocus.focusKey,
          )
        : undefined;
      const remountedTaskLink = taskHref
        ? [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].find(
            (link) =>
              link.getAttribute("href") === taskHref &&
              isVisibleFocusTarget(link),
          )
        : undefined;
      const focusTarget =
        pendingFocus.trigger && isVisibleFocusTarget(pendingFocus.trigger)
          ? pendingFocus.trigger
          : ((remountedExactTrigger &&
            isVisibleFocusTarget(remountedExactTrigger)
              ? remountedExactTrigger
              : null) ??
            remountedExactTrigger
              ?.closest("details:not([open])")
              ?.querySelector<HTMLElement>(":scope > summary") ??
            remountedTaskLink ??
            document.querySelector<HTMLElement>(
              ".operational-focus button[aria-expanded]",
            ) ??
            document.getElementById("main-content"));
      if (pendingFocus.scrollY !== undefined) {
        window.scrollTo({ top: pendingFocus.scrollY, behavior: "instant" });
      }
      focusTarget?.focus({ preventScroll: true });
      if (focusTarget) revealFocusTarget(focusTarget);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [currentLocation]);

  const currentEvent =
    localizedState.events.find(
      (event) => event.id === localizedState.currentEventId,
    ) ?? localizedState.events[0];

  if (!currentEvent) {
    return (
      <main className="fatal-state">
        <h1>{t("fatal.title")}</h1>
        <p>{t("fatal.description")}</p>
        <button className="button button--primary" onClick={resetWorkspace}>
          {t("fatal.restore")}
        </button>
      </main>
    );
  }

  const taskLocation = resolveTaskLocation(
    currentLocation,
    localizedState.tasks,
    localizedState.currentEventId,
  );
  const selectedTaskId =
    taskLocation.status === "valid" ? taskLocation.taskId : null;
  const invalidTaskId =
    taskLocation.status === "invalid" ? taskLocation.taskId : null;

  let page = (
    <DashboardPage
      focusExpanded={dashboardContext.focusExpanded}
      onFocusExpandedChange={(focusExpanded) => {
        const context = { focusExpanded };
        window.history.replaceState(
          withDashboardContext(window.history.state, context),
          "",
        );
        setDashboardContext(context);
      }}
      now={now}
      state={localizedState}
      onNavigate={navigate}
      onOpenTask={openTask}
    />
  );

  if (currentLocation.path === "/tasks") {
    page = (
      <TasksPage
        now={now}
        state={localizedState}
        selectedTaskId={selectedTaskId}
        invalidTaskId={invalidTaskId}
        onOpenTask={openTask}
        onCloseTask={closeTask}
        onStatusChange={updateTaskStatus}
        onToggleAcknowledgement={toggleTaskAcknowledgement}
      />
    );
  } else if (currentLocation.path === "/team") {
    page = (
      <TeamPage
        key={`${localizedState.currentEventId}:${teamEntry}`}
        state={localizedState}
        now={now}
        onOpenTask={openTask}
        onNavigate={navigate}
      />
    );
  } else if (currentLocation.path === "/changes") {
    page = (
      <ChangesPage
        state={localizedState}
        onAcknowledge={acknowledgeChange}
        onStatusChange={updateChangeStatus}
      />
    );
  } else if (currentLocation.path === "/templates") {
    page = <TemplatesPage state={localizedState} onReset={resetWorkspace} />;
  }

  return (
    <AppShell
      currentPath={currentLocation.path}
      event={currentEvent}
      persistenceError={persistenceError}
      onNavigate={(href) => navigate(href)}
    >
      {page}
    </AppShell>
  );
}
