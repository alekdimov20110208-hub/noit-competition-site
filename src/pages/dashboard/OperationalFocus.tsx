import { useId, useState } from "react";
import { AppLink } from "../../components/AppLink.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { TASK_PRIORITY_MESSAGE_KEYS } from "../../domain/labels.ts";
import type { Task, TeamMember } from "../../domain/types.ts";
import { isTaskOverdue } from "../../domain/workspace.ts";
import { useI18n } from "../../i18n/index.ts";
import { createTaskHref } from "../../routes.ts";
import { getAttentionActionKey, getAttentionReason } from "./helpers.ts";

interface OperationalFocusProps {
  tasks: Task[];
  members: Map<string, TeamMember>;
  now: Date;
  onOpenTask: (taskId: string) => void;
}

export function OperationalFocus({
  tasks,
  members,
  now,
  onOpenTask,
}: OperationalFocusProps) {
  const i18n = useI18n();
  const { t, formatDate } = i18n;
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const visibleTasks = expanded ? tasks : tasks.slice(0, 5);

  return (
    <section className="operational-focus" aria-labelledby="focus-title">
      <header className="dashboard-section-heading">
        <div>
          <p>{t("dashboard.attention.eyebrow")}</p>
          <h2 id="focus-title">{t("dashboard.attention.title")}</h2>
        </div>
        <span>{t("dashboard.attention.description")}</span>
      </header>

      {tasks.length === 0 ? (
        <EmptyState
          title={t("dashboard.attention.empty.title")}
          description={t("dashboard.attention.empty.description")}
        />
      ) : (
        <ol className="focus-list" id={listId}>
          {visibleTasks.map((task, index) => {
            const overdue = isTaskOverdue(task, now);
            const owner = members.get(task.ownerId);
            const risk =
              task.status === "blocked" || overdue ? "critical" : "normal";

            return (
              <li key={task.id}>
                <AppLink
                  href={createTaskHref(task.id)}
                  onNavigate={() => onOpenTask(task.id)}
                  className={`focus-item focus-item--${risk}`}
                  data-task-focus-key={`focus:${task.id}`}
                >
                  <span className="focus-item__number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="focus-item__body">
                    <span className="focus-item__topline">
                      <span className="focus-item__action">
                        {t(getAttentionActionKey(task, overdue))}
                      </span>
                      <span
                        className={`focus-item__priority focus-item__priority--${task.priority}`}
                      >
                        {t("taskDetails.priority")}:{" "}
                        {t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
                      </span>
                    </span>
                    <strong>{task.title}</strong>
                    <span className="focus-item__reason">
                      {getAttentionReason(task, now, i18n)}
                    </span>
                    <span className="focus-item__meta">
                      <span>
                        {t("taskDetails.owner")}:{" "}
                        {owner?.name ?? t("common.unassigned")}
                      </span>
                      <time dateTime={task.deadline}>
                        {t(
                          overdue
                            ? "dashboard.attention.wasDue"
                            : "dashboard.attention.due",
                          { date: formatDate(task.deadline) },
                        )}
                      </time>
                    </span>
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ol>
      )}
      {tasks.length > 5 && (
        <button
          type="button"
          className="text-button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
        >
          {t(
            expanded
              ? "dashboard.attention.showLess"
              : "dashboard.attention.showMore",
          )}
        </button>
      )}
    </section>
  );
}
