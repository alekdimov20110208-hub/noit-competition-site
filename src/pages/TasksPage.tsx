import {
  AlertTriangle,
  Check,
  ChevronDown,
  Filter,
  Layers3,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppLink } from "../components/AppLink.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { TaskDrawer } from "../components/TaskDrawer.tsx";
import {
  TASK_PRIORITY_MESSAGE_KEYS,
  TASK_STATUS_MESSAGE_KEYS,
} from "../domain/labels.ts";
import type {
  Task,
  TaskStatus,
  TeamMember,
  WorkspaceState,
} from "../domain/types.ts";
import { isTaskOverdue } from "../domain/workspace.ts";
import { useI18n } from "../i18n/index.ts";
import { createTaskHref } from "../routes.ts";
import { getInitials } from "../utils/format.ts";

type StatusFilter = TaskStatus | "all";

const TASK_STATUSES: readonly TaskStatus[] = [
  "not-started",
  "in-progress",
  "blocked",
  "completed",
];

interface TasksPageProps {
  state: WorkspaceState;
  selectedTaskId: string | null;
  invalidTaskId: string | null;
  onOpenTask: (taskId: string) => void;
  onCloseTask: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onToggleAcknowledgement: (taskId: string) => void;
}

function compareTasks(first: Task, second: Task) {
  const firstOverdue = isTaskOverdue(first) ? 0 : 1;
  const secondOverdue = isTaskOverdue(second) ? 0 : 1;
  if (firstOverdue !== secondOverdue) return firstOverdue - secondOverdue;
  return first.deadline.localeCompare(second.deadline);
}

interface TaskListProps {
  tasks: Task[];
  members: TeamMember[];
  onOpen: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onToggleAcknowledgement: (taskId: string) => void;
}

function TaskList({
  tasks,
  members,
  onOpen,
  onStatusChange,
  onToggleAcknowledgement,
}: TaskListProps) {
  const { formatDate, formatDateTime, t } = useI18n();
  const memberById = new Map(members.map((member) => [member.id, member]));

  return (
    <div
      className="task-table"
      role="table"
      aria-label={t("tasks.table.label")}
    >
      <div className="task-table__header" role="row">
        <span role="columnheader">{t("tasks.table.task")}</span>
        <span role="columnheader">{t("tasks.table.owner")}</span>
        <span role="columnheader">{t("tasks.table.deadline")}</span>
        <span role="columnheader">{t("tasks.table.status")}</span>
        <span role="columnheader">{t("tasks.table.acknowledged")}</span>
      </div>

      {tasks.map((task) => {
        const owner = memberById.get(task.ownerId);
        const overdue = isTaskOverdue(task);

        return (
          <div className="task-row" role="row" key={task.id}>
            <div className="task-row__primary" role="cell">
              <AppLink
                href={createTaskHref(task.id)}
                onNavigate={() => onOpen(task.id)}
                data-task-focus-key={`task-list:${task.id}`}
                aria-label={t("common.openTaskNamed", { title: task.title })}
              >
                {task.title}
              </AppLink>
              <div>
                <span>{task.category}</span>
                <StatusBadge
                  compact
                  tone={task.priority === "critical" ? "critical" : "neutral"}
                  label={t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
                />
              </div>
            </div>

            <div className="task-owner" role="cell">
              <span className="avatar avatar--tiny" aria-hidden="true">
                {owner ? getInitials(owner.name) : "—"}
              </span>
              <span>{owner?.name ?? t("common.unassigned")}</span>
            </div>

            <div className="task-deadline" role="cell">
              <span className={overdue ? "text-warning" : undefined}>
                {formatDate(task.deadline)}
              </span>
              <small>
                {overdue
                  ? t("taskDetails.overdue")
                  : t("tasks.table.updated", {
                      date: formatDateTime(task.updatedAt),
                    })}
              </small>
            </div>

            <div role="cell">
              <label className="sr-only" htmlFor={`status-${task.id}`}>
                {t("tasks.table.statusFor", { title: task.title })}
              </label>
              <div className="select-wrap">
                <select
                  id={`status-${task.id}`}
                  value={task.status}
                  onChange={(event) =>
                    onStatusChange(task.id, event.target.value as TaskStatus)
                  }
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(TASK_STATUS_MESSAGE_KEYS[status])}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </div>
            </div>

            <div role="cell">
              <button
                type="button"
                className={`ack-button ${task.acknowledged ? "ack-button--done" : ""}`}
                aria-pressed={task.acknowledged}
                onClick={() => onToggleAcknowledgement(task.id)}
              >
                <span aria-hidden="true">
                  {task.acknowledged && <Check size={14} />}
                </span>
                {task.acknowledged
                  ? t("tasks.table.acknowledged")
                  : t("tasks.table.acknowledge")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TasksPage({
  state,
  selectedTaskId,
  invalidTaskId,
  onOpenTask,
  onCloseTask,
  onStatusChange,
  onToggleAcknowledgement,
}: TasksPageProps) {
  const { formatNumber, plural, t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [groupByOwner, setGroupByOwner] = useState(false);
  const eventTasks = useMemo(
    () => state.tasks.filter((task) => task.eventId === state.currentEventId),
    [state.currentEventId, state.tasks],
  );
  const filteredTasks = useMemo(
    () =>
      eventTasks
        .filter(
          (task) => statusFilter === "all" || task.status === statusFilter,
        )
        .filter((task) => ownerFilter === "all" || task.ownerId === ownerFilter)
        .sort(compareTasks),
    [eventTasks, ownerFilter, statusFilter],
  );
  const selectedTask =
    eventTasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedOwner = state.teamMembers.find(
    (member) => member.id === selectedTask?.ownerId,
  );
  const groupedTasks = groupByOwner
    ? state.teamMembers
        .map((member) => ({
          member,
          tasks: filteredTasks.filter((task) => task.ownerId === member.id),
        }))
        .filter((group) => group.tasks.length > 0)
    : [];

  function clearFilters() {
    setStatusFilter("all");
    setOwnerFilter("all");
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t("tasks.eyebrow")}
        title={t("tasks.title")}
        description={t("tasks.description")}
        actions={
          <div className="result-count" aria-live="polite">
            {t("tasks.resultCount", {
              visible: formatNumber(filteredTasks.length),
              total: formatNumber(eventTasks.length),
            })}
          </div>
        }
      />

      {invalidTaskId && (
        <div className="notice notice--warning" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            <strong>{t("taskDetails.invalid.title")}</strong>{" "}
            {t("taskDetails.invalid.description")}
          </span>
          <button
            type="button"
            className="button button--quiet"
            onClick={onCloseTask}
          >
            {t("taskDetails.invalid.back")}
          </button>
        </div>
      )}

      <section className="filter-bar" aria-label={t("tasks.filters.label")}>
        <div className="filter-bar__label">
          <Filter size={17} aria-hidden="true" />
          <span>{t("tasks.filters.filter")}</span>
        </div>
        <div className="filter-chips" aria-label={t("tasks.filters.status")}>
          {(["all", ...TASK_STATUSES] as const).map((status) => (
            <button
              type="button"
              key={status}
              className={statusFilter === status ? "is-active" : undefined}
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            >
              {status === "all"
                ? t("tasks.filters.all")
                : t(TASK_STATUS_MESSAGE_KEYS[status])}
            </button>
          ))}
        </div>
        <div className="filter-bar__select">
          <UserRound size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="owner-filter">
            {t("tasks.filters.owner")}
          </label>
          <select
            id="owner-filter"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
          >
            <option value="all">{t("tasks.filters.allOwners")}</option>
            {state.teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={`group-toggle ${groupByOwner ? "is-active" : ""}`}
          aria-pressed={groupByOwner}
          onClick={() => setGroupByOwner((current) => !current)}
        >
          <Layers3 size={16} aria-hidden="true" />{" "}
          {t("tasks.filters.groupByOwner")}
        </button>
      </section>

      {filteredTasks.length === 0 ? (
        <EmptyState
          title={t("tasks.empty.title")}
          description={t("tasks.empty.description")}
          action={
            <button className="button button--secondary" onClick={clearFilters}>
              <RotateCcw size={16} aria-hidden="true" />{" "}
              {t("tasks.empty.clear")}
            </button>
          }
        />
      ) : groupByOwner ? (
        <div className="task-groups">
          {groupedTasks.map(({ member, tasks }) => (
            <section className="task-group" key={member.id}>
              <header>
                <span className="avatar" aria-hidden="true">
                  {getInitials(member.name)}
                </span>
                <div>
                  <h2>{member.name}</h2>
                  <p>
                    {plural(
                      tasks.length,
                      {
                        one: "tasks.group.assigned.one",
                        other: "tasks.group.assigned.other",
                      },
                      { role: member.role },
                    )}
                  </p>
                </div>
              </header>
              <TaskList
                tasks={tasks}
                members={state.teamMembers}
                onOpen={onOpenTask}
                onStatusChange={onStatusChange}
                onToggleAcknowledgement={onToggleAcknowledgement}
              />
            </section>
          ))}
        </div>
      ) : (
        <TaskList
          tasks={filteredTasks}
          members={state.teamMembers}
          onOpen={onOpenTask}
          onStatusChange={onStatusChange}
          onToggleAcknowledgement={onToggleAcknowledgement}
        />
      )}

      <TaskDrawer
        task={selectedTask}
        owner={selectedOwner}
        onClose={onCloseTask}
        onStatusChange={onStatusChange}
        onToggleAcknowledgement={onToggleAcknowledgement}
      />
    </div>
  );
}
