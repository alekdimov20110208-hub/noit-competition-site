import {
  Check,
  ChevronDown,
  Filter,
  Layers3,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { TaskDrawer } from "../components/TaskDrawer.tsx";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "../domain/labels.ts";
import { isTaskOverdue } from "../domain/workspace.ts";
import type {
  Task,
  TaskStatus,
  TeamMember,
  WorkspaceState,
} from "../domain/types.ts";
import { formatDate, formatDateTime, getInitials } from "../utils/format.ts";

type StatusFilter = TaskStatus | "all";

interface TasksPageProps {
  state: WorkspaceState;
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
  const memberById = new Map(members.map((member) => [member.id, member]));

  return (
    <div className="task-table" role="table" aria-label="Event tasks">
      <div className="task-table__header" role="row">
        <span role="columnheader">Task</span>
        <span role="columnheader">Owner</span>
        <span role="columnheader">Deadline</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Acknowledged</span>
      </div>
      {tasks.map((task) => {
        const owner = memberById.get(task.ownerId);
        const overdue = isTaskOverdue(task);
        return (
          <div className="task-row" role="row" key={task.id}>
            <div className="task-row__primary" role="cell">
              <button type="button" onClick={() => onOpen(task.id)}>
                {task.title}
              </button>
              <div>
                <span>{task.category}</span>
                <StatusBadge
                  compact
                  tone={task.priority === "critical" ? "critical" : "neutral"}
                  label={TASK_PRIORITY_LABELS[task.priority]}
                />
              </div>
            </div>
            <div className="task-owner" role="cell">
              <span className="avatar avatar--tiny" aria-hidden="true">
                {owner ? getInitials(owner.name) : "—"}
              </span>
              <span>{owner?.name ?? "Unassigned"}</span>
            </div>
            <div className="task-deadline" role="cell">
              <span className={overdue ? "text-warning" : undefined}>
                {formatDate(task.deadline)}
              </span>
              <small>
                {overdue
                  ? "Overdue"
                  : `Updated ${formatDateTime(task.updatedAt)}`}
              </small>
            </div>
            <div role="cell">
              <label className="sr-only" htmlFor={`status-${task.id}`}>
                Status for {task.title}
              </label>
              <div className="select-wrap">
                <select
                  id={`status-${task.id}`}
                  value={task.status}
                  onChange={(event) =>
                    onStatusChange(task.id, event.target.value as TaskStatus)
                  }
                >
                  {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
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
                {task.acknowledged ? "Acknowledged" : "Acknowledge"}
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
  onStatusChange,
  onToggleAcknowledgement,
}: TasksPageProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [groupByOwner, setGroupByOwner] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const closeTaskDrawer = useCallback(() => setSelectedTaskId(null), []);

  const eventTasks = state.tasks.filter(
    (task) => task.eventId === state.currentEventId,
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
    state.tasks.find((task) => task.id === selectedTaskId) ?? null;
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
        eyebrow="Preparation work"
        title="Tasks"
        description="Keep ownership, deadlines, context, and consequences visible without replacing the conversations that move work forward."
        actions={
          <div className="result-count" aria-live="polite">
            <strong>{filteredTasks.length}</strong> of {eventTasks.length} tasks
          </div>
        }
      />

      <section className="filter-bar" aria-label="Task filters">
        <div className="filter-bar__label">
          <Filter size={17} aria-hidden="true" />
          <span>Filter</span>
        </div>
        <div className="filter-chips" aria-label="Filter by status">
          {(
            [
              "all",
              "not-started",
              "in-progress",
              "blocked",
              "completed",
            ] as const
          ).map((status) => (
            <button
              type="button"
              key={status}
              className={statusFilter === status ? "is-active" : undefined}
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? "All" : TASK_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <div className="filter-bar__select">
          <UserRound size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="owner-filter">
            Filter by owner
          </label>
          <select
            id="owner-filter"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
          >
            <option value="all">All owners</option>
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
          <Layers3 size={16} aria-hidden="true" /> Group by owner
        </button>
      </section>

      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks match these filters"
          description="Clear the filters to return to the full preparation plan."
          action={
            <button className="button button--secondary" onClick={clearFilters}>
              <RotateCcw size={16} aria-hidden="true" /> Clear filters
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
                    {member.role} · {tasks.length} assigned
                  </p>
                </div>
              </header>
              <TaskList
                tasks={tasks}
                members={state.teamMembers}
                onOpen={setSelectedTaskId}
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
          onOpen={setSelectedTaskId}
          onStatusChange={onStatusChange}
          onToggleAcknowledgement={onToggleAcknowledgement}
        />
      )}

      <TaskDrawer
        task={selectedTask}
        owner={selectedOwner}
        onClose={closeTaskDrawer}
        onStatusChange={onStatusChange}
        onToggleAcknowledgement={onToggleAcknowledgement}
      />
    </div>
  );
}
