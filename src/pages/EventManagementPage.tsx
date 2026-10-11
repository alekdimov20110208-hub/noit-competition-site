import { useState } from "react";
import { AppLink } from "../components/AppLink.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { useI18n } from "../i18n/index.ts";
import { eventEditHref, eventHref } from "../routes.ts";
import { revealFocusTarget } from "../navigationFocus.ts";
import type { TaskEvent } from "../services/RemoteWorkspaceService.ts";
import { canEditEvent, filterEvents } from "./events/listing.ts";
import "./events/eventManagement.css";

export function EventManagementPage({
  events,
  status,
  onRetry,
  onNavigate,
}: {
  events: readonly TaskEvent[];
  status: "loading" | "ready" | "error";
  onRetry: () => void;
  onNavigate: (href: string) => void;
}) {
  const { t, formatDate } = useI18n();
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");
  const visible = filterEvents(events, archived, query);
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
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
