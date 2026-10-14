import { useState } from "react";
import { EventArchiveDialog } from "../components/EventArchiveDialog.tsx";
import { EventClearDialog } from "../components/EventClearDialog.tsx";
import {
  readClearAttempt,
  type ClearPreview,
  type ClearAttempt,
  type ClearResult,
} from "../services/eventClearing.ts";
import { readArchiveAttempt } from "../services/eventArchiving.ts";
import { AppLink } from "../components/AppLink.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { useI18n } from "../i18n/index.ts";
import { eventEditHref, eventHref, eventDuplicateHref } from "../routes.ts";
import { revealFocusTarget } from "../navigationFocus.ts";
import type { TaskEvent } from "../services/RemoteWorkspaceService.ts";
import {
  canEditEvent,
  canDuplicateEvent,
  filterEvents,
} from "./events/listing.ts";
import "./events/eventManagement.css";

export function EventManagementPage({
  events,
  status,
  onRetry,
  onNavigate,
  identityId,
  getEvent,
  archiveEvent,
  clearPreview,
  clearTasks,
  onRefresh,
}: {
  events: readonly TaskEvent[];
  status: "loading" | "ready" | "error";
  onRetry: () => void;
  onNavigate: (href: string) => void;
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
  clearPreview: (id: string, signal?: AbortSignal) => Promise<ClearPreview>;
  clearTasks: (
    id: string,
    attempt: ClearAttempt,
    signal?: AbortSignal,
  ) => Promise<ClearResult>;
}) {
  const { t, formatDate } = useI18n();
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<TaskEvent | null>(null);
  const [clearTarget, setClearTarget] = useState<TaskEvent | null>(null);
  const [clearSuccess, setClearSuccess] = useState<{
    name: string;
    count: number;
    refreshFailed: boolean;
  } | null>(null);
  const [dangerOpen, setDangerOpen] = useState<string[]>([]);
  const [success, setSuccess] = useState<{
    name: string;
    refreshFailed: boolean;
  } | null>(null);
  const recoveries =
    status === "ready"
      ? events.filter(
          (e) =>
            e.membership.accessRole === "ORGANIZER" &&
            readArchiveAttempt(identityId, e.id),
        )
      : [];
  const visible = filterEvents(events, archived, query);
  const clearRecoveries =
    status === "ready"
      ? events.filter(
          (e) =>
            !e.archived &&
            e.membership.accessRole === "ORGANIZER" &&
            readClearAttempt(identityId, e.id),
        )
      : [];
  const filtered = query.trim().length > 0;
  return (
    <div
      className="page page--events"
      aria-busy={status === "loading"}
      onFocus={(event) => revealFocusTarget(event.target)}
    >
      <PageHeader
        title={t("events.management.title")}
        description={t("events.management.description")}
        actions={
          <AppLink
            href="/events/new"
            onNavigate={onNavigate}
            className="button button--primary"
          >
            {t("events.create")}
          </AppLink>
        }
      />
      {success && (
        <p className="notice" role="status">
          {t(
            success.refreshFailed
              ? "events.archive.refreshFailed"
              : "events.archive.success",
            { name: success.name },
          )}
        </p>
      )}
      {clearSuccess && (
        <p className="notice" role="status">
          {t(
            clearSuccess.refreshFailed
              ? "events.clear.refreshFailed"
              : clearSuccess.count
                ? "events.clear.success"
                : "events.clear.noop",
            { name: clearSuccess.name, count: clearSuccess.count },
          )}
        </p>
      )}
      {clearRecoveries.map((e) => (
        <div key={e.id} className="notice" role="status">
          <p>{t("events.clear.recoveryNotice", { name: e.name })}</p>
          <button
            className="button button--secondary"
            onClick={() => setClearTarget(e)}
          >
            {t("events.clear.recover")}
          </button>
        </div>
      ))}
      {recoveries.map((e) => (
        <div key={e.id} className="notice" role="status">
          <p>{t("events.archive.recoveryNotice", { name: e.name })}</p>
          <button
            className="button button--secondary"
            onClick={() => setArchiveTarget(e)}
          >
            {t("events.archive.recover")}
          </button>
        </div>
      ))}
      <div className="event-management__controls">
        <div
          className="event-management__filters"
          role="group"
          aria-label={t("events.filter")}
        >
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              className="button button--secondary"
              aria-pressed={archived === value}
              onClick={() => setArchived(value)}
            >
              {t(value ? "events.archived" : "events.active")}
            </button>
          ))}
        </div>
        <div className="event-management__search">
          <label htmlFor="event-search">{t("events.search")}</label>
          <input
            id="event-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      {status === "loading" ? (
        <p className="notice" role="status">
          {t("events.loading")}
        </p>
      ) : status === "error" ? (
        <div className="notice" role="alert">
          <span>{t("events.list.error")}</span>
          <button
            type="button"
            className="button button--secondary"
            onClick={onRetry}
          >
            {t("tasks.remote.retry")}
          </button>
        </div>
      ) : !visible.length ? (
        <EmptyState
          title={t(
            filtered
              ? "events.filtered.empty"
              : archived
                ? "events.archived.empty"
                : events.length
                  ? "events.active.empty"
                  : "events.none",
          )}
          description={t(
            filtered
              ? "events.filtered.description"
              : archived
                ? "events.archived.description"
                : events.length
                  ? "events.active.description"
                  : "events.empty.description",
          )}
        />
      ) : (
        <>
          <p className="event-management__count" role="status">
            {t("events.list.count", { count: visible.length })}
          </p>
          <ul className="event-management__list">
            {visible.map((event) => (
              <li key={event.id} className="event-management__row">
                <div className="event-management__details">
                  <h2>{event.name}</h2>
                  {event.archived && (
                    <p className="event-management__archived">
                      {t("events.archived")}
                    </p>
                  )}
                  <dl>
                    <div>
                      <dt>{t("events.startDate")}</dt>
                      <dd>
                        <time dateTime={event.startDate}>
                          {formatDate(event.startDate)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>{t("events.endDate")}</dt>
                      <dd>
                        <time dateTime={event.endDate}>
                          {formatDate(event.endDate)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>{t("events.timezone")}</dt>
                      <dd>{event.timezone}</dd>
                    </div>
                    <div>
                      <dt>{t("events.accessRole")}</dt>
                      <dd>
                        {t(
                          event.membership.accessRole === "ORGANIZER"
                            ? "events.role.organizer"
                            : "events.role.member",
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="event-management__actions">
                  <AppLink
                    href={eventHref(event.id)}
                    onNavigate={onNavigate}
                    className="button button--secondary"
                    aria-label={`${t(event.archived ? "events.openArchived" : "events.open")}: ${event.name}`}
                  >
                    {t(event.archived ? "events.openArchived" : "events.open")}
                  </AppLink>
                  {canEditEvent(event) && (
                    <AppLink
                      href={eventEditHref(event.id)}
                      onNavigate={onNavigate}
                      className="button button--secondary"
                      aria-label={`${t("events.edit")}: ${event.name}`}
                    >
                      {t("events.edit")}
                    </AppLink>
                  )}
                  <AppLink
                    href={eventHref(event.id, "/history")}
                    onNavigate={onNavigate}
                    className="button button--secondary"
                    aria-label={`${t("history.title")}: ${event.name}`}
                  >
                    {t("history.title")}
                  </AppLink>
                  {canDuplicateEvent(event) && (
                    <AppLink
                      href={eventDuplicateHref(event.id)}
                      onNavigate={onNavigate}
                      className="button button--secondary"
                      aria-label={`${t("events.duplicate")}: ${event.name}`}
                    >
                      {t("events.duplicate")}
                    </AppLink>
                  )}
                </div>
                {canEditEvent(event) && (
                  <details
                    className="event-management__danger"
                    onToggle={(e) => {
                      const open = e.currentTarget.open;
                      setDangerOpen((ids) =>
                        open
                          ? [...new Set([...ids, event.id])]
                          : ids.filter((id) => id !== event.id),
                      );
                    }}
                  >
                    <summary>{t("events.archive.danger")}</summary>
                    {dangerOpen.includes(event.id) && (
                      <>
                        <p>{t("events.archive.description")}</p>
                        <button
                          type="button"
                          className="button event-archive-action"
                          aria-label={`${t("events.archive")}: ${event.name}`}
                          aria-haspopup="dialog"
                          onClick={() => setArchiveTarget(event)}
                        >
                          {t("events.archive")}
                        </button>
                        <p>{t("events.clear.description")}</p>
                        <button
                          type="button"
                          className="button event-clear-action event-clear-trigger"
                          onFocus={(e) => {
                            e.stopPropagation();
                            if (e.currentTarget.matches(":focus-visible"))
                              revealFocusTarget(e.currentTarget);
                          }}
                          aria-label={`${t("events.clear")}: ${event.name}`}
                          aria-haspopup="dialog"
                          onClick={() => setClearTarget(event)}
                        >
                          {t("events.clear")}
                        </button>
                      </>
                    )}
                  </details>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {archiveTarget && (
        <EventArchiveDialog
          key={`${identityId}:${archiveTarget.id}`}
          event={archiveTarget}
          identityId={identityId}
          getEvent={getEvent}
          archiveEvent={archiveEvent}
          onRefresh={onRefresh}
          onClose={() => setArchiveTarget(null)}
          onSuccess={(event, refreshFailed) => {
            setArchiveTarget(null);
            setSuccess({ name: event.name, refreshFailed });
            onNavigate("/events");
          }}
        />
      )}
      {clearTarget && (
        <EventClearDialog
          key={`${identityId}:${clearTarget.id}`}
          event={clearTarget}
          identityId={identityId}
          getPreview={clearPreview}
          clearTasks={clearTasks}
          onRefresh={onRefresh}
          onClose={() => setClearTarget(null)}
          onSuccess={(result, refreshFailed) => {
            setClearTarget(null);
            setClearSuccess({
              name: result.event.name,
              count: result.clearedCount,
              refreshFailed,
            });
          }}
        />
      )}
    </div>
  );
}
