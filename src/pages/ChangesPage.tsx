import {
  AlertOctagon,
  Check,
  Clock3,
  PhoneCall,
  Route,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import {
  CHANGE_SEVERITY_LABELS,
  CHANGE_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "../domain/labels.ts";
import { getAffectedTasks } from "../domain/workspace.ts";
import type {
  ChangeResponseStatus,
  TaskStatus,
  WorkspaceState,
} from "../domain/types.ts";
import { formatDateTime } from "../utils/format.ts";

interface ChangesPageProps {
  state: WorkspaceState;
  onAcknowledge: (changeId: string) => void;
  onStatusChange: (changeId: string, status: ChangeResponseStatus) => void;
}

function taskTone(status: TaskStatus) {
  if (status === "completed") return "success" as const;
  if (status === "blocked") return "blocked" as const;
  if (status === "in-progress") return "progress" as const;
  return "neutral" as const;
}

export function ChangesPage({
  state,
  onAcknowledge,
  onStatusChange,
}: ChangesPageProps) {
  const eventChanges = state.changes
    .filter((change) => change.eventId === state.currentEventId)
    .sort((first, second) => {
      if (
        first.responseStatus === "resolved" &&
        second.responseStatus !== "resolved"
      ) {
        return 1;
      }
      if (
        first.responseStatus !== "resolved" &&
        second.responseStatus === "resolved"
      ) {
        return -1;
      }
      return second.reportedAt.localeCompare(first.reportedAt);
    });
  const memberById = new Map(
    state.teamMembers.map((member) => [member.id, member]),
  );
  const activeCount = eventChanges.filter(
    (change) => change.responseStatus !== "resolved",
  ).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operational response"
        title="Changes & Plan B"
        description="Connect a change to the work it affects, record the current response, and escalate urgent situations through direct human contact."
        actions={
          <div className="result-count">
            <strong>{activeCount}</strong> active change
            {activeCount === 1 ? "" : "s"}
          </div>
        }
      />

      <div className="principle-banner">
        <PhoneCall size={20} aria-hidden="true" />
        <div>
          <strong>
            BudoGraph supports communication—it does not replace it.
          </strong>
          <p>
            Use the workspace to understand impact and ownership. Call directly
            when a critical change needs a fast or sensitive decision.
          </p>
        </div>
      </div>

      <section className="change-list" aria-label="Event changes">
        {eventChanges.map((change) => {
          const owner = memberById.get(change.ownerId);
          const affectedTasks = getAffectedTasks(change, state.tasks);
          const isCritical = change.severity === "critical";
          const isResolved = change.responseStatus === "resolved";
          return (
            <article
              className={`change-card ${isCritical ? "change-card--critical" : ""} ${isResolved ? "change-card--resolved" : ""}`}
              key={change.id}
            >
              <header className="change-card__header">
                <span className="change-card__symbol" aria-hidden="true">
                  {isCritical ? (
                    <AlertOctagon size={24} />
                  ) : (
                    <ShieldAlert size={24} />
                  )}
                </span>
                <div className="change-card__title">
                  <div>
                    <StatusBadge
                      tone={isCritical ? "critical" : "warning"}
                      label={`${CHANGE_SEVERITY_LABELS[change.severity]} severity`}
                    />
                    <StatusBadge
                      tone={isResolved ? "success" : "progress"}
                      label={CHANGE_STATUS_LABELS[change.responseStatus]}
                    />
                  </div>
                  <h2>{change.title}</h2>
                  <p>{change.description}</p>
                </div>
                <div className="change-card__reported">
                  <Clock3 size={15} aria-hidden="true" />
                  <span>
                    Reported{" "}
                    <time dateTime={change.reportedAt}>
                      {formatDateTime(change.reportedAt)}
                    </time>
                  </span>
                </div>
              </header>

              {change.directContactRecommended && !isResolved && (
                <div className="direct-contact-callout">
                  <PhoneCall size={20} aria-hidden="true" />
                  <div>
                    <strong>Direct contact recommended</strong>
                    <p>{change.escalationRecommendation}</p>
                  </div>
                </div>
              )}

              <div className="change-card__grid">
                <section aria-labelledby={`response-${change.id}`}>
                  <p className="section-label" id={`response-${change.id}`}>
                    Current response
                  </p>
                  <p className="change-card__response">{change.response}</p>
                  <div className="owner-line">
                    <UserRound size={16} aria-hidden="true" />
                    <span>
                      Response owner:{" "}
                      <strong>{owner?.name ?? "Unassigned"}</strong>
                    </span>
                  </div>
                  <div className="field-stack field-stack--compact">
                    <label htmlFor={`change-status-${change.id}`}>
                      Response status
                    </label>
                    <select
                      id={`change-status-${change.id}`}
                      value={change.responseStatus}
                      onChange={(event) =>
                        onStatusChange(
                          change.id,
                          event.target.value as ChangeResponseStatus,
                        )
                      }
                    >
                      {Object.entries(CHANGE_STATUS_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </section>

                <section aria-labelledby={`affected-${change.id}`}>
                  <p className="section-label" id={`affected-${change.id}`}>
                    <Route size={15} aria-hidden="true" /> Affected work
                  </p>
                  <div className="affected-areas">
                    {change.affectedAreas.map((area) => (
                      <span key={area}>{area}</span>
                    ))}
                  </div>
                  <div className="affected-task-list">
                    {affectedTasks.map((task) => (
                      <div key={task.id}>
                        <span>{task.title}</span>
                        <StatusBadge
                          compact
                          tone={taskTone(task.status)}
                          label={TASK_STATUS_LABELS[task.status]}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <footer className="change-card__footer">
                <span>
                  {change.acknowledged
                    ? "Organizer has reviewed this change."
                    : "Organizer acknowledgement is still needed."}
                </span>
                <button
                  type="button"
                  className={`button ${change.acknowledged ? "button--success" : "button--primary"}`}
                  disabled={change.acknowledged}
                  onClick={() => onAcknowledge(change.id)}
                >
                  <Check size={16} aria-hidden="true" />
                  {change.acknowledged ? "Acknowledged" : "Acknowledge change"}
                </button>
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}
