import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { AppLink } from "../../components/AppLink.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { getChangeCoordinationState } from "../../domain/changeCoordination.ts";
import { getDeadlineTiming } from "../../domain/taskTiming.ts";
import { useI18n } from "../../i18n/index.ts";
import { changeHref, createTaskHref, eventHref } from "../../routes.ts";
import type { RemoteChange, ChangeError } from "../../services/changes.ts";
import type { TaskEvent } from "../../services/RemoteWorkspaceService.ts";
import { ChangeReadNotice } from "./ChangeReadNotice.tsx";

const CHANGE_PREVIEW_LIMIT = 1;

export function ChangeImpact({
  changes,
  error,
  event,
  now,
  onNavigate,
  onOpenTask,
  onRefresh,
}: {
  changes: RemoteChange[] | null;
  error: ChangeError | null;
  event: TaskEvent;
  now: Date;
  onNavigate: (path: string) => void;
  onOpenTask: (taskId: string) => void;
  onRefresh: () => void;
}) {
  const { t, plural, formatTaskDeadline, formatDateTime, formatRelativeDate } =
    useI18n(event.timezone);
  const [expanded, setExpanded] = useState(false);
  const preview = changes?.slice(0, CHANGE_PREVIEW_LIMIT) ?? [];
  const overflow = changes?.slice(CHANGE_PREVIEW_LIMIT) ?? [];

  function renderChange(change: RemoteChange) {
    const datedTasks = change.affectedTasks.filter(
      (task) => task.status !== "completed" && task.deadline !== null,
    );
    const checkpoint =
      datedTasks.find(
        (task) => getDeadlineTiming(task.deadline!, now) !== "overdue",
      ) ?? datedTasks[0];
    return (
      <article
        className="change-impact__entry"
        key={change.id}
        data-change-id={change.id}
      >
        <header>
          <div className="change-impact__identity">
            <h3>
              <AppLink
                className="change-impact__title-link"
                href={changeHref(event.id, change.id)}
                onNavigate={onNavigate}
              >
                {change.title}
              </AppLink>
            </h3>
            <span>
              {t(`change.state.${getChangeCoordinationState(change)}`)}
            </span>
          </div>
          {change.context && (
            <p className="change-impact__excerpt">{change.context}</p>
          )}
        </header>
        <div className="change-impact__details">
          <section>
            <strong>{t("changes.affectedWork")}</strong>
            <div className="change-impact__affected">
              <span>
                {plural(change.impact.taskCount, {
                  one: "dashboard.changes.affectedTasks.one",
                  other: "dashboard.changes.affectedTasks.other",
                })}
              </span>
            </div>
          </section>
          <div className="change-impact__meta">
            <strong>
              {t("change.owner")}:{" "}
              {change.responseOwner?.name ?? t("change.noOwner")}
            </strong>
            <span>
              {t("change.updated")}:{" "}
              <time dateTime={change.updatedAt}>
                {formatDateTime(change.updatedAt)}
              </time>
            </span>
          </div>
          <section>
            <strong>{t("change.response")}</strong>
            <div className="change-impact__response">
              <p className="change-impact__excerpt">
                {change.response ?? t("change.response.empty")}
              </p>
              {checkpoint && (
                <AppLink
                  href={createTaskHref(checkpoint.id, event.id)}
                  onNavigate={() => onOpenTask(checkpoint.id)}
                  className="change-impact__checkpoint"
                  data-task-focus-key={`change:${change.id}:checkpoint:${checkpoint.id}`}
                >
                  <span>{t("dashboard.changes.nextCheckpoint")}</span>
                  <strong>{checkpoint.title}</strong>
                  <time dateTime={checkpoint.deadline!}>
                    {formatRelativeDate(checkpoint.deadline!, now)} ·{" "}
                    {formatTaskDeadline(
                      checkpoint.deadline!,
                      checkpoint.deadlineTime,
                    )}
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
    <section
      className="change-impact"
      aria-labelledby="change-impact-title"
      aria-busy={(changes === null && !error) || undefined}
    >
      <header className="dashboard-section-heading dashboard-section-heading--action">
        <div>
          <h2 id="change-impact-title">{t("dashboard.changes.title")}</h2>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => onNavigate(eventHref(event.id, "/changes"))}
        >
          {t("dashboard.changes.open")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </header>
      {error || changes === null ? (
        <ChangeReadNotice error={error} onRetry={onRefresh} />
      ) : !changes.length ? (
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
