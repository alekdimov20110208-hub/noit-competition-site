import { AppLink } from "../../components/AppLink.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { StatusBadge } from "../../components/StatusBadge.tsx";
import { TASK_PRIORITY_MESSAGE_KEYS } from "../../domain/labels.ts";
import type { Task, TeamMember } from "../../domain/types.ts";
import { isTaskOverdue } from "../../domain/workspace.ts";
import { useI18n } from "../../i18n/index.ts";
import { createTaskHref } from "../../routes.ts";
import {
  getAttentionActionKey,
  getAttentionReason,
  taskPriorityTone,
} from "./helpers.ts";

interface AttentionQueueProps {
  tasks: Task[];
  members: Map<string, TeamMember>;
  now: Date;
  onOpenTask: (taskId: string) => void;
}

export function AttentionQueue({
  tasks,
  members,
  now,
  onOpenTask,
}: AttentionQueueProps) {
  const i18n = useI18n();
  const { t } = i18n;

  return (
    <section
      className="panel panel--attention"
      aria-labelledby="attention-title"
    >
      <div className="panel__header">
        <div>
          <p className="eyebrow">{t("dashboard.attention.eyebrow")}</p>
          <h2 id="attention-title">{t("dashboard.attention.title")}</h2>
        </div>
      </div>
      <div className="attention-list">
        {tasks.length === 0 ? (
          <EmptyState
            title={t("dashboard.attention.empty.title")}
            description={t("dashboard.attention.empty.description")}
          />
        ) : (
          tasks.map((task) => {
            const overdue = isTaskOverdue(task, now);
            const owner = members.get(task.ownerId);
            return (
              <AppLink
                href={createTaskHref(task.id)}
                onNavigate={() => onOpenTask(task.id)}
                className="attention-item"
                data-task-focus-key={`attention:${task.id}`}
                key={task.id}
              >
                <span className="sr-only">{t("common.openTask")}. </span>
                <span
                  className={`attention-item__marker attention-item__marker--${task.priority}`}
                  aria-hidden="true"
                />
                <span className="attention-item__body">
                  <span className="attention-item__action">
                    {t(getAttentionActionKey(task, overdue))}
                  </span>
                  <strong>{task.title}</strong>
                  <small>
                    <span>{getAttentionReason(task, overdue, i18n)}</span>
                    <span>
                      {t("taskDetails.owner")}:{" "}
                      {owner?.name ?? t("common.unassigned")}
                    </span>
                  </small>
                </span>
                <StatusBadge
                  compact
                  tone={taskPriorityTone(task.priority)}
                  label={t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
                />
              </AppLink>
            );
          })
        )}
      </div>
    </section>
  );
}
