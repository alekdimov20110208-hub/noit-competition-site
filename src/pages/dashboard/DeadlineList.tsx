import { ArrowRight } from "lucide-react";
import { AppLink } from "../../components/AppLink.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { StatusBadge } from "../../components/StatusBadge.tsx";
import { TASK_STATUS_MESSAGE_KEYS } from "../../domain/labels.ts";
import type { Task, TeamMember } from "../../domain/types.ts";
import { useI18n } from "../../i18n/index.ts";
import { createTaskHref } from "../../routes.ts";
import { getTaskStatusTone } from "../../utils/statusTone.ts";

interface DeadlineListProps {
  tasks: Task[];
  members: Map<string, TeamMember>;
  now: Date;
  onNavigate: (path: string) => void;
  onOpenTask: (taskId: string) => void;
}

export function DeadlineList({
  tasks,
  members,
  now,
  onNavigate,
  onOpenTask,
}: DeadlineListProps) {
  const { t, formatDate, formatRelativeDate, formatShortDate } = useI18n();

  return (
    <section
      className="panel panel--deadlines"
      aria-labelledby="deadlines-title"
    >
      <div className="panel__header">
        <div>
          <p className="eyebrow">{t("dashboard.deadlines.eyebrow")}</p>
          <h2 id="deadlines-title">{t("dashboard.deadlines.title")}</h2>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => onNavigate("/tasks")}
        >
          {t("dashboard.deadlines.view")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="deadline-list">
        {tasks.length === 0 ? (
          <EmptyState
            title={t("dashboard.deadlines.empty.title")}
            description={t("dashboard.deadlines.empty.description")}
          />
        ) : (
          tasks.map((task) => {
            const owner = members.get(task.ownerId);
            return (
              <AppLink
                href={createTaskHref(task.id)}
                onNavigate={() => onOpenTask(task.id)}
                className="deadline-item deadline-item--action"
                data-task-focus-key={`deadline:${task.id}`}
                key={task.id}
              >
                <span className="sr-only">{t("common.openTask")}. </span>
                <time
                  dateTime={task.deadline}
                  title={formatDate(task.deadline)}
                >
                  <span>{formatRelativeDate(task.deadline, now)}</span>
                  <strong>{formatShortDate(task.deadline)}</strong>
                </time>
                <span className="deadline-item__content">
                  <strong className="deadline-item__title">{task.title}</strong>
                  <span className="deadline-item__description">
                    {task.context}
                  </span>
                  <span>
                    {t("taskDetails.owner")}:{" "}
                    {owner?.name ?? t("common.unassigned")}
                  </span>
                </span>
                <StatusBadge
                  compact
                  tone={getTaskStatusTone(task.status)}
                  label={t(TASK_STATUS_MESSAGE_KEYS[task.status])}
                />
              </AppLink>
            );
          })
        )}
      </div>
    </section>
  );
}
