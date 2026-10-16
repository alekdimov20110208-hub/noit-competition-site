import { CalendarDays, ClipboardList, Info } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/PageHeader.tsx";
import { AIKIDO_SEMINAR_STARTER } from "../domain/eventTemplates.ts";
import { useI18n } from "../i18n/index.ts";
import { revealFocusTarget } from "../navigationFocus.ts";
import type { TaskReadState } from "../services/taskReadState.ts";
import {
  previewTemplateItem,
  templatePreviewEvent,
  toggleTemplateItem,
} from "./templates/preview.ts";
import "./templates/templates.css";
import { TemplateApplicationPanel } from "./templates/TemplateApplicationPanel.tsx";

export function StarterTemplatesPage({
  readState,
  requestedEventId,
  onRetry,
  onNavigate,
  userId,
  onRefresh,
  onUnauthorized,
}: {
  readState: TaskReadState;
  requestedEventId: string | null;
  onRetry: () => void;
  onNavigate: (href: string) => void;
  userId: string;
  onRefresh: () => Promise<void>;
  onUnauthorized: () => void;
}) {
  const { t, plural, formatDate, formatTaskDeadline, formatNumber } = useI18n();
  const template = AIKIDO_SEMINAR_STARTER;
  const [selected, setSelected] = useState(() =>
    template.items.map((item) => item.id),
  );
  const event = templatePreviewEvent(readState, requestedEventId);
  const denied =
    readState.error === "forbidden" || readState.error === "not-found";
  const contextMessage =
    readState.status === "loading"
      ? "templates.t1.loading"
      : readState.status === "error"
        ? denied
          ? "templates.t1.denied"
          : "templates.t1.error"
        : "templates.t1.noEvent";

  return (
    <div
      className="page page--templates-t1"
      onFocus={(e) => revealFocusTarget(e.target)}
    >
      <PageHeader
        eyebrow={t("templates.t1.eyebrow")}
        title={t("templates.title")}
        description={t("templates.t1.description")}
      />
      <section
        className="templates-t1__intro"
        aria-labelledby="starter-template-name"
      >
        <ClipboardList size={28} aria-hidden="true" />
        <div>
          <p className="eyebrow">
            {t("templates.t1.curated", { version: template.version })}
          </p>
          <h2 id="starter-template-name">{t(template.titleKey)}</h2>
          <p>{t(template.descriptionKey)}</p>
        </div>
      </section>
      <div className="templates-t1__scope">
        <Info size={18} aria-hidden="true" />
        <p>{t("templates.t2.scope")}</p>
      </div>
      <section
        className="templates-t1__event"
        aria-label={t("templates.t1.event")}
        aria-busy={readState.status === "loading"}
      >
        {event ? (
          <div>
            <p className="eyebrow">{t("templates.t1.event")}</p>
            <h2>{event.name}</h2>
            <p>
              {t("templates.t1.start", {
                date: formatDate(event.startDate),
                timezone: event.timezone,
              })}
            </p>
            <p className="templates-t1__access">
              {t(
                event.archived
                  ? "templates.t1.archived"
                  : event.membership.accessRole === "MEMBER"
                    ? "templates.t2.member"
                    : "templates.t2.organizer",
              )}
            </p>
          </div>
        ) : (
          <p role={readState.status === "error" ? "alert" : "status"}>
            {t(contextMessage)}
          </p>
        )}
        <div className="templates-t1__context-actions">
          {readState.status === "error" && (
            <button
              type="button"
              className="button button--secondary"
              onClick={onRetry}
            >
              {t("templates.t1.retry")}
            </button>
          )}
          <button
            type="button"
            className="button button--quiet"
            onClick={() => onNavigate("/events")}
          >
            {t("templates.t1.manage")}
          </button>
        </div>
      </section>
      <fieldset className="templates-t1__items">
        <legend>{t("templates.t1.items")}</legend>
        <div className="templates-t1__toolbar">
          <p role="status" aria-live="polite" aria-atomic="true">
            {t("templates.t1.selected", {
              selected: formatNumber(selected.length),
              total: formatNumber(template.items.length),
            })}
          </p>
          <div>
            <button
              type="button"
              className="button button--quiet"
              disabled={selected.length === template.items.length}
              onClick={() => setSelected(template.items.map((item) => item.id))}
            >
              {t("templates.t1.all")}
            </button>
            <button
              type="button"
              className="button button--quiet"
              disabled={selected.length === 0}
              onClick={() => setSelected([])}
            >
              {t("templates.t1.none")}
            </button>
          </div>
        </div>
        {selected.length === 0 && (
          <p className="notice" role="status">
            {t("templates.t1.empty")}
          </p>
        )}
        <div className="templates-t1__list">
          {template.items.map((item) => {
            const checked = selected.includes(item.id);
            const preview = previewTemplateItem(item, event);
            const contextId = `template-${item.id}-context`;
            return (
              <article
                key={item.id}
                className="templates-t1__item"
                data-selected={checked}
              >
                <div className="templates-t1__task">
                  <label className="templates-t1__choice">
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-describedby={contextId}
                      onChange={() =>
                        setSelected((current) =>
                          toggleTemplateItem(template, current, item.id),
                        )
                      }
                    />
                    <span>{t(item.titleKey)}</span>
                  </label>
                  <p id={contextId}>{t(item.contextKey)}</p>
                  <div className="templates-t1__meta">
                    <span>{t(item.categoryKey)}</span>
                    <span
                      className={`templates-t1__priority templates-t1__priority--${item.priority}`}
                    >
                      {t(`priority.${item.priority}`)}
                    </span>
                    <span>{t("templates.t1.reminders")}</span>
                  </div>
                </div>
                <div className="templates-t1__deadline">
                  <span className="templates-t1__deadline-label">
                    <CalendarDays size={15} aria-hidden="true" />
                    {t("templates.t1.deadline")}
                  </span>
                  <strong>
                    {preview.status === "ready"
                      ? formatTaskDeadline(
                          preview.deadline,
                          preview.deadlineTime,
                        )
                      : t(
                          preview.status === "invalid"
                            ? "templates.t1.invalidDate"
                            : "templates.t1.needsEvent",
                        )}
                  </strong>
                  <span>
                    {item.dayOffset === 0
                      ? t("templates.t1.dayZero")
                      : plural(
                          Math.abs(item.dayOffset),
                          item.dayOffset < 0
                            ? {
                                one: "templates.t1.before.one",
                                other: "templates.t1.before.other",
                              }
                            : {
                                one: "templates.t1.after.one",
                                other: "templates.t1.after.other",
                              },
                        )}
                  </span>
                  <span>
                    {item.deadlineTime === null
                      ? t("templates.t1.dateOnly")
                      : t("templates.t1.localTime", {
                          time: item.deadlineTime,
                        })}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </fieldset>
      {(requestedEventId || event?.id) && (
        <TemplateApplicationPanel
          userId={userId}
          eventId={requestedEventId ?? event!.id}
          event={event}
          selected={selected}
          onRefresh={onRefresh}
          onUnauthorized={onUnauthorized}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
