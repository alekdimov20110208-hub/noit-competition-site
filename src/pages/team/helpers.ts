import type { Task, TeamMember, WorkspaceState } from "../../domain/types.ts";
import {
  compareAttentionTasks,
  getAttentionReasons,
} from "../../domain/taskAttention.ts";
import {
  compareDeadlineDates,
  isUpcomingTask,
} from "../../domain/taskTiming.ts";
import { getTeamWorkload } from "../../domain/workspace.ts";

export function partitionMemberTasks(tasks: readonly Task[], now: Date) {
  const attention = tasks
    .filter((task) => getAttentionReasons(task, now).length > 0)
    .sort((a, b) => compareAttentionTasks(a, b, now));
  const attentionIds = new Set(attention.map((task) => task.id));
  const upcoming = tasks
    .filter((task) => !attentionIds.has(task.id) && isUpcomingTask(task, now))
    .sort(
      (a, b) =>
        compareDeadlineDates(a.deadline, b.deadline) ||
        a.id.localeCompare(b.id),
    );
  const upcomingIds = new Set(upcoming.map((task) => task.id));
  const completed = tasks
    .filter((task) => task.status === "completed")
    .sort(
      (a, b) =>
        compareDeadlineDates(b.deadline, a.deadline) ||
        a.id.localeCompare(b.id),
    );
  const other = tasks
    .filter(
      (task) =>
        task.status !== "completed" &&
        !attentionIds.has(task.id) &&
        !upcomingIds.has(task.id),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  return { attention, upcoming, completed, other };
}

export function getMemberSummary(
  member: Pick<TeamMember, "id" | "name" | "role">,
  tasks: Task[],
  now: Date,
) {
  const owned = tasks.filter((task) => task.ownerId === member.id);
  const workload = getTeamWorkload([member], owned, now)[0];
  const sections = partitionMemberTasks(owned, now);
  const open = owned.filter((task) => task.status !== "completed");
  const representative =
    sections.attention[0] ??
    [...open].sort(
      (a, b) =>
        compareDeadlineDates(a.deadline, b.deadline) ||
        a.id.localeCompare(b.id),
    )[0];
  return {
    member,
    ...sections,
    assigned: owned.length,
    open: open.length,
    blocked: workload.blocked,
    overdue: workload.overdue,
    atRisk: workload.atRisk,
    notAccepted: open.filter((task) => !task.acknowledged).length,
    inProgress: open.filter((task) => task.status === "in-progress").length,
    criticalDeadline: sections.attention.filter((task) =>
      getAttentionReasons(task, now).includes("critical-deadline"),
    ).length,
    categories: [...new Set(owned.map((task) => task.category))],
    representative,
    group: workload.atRisk
      ? 0
      : sections.attention.length
        ? 1
        : open.length
          ? 2
          : 3,
  };
}

export type MemberSummary = ReturnType<typeof getMemberSummary>;

export function getTeamRoster(
  state: Pick<WorkspaceState, "currentEventId" | "tasks"> & {
    teamMembers: Pick<TeamMember, "id" | "name" | "role">[];
  },
  now: Date,
): MemberSummary[] {
  const tasks = state.tasks.filter(
    (task) => task.eventId === state.currentEventId,
  );
  return state.teamMembers
    .map((member, index) => ({
      ...getMemberSummary(member, tasks, now),
      index,
    }))
    .sort((a, b) => {
      if (a.group !== b.group) return a.group - b.group;
      if (a.representative && b.representative) {
        const difference =
          a.group < 2
            ? compareAttentionTasks(a.representative, b.representative, now)
            : compareDeadlineDates(
                a.representative.deadline,
                b.representative.deadline,
              );
        if (difference) return difference;
      }
      return a.index - b.index || a.member.id.localeCompare(b.member.id);
    });
}

export function selectTeamMember(
  roster: readonly MemberSummary[],
  memberId: string | null,
) {
  return roster.find((item) => item.member.id === memberId) ?? roster[0];
}

export function getPreviewLimits(attention: number, upcoming: number) {
  let a = Math.min(3, attention);
  let u = Math.min(2, upcoming);
  a += Math.min(5 - a - u, attention - a);
  u += Math.min(5 - a - u, upcoming - u);
  return { attention: a, upcoming: u };
}
