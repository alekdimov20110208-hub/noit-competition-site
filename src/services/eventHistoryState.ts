import {
  WorkspaceReadFailure,
  type WorkspaceReadError,
} from "./RemoteWorkspaceService.ts";
import {
  historyPrecedes,
  type EventHistoryEntry,
  type EventHistoryPage,
} from "./eventHistory.ts";

export interface EventHistoryState {
  status: "loading" | "ready" | "error";
  entries: EventHistoryEntry[];
  nextCursor: string | null;
  pending: boolean;
  error: WorkspaceReadError | null;
}
export class EventHistoryController {
  private state: EventHistoryState = {
    status: "loading",
    entries: [],
    nextCursor: null,
    pending: false,
    error: null,
  };
  private listeners = new Set<() => void>();
  private cancellation: AbortController | null = null;
  private revision = 0;
  private eventId: string;
  private read: (
    eventId: string,
    before: string | null,
    signal: AbortSignal,
  ) => Promise<EventHistoryPage>;
  private onUnauthorized: () => void;
  constructor(
    eventId: string,
    read: (
      eventId: string,
      before: string | null,
      signal: AbortSignal,
    ) => Promise<EventHistoryPage>,
    onUnauthorized: () => void,
  ) {
    this.eventId = eventId;
    this.read = read;
    this.onUnauthorized = onUnauthorized;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: EventHistoryState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  dispose = () => {
    ++this.revision;
    this.cancellation?.abort();
    this.cancellation = null;
  };
  load = async (append = false) => {
    if (this.cancellation || (append && !this.state.nextCursor)) return;
    const revision = ++this.revision,
      request = new AbortController();
    this.cancellation = request;
    const previous = append ? this.state.entries : [];
    const before = append ? this.state.nextCursor : null;
    this.publish({
      status: previous.length ? "ready" : "loading",
      entries: previous,
      nextCursor: before,
      pending: true,
      error: null,
    });
    try {
      const page = await this.read(this.eventId, before, request.signal);
      if (revision !== this.revision || request.signal.aborted) return;
      const entries = [...previous, ...page.entries];
      if (
        page.eventId !== this.eventId ||
        new Set(entries.map((entry) => entry.id)).size !== entries.length ||
        (previous.length &&
          page.entries.length &&
          !historyPrecedes(previous.at(-1)!, page.entries[0]!))
      )
        throw new WorkspaceReadFailure("invalid");
      this.publish({
        status: "ready",
        entries,
        nextCursor: page.nextCursor,
        pending: false,
        error: null,
      });
    } catch (error) {
      if (revision !== this.revision || request.signal.aborted) return;
      const code =
        error instanceof WorkspaceReadFailure ? error.code : "unavailable";
      this.publish({
        status: "error",
        entries: [],
        nextCursor: null,
        pending: false,
        error: code,
      });
      if (code === "unauthenticated") this.onUnauthorized();
    } finally {
      if (revision === this.revision) this.cancellation = null;
    }
  };
}
