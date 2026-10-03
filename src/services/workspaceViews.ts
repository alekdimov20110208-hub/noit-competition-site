import type { Event, EventChange, Task, TeamMember } from "../domain/types.ts";
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
  changes: EventChange[];
  taskMembers?: DisplayMember[];
  changesPersisted?: boolean;
}

// Presentation projection: membership/access authority stays in the controller's
// task workspace. Changes have no persisted read source until P3.
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
    changes: [],
    changesPersisted: false,
  };
}
