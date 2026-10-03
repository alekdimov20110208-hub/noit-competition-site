import type { RemoteTask, TaskEvent } from "./RemoteWorkspaceService.ts";

// Display affordances only. Every command is authorized again by the backend.
export function taskAffordances(
  event: TaskEvent | undefined,
  task: RemoteTask | null,
) {
  if (!event || !task || event.archived || task.eventId !== event.id)
    return { assignment: false, acceptance: false, status: false };
  const organizer = event?.membership.accessRole === "ORGANIZER";
  const ownAssignment = Boolean(
    event && task?.assignedMemberId === event.membership.id,
  );
  return {
    assignment: Boolean(event && task && organizer),
    acceptance: Boolean(
      task && ownAssignment && event?.membership.accessRole === "MEMBER",
    ),
    status: Boolean(task && (organizer || ownAssignment)),
  };
}
