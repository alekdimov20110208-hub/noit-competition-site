import { ArrowRight } from "lucide-react";
import { PageHeader } from "../components/PageHeader.tsx";
import type { WorkspaceState } from "../domain/types.ts";
import {
  getAttentionTasks,
  getReadinessSummary,
  getTaskCounts,
  getTeamWorkload,
  getUpcomingTasks,
} from "../domain/workspace.ts";
import { useI18n } from "../i18n/index.ts";
import { AttentionQueue } from "./dashboard/AttentionQueue.tsx";
import { ChangesImpact } from "./dashboard/ChangesImpact.tsx";
import { DeadlineList } from "./dashboard/DeadlineList.tsx";
import { EventHero } from "./dashboard/EventHero.tsx";
import { MilestoneTimeline } from "./dashboard/MilestoneTimeline.tsx";
import { OperationalSummary } from "./dashboard/OperationalSummary.tsx";
import { WorkloadComparison } from "./dashboard/WorkloadComparison.tsx";

interface DashboardPageProps {
  state: WorkspaceState;
  onNavigate: (path: string) => void;
  onOpenTask: (taskId: string) => void;
}

export function DashboardPage({
  state,
  onNavigate,
  onOpenTask,
}: DashboardPageProps) {
  const { t, locale } = useI18n();
  const event =
    state.events.find((item) => item.id === state.currentEventId) ??
    state.events[0];

  if (!event) return null;

  const now = new Date();
  const eventTasks = state.tasks.filter((task) => task.eventId === event.id);
  const eventChanges = state.changes
    .filter((change) => change.eventId === event.id)
    .sort(
      (first, second) =>
        second.reportedAt.localeCompare(first.reportedAt) ||
        first.id.localeCompare(second.id),
    );
  const readiness = getReadinessSummary(eventTasks);
  const counts = getTaskCounts(eventTasks, now);
  const attention = getAttentionTasks(eventTasks, now, 5);
  const upcoming = getUpcomingTasks(eventTasks, now, 5);
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
    state.teamMembers.map((member) => [member.id, member]),
  );
  const milestones = [...event.milestones].sort(
    (first, second) =>
      first.date.localeCompare(second.date) ||
      first.id.localeCompare(second.id),
  );

  return (
    <div className="page page--dashboard">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={() => onNavigate("/tasks")}
          >
            {t("dashboard.reviewAllTasks")}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        }
      />

      <EventHero
        event={event}
        readiness={readiness}
        teamCount={state.teamMembers.length}
      />
      <OperationalSummary counts={counts} />

      <div className="dashboard-grid dashboard-grid--operational">
        <AttentionQueue
          tasks={attention}
          members={members}
          now={now}
          onOpenTask={onOpenTask}
        />
        <DeadlineList
          tasks={upcoming}
          members={members}
          now={now}
          onNavigate={onNavigate}
          onOpenTask={onOpenTask}
        />
        <ChangesImpact
          changes={eventChanges}
          eventTasks={eventTasks}
          members={members}
          now={now}
          onNavigate={onNavigate}
          onOpenTask={onOpenTask}
        />
        <WorkloadComparison workloads={workloads} onNavigate={onNavigate} />
      </div>

      <MilestoneTimeline milestones={milestones} />
    </div>
  );
}
