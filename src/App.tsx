import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell.tsx";
import { AppLink } from "./components/AppLink.tsx";
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
import { CalendarPage } from "./pages/CalendarPage.tsx";
import { TasksPage } from "./pages/TasksPage.tsx";
import { TeamPage } from "./pages/TeamPage.tsx";
import { EventFormPage } from "./pages/EventFormPage.tsx";
import { EventManagementPage } from "./pages/EventManagementPage.tsx";
import { EventHistoryPage } from "./pages/EventHistoryPage.tsx";
import { auth } from "./auth/runtime.ts";
import { ChangesPage } from "./pages/ChangesPage.tsx";
import { AccountPage } from "./pages/AccountPage.tsx";
import { StarterTemplatesPage } from "./pages/StarterTemplatesPage.tsx";
import { isVisibleFocusTarget, revealFocusTarget } from "./navigationFocus.ts";
import {
  createTaskDetailHistoryState,
  createTaskHref,
  eventHref,
  calendarHref,
  isGlobalAppPath,
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
    currentLocation.path === "/events" ||
      currentLocation.path === "/history" ||
      currentLocation.eventMode === "duplicate",
  );
  const remoteEvent = remoteTasks.workspace.events[0] ?? null;
  const refreshWorkspace = remoteTasks.retry;
  const taskRecoveryRequired = remoteTasks.mutation?.needsRefresh ?? false;
  const previousPage = useRef(currentLocation.path);
  useEffect(() => {
    const enteredDashboard =
      currentLocation.path === "/" && previousPage.current !== "/";
    previousPage.current = currentLocation.path;
    // Preserve confirmed Task data and the locked explicit-recovery flow after
    // an uncertain/conflicting command whose canonical refresh failed.
    if (enteredDashboard && remoteEnabled && !taskRecoveryRequired)
      void refreshWorkspace();
  }, [
    currentLocation.path,
    refreshWorkspace,
    remoteEnabled,
    taskRecoveryRequired,
  ]);
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
      if (
        scope &&
        !isGlobalAppPath(
          parseAppLocation(targetUrl.pathname, targetUrl.search).path,
        ) &&
        !targetUrl.pathname.startsWith("/events/")
      ) {
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
      !remoteTasks.workspace.currentEventId &&
      !currentLocation.eventId &&
      currentLocation.path !== "/" &&
      currentLocation.path !== "/templates" &&
      currentLocation.path !== "/calendar" &&
      currentLocation.eventMode === "workspace" &&
      !isGlobalAppPath(currentLocation.path)
    ) {
      navigate("/events", { replace: true, scroll: false });
      return;
    }
    if (
      remoteTasks.status === "ready" &&
      remoteTasks.workspace.currentEventId &&
      !currentLocation.eventId &&
      currentLocation.eventMode === "workspace" &&
      !isGlobalAppPath(currentLocation.path)
    ) {
      navigate(
        currentLocation.path === "/calendar" && currentLocation.calendar
          ? calendarHref(
              remoteTasks.workspace.currentEventId,
              currentLocation.calendar,
            )
          : eventHref(
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
      (!isGlobalAppPath(currentLocation.path) &&
        currentLocation.eventMode === "workspace" &&
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
      event={remoteEvent}
      changes={remoteTasks.workspace.changes ?? null}
      changeReadError={remoteTasks.workspace.changeReadError ?? null}
      onRefresh={() => void remoteTasks.retry()}
      onNavigate={navigate}
      onOpenTask={openTask}
    />
  );

  if (currentLocation.path === "/tasks") {
    page = (
      <TasksPage
        key={
          remoteTasks.workspace.currentEventId ||
          currentLocation.eventId ||
          "loading"
        }
        now={now}
        state={remoteTasks.workspace}
        selectedTaskId={selectedTaskId}
        onNavigate={navigate}
        invalidTaskId={invalidTaskId}
        onOpenTask={openTask}
        onCloseTask={closeTask}
        readState={remoteTasks}
        onRetry={() => void remoteTasks.retry()}
        onTaskAction={(taskId, action) =>
          void remoteTasks.mutate(taskId, action)
        }
        taskAuthoring={{
          onSave: (fields, assignee, version, signal) =>
            selectedTaskId && version !== null
              ? remoteTasks.updateTaskDetails(
                  selectedTaskId,
                  version,
                  fields,
                  signal,
                )
              : remoteTasks.createTask(fields, assignee, signal),
          onReload: (signal) =>
            remoteTasks.getTask(
              remoteTasks.workspace.currentEventId,
              selectedTaskId!,
              signal,
            ),
        }}
        onAuthoringOpenChange={remoteTasks.setTaskAuthoringOpen}
      />
    );
  } else if (currentLocation.path === "/calendar") {
    page = (
      <CalendarPage
        state={remoteTasks}
        now={now}
        location={currentLocation.calendar}
        onLocationChange={(location) =>
          navigate(
            calendarHref(
              remoteTasks.workspace.currentEventId || null,
              location,
            ),
            { scroll: false },
          )
        }
        onRetry={() => void remoteTasks.retry()}
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
        invitationEvent={
          remoteEvent?.membership.accessRole === "ORGANIZER"
            ? { id: remoteEvent.id, archived: remoteEvent.archived }
            : undefined
        }
      />
    );
  } else if (currentLocation.path === "/changes") {
    page =
      remoteTasks.status === "ready" && remoteEvent ? (
        <ChangesPage
          key={`${remoteEvent.id}:${currentLocation.changeId ?? "list"}`}
          event={remoteEvent}
          changeId={currentLocation.changeId}
          workspace={remoteTasks.workspace}
          onNavigate={navigate}
        />
      ) : (
        <WorkspaceReadNotice
          state={remoteTasks}
          team={false}
          onRetry={() => void remoteTasks.retry()}
        />
      );
  } else if (currentLocation.path === "/templates") {
    page = (
      <StarterTemplatesPage
        userId={identity.user!.id}
        onRefresh={remoteTasks.refreshForTemplateApplication}
        onUnauthorized={auth.expireSession}
        key={`${identity.user?.id}:${currentLocation.eventId ?? remoteTasks.workspace.currentEventId}`}
        readState={remoteTasks}
        requestedEventId={currentLocation.eventId}
        onRetry={() => void remoteTasks.retry()}
        onNavigate={navigate}
      />
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
          onManage={() => navigate("/events")}
        />
      );
    }
  } else if (
    remoteTasks.status === "ready" &&
    !remoteEvent &&
    currentLocation.path !== "/templates" &&
    currentLocation.path !== "/calendar" &&
    currentLocation.eventMode !== "edit" &&
    currentLocation.eventMode !== "duplicate"
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
            <AppLink
              className="button button--primary"
              href="/events/new"
              onNavigate={navigate}
            >
              {t("events.create")}
            </AppLink>
          }
        />
      </div>
    );
  }

  if (currentLocation.path === "/account" && identity.user)
    page = <AccountPage key={identity.user.id} user={identity.user} />;

  if (currentLocation.eventMode === "duplicate") {
    page =
      remoteTasks.status !== "ready" ? (
        <WorkspaceReadNotice
          state={remoteTasks}
          team={false}
          onRetry={() => void remoteTasks.retry()}
        />
      ) : !contextEvent ||
        contextEvent.membership.accessRole !== "ORGANIZER" ? (
        <div className="page">
          <PageHeader
            title={t("events.duplicate")}
            description={t(
              contextEvent
                ? "events.duplicate.permission"
                : "events.error.not-found",
            )}
          />
          <div className="notice" role="alert">
            {t(
              contextEvent
                ? "events.duplicate.permission"
                : "events.error.not-found",
            )}
          </div>
        </div>
      ) : (
        <EventFormPage
          key={`${identity.user?.id}:${contextEvent.id}:duplicate`}
          duplicateSource={contextEvent}
          identityId={identity.user!.id}
          onSave={(fields, version, signal, commandId) =>
            remoteTasks.duplicateEvent(
              contextEvent.id,
              version!,
              fields,
              commandId!,
              signal,
            )
          }
          onReload={(signal) => remoteTasks.getEvent(contextEvent.id, signal)}
          onSuccess={(event) =>
            navigate(eventHref(event.id), { replace: true })
          }
          onCancel={() => navigate("/events")}
          onManage={() => navigate("/events")}
        />
      );
  }

  if (currentLocation.path === "/events")
    page = (
      <EventManagementPage
        key={identity.user?.id}
        events={remoteTasks.accessibleEvents}
        status={remoteTasks.status}
        onRetry={() => void remoteTasks.retry()}
        onNavigate={navigate}
        identityId={identity.user!.id}
        getEvent={remoteTasks.getEvent}
        archiveEvent={remoteTasks.archiveEvent}
        clearPreview={remoteTasks.clearPreview}
        clearTasks={remoteTasks.clearTasks}
        onRefresh={remoteTasks.refreshEvents}
      />
    );

  if (currentLocation.path === "/history")
    page =
      remoteTasks.status === "ready" && contextEvent ? (
        <EventHistoryPage
          key={`${identity.user?.id}:${contextEvent.id}`}
          event={contextEvent}
          onNavigate={navigate}
          onUnauthorized={auth.expireSession}
        />
      ) : remoteTasks.status === "ready" ? (
        <div className="page">
          <PageHeader
            title={t("history.title")}
            description={t("events.error.not-found")}
          />
          <div className="notice" role="alert">
            {t("events.error.not-found")}
          </div>
        </div>
      ) : (
        <WorkspaceReadNotice
          state={remoteTasks}
          team={false}
          onRetry={() => void remoteTasks.retry()}
        />
      );

  return (
    <AppShell
      currentPath={
        currentLocation.eventMode === "duplicate"
          ? "/events"
          : currentLocation.path
      }
      event={contextEvent}
      events={remoteTasks.accessibleEvents}
      eventsStatus={remoteTasks.status}
      onSwitchEvent={(eventId) =>
        navigate(
          currentLocation.path === "/calendar"
            ? calendarHref(eventId, {
                view: currentLocation.calendar?.view ?? "month",
                date: null,
              })
            : eventHref(
                eventId,
                currentLocation.eventMode === "workspace" &&
                  !isGlobalAppPath(currentLocation.path)
                  ? currentLocation.path
                  : "/",
              ),
        )
      }
      dataMode="remote-workspace"
      persistenceError={null}
      notificationContext={
        remoteTasks.status === "ready" &&
        remoteEvent &&
        remoteEvent.id === contextEvent?.id &&
        identity.user
          ? {
              eventId: remoteEvent.id,
              userId: identity.user.id,
              timeZone: remoteEvent.timezone,
              refreshToken: remoteTasks.workspace,
              onOpenTask: openTask,
            }
          : undefined
      }
      onNavigate={(href) => navigate(href)}
    >
      {page}
    </AppShell>
  );
}
