import type { Task } from "../../domain/types.ts";
import type {
  TaskAssignee,
  TaskEvent,
} from "../../services/RemoteWorkspaceService.ts";
import {
  TASK_PRIORITY_MESSAGE_KEYS,
  TASK_STATUS_MESSAGE_KEYS,
} from "../../domain/labels.ts";
import { useI18n } from "../../i18n/index.ts";
import { StatusBadge } from "../../components/StatusBadge.tsx";
import { getTaskStatusTone } from "../../utils/statusTone.ts";
import { calendarDateLabel, weekdayLabels } from "./month.ts";
import { groupAgenda, weekDates } from "./views.ts";

export function CalendarAgenda({
  view,
  event,
  tasks,
  team,
  date,
  today,
  onOpen,
}: {
  view: "week" | "list";
  event: TaskEvent;
  tasks: readonly Task[];
  team: readonly TaskAssignee[];
  date: string;
  today: string;
  onOpen: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const { dated, undated } = groupAgenda(tasks, event.id);
  const people = new Map(team.map(({ id, name }) => [id, name]));
  const week = view === "week";
  const days = week
    ? weekDates(date).map((day) => ({
        date: day,
        tasks: dated.find((group) => group.date === day)?.tasks ?? [],
      }))
    : dated;
  const weekdays = weekdayLabels(locale);

  const taskList = (items: readonly Task[], day: string | null) => (
    <ul className="calendar-page__tasks calendar-agenda__tasks">
      {items.map((task) => {
        const assignee = people.get(task.ownerId);
        return (
          <li key={task.id}>
            <button type="button" onClick={() => onOpen(task.id)}>
              <span className="calendar-page__task-title">{task.title}</span>
              <span className="calendar-agenda__meta">
                {day && task.deadlineTime ? (
                  <time dateTime={`${day}T${task.deadlineTime}`}>
                    {task.deadlineTime}
                  </time>
                ) : (
                  <span className="calendar-page__date-only">
                    {t(day ? "calendar.dateOnly" : "calendar.noDeadline")}
                  </span>
                )}
                <StatusBadge
                  tone={getTaskStatusTone(task.status)}
                  label={t(TASK_STATUS_MESSAGE_KEYS[task.status])}
                  compact
                />
                {week && (
                  <StatusBadge
                    tone={
                      task.priority === "critical"
                        ? "critical"
                        : task.priority === "important"
                          ? "warning"
                          : "neutral"
                    }
                    label={t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
                    compact
                  />
                )}
                {!week && (assignee || !task.ownerId) && (
                  <span>{assignee ?? t("common.unassigned")}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  return (
    <div
      className={
        week ? "calendar-agenda calendar-agenda--week" : "calendar-agenda"
      }
    >
      {!week && !dated.length && !undated.length && (
        <p role="status">{t("calendar.emptyList")}</p>
      )}
      {days.map(({ date: day, tasks: items }, index) => {
        const inEvent =
          day !== null && day >= event.startDate && day <= event.endDate;
        return (
          <section
            key={day ?? index}
            className="calendar-agenda__day"
            data-event-day={inEvent || undefined}
            aria-labelledby={`calendar-day-${index}`}
          >
            <h3 id={`calendar-day-${index}`}>
              {week && <span>{weekdays[index]!.full}</span>}
              {day && (
                <time
                  dateTime={day}
                  aria-current={day === today ? "date" : undefined}
                >
                  {calendarDateLabel(day, locale)}
                </time>
              )}
            </h3>
            {items.length ? (
              taskList(items, day)
            ) : (
              <p>{t("calendar.emptyDay")}</p>
            )}
          </section>
        );
      })}
      {!week && undated.length > 0 && (
        <section
          className="calendar-agenda__day"
          aria-labelledby="calendar-undated"
        >
          <h3 id="calendar-undated">{t("calendar.noDeadline")}</h3>
          {taskList(undated, null)}
        </section>
      )}
    </div>
  );
}
