import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { TASK_STATUS_LABELS } from "../domain/labels.ts";
import { getTeamWorkload, isTaskOverdue } from "../domain/workspace.ts";
import type { TaskStatus, WorkspaceState } from "../domain/types.ts";
import { formatDate, getInitials } from "../utils/format.ts";

interface TeamPageProps {
  state: WorkspaceState;
}

function statusTone(status: TaskStatus) {
  if (status === "completed") return "success" as const;
  if (status === "blocked") return "blocked" as const;
  if (status === "in-progress") return "progress" as const;
  return "neutral" as const;
}

function workloadLabel(active: number, atRisk: number) {
  if (atRisk > 0) return `${atRisk} item${atRisk === 1 ? "" : "s"} at risk`;
  if (active >= 4) return "High active workload";
  if (active >= 2) return "Steady workload";
  return "Available capacity";
}

export function TeamPage({ state }: TeamPageProps) {
  const initialMember =
    state.teamMembers.find((member) => member.isOrganizer) ??
    state.teamMembers[0];
  const [selectedMemberId, setSelectedMemberId] = useState(
    initialMember?.id ?? "",
  );
  const eventTasks = state.tasks.filter(
    (task) => task.eventId === state.currentEventId,
  );
  const workloads = getTeamWorkload(state.teamMembers, eventTasks);
  const selectedMember = state.teamMembers.find(
    (member) => member.id === selectedMemberId,
  );
  const selectedTasks = eventTasks
    .filter((task) => task.ownerId === selectedMemberId)
    .sort((first, second) => first.deadline.localeCompare(second.deadline));

  return (
    <div className="page">
      <PageHeader
        eyebrow="People & ownership"
        title="Team"
        description="See who owns each part of preparation and where a quick check-in could prevent a bottleneck."
      />

      <section className="team-grid" aria-label="Event team">
        {workloads.map((workload) => {
          const selected = workload.member.id === selectedMemberId;
          return (
            <button
              type="button"
              className={`team-card ${selected ? "team-card--selected" : ""}`}
              aria-pressed={selected}
              key={workload.member.id}
              onClick={() => setSelectedMemberId(workload.member.id)}
            >
              <div className="team-card__top">
                <span className="avatar avatar--large" aria-hidden="true">
                  {getInitials(workload.member.name)}
                </span>
                {workload.member.isOrganizer && (
                  <span className="organizer-label">
                    <ShieldCheck size={13} aria-hidden="true" /> Organizer
                  </span>
                )}
              </div>
              <h2>{workload.member.name}</h2>
              <p>{workload.member.role}</p>
              <dl className="team-card__metrics">
                <div>
                  <dt>Assigned</dt>
                  <dd>{workload.assigned}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>{workload.completed}</dd>
                </div>
                <div>
                  <dt>At risk</dt>
                  <dd className={workload.atRisk ? "text-warning" : undefined}>
                    {workload.atRisk}
                  </dd>
                </div>
              </dl>
              <span className="team-card__load">
                {workload.atRisk > 0 ? (
                  <AlertTriangle size={15} aria-hidden="true" />
                ) : (
                  <UserRoundCheck size={15} aria-hidden="true" />
                )}
                {workloadLabel(workload.active, workload.atRisk)}
              </span>
            </button>
          );
        })}
      </section>

      <section
        className="panel member-panel"
        aria-labelledby="member-tasks-title"
      >
        <div className="member-panel__header">
          <div className="avatar avatar--large" aria-hidden="true">
            {selectedMember ? getInitials(selectedMember.name) : "—"}
          </div>
          <div>
            <p className="eyebrow">Selected teammate</p>
            <h2 id="member-tasks-title">
              {selectedMember?.name ?? "No team member selected"}
            </h2>
            <p>{selectedMember?.role}</p>
          </div>
        </div>

        {selectedTasks.length === 0 ? (
          <EmptyState
            title="No tasks assigned"
            description="This team member has no preparation work in the current event."
          />
        ) : (
          <div className="member-task-list">
            {selectedTasks.map((task) => {
              const overdue = isTaskOverdue(task);
              return (
                <article className="member-task" key={task.id}>
                  <span className="member-task__icon" aria-hidden="true">
                    {task.status === "completed" ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <ClipboardList size={18} />
                    )}
                  </span>
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.context}</p>
                  </div>
                  <div className="member-task__meta">
                    <span className={overdue ? "text-warning" : undefined}>
                      {formatDate(task.deadline)}
                    </span>
                    <StatusBadge
                      compact
                      tone={overdue ? "warning" : statusTone(task.status)}
                      label={
                        overdue ? "Overdue" : TASK_STATUS_LABELS[task.status]
                      }
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
