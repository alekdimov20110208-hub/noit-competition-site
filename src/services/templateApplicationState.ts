import {
  TemplateApplicationService,
  TemplateFailure,
  readTemplateAttempt,
  rememberTemplateAttempt,
  forgetTemplateAttempt,
  type TemplateAttempt,
  type TemplateFailureCode,
  type TemplateReview,
  type TemplateResult,
  type TemplateSelection,
} from "./templateApplications.ts";

export interface TemplateApplicationState {
  pending: "review" | "apply" | null;
  review: TemplateReview | null;
  attempt: TemplateAttempt | null;
  result: TemplateResult | null;
  error: TemplateFailureCode | null;
  refreshFailed: boolean;
}
export class TemplateApplicationController {
  private state: TemplateApplicationState;
  private listeners = new Set<() => void>();
  private disposed = false;
  private revision = 0;
  private reviewCancellation: AbortController | null = null;
  private readonly userId: string;
  private readonly eventId: string;
  private readonly service: Pick<
    TemplateApplicationService,
    "preview" | "apply"
  >;
  private readonly refresh: () => Promise<void>;
  private readonly unauthorized: () => void;
  private readonly operationKey: () => string;
  constructor(
    userId: string,
    eventId: string,
    service: Pick<TemplateApplicationService, "preview" | "apply">,
    refresh: () => Promise<void>,
    unauthorized: () => void,
    operationKey: () => string = () => crypto.randomUUID(),
  ) {
    this.userId = userId;
    this.eventId = eventId;
    this.service = service;
    this.refresh = refresh;
    this.unauthorized = unauthorized;
    this.operationKey = operationKey;
    const attempt = readTemplateAttempt(userId, eventId);
    this.state = {
      pending: null,
      review: null,
      attempt,
      result: null,
      error: attempt ? "uncertain" : null,
      refreshFailed: false,
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: TemplateApplicationState) {
    if (!this.disposed) {
      this.state = next;
      for (const listener of this.listeners) listener();
    }
  }
  private failure(error: unknown): TemplateFailureCode {
    const code = error instanceof TemplateFailure ? error.code : "uncertain";
    if (code === "unauthenticated") this.unauthorized();
    return code;
  }
  activate = () => {
    this.disposed = false;
  };
  dispose = () => {
    this.disposed = true;
    ++this.revision;
    this.reviewCancellation?.abort();
  };
  review = async (selection: TemplateSelection) => {
    if (this.state.pending || this.state.attempt || this.state.result) return;
    const revision = ++this.revision;
    this.reviewCancellation = new AbortController();
    this.publish({
      ...this.state,
      pending: "review",
      review: null,
      error: null,
    });
    try {
      const review = await this.service.preview(
        this.eventId,
        selection,
        this.reviewCancellation.signal,
      );
      if (this.disposed || revision !== this.revision) return;
      this.publish({ ...this.state, pending: null, review });
    } catch (error) {
      if (this.disposed || revision !== this.revision) return;
      this.publish({
        ...this.state,
        pending: null,
        error: this.failure(error),
      });
    }
  };
  apply = async () => {
    if (this.state.pending || this.state.result) return;
    const review = this.state.review;
    let attempt = this.state.attempt;
    if (!attempt) {
      if (!review?.canApply) return;
      attempt = {
        operationId: this.operationKey(),
        templateId: review.templateId,
        templateVersion: review.templateVersion,
        itemIds: [...review.itemIds],
        language: review.language,
        expectedEventVersion: review.event.version,
        reviewRevision: review.reviewRevision,
        confirmed: true,
      };
      rememberTemplateAttempt(this.userId, this.eventId, attempt);
    }
    const held = attempt;
    const revision = ++this.revision;
    this.publish({
      ...this.state,
      pending: "apply",
      attempt: held,
      error: null,
    });
    try {
      const result = await this.service.apply(this.eventId, held);
      // A former page must leave its recovery hint intact: the current page has
      // not seen this result and can safely retrieve the durable receipt.
      if (this.disposed || revision !== this.revision) return;
      // Clear only this operation's hint, never a different controller's attempt.
      if (
        readTemplateAttempt(this.userId, this.eventId)?.operationId ===
        held.operationId
      )
        forgetTemplateAttempt(this.userId, this.eventId);
      this.publish({
        ...this.state,
        pending: null,
        attempt: null,
        result,
        error: null,
      });
      await this.refreshConfirmed();
    } catch (error) {
      if (this.disposed || revision !== this.revision) return;
      const code = this.failure(error);
      // A canonical stale-review rejection proves this exact operation did not
      // commit. Every uncertain/unavailable/key-conflict outcome keeps its key.
      if (code === "conflict") forgetTemplateAttempt(this.userId, this.eventId);
      this.publish({
        ...this.state,
        pending: null,
        review: code === "conflict" ? null : this.state.review,
        attempt: code === "conflict" ? null : held,
        error: code,
      });
    }
  };
  refreshConfirmed = async () => {
    if (!this.state.result || this.disposed) return;
    try {
      await this.refresh();
      this.publish({ ...this.state, refreshFailed: false });
    } catch {
      this.publish({ ...this.state, refreshFailed: true });
    }
  };
  startNew = () => {
    if (this.state.pending || this.state.attempt) return;
    this.publish({
      pending: null,
      review: null,
      attempt: null,
      result: null,
      error: null,
      refreshFailed: false,
    });
  };
}
