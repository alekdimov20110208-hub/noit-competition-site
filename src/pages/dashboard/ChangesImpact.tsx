import { ArrowRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { AppLink } from "../../components/AppLink.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { StatusBadge } from "../../components/StatusBadge.tsx";
import {
  CHANGE_SEVERITY_MESSAGE_KEYS,
  CHANGE_STATUS_MESSAGE_KEYS,
  TASK_STATUS_MESSAGE_KEYS,
} from "../../domain/labels.ts";
import type { EventChange, Task, TeamMember } from "../../domain/types.ts";
import { getAffectedTasks } from "../../domain/workspace.ts";
import { useI18n } from "../../i18n/index.ts";
import { createTaskHref } from "../../routes.ts";
import { getTaskStatusTone } from "../../utils/statusTone.ts";
import {
  changeResponseTone,
  changeSeverityTone,
  getNextCheckpoint,
} from "./helpers.ts";

const CHANGE_PREVIEW_LIMIT = 2;

interface ChangesImpactProps {
  changes: EventChange[];
  eventTasks: Task[];
  members: Map<string, TeamMember>;
  now: Date;
  onNavigate: (path: string) => void;
  onOpenTask: (taskId: string) => void;
}

export function ChangesImpact({
  changes,
  eventTasks,
  members,
  now,
  onNavigate,
  onOpenTask,
}: ChangesImpactProps) {
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
      <article className="change-summary" key={change.id}>
        <span className="change-summary__icon" aria-hidden="true">
          <ShieldAlert size={21} />
        </span>
        <div>
          <div className="change-summary__heading">
            <h3>{change.title}</h3>
            <span className="change-summary__badges">
              <StatusBadge
                compact
                tone={changeSeverityTone(change.severity)}
                label={t(CHANGE_SEVERITY_MESSAGE_KEYS[change.severity])}
              />
              <StatusBadge
                compact
                tone={changeResponseTone(change.responseStatus)}
                label={t(CHANGE_STATUS_MESSAGE_KEYS[change.responseStatus])}
              />
            </span>
          </div>
          <p>{change.description}</p>
          <div className="change-summary__meta">
            <span>
              {t("changes.responseOwner", {
                owner: owner?.name ?? t("common.unassigned"),
              })}
            </span>
            <span>
              {t("changes.reported", {
                date: formatDateTime(change.reportedAt),
              })}
            </span>
          </div>

          <div className="change-summary__impact">
            <strong>{t("changes.affectedWork")}</strong>
            <span>
              {plural(affectedTasks.length, {
                one: "dashboard.changes.affectedTasks.one",
                other: "dashboard.changes.affectedTasks.other",
              })}
            </span>
            <div className="affected-areas">
              {change.affectedAreas.map((area) => (
                <span key={area}>{area}</span>
              ))}
            </div>
            <div className="affected-task-list">
              {affectedTasks.slice(0, 3).map((task) => (
                <AppLink
                  href={createTaskHref(task.id)}
                  onNavigate={() => onOpenTask(task.id)}
                  data-task-focus-key={`change:${change.id}:affected:${task.id}`}
                  key={task.id}
                >
                  <span className="sr-only">{t("common.openTask")}. </span>
                  <span className="affected-task-list__title">
                    {task.title}
                  </span>
                  <StatusBadge
                    compact
                    tone={getTaskStatusTone(task.status)}
                    label={t(TASK_STATUS_MESSAGE_KEYS[task.status])}
                  />
                </AppLink>
              ))}
            </div>
          </div>

          <div className="change-summary__response">
            <strong>{t("changes.currentResponse")}</strong>
            <p>{change.response}</p>
          </div>

          {checkpoint && (
            <AppLink
              href={createTaskHref(checkpoint.id)}
              onNavigate={() => onOpenTask(checkpoint.id)}
              className="change-summary__checkpoint"
              data-task-focus-key={`change:${change.id}:checkpoint:${checkpoint.id}`}
            >
              <span className="sr-only">{t("common.openTask")}. </span>
              <span>{t("dashboard.changes.nextCheckpoint")}</span>
              <strong>{checkpoint.title}</strong>
              <time dateTime={checkpoint.deadline}>
                {formatRelativeDate(checkpoint.deadline, now)} ·{" "}
                {formatDate(checkpoint.deadline)}
              </time>
            </AppLink>
          )}
        </div>
      </article>
    );
  }

  return (
    <section className="panel panel--changes" aria-labelledby="changes-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{t("dashboard.changes.eyebrow")}</p>
          <h2 id="changes-title">{t("dashboard.changes.title")}</h2>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => onNavigate("/changes")}
        >
          {t("dashboard.changes.open")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      {changes.length === 0 ? (
        <EmptyState
          title={t("dashboard.changes.empty.title")}
          description={t("dashboard.changes.empty.description")}
        />
      ) : (
        <div className="change-summary-list">
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
