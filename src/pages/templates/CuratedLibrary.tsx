import { useEffect, useRef, useState } from "react";
import { BookOpen, CalendarDays } from "lucide-react";
import {
  curatedCategories,
  curatedDifficulties,
  filterCuratedTemplates,
  type CuratedTemplate,
} from "../../domain/curatedTemplates.ts";
import { getCalendarDayNumber } from "../../domain/taskTiming.ts";
import { resolveTemplateDeadline } from "../../domain/templateDates.ts";
import { useI18n } from "../../i18n/index.ts";
import type { TaskEvent } from "../../services/RemoteWorkspaceService.ts";
import { fetchCuratedCatalog } from "../../services/curatedTemplates.ts";
import { TemplateFailure } from "../../services/templateApplications.ts";
import type { TaskReadState } from "../../services/taskReadState.ts";
import { TemplateApplicationPanel } from "./TemplateApplicationPanel.tsx";
import "./curated.css";

type Props = {
  userId: string;
  eventId: string | null;
  event: TaskEvent | null;
  readState: TaskReadState;
  onRetry: () => void;
  onRefresh: () => Promise<void>;
  onUnauthorized: () => void;
  onNavigate: (href: string) => void;
};
function CuratedDetail({
  template,
  ...props
}: Props & { template: CuratedTemplate }) {
  const { t, language, plural, formatTaskDeadline } = useI18n();
  const [selected, setSelected] = useState(() =>
    template.items.map((item) => item.id),
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const event = props.event;
  const start = event ? getCalendarDayNumber(event.startDate) : null,
    end = event ? getCalendarDayNumber(event.endDate) : null;
  const duration = start !== null && end !== null ? end - start + 1 : null;
  return (
    <>
      <section className="templates-t1__intro">
        <BookOpen size={28} aria-hidden="true" />
        <div>
          <p className="eyebrow">
            {t(`templates.t4.${template.category}`)} ·{" "}
            {t(`templates.t4.${template.difficulty}`)} · v{template.version}
          </p>
          <h2 ref={heading} tabIndex={-1}>
            {template.name[language]}
          </h2>
          <p>{template.description[language]}</p>
          <p>{template.audience[language]}</p>
        </div>
      </section>
      <p className="notice">{t("templates.t4.preparation")}</p>
      {template.durationDays !== null && (
        <p className="notice">
          {t("templates.t4.duration", { days: template.durationDays })}
        </p>
      )}
      {event &&
        template.durationDays !== null &&
        duration !== template.durationDays && (
          <p role="status" className="notice">
            {t("templates.t4.durationMismatch")}
          </p>
        )}
      <section
        className="templates-t1__event"
        aria-label={t("templates.t1.event")}
        aria-busy={props.readState.status === "loading"}
      >
        {event ? (
          <div>
            <p className="eyebrow">{t("templates.t1.event")}</p>
            <h2>{event.name}</h2>
            <p>
              {t("templates.t1.start", {
                date: event.startDate,
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
          <p role={props.readState.status === "error" ? "alert" : "status"}>
            {t(
              props.readState.status === "loading"
                ? "templates.t1.loading"
                : props.readState.status === "error"
                  ? "templates.t1.error"
                  : "templates.t1.noEvent",
            )}
          </p>
        )}
        <div className="templates-t1__context-actions">
          {props.readState.status === "error" && (
            <button
              type="button"
              className="button button--secondary"
              onClick={props.onRetry}
            >
              {t("templates.t1.retry")}
            </button>
          )}
          <button
            type="button"
            className="button button--quiet"
            onClick={() => props.onNavigate("/events")}
          >
            {t("templates.t1.manage")}
          </button>
        </div>
      </section>
      <fieldset className="templates-t1__items">
        <legend>{t("templates.t1.items")}</legend>
        <div className="templates-t1__toolbar">
          <p role="status" aria-live="polite">
            {t("templates.t1.selected", {
              selected: selected.length,
              total: template.itemCount,
            })}
          </p>
          <div>
            <button
              type="button"
              className="button button--quiet"
              disabled={selected.length === template.itemCount}
              onClick={() => setSelected(template.items.map((item) => item.id))}
            >
              {t("templates.t1.all")}
            </button>
            <button
              type="button"
              className="button button--quiet"
              disabled={!selected.length}
              onClick={() => setSelected([])}
            >
              {t("templates.t1.none")}
            </button>
          </div>
        </div>
        {!selected.length && (
          <p className="notice" role="status">
            {t("templates.t1.empty")}
          </p>
        )}
        <div className="templates-t1__list">
          {template.items.map((item) => {
            const content = item.text[language],
              checked = selected.includes(item.id);
            let deadline: string | null = null,
              invalid = false;
            if (event) {
              try {
                deadline = resolveTemplateDeadline(
                  event.startDate,
                  item.dayOffset,
                  item.deadlineTime,
                ).deadline;
              } catch {
                invalid = true;
              }
            }
            return (
              <article
                className="templates-t1__item"
                data-selected={checked}
                key={item.id}
              >
                <div className="templates-t1__task">
                  <label className="templates-t1__choice">
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-describedby={`curated-${item.id}-context`}
                      onChange={() =>
                        setSelected((current) =>
                          template.items
                            .filter((candidate) =>
                              candidate.id === item.id
                                ? !current.includes(candidate.id)
                                : current.includes(candidate.id),
                            )
                            .map((candidate) => candidate.id),
                        )
                      }
                    />
                    <span>{content.title}</span>
                  </label>
                  <p id={`curated-${item.id}-context`}>{content.context}</p>
                  <div className="templates-t1__meta">
                    <span>{content.category}</span>
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
                    {deadline
                      ? formatTaskDeadline(deadline, item.deadlineTime)
                      : t(
                          invalid
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
      {props.eventId && (
        <TemplateApplicationPanel
          userId={props.userId}
          eventId={props.eventId}
          event={event}
          selected={selected}
          curated={template}
          onRefresh={props.onRefresh}
          onUnauthorized={props.onUnauthorized}
          onNavigate={props.onNavigate}
        />
      )}
    </>
  );
}

export function CuratedLibrary(props: Props) {
  const { t, language } = useI18n();
  const [templates, setTemplates] = useState<CuratedTemplate[] | null>(null);
  const [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [difficulty, setDifficulty] = useState("");
  const [opened, setOpened] = useState<string | null>(null);
  const unauthorized = useRef(props.onUnauthorized);
  unauthorized.current = props.onUnauthorized;
  const opener = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setTemplates(null);
    setError(false);
    setOpened(null);
    void fetchCuratedCatalog(
      AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    )
      .then((result) => {
        if (!controller.signal.aborted) setTemplates(result);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (
          error instanceof TemplateFailure &&
          error.code === "unauthenticated"
        )
          unauthorized.current();
        setError(true);
      });
    return () => controller.abort();
  }, [props.userId, retry]);
  if (error)
    return (
      <div role="alert">
        <p>{t("templates.t4.error")}</p>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setRetry((value) => value + 1)}
        >
          {t("templates.t1.retry")}
        </button>
      </div>
    );
  if (!templates) return <p role="status">{t("templates.t4.loading")}</p>;
  const template = templates.find((entry) => entry.id === opened);
  if (template)
    return (
      <div className="curated-library">
        <button
          type="button"
          className="button button--quiet"
          onClick={() => {
            setOpened(null);
            requestAnimationFrame(() => {
              if (opener.current)
                document.getElementById(opener.current)?.focus();
            });
          }}
        >
          {t("templates.t4.back")}
        </button>
        <CuratedDetail
          key={`${props.userId}:${props.eventId}:${template.id}`}
          {...props}
          template={template}
        />
      </div>
    );
  const filtered = filterCuratedTemplates(
    templates,
    search,
    category,
    difficulty,
    language,
  );
  return (
    <section
      className="curated-library"
      aria-labelledby="curated-library-title"
    >
      <div>
        <h2 id="curated-library-title">{t("templates.t4.library")}</h2>
        <p>{t("templates.t4.description")}</p>
      </div>
      <div className="curated-library__filters">
        <label>
          {t("templates.t4.search")}
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={200}
          />
        </label>
        <label>
          {t("templates.t4.category")}
          <select
            aria-label={t("templates.t4.category")}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{t("templates.t4.anyCategory")}</option>
            {curatedCategories.map((value) => (
              <option key={value} value={value}>
                {t(`templates.t4.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("templates.t4.difficulty")}
          <select
            aria-label={t("templates.t4.difficulty")}
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="">{t("templates.t4.anyDifficulty")}</option>
            {curatedDifficulties.map((value) => (
              <option key={value} value={value}>
                {t(`templates.t4.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status" aria-live="polite">
        {t("templates.t4.results", {
          count: filtered.length,
          total: templates.length,
        })}
      </p>
      {!templates.length ? (
        <p>{t("templates.t4.empty")}</p>
      ) : !filtered.length ? (
        <div>
          <p>{t("templates.t4.noResults")}</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              setSearch("");
              setCategory("");
              setDifficulty("");
            }}
          >
            {t("templates.t4.clear")}
          </button>
        </div>
      ) : (
        <div className="curated-library__grid">
          {filtered.map((entry) => (
            <article key={entry.id} className="curated-library__card">
              <div className="curated-library__badges">
                <span>{t(`templates.t4.${entry.category}`)}</span>
                <span>{t(`templates.t4.${entry.difficulty}`)}</span>
              </div>
              <h3>{entry.name[language]}</h3>
              <p>{entry.description[language]}</p>
              <p className="curated-library__count">
                {t("templates.t4.count", {
                  count: entry.itemCount,
                  version: entry.version,
                })}
              </p>
              <button
                type="button"
                className="button button--secondary"
                aria-label={`${t("templates.t4.open")}: ${entry.name[language]}`}
                id={`${entry.id}-open`}
                onClick={() => {
                  opener.current = `${entry.id}-open`;
                  setOpened(entry.id);
                }}
              >
                {t("templates.t4.open")}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
