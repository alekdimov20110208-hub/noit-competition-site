import type { Task, TaskStatus, TeamMember } from "../../domain/types.ts";
import { compareDeadlineDates } from "../../domain/taskTiming.ts";
import { isTaskOverdue } from "../../domain/workspace.ts";

export type TaskStatusFilter = TaskStatus | "all";

export const TASK_STATUSES = [
  "not-started",
  "in-progress",
  "blocked",
  "completed",
] as const satisfies readonly TaskStatus[];

export function groupTasksByStatus(tasks: readonly Task[]) {
  const groups: Record<TaskStatus, Task[]> = {
    "not-started": [],
    "in-progress": [],
    blocked: [],
    completed: [],
  };
  for (const task of tasks) groups[task.status].push(task);
  return TASK_STATUSES.map((status) => ({ status, tasks: groups[status] }));
}

export interface TaskFilters {
  search: string;
  status: TaskStatusFilter;
  ownerId: string;
  category: string;
}

function normalizeSearchValue(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

export function compareOperationalTasks(
  first: Task,
  second: Task,
  now = new Date(),
): number {
  const firstOverdue = isTaskOverdue(first, now) ? 0 : 1;
  const secondOverdue = isTaskOverdue(second, now) ? 0 : 1;
  if (firstOverdue !== secondOverdue) return firstOverdue - secondOverdue;

  if (first.status === "blocked" && second.status !== "blocked") return -1;
  if (second.status === "blocked" && first.status !== "blocked") return 1;

  const deadlineDifference = compareDeadlineDates(
    first.deadline,
    second.deadline,
  );
  return deadlineDifference || first.id.localeCompare(second.id);
}

export function filterTasks(
  tasks: readonly Task[],
  members: readonly Pick<TeamMember, "id" | "name">[],
  filters: TaskFilters,
  now = new Date(),
): Task[] {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const query = normalizeSearchValue(filters.search);

  return tasks
    .filter(
      (task) => filters.status === "all" || task.status === filters.status,
    )
    .filter(
      (task) => filters.ownerId === "all" || task.ownerId === filters.ownerId,
    )
    .filter(
      (task) =>
        filters.category === "all" || task.category === filters.category,
    )
    .filter((task) => {
      if (!query) return true;

      const owner = memberById.get(task.ownerId);
      return [task.title, task.context, task.category, owner?.name ?? ""].some(
        (value) => normalizeSearchValue(value).includes(query),
      );
    })
    .sort((first, second) => compareOperationalTasks(first, second, now));
}

export function getTaskCategories(tasks: readonly Task[]): string[] {
  return [...new Set(tasks.map((task) => task.category))].sort(
    (first, second) => first.localeCompare(second),
  );
}

export function hasActiveTaskFilters(filters: TaskFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status !== "all" ||
    filters.ownerId !== "all" ||
    filters.category !== "all"
  );
}
