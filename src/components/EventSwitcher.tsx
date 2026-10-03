import type { TaskEvent } from "../services/RemoteWorkspaceService.ts";
import { useI18n } from "../i18n/index.ts";
import { AppLink } from "./AppLink.tsx";
import "./eventSwitcher.css";

export function EventSwitcher({
  events,
  currentEventId,
  onSwitch,
  onNavigate,
  editHref,
  status = "ready",
  mobile = false,
}: {
  events: readonly TaskEvent[];
  currentEventId?: string;
  onSwitch: (eventId: string) => void;
  onNavigate: (href: string) => void;
  editHref?: string;
  status?: "loading" | "ready" | "error";
  mobile?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={`event-switcher${mobile ? " event-switcher--mobile" : ""}`}>
      <select
        id={mobile ? "mobile-event-switcher" : "event-switcher"}
        aria-label={t("events.switch")}
        value={currentEventId ?? ""}
        onChange={(e) => onSwitch(e.target.value)}
        disabled={!events.some((event) => !event.archived)}
      >
        {!currentEventId && (
          <option value="" disabled>
            {t(
              !events.length && status === "loading"
                ? "events.loading"
                : events.length || status === "error"
                  ? "events.choose"
                  : "events.none",
            )}
          </option>
        )}
        {events
          .filter((event) => !event.archived || event.id === currentEventId)
          .map((event) => (
            <option key={event.id} value={event.id} disabled={event.archived}>
              {event.name}
            </option>
          ))}
      </select>
      <div className="event-switcher__actions">
        <AppLink href="/events/new" onNavigate={onNavigate}>
          {t("events.create")}
        </AppLink>
        {editHref && (
          <AppLink href={editHref} onNavigate={onNavigate}>
            {t("events.edit")}
          </AppLink>
        )}
      </div>
    </div>
  );
}
