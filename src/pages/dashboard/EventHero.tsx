import { CalendarClock, MapPin, Users } from "lucide-react";
import type { CSSProperties } from "react";
import type { Event } from "../../domain/types.ts";
import type { ReadinessSummary } from "../../domain/workspace.ts";
import { useI18n, type MessageKey } from "../../i18n/index.ts";

const EVENT_STATUS_MESSAGE_KEYS = {
  planning: "status.event.planning",
  ready: "status.event.ready",
  completed: "status.event.completed",
} satisfies Record<Event["status"], MessageKey>;

interface EventHeroProps {
  event: Event;
  readiness: ReadinessSummary;
  teamCount: number;
}

export function EventHero({ event, readiness, teamCount }: EventHeroProps) {
  const { t, plural, formatDateRange, formatNumber, formatPercent } = useI18n();
  const readinessStyle = {
    "--readiness": `${readiness.percent * 3.6}deg`,
  } as CSSProperties;

  return (
    <section className="event-hero" aria-labelledby="current-event-title">
      <div className="event-hero__details">
        <div className="event-hero__meta">
          <span className="event-hero__status">
            {t(EVENT_STATUS_MESSAGE_KEYS[event.status])}
          </span>
          <span>{t("dashboard.fictionalEvent")}</span>
        </div>
        <h2 id="current-event-title">{event.name}</h2>
        <p className="event-hero__guest">
          {t("dashboard.withGuest", { guest: event.guestInstructor })}
        </p>
        <div className="event-hero__facts">
          <span>
            <CalendarClock size={17} aria-hidden="true" />
            {formatDateRange(event.startDate, event.endDate)}
          </span>
          <span>
            <MapPin size={17} aria-hidden="true" />
            {event.location}
          </span>
          <span>
            <Users size={17} aria-hidden="true" />
            {plural(teamCount, {
              one: "dashboard.teamCount.one",
              other: "dashboard.teamCount.other",
            })}
          </span>
        </div>
      </div>

      <div className="readiness-card">
        <div
          className="readiness-ring"
          style={readinessStyle}
          role="img"
          aria-label={t("dashboard.readiness.detail", {
            completed: formatNumber(readiness.completed),
            total: formatNumber(readiness.total),
          })}
        >
          <div>
            <strong>{formatPercent(readiness.percent)}</strong>
            <span>{t("dashboard.readiness.complete")}</span>
          </div>
        </div>
        <div>
          <strong>{t("dashboard.readiness.title")}</strong>
          <p>
            {t("dashboard.readiness.detail", {
              completed: formatNumber(readiness.completed),
              total: formatNumber(readiness.total),
            })}
          </p>
          <p>{t("dashboard.readiness.explanation")}</p>
        </div>
      </div>
    </section>
  );
}
