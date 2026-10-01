import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { AppLink } from "../../components/AppLink.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import {
  CHANGE_SEVERITY_MESSAGE_KEYS,
  CHANGE_STATUS_MESSAGE_KEYS,
} from "../../domain/labels.ts";
import type { EventChange, Task, TeamMember } from "../../domain/types.ts";
import { getAffectedTasks } from "../../domain/workspace.ts";
import { useI18n } from "../../i18n/index.ts";
import { createTaskHref } from "../../routes.ts";
import { getNextCheckpoint } from "./helpers.ts";

const CHANGE_PREVIEW_LIMIT = 1;

interface ChangeImpactProps {
  changes: EventChange[];
  eventTasks: Task[];
  members: Map<string, TeamMember>;
  now: Date;
  onNavigate: (path: string) => void;
  onOpenTask: (taskId: string) => void;
}

export function ChangeImpact({
  changes,
  eventTasks,
  members,
  now,
  onNavigate,
  onOpenTask,
}: ChangeImpactProps) {
  const { t, plural, formatDate, formatDateTime, formatRelativeDate } =
    useI18n();
  const [expanded, setExpanded] = useState(false);
  const preview = changes.slice(0, CHANGE_PREVIEW_LIMIT);
  const overflow = changes.slice(CHANGE_PREVIEW_LIMIT);

  function renderChange(change: EventChange) {
    const owner = members.get(change.ownerId);
    const affectedTasks = getAffectedTasks(change, eventTasks);
    const checkpoint = getNextCheckpoint(affectedTasks, now);

    return (
      <article
        className={`change-impact__entry change-impact__entry--${change.severity}`}
        key={change.id}
      >
        <header>
          <div className="change-impact__identity">
            <h3>{change.title}</h3>
            <span>{t(CHANGE_SEVERITY_MESSAGE_KEYS[change.severity])}</span>
          </div>
          <p>{change.description}</p>
        </header>

        <div className="change-impact__details">
          <section>
            <strong>{t("changes.affectedWork")}</strong>
            <div className="change-impact__affected">
              <span>
                {plural(affectedTasks.length, {
                  one: "dashboard.changes.affectedTasks.one",
                  other: "dashboard.changes.affectedTasks.other",
                })}
              </span>
              <ul>
                {change.affectedAreas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </div>
          </section>
          <div className="change-impact__meta">
            <strong>
              {t("changes.responseOwner", {
                owner: owner?.name ?? t("common.unassigned"),
              })}
            </strong>
            <span>{t(CHANGE_STATUS_MESSAGE_KEYS[change.responseStatus])}</span>
            <span>
              {t("changes.reported", {
                date: formatDateTime(change.reportedAt),
              })}
            </span>
          </div>
          <section>
            <strong>{t("changes.currentResponse")}</strong>
            <div className="change-impact__response">
              <p>{change.response}</p>
              {checkpoint && (
                <AppLink
                  href={createTaskHref(checkpoint.id)}
                  onNavigate={() => onOpenTask(checkpoint.id)}
                  className="change-impact__checkpoint"
                  data-task-focus-key={`change:${change.id}:checkpoint:${checkpoint.id}`}
                >
                  <span>{t("dashboard.changes.nextCheckpoint")}</span>
                  <strong>{checkpoint.title}</strong>
                  <time dateTime={checkpoint.deadline}>
                    {formatRelativeDate(checkpoint.deadline, now)} ·{" "}
                    {formatDate(checkpoint.deadline)}
                  </time>
                </AppLink>
              )}
            </div>
          </section>
        </div>
      </article>
    );
  }

  return (
    <section className="change-impact" aria-labelledby="change-impact-title">
      <header className="dashboard-section-heading dashboard-section-heading--action">
        <div>
          <h2 id="change-impact-title">{t("dashboard.changes.title")}</h2>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => onNavigate("/changes")}
        >
          {t("dashboard.changes.open")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </header>
      {changes.length === 0 ? (
        <EmptyState
          title={t("dashboard.changes.empty.title")}
          description={t("dashboard.changes.empty.description")}
        />
      ) : (
        <div className="change-impact__list">
          {preview.map(renderChange)}
          {overflow.length > 0 && (
            <details
              className="dashboard-overflow"
              open={expanded}
              onToggle={(event) => setExpanded(event.currentTarget.open)}
            >
              <summary className="dashboard-overflow__summary">
                {expanded
                  ? t("dashboard.changes.collapse")
                  : plural(overflow.length, {
                      one: "dashboard.changes.expand.one",
                      other: "dashboard.changes.expand.other",
                    })}
              </summary>
              <div className="dashboard-overflow__content">
                {overflow.map(renderChange)}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
