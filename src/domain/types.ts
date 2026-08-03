export type EventStatus = "planning" | "ready" | "completed";

export type EventMilestoneStatus = "completed" | "current" | "upcoming";

export interface EventMilestone {
  id: string;
  title: string;
  date: string;
  status: EventMilestoneStatus;
}

export interface Event {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
  leadOrganizerId: string;
  guestInstructor: string;
  milestones: EventMilestone[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  isOrganizer: boolean;
}

export type TaskStatus =
  "not-started" | "in-progress" | "blocked" | "completed";

export type TaskPriority = "normal" | "important" | "critical";

export interface Task {
  id: string;
  eventId: string;
  title: string;
  category: string;
  ownerId: string;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
  context: string;
  blockedBy?: string;
  blocks?: string;
  acknowledged: boolean;
  updatedAt: string;
}

export type ChangeSeverity = "low" | "medium" | "critical";

export type ChangeResponseStatus = "reported" | "in-progress" | "resolved";

export interface EventChange {
  id: string;
  eventId: string;
  title: string;
  description: string;
  severity: ChangeSeverity;
  reportedAt: string;
  affectedTaskIds: string[];
  affectedAreas: string[];
  ownerId: string;
  response: string;
  responseStatus: ChangeResponseStatus;
  acknowledged: boolean;
  directContactRecommended: boolean;
  escalationRecommendation: string;
}

export interface EventTemplateArea {
  name: string;
  items: string[];
}

export interface EventTemplate {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  areas: EventTemplateArea[];
}

export interface WorkspaceState {
  version: 1;
  currentEventId: string;
  events: Event[];
  teamMembers: TeamMember[];
  tasks: Task[];
  changes: EventChange[];
  templates: EventTemplate[];
  demoLabel: string;
}
