import { Check, Circle } from "lucide-react";
import { AppLink } from "../../components/AppLink.tsx";
import { StatusBadge } from "../../components/StatusBadge.tsx";
import {
  TASK_PRIORITY_MESSAGE_KEYS,
  TASK_STATUS_MESSAGE_KEYS,
} from "../../domain/labels.ts";
import type { Task, TeamMember } from "../../domain/types.ts";
import { isTaskOverdue } from "../../domain/workspace.ts";
import { useI18n } from "../../i18n/index.ts";
import { tasksHref } from "../../routes.ts";
import { getTaskStatusTone } from "../../utils/statusTone.ts";
import { groupTasksByStatus } from "./helpers.ts";
import "./taskBoard.css";

interface TaskBoardProps {
  eventId: string;
  now: Date;
  tasks: readonly Task[];
  members: readonly Pick<TeamMember, "id" | "name">[];
  timeZone?: string;
  selectedTaskId: string | null;
  onOpen: (taskId: string) => void;
}

export function TaskBoard({
  eventId,
  now,
  tasks,
  members,
  timeZone,
  selectedTaskId,
  onOpen,
}: TaskBoardProps) {
  const { formatNumber, formatTaskDeadline, t } = useI18n(timeZone);
  const memberById = new Map(members.map((member) => [member.id, member]));

  return (
    <section
      className="task-board"
      aria-label={t("tasks.board.label")}
      tabIndex={0}
    >
      {groupTasksByStatus(tasks).map(({ status, tasks: columnTasks }) => (
        <section
          className="task-board__column"
          key={status}
          aria-labelledby={`task-board-${status}`}
        >
          <h2 id={`task-board-${status}`}>
            <StatusBadge
              compact
              tone={getTaskStatusTone(status)}
              label={t(TASK_STATUS_MESSAGE_KEYS[status])}
            />
            <span>{formatNumber(columnTasks.length)}</span>
          </h2>
          {columnTasks.length === 0 ? (
            <p className="task-board__empty">{t("tasks.board.empty")}</p>
          ) : (
            <ul className="task-board__cards" role="list">
              {columnTasks.map((task) => {
                const overdue = isTaskOverdue(task, now);
                const AcceptanceIcon = task.acknowledged ? Check : Circle;
                const selected = selectedTaskId === task.id;

                return (
                  <li
                    key={task.id}
                    className="task-board__card"
                    data-selected={selected || undefined}
                  >
                    <AppLink
                      className="task-board__link"
                      href={tasksHref(eventId, task.id, "board")}
                      onNavigate={() => onOpen(task.id)}
                      data-task-focus-key={`task-board:${task.id}`}
                      aria-current={selected ? "location" : undefined}
                      aria-label={t("common.openTaskNamed", {
                        title: task.title,
                      })}
                    >
                      {task.title}
                    </AppLink>
                    <div className="task-board__meta">
                      <span
                        className={`task-priority task-priority--${task.priority}`}
                      >
                        {t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
                      </span>
                      <time dateTime={task.deadline}>
                        {formatTaskDeadline(task.deadline, task.deadlineTime)}
                      </time>
                      {overdue && (
                        <span className="task-deadline__overdue">
                          {t("taskDetails.overdue")}
                        </span>
                      )}
                    </div>
                    <div className="task-board__meta">
                      <span>
                        {memberById.get(task.ownerId)?.name ??
                          t("common.unassigned")}
                      </span>
                      <span
                        className={`task-acceptance ${task.acknowledged ? "task-acceptance--accepted" : ""}`}
                      >
                        <AcceptanceIcon size={13} aria-hidden="true" />
                        {task.acknowledged
                          ? t("taskDetails.acknowledged")
                          : t("taskDetails.acknowledgementNeeded")}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </section>
  );
}
