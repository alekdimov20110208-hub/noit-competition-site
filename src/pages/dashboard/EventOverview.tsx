import { ArrowRight } from "lucide-react";
import type { Event } from "../../domain/types.ts";
import type { ReadinessSummary, TaskCounts } from "../../domain/workspace.ts";
import { useI18n, type MessageKey } from "../../i18n/index.ts";

const EVENT_STATUS_MESSAGE_KEYS = {
  planning: "status.event.planning",
  ready: "status.event.ready",
  completed: "status.event.completed",
} satisfies Record<Event["status"], MessageKey>;

interface EventOverviewProps {
  event: Event;
  readiness: ReadinessSummary;
  counts: TaskCounts;
  teamCount: number;
  onNavigate: (path: string) => void;
}

export function EventOverview({
  event,
  readiness,
  counts,
  teamCount,
  onNavigate,
}: EventOverviewProps) {
  const { t, plural, formatDateRange, formatNumber, formatPercent } = useI18n();

  return (
    <section className="event-overview" aria-labelledby="event-overview-title">
      <header className="event-overview__header">
        <div className="event-overview__identity">
          <h1 id="event-overview-title">{event.name}</h1>
          <div className="event-overview__supporting">
            <p className="event-overview__guest">
              {t("dashboard.withGuest", { guest: event.guestInstructor })}
            </p>
            <div className="event-overview__state">
              <span>{t(EVENT_STATUS_MESSAGE_KEYS[event.status])}</span>
              <span>{t("dashboard.fictionalEvent")}</span>
            </div>
          </div>
        </div>
        <button
          className="text-button event-overview__task-link"
          type="button"
          onClick={() => onNavigate("/tasks")}
        >
          {t("dashboard.reviewAllTasks")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </header>

      <div className="event-overview__facts">
        <span>{formatDateRange(event.startDate, event.endDate)}</span>
        <span>{event.location}</span>
        <span>
          {plural(teamCount, {
            one: "dashboard.teamCount.one",
            other: "dashboard.teamCount.other",
          })}
        </span>
      </div>

      <div className="event-overview__operations">
        <div className="event-overview__progress">
          <dl className="event-overview__metrics">
            <div className="event-overview__metric--complete">
              <dt>{t("dashboard.summary.completed")}</dt>
              <dd>{formatNumber(counts.completed)}</dd>
            </div>
            <div>
              <dt>{t("dashboard.summary.total")}</dt>
              <dd>{formatNumber(counts.total)}</dd>
            </div>
          </dl>
          <span className="event-overview__progress-value">
            {t("dashboard.readiness.title")} {formatPercent(readiness.percent)}
          </span>
          <div
            className="event-overview__progress-track"
            role="progressbar"
            aria-label={t("dashboard.readiness.detail", {
              completed: formatNumber(readiness.completed),
              total: formatNumber(readiness.total),
            })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={readiness.percent}
          >
            <span style={{ width: `${readiness.percent}%` }} />
          </div>
        </div>
        <dl className="event-overview__metrics">
          <div className="event-overview__metric--active">
            <dt>{t("dashboard.summary.active")}</dt>
            <dd>{formatNumber(counts.active)}</dd>
          </div>
          <div className="event-overview__metric--blocked">
            <dt>{t("dashboard.summary.blocked")}</dt>
            <dd>{formatNumber(counts.blocked)}</dd>
          </div>
          <div className="event-overview__metric--overdue">
            <dt>{t("dashboard.summary.overdue")}</dt>
            <dd>{formatNumber(counts.overdue)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
