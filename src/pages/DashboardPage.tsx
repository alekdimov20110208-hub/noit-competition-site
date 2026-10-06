import type { WorkspaceView } from "../services/workspaceViews.ts";
import type { TaskEvent } from "../services/RemoteWorkspaceService.ts";
import type { RemoteChange, ChangeError } from "../services/changes.ts";
import {
  getEventChanges,
  getPersonalChangeAttention,
} from "../domain/changeCoordination.ts";
import {
  getAttentionTasks,
  getReadinessSummary,
  getTaskCounts,
  getTeamWorkload,
} from "../domain/workspace.ts";
import { useI18n } from "../i18n/index.ts";
import { ChangeImpact } from "./dashboard/ChangeImpact.tsx";
import { EventOverview } from "./dashboard/EventOverview.tsx";
import {
  buildPreparationTimeline,
  eventDateMilestones,
} from "./dashboard/helpers.ts";
import { OperationalFocus } from "./dashboard/OperationalFocus.tsx";
import { PreparationTimeline } from "./dashboard/PreparationTimeline.tsx";
import { TeamPressure } from "./dashboard/TeamPressure.tsx";
import "./dashboard/integration.css";

interface DashboardPageProps {
  now: Date;
  state: WorkspaceView;
  event: TaskEvent | null;
  changes: RemoteChange[] | null;
  changeReadError: ChangeError | null;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  onOpenTask: (taskId: string) => void;
  focusExpanded: boolean;
  onFocusExpandedChange: (expanded: boolean) => void;
}

export function DashboardPage({
  now,
  state,
  event: currentEvent,
  changes,
  changeReadError,
  onRefresh,
  onNavigate,
  onOpenTask,
  focusExpanded,
  onFocusExpandedChange,
}: DashboardPageProps) {
  const { locale, t } = useI18n();
  const event =
    state.events.find((item) => item.id === state.currentEventId) ??
    state.events[0];

  if (!event || !currentEvent || currentEvent.id !== event.id) return null;

  const eventTasks = state.tasks.filter((task) => task.eventId === event.id);
  const eventChanges =
    changes === null ? null : getEventChanges(changes, event.id);
  const coordination = getPersonalChangeAttention(
    eventChanges ?? [],
    currentEvent,
  );
  const readiness = getReadinessSummary(eventTasks);
  const counts = getTaskCounts(eventTasks, now);
  const attention = getAttentionTasks(eventTasks, now, eventTasks.length);
  const workloads = getTeamWorkload(state.teamMembers, eventTasks, now).sort(
    (first, second) => {
      if (first.atRisk !== second.atRisk) return second.atRisk - first.atRisk;
      if (first.active !== second.active) return second.active - first.active;
      if (first.assigned !== second.assigned) {
        return second.assigned - first.assigned;
      }
      return first.member.name.localeCompare(second.member.name, locale);
    },
  );
  const members = new Map(
    (state.taskMembers ?? state.teamMembers).map((member) => [
      member.id,
      member,
    ]),
  );
  const milestones = [
    ...eventDateMilestones(
      event,
      now,
      t("workspace.event.start"),
      t("workspace.event.end"),
    ),
  ].sort(
    (first, second) =>
      first.date.localeCompare(second.date) ||
      first.id.localeCompare(second.id),
  );
  const timeline = buildPreparationTimeline(eventTasks, milestones, now);

  return (
    <div className="page page--dashboard">
      <EventOverview
        event={event}
        readiness={readiness}
        counts={counts}
        teamCount={state.teamMembers.length}
        onNavigate={onNavigate}
      />

      <div className="dashboard-command-grid">
        <OperationalFocus
          expanded={focusExpanded}
          onExpandedChange={onFocusExpandedChange}
          tasks={attention}
          coordination={coordination}
          changeReadError={changeReadError}
          changesAvailable={eventChanges !== null}
          onRefresh={onRefresh}
          onNavigate={onNavigate}
          members={members}
          now={now}
          onOpenTask={onOpenTask}
        />
        <PreparationTimeline
          entries={timeline}
          members={members}
          onNavigate={onNavigate}
          onOpenTask={onOpenTask}
        />
      </div>

      <ChangeImpact
        changes={eventChanges}
        error={changeReadError}
        event={currentEvent}
        onRefresh={onRefresh}
        now={now}
        onNavigate={onNavigate}
        onOpenTask={onOpenTask}
      />

      <TeamPressure workloads={workloads} onNavigate={onNavigate} />
    </div>
  );
}
