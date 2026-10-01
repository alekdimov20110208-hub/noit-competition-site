import {
  AlertTriangle,
  Check,
  ChevronRight,
  Circle,
  Layers3,
  ListFilter,
  RotateCcw,
  Search,
  Tag,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppLink } from "../components/AppLink.tsx";
import {
  BudoSelect,
  type BudoSelectOption,
} from "../components/BudoSelect.tsx";
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
import { getTaskCounts, isTaskOverdue } from "../domain/workspace.ts";
import { useI18n } from "../i18n/index.ts";
import { createTaskHref } from "../routes.ts";
import { getInitials } from "../utils/format.ts";
import { getTaskStatusTone } from "../utils/statusTone.ts";
import {
  filterTasks,
  getTaskCategories,
  hasActiveTaskFilters,
  type TaskFilters,
} from "./tasks/helpers.ts";

const TASK_STATUSES: readonly TaskStatus[] = [
  "not-started",
  "in-progress",
  "blocked",
  "completed",
];

interface TasksPageProps {
  now: Date;
  state: WorkspaceState;
  selectedTaskId: string | null;
  invalidTaskId: string | null;
  onOpenTask: (taskId: string) => void;
  onCloseTask: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onToggleAcknowledgement: (taskId: string) => void;
}

interface TaskListProps {
  now: Date;
  tasks: Task[];
  members: TeamMember[];
  selectedTaskId: string | null;
  onOpen: (taskId: string) => void;
}

function TaskList({
  tasks,
  members,
  selectedTaskId,
  onOpen,
  now,
}: TaskListProps) {
  const { formatDate, formatDateTime, t } = useI18n();
  const memberById = new Map(members.map((member) => [member.id, member]));

  return (
    <div
      className="task-register"
      role="table"
      aria-label={t("tasks.table.label")}
    >
      <div className="task-register__header" role="row">
        <span role="columnheader">{t("tasks.table.task")}</span>
        <span role="columnheader">{t("tasks.table.responsibility")}</span>
        <span role="columnheader">{t("tasks.table.deadline")}</span>
        <span role="columnheader">{t("tasks.table.status")}</span>
      </div>

      {tasks.map((task) => {
        const owner = memberById.get(task.ownerId);
        const overdue = isTaskOverdue(task, now);
        const selected = selectedTaskId === task.id;
        const priorityTone =
          task.priority === "critical"
            ? "critical"
            : task.priority === "important"
              ? "warning"
              : "neutral";

        return (
          <div
            className={`task-row ${overdue ? "task-row--overdue" : ""}`}
            data-status={task.status}
            data-selected={selected || undefined}
            role="row"
            key={task.id}
          >
            <div className="task-row__primary" role="cell">
              <AppLink
                className="task-row__link"
                href={createTaskHref(task.id)}
                onNavigate={() => onOpen(task.id)}
                data-task-focus-key={`task-list:${task.id}`}
                aria-current={selected ? "location" : undefined}
                aria-label={t("common.openTaskNamed", { title: task.title })}
              >
                {task.title}
              </AppLink>
              <div className="task-row__context">
                <span>{task.category}</span>
                {task.priority !== "normal" && (
                  <StatusBadge
                    compact
                    tone={priorityTone}
                    label={t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
                  />
                )}
              </div>
            </div>

            <div className="task-responsibility" role="cell">
              <div className="task-owner">
                <span className="avatar avatar--tiny" aria-hidden="true">
                  {owner ? getInitials(owner.name) : "—"}
                </span>
                <span>{owner?.name ?? t("common.unassigned")}</span>
              </div>
              <span
                className={`task-acceptance ${task.acknowledged ? "task-acceptance--accepted" : ""}`}
              >
                {task.acknowledged ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Circle size={12} aria-hidden="true" />
                )}
                {task.acknowledged
                  ? t("taskDetails.acknowledged")
                  : t("taskDetails.acknowledgementNeeded")}
              </span>
            </div>

            <div className="task-deadline" role="cell">
              <time dateTime={task.deadline}>{formatDate(task.deadline)}</time>
              <small className={overdue ? "task-deadline__overdue" : undefined}>
                {overdue
                  ? t("taskDetails.overdue")
                  : t("tasks.table.updated", {
                      date: formatDateTime(task.updatedAt),
                    })}
              </small>
            </div>

            <div className="task-row__status" role="cell">
              <StatusBadge
                compact
                tone={getTaskStatusTone(task.status)}
                label={t(TASK_STATUS_MESSAGE_KEYS[task.status])}
              />
            </div>

            <ChevronRight
              className="task-row__chevron"
              size={17}
              aria-hidden="true"
            />
          </div>
        );
      })}
    </div>
  );
}

export function TasksPage({
  now,
  state,
  selectedTaskId,
  invalidTaskId,
  onOpenTask,
  onCloseTask,
  onStatusChange,
  onToggleAcknowledgement,
}: TasksPageProps) {
  const { formatNumber, plural, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [groupByOwner, setGroupByOwner] = useState(false);
  const eventTasks = useMemo(
    () => state.tasks.filter((task) => task.eventId === state.currentEventId),
    [state.currentEventId, state.tasks],
  );
  const categories = useMemo(() => getTaskCategories(eventTasks), [eventTasks]);
  const filters = useMemo<TaskFilters>(
    () => ({
      search: searchQuery,
      status: statusFilter,
      ownerId: ownerFilter,
      category: categoryFilter,
    }),
    [categoryFilter, ownerFilter, searchQuery, statusFilter],
  );
  const filteredTasks = useMemo(
    () => filterTasks(eventTasks, state.teamMembers, filters, now),
    [eventTasks, filters, state.teamMembers, now],
  );
  const counts = useMemo(
    () => getTaskCounts(eventTasks, now),
    [eventTasks, now],
  );
  const selectedTask =
    eventTasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedOwner = state.teamMembers.find(
    (member) => member.id === selectedTask?.ownerId,
  );
  const knownMemberIds = new Set(state.teamMembers.map((member) => member.id));
  const groupedTasks = groupByOwner
    ? [
        ...state.teamMembers.map((member) => ({
          member,
          tasks: filteredTasks.filter((task) => task.ownerId === member.id),
        })),
        {
          member: null,
          tasks: filteredTasks.filter(
            (task) => !knownMemberIds.has(task.ownerId),
          ),
        },
      ].filter((group) => group.tasks.length > 0)
    : [];
  const filtersActive = hasActiveTaskFilters(filters);
  const statusOptions = useMemo<
    readonly BudoSelectOption<TaskStatus | "all">[]
  >(
    () => [
      { value: "all", label: t("tasks.filters.allStatuses") },
      ...TASK_STATUSES.map((status) => ({
        value: status,
        label: t(TASK_STATUS_MESSAGE_KEYS[status]),
      })),
    ],
    [t],
  );
  const ownerOptions = useMemo<readonly BudoSelectOption<string>[]>(
    () => [
      { value: "all", label: t("tasks.filters.allOwners") },
      ...state.teamMembers.map((member) => ({
        value: member.id,
        label: member.name,
      })),
    ],
    [state.teamMembers, t],
  );
  const categoryOptions = useMemo<readonly BudoSelectOption<string>[]>(
    () => [
      { value: "all", label: t("tasks.filters.allCategories") },
      ...categories.map((category) => ({
        value: category,
        label: category,
      })),
    ],
    [categories, t],
  );

  useEffect(() => {
    if (categoryFilter !== "all" && !categories.includes(categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categories, categoryFilter]);

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setOwnerFilter("all");
    setCategoryFilter("all");
  }

  const taskList = (
    <TaskList
      now={now}
      tasks={filteredTasks}
      members={state.teamMembers}
      selectedTaskId={selectedTaskId}
      onOpen={onOpenTask}
    />
  );

  return (
    <div className="page page--tasks">
      <PageHeader
        title={t("tasks.title")}
        description={t("tasks.description")}
        actions={
          <dl className="tasks-overview" aria-label={t("tasks.summary.label")}>
            <div>
              <dt>{t("tasks.summary.total")}</dt>
              <dd>{formatNumber(counts.total)}</dd>
            </div>
            <div>
              <dt>{t("tasks.summary.active")}</dt>
              <dd>{formatNumber(counts.active)}</dd>
            </div>
            <div>
              <dt>{t("tasks.summary.blocked")}</dt>
              <dd>{formatNumber(counts.blocked)}</dd>
            </div>
            <div className="tasks-overview__risk">
              <dt>{t("tasks.summary.overdue")}</dt>
              <dd>{formatNumber(counts.overdue)}</dd>
            </div>
          </dl>
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

      <section className="task-filters" aria-label={t("tasks.filters.label")}>
        <div className="task-search">
          <Search size={17} aria-hidden="true" />
          <label className="sr-only" htmlFor="task-search">
            {t("tasks.filters.search")}
          </label>
          <input
            id="task-search"
            type="search"
            value={searchQuery}
            placeholder={t("tasks.filters.searchPlaceholder")}
            autoComplete="off"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="task-filter-controls">
          <BudoSelect<TaskStatus | "all">
            id="status-filter"
            className={`task-filter-select ${statusFilter !== "all" ? "is-filtered" : ""}`}
            label={t("tasks.filters.status")}
            labelMode="sr-only"
            value={statusFilter}
            options={statusOptions}
            onChange={setStatusFilter}
            icon={<ListFilter size={15} aria-hidden="true" />}
            popupMinWidth={190}
          />

          <BudoSelect
            id="owner-filter"
            className={`task-filter-select task-filter-select--owner ${ownerFilter !== "all" ? "is-filtered" : ""}`}
            label={t("tasks.filters.owner")}
            labelMode="sr-only"
            value={ownerFilter}
            options={ownerOptions}
            onChange={setOwnerFilter}
            icon={<UserRound size={15} aria-hidden="true" />}
            popupMinWidth={220}
          />

          <BudoSelect
            id="category-filter"
            className={`task-filter-select task-filter-select--category ${categoryFilter !== "all" ? "is-filtered" : ""}`}
            label={t("tasks.filters.category")}
            labelMode="sr-only"
            value={categoryFilter}
            options={categoryOptions}
            onChange={setCategoryFilter}
            icon={<Tag size={15} aria-hidden="true" />}
            popupMinWidth={260}
          />

          <button
            type="button"
            className={`group-toggle ${groupByOwner ? "is-active" : ""}`}
            aria-pressed={groupByOwner}
            onClick={() => setGroupByOwner((current) => !current)}
          >
            <Layers3 size={15} aria-hidden="true" />{" "}
            {t("tasks.filters.groupByOwner")}
          </button>

          {filtersActive && (
            <button
              type="button"
              className="task-filters__clear"
              onClick={clearFilters}
            >
              <RotateCcw size={14} aria-hidden="true" />{" "}
              {t("tasks.filters.clear")}
            </button>
          )}
        </div>

        <div className="task-filters__result" aria-live="polite">
          {t("tasks.resultCount", {
            visible: formatNumber(filteredTasks.length),
            total: formatNumber(eventTasks.length),
          })}
        </div>
      </section>

      <div id="task-results">
        {filteredTasks.length === 0 ? (
          <EmptyState
            title={t("tasks.empty.title")}
            description={t("tasks.empty.description")}
            action={
              <button
                className="button button--secondary"
                onClick={clearFilters}
              >
                <RotateCcw size={16} aria-hidden="true" />{" "}
                {t("tasks.empty.clear")}
              </button>
            }
          />
        ) : groupByOwner ? (
          <div className="task-groups">
            {groupedTasks.map(({ member, tasks }) => (
              <section className="task-group" key={member?.id ?? "unassigned"}>
                <header>
                  <span className="avatar" aria-hidden="true">
                    {member ? getInitials(member.name) : "—"}
                  </span>
                  <div>
                    <h2>{member?.name ?? t("common.unassigned")}</h2>
                    <p>
                      {plural(
                        tasks.length,
                        {
                          one: "tasks.group.assigned.one",
                          other: "tasks.group.assigned.other",
                        },
                        { role: member?.role ?? t("common.unassigned") },
                      )}
                    </p>
                  </div>
                </header>
                <TaskList
                  now={now}
                  tasks={tasks}
                  members={state.teamMembers}
                  selectedTaskId={selectedTaskId}
                  onOpen={onOpenTask}
                />
              </section>
            ))}
          </div>
        ) : (
          taskList
        )}
      </div>

      <TaskDrawer
        now={now}
        task={selectedTask}
        owner={selectedOwner}
        onClose={onCloseTask}
        onStatusChange={onStatusChange}
        onToggleAcknowledgement={onToggleAcknowledgement}
      />
    </div>
  );
}
