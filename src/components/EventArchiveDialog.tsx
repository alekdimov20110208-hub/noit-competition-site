import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n, type MessageKey } from "../i18n/index.ts";
import {
  EventActionFailure,
  type TaskEvent,
} from "../services/RemoteWorkspaceService.ts";
import {
  readArchiveAttempt,
  rememberArchiveAttempt,
  forgetArchiveAttempt,
  type ArchiveAttempt,
} from "../services/eventArchiving.ts";
import "./eventArchive.css";
export function EventArchiveDialog({
  event,
  identityId,
  getEvent,
  archiveEvent,
  onRefresh,
  onSuccess,
  onClose,
}: {
  event: TaskEvent;
  identityId: string;
  getEvent: (id: string, signal?: AbortSignal) => Promise<TaskEvent>;
  archiveEvent: (
    id: string,
    version: number,
    name: string,
    key: string,
    signal?: AbortSignal,
  ) => Promise<TaskEvent>;
  onRefresh: () => Promise<void>;
  onSuccess: (event: TaskEvent, refreshFailed: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useI18n(),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef(document.activeElement),
    errorRef = useRef<HTMLParagraphElement>(null),
    busy = useRef(false),
    cancellation = useRef(new AbortController());
  const [canonical, setCanonical] = useState(event),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false),
    [name, setName] = useState(""),
    [attempt, setAttempt] = useState<ArchiveAttempt | null>(() =>
      readArchiveAttempt(identityId, event.id),
    ),
    [error, setError] = useState<MessageKey | null>(null),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    const control = new AbortController();
    cancellation.current = control;
    getEvent(event.id, control.signal)
      .then((latest) => {
        if (control.signal.aborted) return;
        setCanonical(latest);
        setBlocked(latest.membership.accessRole !== "ORGANIZER");
        setLoading(false);
      })
      .catch(() => {
        if (!control.signal.aborted) {
          setError("events.archive.unavailable");
          setBlocked(true);
          setLoading(false);
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
  }, [event.id, getEvent]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const latest = await getEvent(event.id, cancellation.current.signal);
      setCanonical(latest);
      setBlocked(
        latest.archived || latest.membership.accessRole !== "ORGANIZER",
      );
      setName("");
    } catch {
      setBlocked(true);
      setError("events.archive.unavailable");
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
    };
    rememberArchiveAttempt(identityId, event.id, held);
    setAttempt(held);
    try {
      const result = await archiveEvent(
        event.id,
        held.expectedVersion,
        held.confirmationName,
        held.commandId,
        cancellation.current.signal,
      );
      forgetArchiveAttempt(identityId, event.id);
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
        forgetArchiveAttempt(identityId, event.id);
        setAttempt(null);
      }
      if (code === "conflict") {
        setBlocked(true);
        setError("events.archive.conflict");
      } else if (code === "invalid") setError("events.archive.invalid");
      else if (
        code === "forbidden" ||
        code === "not-found" ||
        code === "unauthenticated"
      ) {
        setBlocked(true);
        setError("events.archive.permission");
        try {
          await onRefresh();
        } catch {
          /* Session clearing is handled by the controller. */
        }
      } else if (code === "version-limit" || code === "key-reused") {
        setBlocked(true);
        setError("events.archive.unavailable");
      } else setError("events.archive.uncertain");
    } finally {
      busy.current = false;
      if (!cancellation.current.signal.aborted) setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="event-archive-dialog"
      aria-labelledby="event-archive-title"
      aria-describedby="event-archive-description"
      aria-busy={loading || pending}
      tabIndex={-1}
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
      <h2 id="event-archive-title">{t("events.archive")}</h2>
      <p className="event-archive-dialog__name">
        {error === "events.archive.permission"
          ? t("events.error.not-found")
          : canonical.name}
      </p>
      <p id="event-archive-description">{t("events.archive.description")}</p>
      {pending && <p role="status">{t("events.archive.pending")}</p>}
      {loading ? (
        <p role="status">{t("events.loading")}</p>
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          {attempt ? (
            <p className="notice" role="status">
              {t("events.archive.uncertain")}
            </p>
          ) : (
            <div className="event-archive-dialog__field">
              <label htmlFor="archive-confirmation">
                {t("events.archive.confirmation")}
              </label>
              <p id="archive-confirmation-help">{t("events.archive.exact")}</p>
              <input
                id="archive-confirmation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending || blocked || canonical.archived}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={`archive-confirmation-help${name && name !== canonical.name ? " archive-confirmation-error" : ""}${error ? " archive-command-error" : ""}`}
                aria-invalid={
                  error === "events.archive.invalid" ||
                  Boolean(name && name !== canonical.name)
                }
              />
              {name && name !== canonical.name && (
                <p id="archive-confirmation-error">
                  {t("events.archive.invalid")}
                </p>
              )}
            </div>
          )}
          {error && (
            <p
              id="archive-command-error"
              ref={errorRef}
              tabIndex={-1}
              className="notice"
              role="alert"
            >
              {t(error)}
            </p>
          )}
          {error === "events.archive.conflict" && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void reload()}
              disabled={pending}
            >
              {t("events.archive.reload")}
            </button>
          )}
          {canonical.archived && !attempt && (
            <p role="status">{t("events.archive.already")}</p>
          )}
          <div className="event-archive-dialog__actions">
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
              className="button event-archive-action"
              disabled={
                pending ||
                blocked ||
                (!attempt && (canonical.archived || name !== canonical.name))
              }
            >
              {t(
                pending
                  ? "events.archive.pending"
                  : attempt
                    ? "events.archive.recover"
                    : "events.archive",
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
