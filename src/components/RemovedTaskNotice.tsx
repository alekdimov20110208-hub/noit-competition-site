import { useEffect, useState } from "react";
import { auth } from "../auth/runtime.ts";
import { useI18n } from "../i18n/index.ts";
import { AppLink } from "./AppLink.tsx";
import { eventHref } from "../routes.ts";
import {
  readRetainedTask,
  RemovedTaskFailure,
  type RetainedTask,
} from "../services/removedTasks.ts";
import { TASK_STATUS_MESSAGE_KEYS } from "../domain/labels.ts";
export function RemovedTaskNotice({
  eventId,
  taskId,
  onClose,
  onNavigate,
}: {
  eventId: string;
  taskId: string;
  onClose: () => void;
  onNavigate?: (href: string) => void;
}) {
  const { t, formatDateTime, formatTaskDeadline } = useI18n();
  const [state, setState] = useState<{
    status: "loading" | "removed" | "unknown" | "error";
    task?: RetainedTask;
  }>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const control = new AbortController();
    setState({ status: "loading" });
    void (async () => {
      try {
        const task = await readRetainedTask(eventId, taskId, control.signal);
        if (!control.signal.aborted) setState({ status: "removed", task });
      } catch (error) {
        if (control.signal.aborted) return;
        if (
          error instanceof RemovedTaskFailure &&
          error.code === "unauthenticated"
        ) {
          auth.expireSession();
          return;
        }
        setState({
          status:
            error instanceof RemovedTaskFailure && error.code === "unknown"
              ? "unknown"
              : "error",
        });
      }
    })();
    return () => control.abort();
  }, [eventId, taskId, revision]);
  return (
    <section
      className="notice notice--warning"
      aria-live="polite"
      aria-busy={state.status === "loading"}
    >
      {state.status === "loading" ? (
        <p role="status">{t("events.clear.historyLoading")}</p>
      ) : state.task ? (
        <div>
          <h2>{state.task.title}</h2>
          <p>{t("events.clear.historyNotice")}</p>
          <p>{t(TASK_STATUS_MESSAGE_KEYS[state.task.status])}</p>
          {state.task.context && <p>{state.task.context}</p>}
          <p>
            {t("events.clear.historyMetadata", {
              version: state.task.version,
              removed: formatDateTime(state.task.removedAt),
              actor: state.task.removerName,
            })}
          </p>
          <p>
            {t("events.clear.historyResponsibility", {
              assignee: state.task.assigneeName ?? t("common.unassigned"),
              accepted: state.task.acceptedAt
                ? formatDateTime(state.task.acceptedAt)
                : "—",
              deadline: formatTaskDeadline(
                state.task.deadline,
                state.task.deadlineTime,
              ),
            })}
          </p>
          <AppLink
            href={eventHref(eventId, "/history")}
            onNavigate={onNavigate ?? ((href) => window.location.assign(href))}
          >
            {t("history.title")}
          </AppLink>
        </div>
      ) : state.status === "unknown" ? (
        <p>
          <strong>{t("taskDetails.invalid.title")}</strong>{" "}
          {t("taskDetails.invalid.description")}
        </p>
      ) : (
        <p role="alert">{t("events.clear.historyError")}</p>
      )}
      {state.status === "error" && (
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setRevision((n) => n + 1)}
        >
          {t("tasks.remote.retry")}
        </button>
      )}
      <button type="button" className="button button--quiet" onClick={onClose}>
        {t("taskDetails.invalid.back")}
      </button>
    </section>
  );
}
