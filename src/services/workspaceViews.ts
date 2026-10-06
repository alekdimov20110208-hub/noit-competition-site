import type { Event, Task, TeamMember } from "../domain/types.ts";
import type { TasksWorkspace } from "./RemoteWorkspaceService.ts";

export type DisplayMember = Pick<TeamMember, "id" | "name" | "role">;
export type OverviewEvent = Pick<
  Event,
  "id" | "name" | "startDate" | "endDate"
> &
  Partial<
    Pick<Event, "location" | "guestInstructor" | "status" | "milestones">
  > & {
    timezone?: string;
  };
export interface WorkspaceView {
  currentEventId: string;
  events: OverviewEvent[];
  teamMembers: DisplayMember[];
  tasks: Task[];
  taskMembers?: DisplayMember[];
}

// Presentation projection: membership/access authority stays in the controller's
// task workspace. Dashboard receives the canonical Change DTOs separately;
// no legacy prototype Change projection or fabricated empty source is supplied.
export function toWorkspaceView(workspace: TasksWorkspace): WorkspaceView {
  return {
    currentEventId: workspace.currentEventId,
    events: workspace.events.map(
      ({ id, name, startDate, endDate, timezone }) => ({
        id,
        name,
        startDate,
        endDate,
        timezone,
      }),
    ),
    teamMembers: workspace.activeMembers ?? [],
    taskMembers: workspace.teamMembers,
    tasks: workspace.tasks,
  };
}
