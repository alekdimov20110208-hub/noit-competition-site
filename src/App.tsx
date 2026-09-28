import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell.tsx";
import { getDemoReferenceNow } from "./data/demoTime.ts";
import { useWorkspace } from "./hooks/useWorkspace.ts";
import { localizeWorkspace, useI18n } from "./i18n/index.ts";
import { ChangesPage } from "./pages/ChangesPage.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { TasksPage } from "./pages/TasksPage.tsx";
import { TeamPage } from "./pages/TeamPage.tsx";
import { TemplatesPage } from "./pages/TemplatesPage.tsx";
import { usePreferences } from "./preferences/index.ts";
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
}

export default function App() {
  const [now] = useState(getDemoReferenceNow);
  const { language } = usePreferences();
  const { t } = useI18n();
  const [currentLocation, setCurrentLocation] = useState(() =>
    parseAppLocation(window.location.pathname, window.location.search),
  );
  const pendingTaskFocusRef = useRef<PendingTaskFocus | null>(null);
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

      if (currentHref !== normalizedHref) {
        if (options.replace) {
          window.history.replaceState(options.state ?? {}, "", normalizedHref);
        } else {
          window.history.pushState(options.state ?? {}, "", normalizedHref);
        }
      }

      setCurrentLocation(nextLocation);
      if (options.scroll !== false) {
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
            (link) => link.getAttribute("href") === taskHref,
          )
        : undefined;
      const focusTarget =
        pendingFocus.trigger?.isConnected === true
          ? pendingFocus.trigger
          : (remountedExactTrigger ??
            remountedTaskLink ??
            document.getElementById("main-content"));
      focusTarget?.focus();
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
    page = <TeamPage state={localizedState} now={now} />;
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
