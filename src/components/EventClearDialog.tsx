import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n, type MessageKey } from "../i18n/index.ts";
import {
  EventActionFailure,
  type TaskEvent,
} from "../services/RemoteWorkspaceService.ts";
import {
  readClearAttempt,
  rememberClearAttempt,
  forgetClearAttempt,
  type ClearAttempt,
} from "../services/eventClearing.ts";
import type { ClearPreview, ClearResult } from "../services/eventClearing.ts";
import "./eventClear.css";
export function EventClearDialog({
  event,
  identityId,
  getPreview,
  clearTasks,
  onRefresh,
  onSuccess,
  onClose,
}: {
  event: TaskEvent;
  identityId: string;
  getPreview: (id: string, signal?: AbortSignal) => Promise<ClearPreview>;
  clearTasks: (
    id: string,
    attempt: ClearAttempt,
    signal?: AbortSignal,
  ) => Promise<ClearResult>;
  onRefresh: () => Promise<void>;
  onSuccess: (result: ClearResult, refreshFailed: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useI18n(),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef(document.activeElement),
    errorRef = useRef<HTMLParagraphElement>(null),
    busy = useRef(false),
    cancellation = useRef(new AbortController());
  const [preview, setPreview] = useState<ClearPreview | null>(null);
  const [canonical, setCanonical] = useState(event),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false),
    [name, setName] = useState(""),
    [attempt, setAttempt] = useState<ClearAttempt | null>(() =>
      readClearAttempt(identityId, event.id),
    ),
    [error, setError] = useState<MessageKey | null>(null),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    const control = new AbortController();
    cancellation.current = control;
    getPreview(event.id, control.signal)
      .then((latest) => {
        if (control.signal.aborted) return;
        setCanonical(latest.event);
        setPreview(latest);
        setBlocked(latest.event.membership.accessRole !== "ORGANIZER");
        setLoading(false);
      })
      .catch((failure) => {
        if (!control.signal.aborted) {
          const denied =
            failure instanceof EventActionFailure &&
            ["forbidden", "not-found", "unauthenticated"].includes(
              failure.code,
            );
          setError(
            denied ? "events.clear.permission" : "events.clear.unavailable",
          );
          setBlocked(true);
          setLoading(false);
          if (denied) void onRefresh().catch(() => {});
        }
      });
    const previous = trigger.current;
    return () => {
      control.abort();
      modal?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
      else
        document.getElementById("event-search")?.focus({ preventScroll: true });
    };
  }, [event.id, getPreview, onRefresh]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const latest = await getPreview(event.id, cancellation.current.signal);
      setCanonical(latest.event);
      setPreview(latest);
      setBlocked(
        latest.event.archived ||
          latest.event.membership.accessRole !== "ORGANIZER",
      );
      setName("");
    } catch {
      setBlocked(true);
      setError("events.clear.unavailable");
    } finally {
      if (!cancellation.current.signal.aborted) setLoading(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      busy.current ||
      loading ||
      blocked ||
      (!attempt && (canonical.archived || name !== canonical.name))
    )
      return;
    busy.current = true;
    setPending(true);
    setError(null);
    const held = attempt ?? {
      commandId: crypto.randomUUID(),
      expectedVersion: canonical.version,
      confirmationName: name,
      scopeRevision: preview!.scopeRevision,
      reviewedCount: preview!.taskCount,
    };
    rememberClearAttempt(identityId, event.id, held);
    setAttempt(held);
    try {
      const result = await clearTasks(
        event.id,
        held,
        cancellation.current.signal,
      );
      forgetClearAttempt(identityId, event.id);
      let refreshFailed = false;
      try {
        await onRefresh();
      } catch {
        refreshFailed = true;
      }
      if (!cancellation.current.signal.aborted)
        onSuccess(result, refreshFailed);
    } catch (failure) {
      if (cancellation.current.signal.aborted) return;
      const code =
        failure instanceof EventActionFailure ? failure.code : "uncertain";
      if (
        [
          "invalid",
          "conflict",
          "forbidden",
          "not-found",
          "unauthenticated",
          "version-limit",
        ].includes(code)
      ) {
        forgetClearAttempt(identityId, event.id);
        setAttempt(null);
      }
      if (code === "conflict") {
        setBlocked(true);
        setError("events.clear.conflict");
      } else if (code === "invalid") setError("events.clear.invalid");
      else if (
        code === "forbidden" ||
        code === "not-found" ||
        code === "unauthenticated"
      ) {
        setBlocked(true);
        setError("events.clear.permission");
        try {
          await onRefresh();
        } catch {
          /* Session clearing is handled by the controller. */
        }
      } else if (code === "version-limit" || code === "key-reused") {
        setBlocked(true);
        setError("events.clear.unavailable");
      } else setError("events.clear.uncertain");
    } finally {
      busy.current = false;
      if (!cancellation.current.signal.aborted) setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="event-clear-dialog"
      aria-labelledby="event-clear-title"
      aria-describedby="event-clear-description"
      aria-busy={loading || pending}
      tabIndex={-1}
      onFocus={(e) => {
        e.stopPropagation();
        if (e.target instanceof HTMLElement) {
          const field = e.target.getBoundingClientRect(),
            modal = e.currentTarget.getBoundingClientRect();
          const offset =
            field.bottom > modal.bottom - 12
              ? field.bottom - modal.bottom + 12
              : field.top < modal.top + 12
                ? field.top - modal.top - 12
                : 0;
          if (offset)
            e.currentTarget.scrollBy({ top: offset, behavior: "instant" });
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),[tabindex='0']",
          ),
        ).filter((x) => x.getClientRects().length);
        if (!controls.length) {
          e.preventDefault();
          e.currentTarget.focus();
          return;
        }
        const first = controls[0],
          last = controls.at(-1);
        if (
          (e.shiftKey && document.activeElement === first) ||
          (!e.shiftKey && document.activeElement === last)
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }}
    >
      <h2 id="event-clear-title">{t("events.clear")}</h2>
      <p className="event-clear-dialog__name">
        {error === "events.clear.permission"
          ? t("events.error.not-found")
          : canonical.name}
      </p>
      <p id="event-clear-description">{t("events.clear.description")}</p>
      {attempt && !blocked && (
        <p role="status">
          {t("events.clear.originalCount", { count: attempt.reviewedCount })}
        </p>
      )}
      {preview && !attempt && !blocked && (
        <p role="status">
          {t("events.clear.count", {
            count: preview.taskCount,
            completed: preview.completedCount,
            changes: preview.affectedChangeCount,
            reminders: preview.reminderCount,
          })}
        </p>
      )}
      {preview?.taskCount === 0 && !attempt && !blocked && (
        <p>{t("events.clear.empty")}</p>
      )}
      {pending && <p role="status">{t("events.clear.pending")}</p>}
      {loading ? (
        <p role="status">{t("events.loading")}</p>
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          {attempt ? (
            <p className="notice" role="status">
              {t("events.clear.uncertain")}
            </p>
          ) : (
            <div className="event-clear-dialog__field">
              <label htmlFor="clear-confirmation">
                {t("events.clear.confirmation")}
              </label>
              <p id="clear-confirmation-help">{t("events.clear.exact")}</p>
              <input
                id="clear-confirmation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending || blocked || canonical.archived}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={`clear-confirmation-help${name && name !== canonical.name ? " clear-confirmation-error" : ""}${error ? " clear-command-error" : ""}`}
                aria-invalid={
                  error === "events.clear.invalid" ||
                  Boolean(name && name !== canonical.name)
                }
              />
              {name && name !== canonical.name && (
                <p id="clear-confirmation-error">{t("events.clear.invalid")}</p>
              )}
            </div>
          )}
          {error && (
            <p
              id="clear-command-error"
              ref={errorRef}
              tabIndex={-1}
              className="notice"
              role="alert"
            >
              {t(error)}
            </p>
          )}
          {(error === "events.clear.conflict" ||
            error === "events.clear.unavailable") && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void reload()}
              disabled={pending}
            >
              {t("events.clear.reload")}
            </button>
          )}
          {canonical.archived && !attempt && (
            <p role="status">{t("events.clear.already")}</p>
          )}
          <div className="event-clear-dialog__actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={pending}
              onClick={onClose}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="button event-clear-action"
              disabled={
                pending ||
                blocked ||
                (!attempt && (canonical.archived || name !== canonical.name))
              }
            >
              {t(
                pending
                  ? "events.clear.pending"
                  : attempt
                    ? "events.clear.recover"
                    : "events.clear",
              )}
            </button>
          </div>
        </form>
      )}
      {loading && (
        <button
          type="button"
          className="button button--secondary"
          onClick={onClose}
        >
          {t("common.cancel")}
        </button>
      )}
    </dialog>
  );
}
