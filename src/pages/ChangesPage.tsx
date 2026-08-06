import {
  AlertOctagon,
  Check,
  Clock3,
  PhoneCall,
  Route,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import {
  CHANGE_SEVERITY_MESSAGE_KEYS,
  CHANGE_STATUS_MESSAGE_KEYS,
  TASK_STATUS_MESSAGE_KEYS,
} from "../domain/labels.ts";
import { getAffectedTasks } from "../domain/workspace.ts";
import type { ChangeResponseStatus, WorkspaceState } from "../domain/types.ts";
import { useI18n } from "../i18n/index.ts";
import { getTaskStatusTone } from "../utils/statusTone.ts";

interface ChangesPageProps {
  state: WorkspaceState;
  onAcknowledge: (changeId: string) => void;
  onStatusChange: (changeId: string, status: ChangeResponseStatus) => void;
}

export function ChangesPage({
  state,
  onAcknowledge,
  onStatusChange,
}: ChangesPageProps) {
  const { count, formatDateTime, t } = useI18n();
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
        eyebrow={t("changes.eyebrow")}
        title={t("changes.title")}
        description={t("changes.description")}
        actions={
          <div className="result-count">
            {count(activeCount, {
              one: "changes.active.one",
              other: "changes.active.other",
            })}
          </div>
        }
      />

      <div className="principle-banner">
        <PhoneCall size={20} aria-hidden="true" />
        <div>
          <strong>{t("changes.principle.title")}</strong>
          <p>{t("changes.principle.description")}</p>
        </div>
      </div>

      <section className="change-list" aria-label={t("changes.listLabel")}>
        {eventChanges.length === 0 && (
          <EmptyState
            title={t("changes.empty.title")}
            description={t("changes.empty.description")}
          />
        )}
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
                      label={t("severity.withLabel", {
                        severity: t(
                          CHANGE_SEVERITY_MESSAGE_KEYS[change.severity],
                        ),
                      })}
                    />
                    <StatusBadge
                      tone={isResolved ? "success" : "progress"}
                      label={t(
                        CHANGE_STATUS_MESSAGE_KEYS[change.responseStatus],
                      )}
                    />
                  </div>
                  <h2>{change.title}</h2>
                  <p>{change.description}</p>
                </div>
                <div className="change-card__reported">
                  <Clock3 size={15} aria-hidden="true" />
                  <time dateTime={change.reportedAt}>
                    {t("changes.reported", {
                      date: formatDateTime(change.reportedAt),
                    })}
                  </time>
                </div>
              </header>

              {change.directContactRecommended && !isResolved && (
                <div className="direct-contact-callout">
                  <PhoneCall size={20} aria-hidden="true" />
                  <div>
                    <strong>{t("changes.directContact")}</strong>
                    <p>{change.escalationRecommendation}</p>
                  </div>
                </div>
              )}

              <div className="change-card__grid">
                <section aria-labelledby={`response-${change.id}`}>
                  <p className="section-label" id={`response-${change.id}`}>
                    {t("changes.currentResponse")}
                  </p>
                  <p className="change-card__response">{change.response}</p>
                  <div className="owner-line">
                    <UserRound size={16} aria-hidden="true" />
                    <span>
                      {t("changes.responseOwner", {
                        owner: owner?.name ?? t("common.unassigned"),
                      })}
                    </span>
                  </div>
                  <div className="field-stack field-stack--compact">
                    <label htmlFor={`change-status-${change.id}`}>
                      {t("changes.responseStatus")}
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
                      {Object.entries(CHANGE_STATUS_MESSAGE_KEYS).map(
                        ([value, messageKey]) => (
                          <option key={value} value={value}>
                            {t(messageKey)}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </section>

                <section aria-labelledby={`affected-${change.id}`}>
                  <p className="section-label" id={`affected-${change.id}`}>
                    <Route size={15} aria-hidden="true" />
                    {t("changes.affectedWork")}
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
                          tone={getTaskStatusTone(task.status)}
                          label={t(TASK_STATUS_MESSAGE_KEYS[task.status])}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <footer className="change-card__footer">
                <span>
                  {change.acknowledged
                    ? t("changes.reviewed")
                    : t("changes.reviewNeeded")}
                </span>
                <button
                  type="button"
                  className={`button ${change.acknowledged ? "button--success" : "button--primary"}`}
                  disabled={change.acknowledged}
                  onClick={() => onAcknowledge(change.id)}
                >
                  <Check size={16} aria-hidden="true" />
                  {change.acknowledged
                    ? t("changes.acknowledged")
                    : t("changes.acknowledge")}
                </button>
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}
