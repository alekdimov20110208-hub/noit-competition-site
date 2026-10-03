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
  mutation?: TaskMutationState | null;
}
export class TaskReadController {
  private state: TaskReadState = {
    status: "loading",
    workspace: emptyTasksWorkspace(),
    error: null,
  };
  private listeners = new Set<() => void>();
  private pending: Promise<void> | null = null;
  private cancellation: AbortController | null = null;
  private revision = 0;
  private service: TasksReadService & Partial<TasksMutationService>;
  private actionPending: Promise<void> | null = null;
  private onUnauthorized: () => void;
  constructor(
    service: TasksReadService & Partial<TasksMutationService>,
    onUnauthorized: () => void,
  ) {
    this.service = service;
    this.onUnauthorized = onUnauthorized;
  }
  getSnapshot = () => this.state;
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
    this.cancellation?.abort();
    this.cancellation = null;
    this.pending = null;
    this.actionPending = null;
    this.publish({
      status: "loading",
      workspace: emptyTasksWorkspace(),
      error: null,
    });
  };
  load = (): Promise<void> => {
    if (this.actionPending) return this.actionPending;
    if (this.pending) return this.pending;
    const revision = ++this.revision;
    const cancellation = new AbortController();
    this.cancellation = cancellation;
    this.publish({
      status: "loading",
      workspace: emptyTasksWorkspace(),
      error: null,
    });
    // Schedule once; the StrictMode discarded setup is cancelled before HTTP.
    this.pending = Promise.resolve()
      .then(async () => {
        if (revision !== this.revision) return;
        try {
          const workspace = await this.service.readTasks(cancellation.signal);
          if (revision === this.revision)
            this.publish({ status: "ready", workspace, error: null });
        } catch (error) {
          if (revision !== this.revision) return;
          const code =
            error instanceof WorkspaceReadFailure ? error.code : "unavailable";
          this.publish({
            status: "error",
            workspace: emptyTasksWorkspace(),
            error: code,
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
          if (code === "forbidden") {
            this.publish({
              status: "error",
              workspace: emptyTasksWorkspace(),
              error: "forbidden",
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
