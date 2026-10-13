import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AppLink } from "../components/AppLink.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { useI18n, type MessageKey } from "../i18n/index.ts";
import {
  RemoteWorkspaceService,
  type TaskEvent,
} from "../services/RemoteWorkspaceService.ts";
import { EventHistoryController } from "../services/eventHistoryState.ts";
import { changeHref, eventHref } from "../routes.ts";
import { revealFocusTarget } from "../navigationFocus.ts";
import "./events/history.css";

const ACTIONS: Record<string, MessageKey> = {
  EVENT_CREATED: "history.event.created",
  EVENT_UPDATED: "history.event.updated",
  EVENT_ARCHIVED: "history.event.archived",
  "task.created": "history.task.created",
  "task.updated": "history.task.updated",
  "task.assigned": "history.task.assigned",
  "task.reassigned": "history.task.reassigned",
  "task.unassigned": "history.task.unassigned",
  "task.accepted": "history.task.accepted",
  "task.acceptance_withdrawn": "history.task.withdrawn",
  "task.status_changed": "history.task.status",
  CHANGE_CREATED: "history.change.created",
  CHANGE_UPDATED: "history.change.updated",
  "invitation.created": "history.invitation.created",
  "invitation.revoked": "history.invitation.revoked",
  "invitation.accepted": "history.invitation.accepted",
};
const FIELDS: Record<string, MessageKey> = {
  name: "events.name",
  startDate: "events.startDate",
  endDate: "events.endDate",
  timezone: "events.timezone",
  title: "history.field.title",
  category: "history.field.category",
  context: "history.field.context",
  deadline: "history.field.deadline",
  deadlineTime: "history.field.time",
  priority: "history.field.priority",
  reminderOffsets: "history.field.reminders",
  assignedMemberId: "history.field.assignee",
  responseOwnerMemberId: "history.field.owner",
  affectedTaskIds: "history.field.tasks",
  decision: "history.field.decision",
  response: "history.field.response",
  planB: "history.field.planB",
  status: "history.field.status",
};
const STATES: Record<string, MessageKey> = {
  present: "history.present",
  absent: "history.absent",
  "not-started": "status.task.notStarted",
  "in-progress": "status.task.inProgress",
  blocked: "status.task.blocked",
  completed: "status.task.completed",
};
export function EventHistoryPage({
  event,
  onNavigate,
  onUnauthorized,
}: {
  event: TaskEvent;
  onNavigate: (href: string) => void;
  onUnauthorized: () => void;
}) {
  const { t, locale } = useI18n();
  const controller = useMemo(() => {
    const service = new RemoteWorkspaceService();
    return new EventHistoryController(
      event.id,
      (id, before, signal) => service.readEventHistory(id, before, signal),
      onUnauthorized,
    );
  }, [event.id, onUnauthorized]);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  useEffect(() => {
    void controller.load();
    return controller.dispose;
  }, [controller]);
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: event.timezone,
      }),
    [locale, event.timezone],
  );
  return (
    <div
      className="page page--event-history"
      aria-busy={state.pending}
      onFocus={(e) => revealFocusTarget(e.target)}
    >
      <PageHeader
        title={t("history.title")}
        description={event.name}
        actions={
          <>
            <AppLink
              href="/events"
              onNavigate={onNavigate}
              className="button button--secondary"
            >
              {t("events.backToManagement")}
            </AppLink>
            <AppLink
              href={eventHref(event.id)}
              onNavigate={onNavigate}
              className="button button--secondary"
            >
              {t(event.archived ? "events.openArchived" : "events.open")}
            </AppLink>
          </>
        }
      />
      <p className="event-history__context">
        {t("history.order", { timezone: event.timezone })}
      </p>
      <p className="event-history__context">{t("history.scope")}</p>
      {state.status === "loading" ? (
        <p className="notice" role="status">
          {t("history.loading")}
        </p>
      ) : state.status === "error" ? (
        <div className="notice" role="alert">
          <span>
            {t(
              state.error === "not-found" || state.error === "forbidden"
                ? "events.error.not-found"
                : "history.error",
            )}
          </span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void controller.load()}
          >
            {t("tasks.remote.retry")}
          </button>
        </div>
      ) : !state.entries.length ? (
        <EmptyState
          title={t("history.empty")}
          description={t("history.empty.description")}
        />
      ) : (
        <>
          <p className="event-history__context" role="status">
            {t("history.count", { count: state.entries.length })}
          </p>
          <ol className="event-history__list">
            {state.entries.map((entry) => {
              const target = entry.target;
              const href = target.available
                ? target.type === "task"
                  ? eventHref(event.id, "/tasks", target.id)
                  : target.type === "change"
                    ? changeHref(event.id, target.id)
                    : null
                : null;
              const label = `${t(target.type === "task" ? "history.target.task" : target.type === "change" ? "history.target.change" : target.type === "event" ? "history.target.event" : target.type === "invitation" ? "history.target.invitation" : "history.target.record")}: ${target.title ?? target.id}`;
              return (
                <li
                  key={entry.id}
                  className="event-history__entry"
                  data-history-id={entry.id}
                >
                  <div className="event-history__heading">
                    <h2>
                      {Object.hasOwn(ACTIONS, entry.action)
                        ? t(ACTIONS[entry.action])
                        : t("history.unknown", { action: entry.action })}
                    </h2>
                    <time dateTime={entry.createdAt} title={entry.createdAt}>
                      {time.format(new Date(entry.createdAt))}
                    </time>
                  </div>
                  <p>{t("history.actor", { actor: entry.actor.name })}</p>
                  {href ? (
                    <AppLink href={href} onNavigate={onNavigate}>
                      {label}
                    </AppLink>
                  ) : (
                    <p>{label}</p>
                  )}
                  {entry.version !== null && (
                    <p className="event-history__context">
                      {t(
                        entry.previousVersion === null
                          ? "history.version"
                          : "history.versions",
                        {
                          version: entry.version,
                          previous: entry.previousVersion ?? "",
                        },
                      )}
                    </p>
                  )}
                  {entry.changedFields.length > 0 && (
                    <p className="event-history__context">
                      {t("history.fields", {
                        fields: entry.changedFields
                          .map((field) =>
                            Object.hasOwn(FIELDS, field)
                              ? t(FIELDS[field])
                              : field,
                          )
                          .join(", "),
                      })}
                    </p>
                  )}
                  {entry.stateChanges.map((change) => (
                    <p className="event-history__context" key={change.field}>
                      {t(FIELDS[change.field])}:{" "}
                      {change.before === null
                        ? ""
                        : `${t(STATES[change.before])} → `}
                      {t(STATES[change.after])}
                    </p>
                  ))}
                </li>
              );
            })}
          </ol>
          <div className="event-history__actions">
            {state.nextCursor !== null && (
              <button
                className="button button--secondary"
                type="button"
                disabled={state.pending}
                onClick={() => void controller.load(true)}
              >
                {t(state.pending ? "history.loading" : "history.older")}
              </button>
            )}
            <button
              className="button button--secondary"
              type="button"
              disabled={state.pending}
              onClick={() => void controller.load()}
            >
              {t("history.refresh")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
