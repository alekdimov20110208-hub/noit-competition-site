import type { TaskStatus } from "../domain/types.ts";

export function getTaskStatusTone(status: TaskStatus) {
  if (status === "completed") return "success" as const;
  if (status === "blocked") return "blocked" as const;
  if (status === "in-progress") return "progress" as const;
  return "neutral" as const;
}
