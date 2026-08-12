import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
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
          <p className="event-overview__kicker">{t("dashboard.eyebrow")}</p>
          <div className="event-overview__state">
            <span>{t(EVENT_STATUS_MESSAGE_KEYS[event.status])}</span>
            <span>{t("dashboard.fictionalEvent")}</span>
          </div>
          <h1 id="event-overview-title">{event.name}</h1>
          <p className="event-overview__guest">
            {t("dashboard.withGuest", { guest: event.guestInstructor })}
          </p>
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

      <div className="event-overview__context">
        <div className="event-overview__facts">
          <span>
            <CalendarDays size={16} aria-hidden="true" />
            {formatDateRange(event.startDate, event.endDate)}
          </span>
          <span>
            <MapPin size={16} aria-hidden="true" />
            {event.location}
          </span>
          <span>
            <Users size={16} aria-hidden="true" />
            {plural(teamCount, {
              one: "dashboard.teamCount.one",
              other: "dashboard.teamCount.other",
            })}
          </span>
        </div>

        <div className="event-overview__progress">
          <div>
            <strong>
              {t("dashboard.readiness.title")}
              <span className="event-overview__mobile-total">
                {" · "}
                {t("dashboard.summary.total")} {formatNumber(counts.total)}
              </span>
            </strong>
            <span className="event-overview__progress-value">
              {formatPercent(readiness.percent)}
            </span>
          </div>
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
      </div>

      <div className="event-overview__operations">
        <dl className="event-overview__metrics">
          <div>
            <dt>{t("dashboard.summary.total")}</dt>
            <dd>{formatNumber(counts.total)}</dd>
          </div>
          <div className="event-overview__metric--complete">
            <dt>{t("dashboard.summary.completed")}</dt>
            <dd>{formatNumber(counts.completed)}</dd>
          </div>
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
