import { ArrowRight } from "lucide-react";
import { AppLink } from "../../components/AppLink.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { TASK_STATUS_MESSAGE_KEYS } from "../../domain/labels.ts";
import type { EventMilestoneStatus, TeamMember } from "../../domain/types.ts";
import { useI18n, type MessageKey } from "../../i18n/index.ts";
import { createTaskHref } from "../../routes.ts";
import type { PreparationTimelineEntry, PreparationWindow } from "./helpers.ts";
import { DashboardDisclosure } from "./DashboardDisclosure.tsx";

const WINDOW_ORDER: readonly PreparationWindow[] = [
  "current",
  "today",
  "near",
  "later",
];

const WINDOW_LABEL_KEYS = {
  current: "dashboard.timeline.window.current",
  today: "dashboard.timeline.window.today",
  near: "dashboard.timeline.window.near",
  later: "dashboard.timeline.window.later",
} satisfies Record<PreparationWindow, MessageKey>;

const WINDOW_PREVIEW_LIMITS = {
  current: 2,
  today: 3,
  near: 4,
  later: 4,
} satisfies Record<PreparationWindow, number>;

const MILESTONE_STATUS_MESSAGE_KEYS = {
  completed: "status.milestone.completed",
  current: "status.milestone.current",
  upcoming: "status.milestone.upcoming",
} satisfies Record<EventMilestoneStatus, MessageKey>;

interface PreparationTimelineProps {
  entries: PreparationTimelineEntry[];
  members: Map<string, TeamMember>;
  onNavigate: (path: string) => void;
  onOpenTask: (taskId: string) => void;
}

export function PreparationTimeline({
  entries,
  members,
  onNavigate,
  onOpenTask,
}: PreparationTimelineProps) {
  const { t, formatDate, formatShortDate, plural } = useI18n();

  function renderEntry(entry: PreparationTimelineEntry) {
    const date = (
      <time dateTime={entry.date} title={formatDate(entry.date)}>
        {formatShortDate(entry.date)}
      </time>
    );

    if (entry.kind === "milestone") {
      return (
        <li className="timeline-entry timeline-entry--milestone" key={entry.id}>
          {date}
          <span className="timeline-entry__rail" aria-hidden="true" />
          <span className="timeline-entry__body">
            <span className="timeline-entry__kind">
              {t("dashboard.timeline.milestone")}
            </span>
            <strong>{entry.milestone.title}</strong>
          </span>
          <span className="timeline-entry__state timeline-entry__state--milestone">
            {t(MILESTONE_STATUS_MESSAGE_KEYS[entry.milestone.status])}
          </span>
        </li>
      );
    }

    const owner = members.get(entry.task.ownerId);
    return (
      <li key={entry.id}>
        <AppLink
          href={createTaskHref(entry.task.id)}
          onNavigate={() => onOpenTask(entry.task.id)}
          className="timeline-entry timeline-entry--task"
          data-task-focus-key={`timeline:${entry.task.id}`}
        >
          {date}
          <span className="timeline-entry__rail" aria-hidden="true" />
          <span className="timeline-entry__body">
            <span className="timeline-entry__kind">
              {t("dashboard.timeline.task")}
            </span>
            <strong>{entry.task.title}</strong>
            <span>
              {t("taskDetails.owner")}: {owner?.name ?? t("common.unassigned")}
            </span>
          </span>
          <span
            className={`timeline-entry__state timeline-entry__state--${entry.task.status}`}
          >
            {t(TASK_STATUS_MESSAGE_KEYS[entry.task.status])}
          </span>
        </AppLink>
      </li>
    );
  }

  return (
    <section className="preparation-timeline" aria-labelledby="timeline-title">
      <header className="dashboard-section-heading dashboard-section-heading--action">
        <div>
          <p>{t("dashboard.timeline.label")}</p>
          <h2 id="timeline-title">{t("dashboard.timeline.title")}</h2>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => onNavigate("/tasks")}
        >
          {t("dashboard.deadlines.view")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </header>
      <p className="dashboard-section-description">
        {t("dashboard.timeline.description")}
      </p>

      {entries.length === 0 ? (
        <EmptyState
          title={t("dashboard.timeline.empty.title")}
          description={t("dashboard.timeline.empty.description")}
        />
      ) : (
        <div className="timeline-windows">
          {WINDOW_ORDER.map((window) => {
            const windowEntries = entries.filter(
              (entry) => entry.window === window,
            );
            if (windowEntries.length === 0) return null;
            const previewLimit = WINDOW_PREVIEW_LIMITS[window];
            const preview = windowEntries.slice(0, previewLimit);
            const overflow = windowEntries.slice(previewLimit);

            return (
              <section className="timeline-window" key={window}>
                <h3>{t(WINDOW_LABEL_KEYS[window])}</h3>
                <ol>{preview.map(renderEntry)}</ol>
                {overflow.length > 0 && (
                  <DashboardDisclosure
                    className="timeline-window__overflow"
                    expandedLabel={t("dashboard.timeline.less")}
                    collapsedLabel={plural(overflow.length, {
                      one: "dashboard.timeline.more.one",
                      other: "dashboard.timeline.more.other",
                    })}
                  >
                    <ol>{overflow.map(renderEntry)}</ol>
                  </DashboardDisclosure>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
