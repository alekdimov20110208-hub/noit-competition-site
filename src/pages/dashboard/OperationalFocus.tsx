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
        <ol className="focus-list">
          {tasks.map((task, index) => {
            const overdue = isTaskOverdue(task, now);
            const owner = members.get(task.ownerId);
            const risk = task.status === "blocked" ? "critical" : task.priority;

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
                    <span className="focus-item__action">
                      {t(getAttentionActionKey(task, overdue))}
                    </span>
                    <strong>{task.title}</strong>
                    <span className="focus-item__reason">
                      {getAttentionReason(task, overdue, i18n)}
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
                  <span
                    className={`focus-item__priority focus-item__priority--${task.priority}`}
                  >
                    {t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
