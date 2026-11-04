import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/index.ts";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { TaskDrawer } from "../components/TaskDrawer.tsx";
import type { TaskReadState } from "../services/taskReadState.ts";
import {
  calendarDateLabel,
  monthLabel,
  monthWeeks,
  tasksByDay,
  weekdayLabels,
} from "./calendar/month.ts";
import { CalendarAgenda } from "./calendar/CalendarAgenda.tsx";
import {
  CALENDAR_VIEWS,
  currentCalendarDate,
  shiftCalendarDate,
  weekDates,
  type CalendarLocation,
} from "./calendar/views.ts";
import "./calendar/calendar.css";

export function CalendarPage({
  state,
  now,
  onRetry,
  location,
  onLocationChange,
}: {
  state: TaskReadState;
  now: Date;
  onRetry: () => void;
  location?: CalendarLocation;
  onLocationChange: (location: CalendarLocation) => void;
}) {
  const { t, locale, formatDateRange } = useI18n();
  const [taskId, setTaskId] = useState<string | null>(null);
  const { currentEventId, events, tasks, teamMembers } = state.workspace;
  const event = events.find((event) => event.id === currentEventId);
  const today = currentCalendarDate(now);
  const view = location?.view ?? "month";
  const reference = location?.date ?? today;
  const displayed = reference.slice(0, 7);
  const week =
    view === "week" ? weekDates(reference).filter((day) => day !== null) : [];
  const title =
    view === "month"
      ? monthLabel(displayed, locale)
      : view === "week"
        ? formatDateRange(week[0]!, week.at(-1)!)
        : t("calendar.agenda");
  const previous =
    view === "list" ? null : shiftCalendarDate(reference, view, -1);
  const next = view === "list" ? null : shiftCalendarDate(reference, view, 1);
  const byDay = tasksByDay(tasks, currentEventId, displayed);
  const move = (date: string) => onLocationChange({ view, date });
  const selectedTask =
    tasks.find(
      (task) => task.id === taskId && task.eventId === currentEventId,
    ) ?? null;
  return (
    <div className="page calendar-page" aria-busy={state.status === "loading"}>
      <PageHeader
        title={t("nav.calendar")}
        description={t("calendar.description")}
      />
      {state.status === "ready" && !event ? (
        <EmptyState
          title={t("tasks.remote.noEvent.title")}
          description={t("tasks.remote.noEvent.description")}
        />
      ) : state.status !== "ready" || !event ? (
        <div
          className="notice"
          role={state.status === "error" ? "alert" : "status"}
        >
          <span>
            {t(
              state.status === "loading"
                ? "workspace.loading"
                : state.error === "forbidden"
                  ? "workspace.forbidden"
                  : state.error === "not-found"
                    ? "events.error.not-found"
                    : "workspace.error",
            )}
          </span>
          {state.status === "error" && (
            <button
              className="button button--secondary"
              type="button"
              onClick={onRetry}
            >
              {t("tasks.remote.retry")}
            </button>
          )}
        </div>
      ) : (
        <>
          {state.mutation?.needsRefresh && (
            <div className="notice" role="alert">
              <span>{t("workspace.stale")}</span>
              <button
                type="button"
                className="button button--secondary"
                onClick={onRetry}
              >
                {t("tasks.remote.retry")}
              </button>
            </div>
          )}
          <div
            className="calendar-page__views"
            role="group"
            aria-label={t("calendar.views")}
          >
            {CALENDAR_VIEWS.map((option) => (
              <button
                key={option}
                type="button"
                className={`button button--${view === option ? "primary" : "secondary"}`}
                aria-pressed={view === option}
                onClick={() =>
                  onLocationChange({ view: option, date: reference })
                }
              >
                {t(`calendar.view.${option}`)}
              </button>
            ))}
          </div>
          <div className="calendar-page__toolbar">
            <h2
              id={view === "month" ? "calendar-month" : "calendar-period"}
              aria-live="polite"
              aria-atomic="true"
            >
              {title}
            </h2>
            <div
              className="calendar-page__navigation"
              role="group"
              aria-label={t("nav.calendar")}
            >
              {view !== "list" && (
                <>
                  <button
                    type="button"
                    className="button button--secondary"
                    aria-label={t(
                      view === "month"
                        ? "calendar.previous"
                        : "calendar.previousWeek",
                    )}
                    disabled={!previous}
                    onClick={() => previous && move(previous)}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => move(today)}
                  >
                    {t(
                      view === "month" ? "calendar.current" : "calendar.today",
                    )}
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    aria-label={t(
                      view === "month" ? "calendar.next" : "calendar.nextWeek",
                    )}
                    disabled={!next}
                    onClick={() => next && move(next)}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </>
              )}
              <button
                type="button"
                className="button button--secondary"
                onClick={onRetry}
              >
                {t("calendar.refresh")}
              </button>
            </div>
          </div>
          <p className="calendar-page__range">
            {t("calendar.eventRange", {
              event: event.name,
              range: formatDateRange(event.startDate, event.endDate),
            })}
          </p>
          <p className="calendar-page__context">
            {t("calendar.timezone", { timezone: event.timezone })}
          </p>
          {view === "month" ? (
            <>
              <p role="status">
                {byDay.size
                  ? t("calendar.count", {
                      count: [...byDay.values()].reduce(
                        (count, tasks) => count + tasks.length,
                        0,
                      ),
                    })
                  : t("calendar.empty")}
              </p>
              <p id="calendar-scroll" className="calendar-page__hint">
                {t("calendar.scroll")}
              </p>
              <div
                className="calendar-page__scroll"
                role="region"
                aria-labelledby="calendar-month"
                aria-describedby="calendar-scroll"
                tabIndex={0}
              >
                <table
                  className="calendar-page__table"
                  aria-labelledby="calendar-month"
                >
                  <thead>
                    <tr>
                      {weekdayLabels(locale).map((day) => (
                        <th scope="col" key={day.full}>
                          <abbr title={day.full}>{day.short}</abbr>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthWeeks(displayed).map((week, index) => (
                      <tr key={index}>
                        {week.map((date, dayIndex) => {
                          const eventDay =
                            date !== null &&
                            date >= event.startDate &&
                            date <= event.endDate;
                          const dayTasks = date ? byDay.get(date) : undefined;
                          return (
                            <td
                              key={date ?? `blank-${dayIndex}`}
                              className={
                                date === today
                                  ? "calendar-page__today"
                                  : undefined
                              }
                              data-event-day={eventDay || undefined}
                            >
                              {date && (
                                <>
                                  <time
                                    className="calendar-page__date"
                                    dateTime={date}
                                    aria-label={
                                      eventDay
                                        ? t("calendar.eventDay", {
                                            date: calendarDateLabel(
                                              date,
                                              locale,
                                            ),
                                          })
                                        : calendarDateLabel(date, locale)
                                    }
                                    aria-current={
                                      date === today ? "date" : undefined
                                    }
                                  >
                                    {Number(date.slice(-2))}
                                  </time>
                                  {dayTasks && (
                                    <ul className="calendar-page__tasks">
                                      {dayTasks.map((task) => (
                                        <li key={task.id}>
                                          <button
                                            type="button"
                                            onClick={() => setTaskId(task.id)}
                                          >
                                            <span className="calendar-page__task-title">
                                              {task.title}
                                            </span>
                                            {task.deadlineTime ? (
                                              <time
                                                dateTime={`${date}T${task.deadlineTime}`}
                                              >
                                                {task.deadlineTime}
                                              </time>
                                            ) : (
                                              <span className="calendar-page__date-only">
                                                {t("calendar.dateOnly")}
                                              </span>
                                            )}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <CalendarAgenda
              view={view}
              event={event}
              tasks={tasks}
              team={teamMembers}
              date={reference}
              today={today}
              onOpen={setTaskId}
            />
          )}
          <TaskDrawer
            now={now}
            task={selectedTask}
            owner={teamMembers.find(
              (member) => member.id === selectedTask?.ownerId,
            )}
            timeZone={event.timezone}
            onClose={() => setTaskId(null)}
            readOnly
          />
        </>
      )}
    </div>
  );
}
