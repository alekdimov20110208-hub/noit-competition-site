import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/index.ts";
import { reminderNotificationKey } from "../i18n/notificationMessages.ts";
import {
  NotificationFailure,
  NotificationService,
  type NotificationSnapshot,
  type InAppNotification,
} from "../services/notifications.ts";
import "./notifications.css";

const service = new NotificationService();
export function NotificationCenter({
  eventId,
  timeZone,
  refreshToken,
  onOpenTask,
}: {
  eventId: string;
  timeZone: string;
  refreshToken: unknown;
  onOpenTask: (id: string) => void;
}) {
  const { t, formatDateTime, formatTaskDeadline } = useI18n(timeZone);
  const [snapshot, setSnapshot] = useState<NotificationSnapshot | null>(null);
  const [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false);
  const [error, setError] = useState<"read" | "write" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    bell = useRef<HTMLButtonElement>(null);
  const readRequest = useRef<AbortController | null>(null),
    writeRequest = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    readRequest.current?.abort();
    const request = new AbortController();
    readRequest.current = request;
    setLoading(true);
    setError(null);
    try {
      const result = await service.list(eventId, request.signal);
      if (!request.signal.aborted) setSnapshot(result);
    } catch (e) {
      if (!request.signal.aborted) {
        setError("read");
        if (
          e instanceof NotificationFailure &&
          ["unauthenticated", "forbidden", "not-found"].includes(e.code)
        )
          setSnapshot(null);
      }
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [eventId]);
  useEffect(() => {
    void load();
  }, [load, refreshToken]);
  useEffect(
    () => () => {
      readRequest.current?.abort();
      writeRequest.current?.abort();
    },
    [],
  );
  function close() {
    dialog.current?.close();
    bell.current?.focus();
  }
  async function mark(notification?: InAppNotification) {
    if (writeRequest.current) return;
    readRequest.current?.abort();
    setLoading(false);
    const request = new AbortController();
    writeRequest.current = request;
    setPending(true);
    setError(null);
    try {
      if (notification) {
        const confirmed = await service.markRead(
          eventId,
          notification.id,
          request.signal,
        );
        if (request.signal.aborted) return;
        setSnapshot((current) =>
          current
            ? {
                ...current,
                unreadCount: Math.max(
                  0,
                  current.unreadCount - (notification.readAt === null ? 1 : 0),
                ),
                notifications: current.notifications.map((n) =>
                  n.id === confirmed.id ? confirmed : n,
                ),
              }
            : current,
        );
        close();
        onOpenTask(confirmed.taskId);
      } else {
        await service.markAllRead(eventId, request.signal);
        if (!request.signal.aborted) await load();
      }
    } catch {
      if (!request.signal.aborted) setError("write");
    } finally {
      if (!request.signal.aborted) {
        writeRequest.current = null;
        setPending(false);
      }
    }
  }
  const count = snapshot?.unreadCount;
  return (
    <>
      <button
        ref={bell}
        className="icon-button notification-bell"
        type="button"
        aria-label={
          count === undefined
            ? t("notifications.title")
            : `${t("notifications.title")} · ${t("notifications.unread", { count })}`
        }
        aria-haspopup="dialog"
        onClick={() => {
          dialog.current?.showModal();
          void load();
        }}
      >
        <Bell size={19} aria-hidden="true" />
        <span className="notification-count" aria-hidden="true">
          {count ? (count > 99 ? "99+" : count) : error ? "!" : null}
        </span>
      </button>
      <dialog
        ref={dialog}
        className="notification-panel"
        aria-labelledby="notification-heading"
        onClose={() => bell.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="notification-panel__content">
          <div className="notification-panel__header">
            <h2 id="notification-heading">{t("notifications.title")}</h2>
            <button
              type="button"
              className="icon-button"
              aria-label={t("notifications.close")}
              onClick={close}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="notification-panel__actions">
            <button
              className="text-button"
              type="button"
              disabled={loading || pending}
              onClick={() => void load()}
            >
              {t("notifications.retry")}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={loading || pending || !count}
              onClick={() => void mark()}
            >
              {t("notifications.allRead")}
            </button>
          </div>
          {error && (
            <p role="alert" className="notice">
              {t(
                error === "write"
                  ? "notifications.writeError"
                  : "notifications.error",
              )}
            </p>
          )}
          {loading && <p role="status">{t("notifications.loading")}</p>}
          {!loading && !error && snapshot?.notifications.length === 0 && (
            <p>{t("notifications.empty")}</p>
          )}
          {!loading && snapshot && (
            <ul className="notification-list" aria-busy={pending}>
              {snapshot.notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    disabled={pending}
                    className="notification-item"
                    data-unread={n.readAt === null}
                    onClick={() => void mark(n)}
                  >
                    <span className="notification-item__meaning">
                      {t(
                        n.kind === "TASK_ASSIGNED"
                          ? "notifications.assigned"
                          : reminderNotificationKey(n.reminderOffsetMinutes!),
                      )}
                      <span className="notification-item__read">
                        {t(
                          n.readAt === null
                            ? "notifications.unreadItem"
                            : "notifications.readItem",
                        )}
                      </span>
                    </span>
                    <strong>{n.taskTitle}</strong>
                    {n.kind === "TASK_DUE_REMINDER" && (
                      <span>
                        {t("notifications.due", {
                          deadline: formatTaskDeadline(
                            n.deadline,
                            n.deadlineTime,
                          ),
                        })}
                      </span>
                    )}
                    <time dateTime={n.createdAt}>
                      {formatDateTime(n.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}
