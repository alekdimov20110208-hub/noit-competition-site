import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell.tsx";
import {
  readDashboardContext,
  withDashboardContext,
} from "./dashboardNavigation.ts";
import { useRemoteTasks } from "./hooks/useRemoteTasks.ts";
import { useAuth } from "./auth/runtime.ts";
import { eventCalendarNow } from "./services/taskReadState.ts";
import { useI18n } from "./i18n/index.ts";
import { toWorkspaceView } from "./services/workspaceViews.ts";
import { WorkspaceReadNotice } from "./components/WorkspaceReadNotice.tsx";
import { EmptyState } from "./components/EmptyState.tsx";
import { PageHeader } from "./components/PageHeader.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { TasksPage } from "./pages/TasksPage.tsx";
import { TeamPage } from "./pages/TeamPage.tsx";
import { EventFormPage } from "./pages/EventFormPage.tsx";
import { isVisibleFocusTarget, revealFocusTarget } from "./navigationFocus.ts";
import {
  createTaskDetailHistoryState,
  createTaskHref,
  eventHref,
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
  const [instant, setInstant] = useState(() => new Date());
  const { t } = useI18n();
  const [currentLocation, setCurrentLocation] = useState(() =>
    parseAppLocation(window.location.pathname, window.location.search),
  );
  const [dashboardContext, setDashboardContext] = useState(() =>
    readDashboardContext(window.history.state),
  );
  // Team remounts from its own history-entry context, including same-route sheets.
  const [teamEntry, setTeamEntry] = useState(0);
  const pendingRouteFocus = useRef(false);
  const pendingTaskFocusRef = useRef<PendingTaskFocus | null>(
    currentLocation.path === "/" && dashboardContext.origin
      ? { ...dashboardContext.origin, trigger: null }
      : null,
  );
  const identity = useAuth();
  const remoteEnabled = Boolean(identity.user);
  const remoteTasks = useRemoteTasks(
    remoteEnabled,
    identity.user?.id ?? "",
    currentLocation.eventId,
  );
  const remoteEvent = remoteTasks.workspace.events[0] ?? null;
  useEffect(() => {
    if (!remoteEnabled) return;
    const refresh = () => setInstant(new Date());
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [remoteEnabled]);
  const workspaceView = useMemo(
    () => toWorkspaceView(remoteTasks.workspace),
    [remoteTasks.workspace],
  );
  const now = remoteEvent
    ? eventCalendarNow(instant, remoteEvent.timezone)
    : instant;

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
      const scope =
        parseAppLocation(window.location.pathname, window.location.search)
          .eventId ?? remoteTasks.workspace.currentEventId;
      if (scope && !targetUrl.pathname.startsWith("/events/")) {
        const legacy = parseAppLocation(targetUrl.pathname, targetUrl.search);
        targetUrl.pathname = eventHref(scope, legacy.path);
      }
      const nextLocation = parseAppLocation(
        targetUrl.pathname,
        targetUrl.search,
      );
      const normalizedHref = `${targetUrl.pathname}${targetUrl.search}`;
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
        pendingRouteFocus.current = true;
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    },
    [remoteTasks.workspace.currentEventId],
  );
  useEffect(() => {
    if (
      remoteTasks.status === "ready" &&
      remoteTasks.workspace.currentEventId &&
      !currentLocation.eventId &&
      currentLocation.eventMode === "workspace"
    ) {
      navigate(
        eventHref(
          remoteTasks.workspace.currentEventId,
          currentLocation.path,
          currentLocation.taskId,
        ),
        { replace: true, scroll: false },
      );
    }
  }, [
    remoteTasks.status,
    remoteTasks.workspace.currentEventId,
    currentLocation,
    navigate,
  ]);
  useEffect(() => {
    if (
      !pendingRouteFocus.current ||
      (currentLocation.eventMode === "workspace" &&
        remoteTasks.status === "loading")
    )
      return;
    const frame = window.requestAnimationFrame(() => {
      pendingRouteFocus.current = false;
      document.getElementById("main-content")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentLocation, remoteTasks.status]);
  const openTask = useCallback(
    (taskId: string) => {
      const trigger =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const focusKey = trigger?.dataset.taskFocusKey ?? null;
      if (
        parseAppLocation(window.location.pathname, window.location.search)
          .path === "/"
      ) {
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
      navigate(createTaskHref(taskId, remoteTasks.workspace.currentEventId), {
        scroll: false,
        state: createTaskDetailHistoryState(focusKey),
      });
    },
    [navigate, remoteTasks.workspace.currentEventId],
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
    // Back can restore a Dashboard origin across Events. Keep its focus/scroll
    // pending until the matching scoped content has replaced the loading mask.
    if (remoteTasks.status === "loading") return;

    const pendingFocus = pendingTaskFocusRef.current;
    if (!pendingFocus) return;

    const animationFrame = window.requestAnimationFrame(() => {
      pendingTaskFocusRef.current = null;
      const taskHref = pendingFocus.taskId
        ? createTaskHref(
            pendingFocus.taskId,
            currentLocation.eventId ?? undefined,
          )
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
  }, [currentLocation, remoteTasks.status]);

  const taskLocation = resolveTaskLocation(
    currentLocation,
    remoteTasks.workspace.tasks,
    remoteTasks.workspace.currentEventId,
  );
  const selectedTaskId =
    taskLocation.status === "valid" ? taskLocation.taskId : null;
  const invalidTaskId =
    remoteTasks.status === "ready" && taskLocation.status === "invalid"
      ? taskLocation.taskId
      : null;

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
      state={workspaceView}
      onNavigate={navigate}
      onOpenTask={openTask}
    />
  );

  if (currentLocation.path === "/tasks") {
    page = (
      <TasksPage
        now={now}
        state={remoteTasks.workspace}
        selectedTaskId={selectedTaskId}
        invalidTaskId={invalidTaskId}
        onOpenTask={openTask}
        onCloseTask={closeTask}
        readState={remoteTasks}
        onRetry={() => void remoteTasks.retry()}
        onTaskAction={(taskId, action) =>
          void remoteTasks.mutate(taskId, action)
        }
      />
    );
  } else if (currentLocation.path === "/team") {
    page = (
      <TeamPage
        key={`${workspaceView.currentEventId}:${teamEntry}`}
        state={workspaceView}
        now={now}
        onOpenTask={openTask}
        onNavigate={navigate}
      />
    );
  } else if (currentLocation.path === "/changes") {
    page = (
      <div className="page">
        <PageHeader
          title={t("changes.title")}
          description={t("workspace.changes.description")}
        />
        <EmptyState
          title={t("workspace.changes.title")}
          description={t("workspace.changes.description")}
        />
      </div>
    );
  } else if (currentLocation.path === "/templates") {
    page = (
      <div className="page">
        <PageHeader
          title={t("templates.title")}
          description={t("workspace.templates.description")}
        />
        <EmptyState
          title={t("workspace.templates.title")}
          description={t("workspace.templates.description")}
        />
      </div>
    );
  }

  if (currentLocation.path === "/" || currentLocation.path === "/team") {
    if (remoteTasks.status !== "ready" || !remoteEvent) {
      page = (
        <WorkspaceReadNotice
          state={remoteTasks}
          team={currentLocation.path === "/team"}
          onRetry={() => void remoteTasks.retry()}
        />
      );
    } else if (remoteTasks.mutation?.needsRefresh) {
      page = (
        <>
          <div className="notice" role="alert">
            <span>{t("workspace.stale")}</span>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void remoteTasks.retry()}
            >
              {t("tasks.remote.retry")}
            </button>
          </div>
          {page}
        </>
      );
    }
  }

  const deniedEvent =
    remoteTasks.status === "error" &&
    (remoteTasks.error === "forbidden" || remoteTasks.error === "not-found");
  const contextEvent = deniedEvent
    ? null
    : (remoteTasks.accessibleEvents.find(
        (event) => event.id === currentLocation.eventId,
      ) ?? remoteEvent);
  const authoringEvent =
    currentLocation.eventMode === "edit" ? contextEvent : null;
  if (
    currentLocation.eventMode === "create" ||
    (authoringEvent && currentLocation.eventMode === "edit")
  ) {
    if (
      authoringEvent &&
      (authoringEvent.archived ||
        authoringEvent.membership.accessRole !== "ORGANIZER")
    ) {
      page = (
        <div className="page">
          <PageHeader
            title={t("events.edit")}
            description={t("events.permission")}
          />
          <div className="notice" role="alert">
            {t("events.permission")}
          </div>
        </div>
      );
    } else {
      page = (
        <EventFormPage
          key={authoringEvent?.id ?? "new-event"}
          event={authoringEvent ?? undefined}
          onSave={(fields, expectedVersion, signal) =>
            authoringEvent && expectedVersion !== null
              ? remoteTasks.updateEvent(
                  authoringEvent.id,
                  expectedVersion,
                  fields,
                  signal,
                )
              : remoteTasks.createEvent(fields, signal)
          }
          onReload={(signal) =>
            remoteTasks.getEvent(authoringEvent!.id, signal)
          }
          onSuccess={(event) =>
            navigate(eventHref(event.id), { replace: true })
          }
          onCancel={() =>
            navigate(contextEvent ? eventHref(contextEvent.id) : "/")
          }
        />
      );
    }
  } else if (
    remoteTasks.status === "ready" &&
    !remoteEvent &&
    currentLocation.eventMode !== "edit"
  ) {
    page = (
      <div className="page">
        <PageHeader
          title={t("events.none")}
          description={t("events.empty.description")}
        />
        <EmptyState
          title={t("events.none")}
          description={t("events.empty.description")}
          action={
            <button
              className="button button--primary"
              type="button"
              onClick={() => navigate("/events/new")}
            >
              {t("events.create")}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <AppShell
      currentPath={currentLocation.path}
      event={contextEvent}
      events={remoteTasks.accessibleEvents}
      eventsStatus={remoteTasks.status}
      onSwitchEvent={(eventId) =>
        navigate(
          eventHref(
            eventId,
            currentLocation.eventMode === "workspace"
              ? currentLocation.path
              : "/",
          ),
        )
      }
      eventEditHref={
        contextEvent?.membership.accessRole === "ORGANIZER" &&
        !contextEvent.archived
          ? `/events/${contextEvent.id}/edit`
          : undefined
      }
      dataMode="remote-workspace"
      persistenceError={null}
      onNavigate={(href) => navigate(href)}
    >
      {page}
    </AppShell>
  );
}
