import type { Task } from "./types.ts";
import { compareDeadlineDates, getDeadlineTiming } from "./taskTiming.ts";

export type AttentionReason =
  "blocked" | "overdue" | "not-accepted" | "critical-deadline";

export function getAttentionReasons(task: Task, now: Date): AttentionReason[] {
  if (task.status === "completed") return [];
  const timing = getDeadlineTiming(task.deadline, now);
  const reasons: AttentionReason[] = [];
  if (task.status === "blocked") reasons.push("blocked");
  if (timing === "overdue") reasons.push("overdue");
  if (!task.acknowledged) reasons.push("not-accepted");
  if (
    task.priority === "critical" &&
    (timing === "today" || timing === "near")
  ) {
    reasons.push("critical-deadline");
  }
  return reasons;
}

function hasOperationalFailure(reasons: AttentionReason[]): boolean {
  return reasons.includes("blocked") || reasons.includes("overdue");
}

// Explainable lexicographic order (no additive urgency score):
// 1. Blocked OR overdue share the strongest class; neither status has a blanket
//    advantage over the other. Other eligible work forms the second class.
// 2. Within a class, earlier deadlines first (invalid deadlines last).
// 3. At equal deadlines: more reasons, then unaccepted responsibility, then
//    impact/priority, then stable ID. Priority cannot override a real deadline.
export function compareAttentionTasks(
  first: Task,
  second: Task,
  now: Date,
): number {
  const firstReasons = getAttentionReasons(first, now);
  const secondReasons = getAttentionReasons(second, now);
  const priorityOrder = { normal: 0, important: 1, critical: 2 };
  return (
    Number(hasOperationalFailure(secondReasons)) -
      Number(hasOperationalFailure(firstReasons)) ||
    compareDeadlineDates(first.deadline, second.deadline) ||
    secondReasons.length - firstReasons.length ||
    Number(first.acknowledged) - Number(second.acknowledged) ||
    priorityOrder[second.priority] - priorityOrder[first.priority] ||
    first.id.localeCompare(second.id)
  );
}
