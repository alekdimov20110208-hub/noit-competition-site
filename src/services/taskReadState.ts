import {
  emptyTasksWorkspace,
  WorkspaceReadFailure,
  type TasksReadService,
  type TasksWorkspace,
  type WorkspaceReadError,
} from "./RemoteWorkspaceService.ts";

export interface TaskReadState {
  status: "loading" | "ready" | "error";
  workspace: TasksWorkspace;
  error: WorkspaceReadError | null;
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
  private service: TasksReadService;
  private onUnauthorized: () => void;
  constructor(service: TasksReadService, onUnauthorized: () => void) {
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
    this.publish({
      status: "loading",
      workspace: emptyTasksWorkspace(),
      error: null,
    });
  };
  load = (): Promise<void> => {
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
