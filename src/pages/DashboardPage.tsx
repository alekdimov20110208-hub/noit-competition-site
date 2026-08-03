import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import type { CSSProperties } from "react";
import {
  getAttentionTasks,
  getReadinessPercent,
  getTaskCounts,
  getTeamWorkload,
  getUpcomingTasks,
  isTaskOverdue,
} from "../domain/workspace.ts";
import {
  CHANGE_SEVERITY_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "../domain/labels.ts";
import type { WorkspaceState } from "../domain/types.ts";
import {
  formatDate,
  formatDateTime,
  formatShortDate,
} from "../utils/format.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";

interface DashboardPageProps {
  state: WorkspaceState;
  onNavigate: (path: string) => void;
}

function taskStatusTone(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "blocked") return "blocked" as const;
  if (status === "in-progress") return "progress" as const;
  return "neutral" as const;
}

export function DashboardPage({ state, onNavigate }: DashboardPageProps) {
  const event =
    state.events.find((item) => item.id === state.currentEventId) ??
    state.events[0];
  const eventTasks = state.tasks.filter((task) => task.eventId === event.id);
  const eventChanges = state.changes.filter(
    (change) =>
      change.eventId === event.id && change.responseStatus !== "resolved",
  );
  const readiness = getReadinessPercent(eventTasks);
  const counts = getTaskCounts(eventTasks);
  const upcoming = getUpcomingTasks(eventTasks, new Date(), 4);
  const attention = getAttentionTasks(eventTasks, new Date(), 5);
  const workloads = getTeamWorkload(state.teamMembers, eventTasks);
  const memberById = new Map(
    state.teamMembers.map((member) => [member.id, member]),
  );

  const readinessStyle = {
    "--readiness": `${readiness * 3.6}deg`,
  } as CSSProperties;

  return (
    <div className="page page--dashboard">
      <PageHeader
        eyebrow="Organizer command center"
        title="The seminar, at a glance"
        description="See what is ready, what is late, and where your attention is needed before the next coordination call."
        actions={
          <button
            className="button button--primary"
            onClick={() => onNavigate("/tasks")}
          >
            Review all tasks <ArrowRight size={17} aria-hidden="true" />
          </button>
        }
      />

      <section className="event-hero" aria-labelledby="current-event-title">
        <div className="event-hero__details">
          <div className="event-hero__meta">
            <span className="event-hero__status">Planning in progress</span>
            <span>Fictional demonstration event</span>
          </div>
          <h2 id="current-event-title">{event.name}</h2>
          <p className="event-hero__guest">with {event.guestInstructor}</p>
          <div className="event-hero__facts">
            <span>
              <CalendarClock size={17} aria-hidden="true" />
              {formatDate(event.startDate)} – {formatDate(event.endDate)}
            </span>
            <span>
              <MapPin size={17} aria-hidden="true" /> {event.location}
            </span>
            <span>
              <Users size={17} aria-hidden="true" /> {state.teamMembers.length}{" "}
              organizers and helpers
            </span>
          </div>
        </div>

        <div className="readiness-card">
          <div className="readiness-ring" style={readinessStyle}>
            <div>
              <strong>{readiness}%</strong>
              <span>complete</span>
            </div>
          </div>
          <div>
            <strong>Task progress</strong>
            <p>Based on completed tasks—not a safety or go/no-go assessment.</p>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Task summary">
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--success">
            <CheckCircle2 size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{counts.completed}</strong>
            <span>Completed</span>
          </div>
          <small>of {counts.total} tasks</small>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--progress">
            <Clock3 size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{counts.inProgress}</strong>
            <span>In progress</span>
          </div>
          <small>being worked on</small>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--blocked">
            <Ban size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{counts.blocked}</strong>
            <span>Blocked</span>
          </div>
          <small>need a decision</small>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--warning">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{counts.overdue}</strong>
            <span>Overdue</span>
          </div>
          <small>past their deadline</small>
        </article>
      </section>

      <div className="dashboard-grid">
        <section
          className="panel panel--deadlines"
          aria-labelledby="deadlines-title"
        >
          <div className="panel__header">
            <div>
              <p className="eyebrow">Next up</p>
              <h2 id="deadlines-title">Upcoming deadlines</h2>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("/tasks")}
            >
              View tasks <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="deadline-list">
            {upcoming.length === 0 ? (
              <EmptyState
                title="No upcoming deadlines"
                description="All scheduled preparation work is complete or has no valid future deadline."
              />
            ) : (
              upcoming.map((task) => {
                const owner = memberById.get(task.ownerId);
                return (
                  <article className="deadline-item" key={task.id}>
                    <time dateTime={task.deadline}>
                      <span>
                        {formatShortDate(task.deadline).split(" ")[0]}
                      </span>
                      <strong>
                        {formatShortDate(task.deadline).split(" ")[1]}
                      </strong>
                    </time>
                    <div className="deadline-item__content">
                      <h3>{task.title}</h3>
                      <p>{task.context}</p>
                      <span>
                        <UserRound size={14} aria-hidden="true" />
                        {owner?.name ?? "Unassigned"}
                      </span>
                    </div>
                    <StatusBadge
                      compact
                      tone={taskStatusTone(task.status)}
                      label={TASK_STATUS_LABELS[task.status]}
                    />
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section
          className="panel panel--changes"
          aria-labelledby="changes-title"
        >
          <div className="panel__header">
            <div>
              <p className="eyebrow">What changed</p>
              <h2 id="changes-title">Active risks & changes</h2>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("/changes")}
            >
              Open Plan B <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="change-summary-list">
            {eventChanges.length === 0 ? (
              <EmptyState
                title="No active changes"
                description="There are no unresolved operational changes in the current event."
              />
            ) : (
              eventChanges.map((change) => {
                const owner = memberById.get(change.ownerId);
                return (
                  <article className="change-summary" key={change.id}>
                    <span className="change-summary__icon" aria-hidden="true">
                      <ShieldAlert size={21} />
                    </span>
                    <div>
                      <div className="change-summary__heading">
                        <h3>{change.title}</h3>
                        <StatusBadge
                          compact
                          tone={
                            change.severity === "critical"
                              ? "critical"
                              : "warning"
                          }
                          label={CHANGE_SEVERITY_LABELS[change.severity]}
                        />
                      </div>
                      <p>{change.description}</p>
                      <div className="change-summary__meta">
                        <span>{owner?.name}</span>
                        <span>{formatDateTime(change.reportedAt)}</span>
                      </div>
                      {change.directContactRecommended && (
                        <strong className="direct-contact">
                          Direct contact recommended
                        </strong>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="attention-title">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Decision queue</p>
              <h2 id="attention-title">Requires your attention</h2>
            </div>
          </div>
          <div className="attention-list">
            {attention.length === 0 ? (
              <EmptyState
                title="Nothing needs immediate attention"
                description="No open task is critical, blocked, overdue, or awaiting acknowledgement."
              />
            ) : (
              attention.map((task) => {
                const overdue = isTaskOverdue(task);
                return (
                  <button
                    type="button"
                    className="attention-item"
                    key={task.id}
                    onClick={() => onNavigate("/tasks")}
                  >
                    <span
                      className={`attention-item__marker attention-item__marker--${task.priority}`}
                      aria-hidden="true"
                    />
                    <span className="attention-item__body">
                      <strong>{task.title}</strong>
                      <small>
                        {overdue
                          ? `Overdue · ${formatDate(task.deadline)}`
                          : task.status === "blocked"
                            ? task.blockedBy || "Blocked"
                            : !task.acknowledged
                              ? "Awaiting acknowledgement"
                              : TASK_STATUS_LABELS[task.status]}
                      </small>
                    </span>
                    <StatusBadge
                      compact
                      tone={overdue ? "warning" : taskStatusTone(task.status)}
                      label={
                        overdue
                          ? "Overdue"
                          : TASK_PRIORITY_LABELS[task.priority]
                      }
                    />
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="workload-title">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Team view</p>
              <h2 id="workload-title">Workload</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("/team")}>
              View team <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="workload-list">
            {workloads.length === 0 ? (
              <EmptyState
                title="No team workload yet"
                description="Add a team member before assigning preparation work."
              />
            ) : (
              workloads.map((workload) => {
                const completion = workload.assigned
                  ? Math.round((workload.completed / workload.assigned) * 100)
                  : 0;
                return (
                  <article className="workload-row" key={workload.member.id}>
                    <div className="avatar avatar--small" aria-hidden="true">
                      {workload.member.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="workload-row__body">
                      <div>
                        <strong>{workload.member.name}</strong>
                        <span>
                          {workload.active} active · {workload.atRisk} at risk
                        </span>
                      </div>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={`${workload.member.name} task completion`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={completion}
                      >
                        <span style={{ width: `${completion}%` }} />
                      </div>
                    </div>
                    <strong className="workload-row__count">
                      {workload.completed}/{workload.assigned}
                    </strong>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section
        className="panel timeline-panel"
        aria-labelledby="timeline-title"
      >
        <div className="panel__header">
          <div>
            <p className="eyebrow">Event rhythm</p>
            <h2 id="timeline-title">Milestones</h2>
          </div>
        </div>
        {event.milestones.length === 0 ? (
          <EmptyState
            title="No milestones yet"
            description="The current event does not have a milestone sequence."
          />
        ) : (
          <ol className="timeline">
            {event.milestones.map((milestone) => (
              <li
                className={`timeline__item timeline__item--${milestone.status}`}
                key={milestone.id}
              >
                <span className="timeline__dot" aria-hidden="true" />
                <time dateTime={milestone.date}>
                  {formatShortDate(milestone.date)}
                </time>
                <strong>{milestone.title}</strong>
                <span className="timeline__state">
                  {milestone.status === "completed"
                    ? "Complete"
                    : milestone.status === "current"
                      ? "In focus"
                      : "Upcoming"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
