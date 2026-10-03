import {
  emptyTasksWorkspace,
  WorkspaceReadFailure,
  type TasksReadService,
  type TasksWorkspace,
  type WorkspaceReadError,
  TaskActionFailure,
  type TaskAction,
  type TaskActionError,
  type TasksMutationService,
  type EventWorkspaceService,
  type EventFields,
  type TaskEvent,
  EventActionFailure,
  selectAccessibleEvent,
} from "./RemoteWorkspaceService.ts";

export interface TaskMutationState {
  taskId: string;
  pending: boolean;
  message:
    TaskActionError | "refresh-failed" | "conflict-refresh-failed" | null;
  needsRefresh: boolean;
}

export interface TaskReadState {
  status: "loading" | "ready" | "error";
  workspace: TasksWorkspace;
  error: WorkspaceReadError | null;
  accessibleEvents: TaskEvent[];
  mutation?: TaskMutationState | null;
}
export class TaskReadController {
  private state: TaskReadState = {
    status: "loading",
    workspace: emptyTasksWorkspace(),
    error: null,
    accessibleEvents: [],
  };
  private listeners = new Set<() => void>();
  private pending: Promise<void> | null = null;
  private cancellation: AbortController | null = null;
  private revision = 0;
  private contextRevision = 0;
  private currentEventId = "";
  private service: TasksReadService &
    Partial<TasksMutationService & EventWorkspaceService>;
  private actionPending: Promise<void> | null = null;
  private eventPending: Promise<TaskEvent> | null = null;
  private eventCancellations = new Set<AbortController>();
  private selectedEventId: string | null = null;
  private onUnauthorized: () => void;
  constructor(
    service: TasksReadService &
      Partial<TasksMutationService & EventWorkspaceService>,
    onUnauthorized: () => void,
  ) {
    this.service = service;
    this.onUnauthorized = onUnauthorized;
  }
  getSnapshot = () => this.state;
  getSelectedEventId = () => this.selectedEventId;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: TaskReadState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  clear = () => {
    ++this.revision;
    ++this.contextRevision;
    this.cancellation?.abort();
    this.cancellation = null;
    this.pending = null;
    this.actionPending = null;
    this.eventPending = null;
    for (const cancellation of this.eventCancellations) cancellation.abort();
    this.eventCancellations.clear();
    this.currentEventId = "";
    this.selectedEventId = null;
    this.publish({
      status: "loading",
      workspace: emptyTasksWorkspace(),
      error: null,
      accessibleEvents: [],
    });
  };
  selectEvent = (eventId: string | null) => {
    if (eventId === this.selectedEventId) return;
    const accessibleEvents = this.state.accessibleEvents;
    this.clear();
    this.selectedEventId = eventId;
    this.currentEventId = eventId ?? "";
    this.publish({ ...this.state, accessibleEvents });
  };
  load = (): Promise<void> => {
    if (this.actionPending) return this.actionPending;
    if (this.eventPending)
      return this.eventPending.then(
        () => {},
        () => {},
      );
    if (this.pending) return this.pending;
    const revision = ++this.revision;
    let readingEventId = this.selectedEventId ?? this.currentEventId;
    const cancellation = new AbortController();
    this.cancellation = cancellation;
    this.publish({
      status: "loading",
      workspace: emptyTasksWorkspace(),
      error: null,
      accessibleEvents: this.state.accessibleEvents,
    });
    // Schedule once; the StrictMode discarded setup is cancelled before HTTP.
    this.pending = Promise.resolve()
      .then(async () => {
        if (revision !== this.revision) return;
        try {
          let workspace: TasksWorkspace;
          if (this.service.listEvents && this.service.readEventTasks) {
            const accessibleEvents = await this.service.listEvents(
              cancellation.signal,
            );
            if (revision !== this.revision) return;
            this.publish({ ...this.state, accessibleEvents });
            const requestedId = this.selectedEventId ?? this.currentEventId;
            const event = requestedId
              ? accessibleEvents.find((event) => event.id === requestedId)
              : selectAccessibleEvent(accessibleEvents);
            readingEventId = event?.id ?? requestedId;
            if (!event && requestedId)
              throw new WorkspaceReadFailure(
                this.selectedEventId ? "not-found" : "forbidden",
              );
            workspace = event
              ? await this.service.readEventTasks(event, cancellation.signal)
              : emptyTasksWorkspace();
          } else {
            workspace =
              this.currentEventId && this.service.refreshTasks
                ? await this.service.refreshTasks(
                    this.currentEventId,
                    cancellation.signal,
                  )
                : await this.service.readTasks(
                    cancellation.signal,
                    this.selectedEventId,
                  );
          }
          if (revision === this.revision) {
            this.currentEventId = workspace.currentEventId;
            this.publish({
              status: "ready",
              workspace,
              error: null,
              accessibleEvents: this.service.listEvents
                ? this.state.accessibleEvents
                : (workspace.accessibleEvents ?? workspace.events),
            });
          }
        } catch (error) {
          if (revision !== this.revision) return;
          const code =
            error instanceof WorkspaceReadFailure ? error.code : "unavailable";
          this.publish({
            status: "error",
            workspace: emptyTasksWorkspace(),
            error: code,
            accessibleEvents:
              code === "unauthenticated"
                ? []
                : code === "forbidden" || code === "not-found"
                  ? this.state.accessibleEvents.filter(
                      (event) => event.id !== readingEventId,
                    )
                  : this.state.accessibleEvents,
          });
          if (code === "unauthenticated") this.onUnauthorized();
        }
      })
      .finally(() => {
        if (revision === this.revision) {
          this.pending = null;
          this.cancellation = null;
        }
      });
    return this.pending;
  };

  mutate = (taskId: string, action: TaskAction): Promise<void> => {
    if (this.actionPending) return this.actionPending;
    if (
      this.pending ||
      this.eventPending ||
      this.state.status !== "ready" ||
      this.state.mutation?.pending ||
      this.state.mutation?.needsRefresh
    )
      return Promise.resolve();
    const task = this.state.workspace.tasks.find((task) => task.id === taskId);
    const eventId = this.state.workspace.currentEventId;
    if (!task || !this.service.executeTaskAction || !this.service.refreshTasks)
      return Promise.resolve();
    const revision = this.revision;
    const cancellation = new AbortController();
    this.cancellation = cancellation;
    const mutation: TaskMutationState = {
      taskId,
      pending: true,
      message: null,
      needsRefresh: false,
    };
    this.publish({ ...this.state, mutation });
    this.actionPending = Promise.resolve()
      .then(async () => {
        if (revision !== this.revision) return;
        let message: TaskMutationState["message"] = null;
        try {
          const canonical = await this.service.executeTaskAction!(
            eventId,
            taskId,
            task.version,
            action,
            cancellation.signal,
          );
          if (revision !== this.revision) return;
          this.publish({
            ...this.state,
            workspace: {
              ...this.state.workspace,
              tasks: this.state.workspace.tasks.map((task) =>
                task.id === taskId ? canonical : task,
              ),
            },
            mutation,
          });
        } catch (error) {
          if (revision !== this.revision) return;
          message =
            error instanceof TaskActionFailure ? error.code : "unavailable";
          if (message === "unauthenticated") {
            this.clear();
            this.onUnauthorized();
            return;
          }
        }
        // A lost response can still mean a committed write. Always refetch, and
        // never replay the command. Keep confirmed content visible while reading.
        try {
          const workspace = await this.service.refreshTasks!(
            eventId,
            cancellation.signal,
          );
          if (revision !== this.revision) return;
          this.publish({
            status: "ready",
            workspace,
            error: null,
            accessibleEvents:
              workspace.accessibleEvents ?? this.state.accessibleEvents,
            mutation: { ...mutation, pending: false, message },
          });
        } catch (error) {
          if (revision !== this.revision) return;
          const code =
            error instanceof WorkspaceReadFailure ? error.code : "unavailable";
          if (code === "unauthenticated") {
            this.clear();
            this.onUnauthorized();
            return;
          }
          if (code === "forbidden" || code === "not-found") {
            this.publish({
              status: "error",
              workspace: emptyTasksWorkspace(),
              error: code,
              accessibleEvents: this.state.accessibleEvents.filter(
                (event) => event.id !== eventId,
              ),
            });
            return;
          }
          this.publish({
            ...this.state,
            mutation: {
              ...mutation,
              pending: false,
              needsRefresh: true,
              message:
                message === "conflict"
                  ? "conflict-refresh-failed"
                  : "refresh-failed",
            },
          });
        }
      })
      .finally(() => {
        if (revision === this.revision) {
          this.actionPending = null;
          this.cancellation = null;
        }
      });
    return this.actionPending;
  };

  private rememberEvent(event: TaskEvent) {
    const known = this.state.accessibleEvents;
    const accessibleEvents = known.some((value) => value.id === event.id)
      ? known.map((value) => (value.id === event.id ? event : value))
      : [...known, event];
    this.publish({
      ...this.state,
      accessibleEvents,
      workspace:
        this.state.workspace.currentEventId === event.id
          ? { ...this.state.workspace, events: [event] }
          : this.state.workspace,
    });
  }

  private async eventRequest<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const revision = this.contextRevision;
    const cancellation = new AbortController();
    this.eventCancellations.add(cancellation);
    const combined = signal
      ? AbortSignal.any([signal, cancellation.signal])
      : cancellation.signal;
    try {
      combined.throwIfAborted();
      const result = await operation(combined);
      combined.throwIfAborted();
      if (revision !== this.contextRevision)
        throw new DOMException("Event context changed.", "AbortError");
      return result;
    } catch (error) {
      if (revision !== this.contextRevision || combined.aborted)
        throw (
          combined.reason ??
          new DOMException("Event context changed.", "AbortError")
        );
      if (
        (error instanceof EventActionFailure ||
          error instanceof WorkspaceReadFailure) &&
        error.code === "unauthenticated"
      ) {
        this.clear();
        this.onUnauthorized();
      }
      throw error;
    } finally {
      this.eventCancellations.delete(cancellation);
    }
  }

  private async waitForPendingWorkspace(
    pendingWorkspace: Promise<void>,
    signal: AbortSignal,
  ) {
    let abort = () => {};
    try {
      await Promise.race([
        pendingWorkspace,
        new Promise<never>((_resolve, reject) => {
          abort = () =>
            reject(
              signal.reason ??
                new DOMException("Event command cancelled.", "AbortError"),
            );
          signal.addEventListener("abort", abort, { once: true });
          if (signal.aborted) abort();
        }),
      ]);
    } finally {
      signal.removeEventListener("abort", abort);
    }
    signal.throwIfAborted();
  }

  refreshEvents = async (): Promise<void> => {
    if (!this.service.listEvents) return;
    const revision = this.contextRevision;
    const events = await this.eventRequest((signal) =>
      this.service.listEvents!(signal),
    );
    if (revision !== this.contextRevision)
      throw new DOMException("Event context changed.", "AbortError");
    if (
      this.currentEventId &&
      !events.some((event) => event.id === this.currentEventId)
    ) {
      const selected = this.selectedEventId;
      this.clear();
      this.selectedEventId = selected;
      this.currentEventId = selected ?? "";
      this.publish({
        ...this.state,
        status: "error",
        error: "not-found",
        accessibleEvents: events,
      });
      return;
    }
    this.publish({ ...this.state, accessibleEvents: events });
  };

  getEvent = async (
    eventId: string,
    signal?: AbortSignal,
  ): Promise<TaskEvent> => {
    if (!this.service.getEvent) throw new EventActionFailure("unavailable");
    const revision = this.contextRevision;
    const event = await this.eventRequest(
      (cancellation) => this.service.getEvent!(eventId, cancellation),
      signal,
    );
    if (revision !== this.contextRevision)
      throw new DOMException("Event context changed.", "AbortError");
    this.rememberEvent(event);
    return event;
  };

  createEvent = (
    fields: EventFields,
    signal?: AbortSignal,
  ): Promise<TaskEvent> => {
    if (this.eventPending) return this.eventPending;
    if (!this.service.createEvent)
      return Promise.reject(new EventActionFailure("unavailable"));
    const revision = this.contextRevision;
    const pendingWorkspace = this.pending ?? this.actionPending;
    const request = this.eventRequest(async (cancellation) => {
      // Settle prior reads/actions first. New focus reads coalesce with the
      // command, so old Event metadata cannot overwrite its canonical result.
      if (pendingWorkspace)
        await this.waitForPendingWorkspace(pendingWorkspace, cancellation);
      return this.service.createEvent!(fields, cancellation);
    }, signal).then((event) => {
      if (revision !== this.contextRevision)
        throw new DOMException("Event context changed.", "AbortError");
      this.rememberEvent(event);
      return event;
    });
    this.eventPending = request;
    void request
      .finally(() => {
        if (this.eventPending === request) this.eventPending = null;
      })
      .catch(() => {});
    return request;
  };

  updateEvent = (
    eventId: string,
    expectedVersion: number,
    fields: EventFields,
    signal?: AbortSignal,
  ): Promise<TaskEvent> => {
    if (this.eventPending) return this.eventPending;
    if (!this.service.updateEvent)
      return Promise.reject(new EventActionFailure("unavailable"));
    const revision = this.contextRevision;
    const pendingWorkspace = this.pending ?? this.actionPending;
    const request = this.eventRequest(async (cancellation) => {
      if (pendingWorkspace)
        await this.waitForPendingWorkspace(pendingWorkspace, cancellation);
      return this.service.updateEvent!(
        eventId,
        expectedVersion,
        fields,
        cancellation,
      );
    }, signal).then((event) => {
      if (revision !== this.contextRevision)
        throw new DOMException("Event context changed.", "AbortError");
      this.rememberEvent(event);
      return event;
    });
    this.eventPending = request;
    void request
      .finally(() => {
        if (this.eventPending === request) this.eventPending = null;
      })
      .catch(() => {});
    return request;
  };
}

// A calendar carrier for existing date-only selectors. Deadline strings are
// never parsed into instants; only the real clock is projected into Event time.
export function eventCalendarNow(now: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((value) => value.type === type)?.value);
  return new Date(part("year"), part("month") - 1, part("day"), 12);
}
