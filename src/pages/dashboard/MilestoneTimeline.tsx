import { useState } from "react";
import { EmptyState } from "../../components/EmptyState.tsx";
import type {
  EventMilestone,
  EventMilestoneStatus,
} from "../../domain/types.ts";
import { useI18n, type MessageKey } from "../../i18n/index.ts";

const MILESTONE_PREVIEW_LIMIT = 6;

const MILESTONE_STATUS_MESSAGE_KEYS = {
  completed: "status.milestone.completed",
  current: "status.milestone.current",
  upcoming: "status.milestone.upcoming",
} satisfies Record<EventMilestoneStatus, MessageKey>;

interface MilestoneTimelineProps {
  milestones: EventMilestone[];
}

export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  const { t, formatDate, formatShortDate } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const preview = milestones.slice(0, MILESTONE_PREVIEW_LIMIT);
  const overflow = milestones.slice(MILESTONE_PREVIEW_LIMIT);

  function renderMilestone(milestone: EventMilestone) {
    return (
      <li
        className={`timeline__item timeline__item--${milestone.status}`}
        key={milestone.id}
      >
        <time dateTime={milestone.date} title={formatDate(milestone.date)}>
          {formatShortDate(milestone.date)}
        </time>
        <span className="timeline__dot" aria-hidden="true" />
        <strong>{milestone.title}</strong>
        <span className="timeline__state">
          {t(MILESTONE_STATUS_MESSAGE_KEYS[milestone.status])}
        </span>
      </li>
    );
  }

  return (
    <section className="panel timeline-panel" aria-labelledby="timeline-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{t("dashboard.milestones.eyebrow")}</p>
          <h2 id="timeline-title">{t("dashboard.milestones.title")}</h2>
        </div>
      </div>
      {milestones.length === 0 ? (
        <EmptyState
          title={t("dashboard.milestones.empty.title")}
          description={t("dashboard.milestones.empty.description")}
        />
      ) : (
        <>
          <ol className="timeline">{preview.map(renderMilestone)}</ol>
          {overflow.length > 0 && (
            <details
              className="timeline-overflow"
              open={expanded}
              onToggle={(event) => setExpanded(event.currentTarget.open)}
            >
              <summary className="timeline-overflow__summary">
                {t(
                  expanded
                    ? "dashboard.milestones.collapse"
                    : "dashboard.milestones.expand",
                )}
              </summary>
              <ol
                className="timeline timeline--continuation"
                start={MILESTONE_PREVIEW_LIMIT + 1}
              >
                {overflow.map(renderMilestone)}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}
