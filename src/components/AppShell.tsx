import { CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import type { Event } from "../domain/types.ts";
import { useI18n, type MessageKey } from "../i18n/index.ts";
import { usePreferences } from "../preferences/index.ts";
import { APP_ROUTES, type AppPath } from "../routes.ts";
import { AppLink } from "./AppLink.tsx";
import { BrandWordmark } from "./BrandWordmark.tsx";
import { PreferencesControls } from "./PreferencesControls.tsx";

type PersistenceError = "read" | "write" | null;

const WORKSPACE_ERROR_KEYS: Record<
  Exclude<PersistenceError, null>,
  MessageKey
> = {
  read: "shell.storage.read",
  write: "shell.storage.write",
};

const PREFERENCE_ERROR_KEYS = {
  read: "preferences.storage.read",
  write: "preferences.storage.write",
} as const satisfies Record<"read" | "write", MessageKey>;

interface AppShellProps {
  currentPath: AppPath;
  event: Event;
  persistenceError: PersistenceError;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

export function AppShell({
  currentPath,
  event,
  persistenceError,
  onNavigate,
  children,
}: AppShellProps) {
  const { t, formatDateRange } = useI18n();
  const { storageError: preferenceStorageError } = usePreferences();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("shell.skipToContent")}
      </a>

      <aside className="sidebar" aria-label={t("nav.primary")}>
        <div className="sidebar__brand">
          <BrandWordmark />
        </div>

        <div className="sidebar__event" aria-label={t("shell.currentEvent")}>
          <div className="sidebar__event-label">{t("shell.currentEvent")}</div>
          <strong>{event.name}</strong>
          <span>{formatDateRange(event.startDate, event.endDate)}</span>
          <span>
            <MapPin size={13} aria-hidden="true" /> {event.location}
          </span>
        </div>

        <nav className="sidebar__nav">
          <p>{t("shell.organizer")}</p>
          {APP_ROUTES.map((route) => {
            const Icon = route.icon;
            const label = t(route.labelKey);
            return (
              <AppLink
                key={route.path}
                href={route.path}
                onNavigate={onNavigate}
                className="sidebar__link"
                aria-current={currentPath === route.path ? "page" : undefined}
                aria-label={label}
              >
                <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                <span>{label}</span>
              </AppLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <span className="demo-dot" aria-hidden="true" />
          {t("shell.demoNotice")}
        </div>
      </aside>

      <header className="app-header">
        <div className="app-header__mobile-context">
          <BrandWordmark compact />
          <div className="app-header__event">
            <CalendarDays size={15} aria-hidden="true" />
            <span>{event.name}</span>
          </div>
        </div>
        <PreferencesControls />
      </header>

      <main className="app-main" id="main-content" tabIndex={-1}>
        {persistenceError && (
          <div className="notice notice--warning" role="status">
            <strong>{t("shell.storage.summary")}</strong>
            <span>{t(WORKSPACE_ERROR_KEYS[persistenceError])}</span>
          </div>
        )}
        {preferenceStorageError && (
          <div className="notice notice--warning" role="status">
            <strong>{t(PREFERENCE_ERROR_KEYS[preferenceStorageError])}</strong>
          </div>
        )}
        {children}
      </main>

      <nav className="mobile-nav" aria-label={t("nav.primary")}>
        {APP_ROUTES.map((route) => {
          const Icon = route.icon;
          const label = t(route.labelKey);
          return (
            <AppLink
              key={route.path}
              href={route.path}
              onNavigate={onNavigate}
              className="mobile-nav__link"
              aria-current={currentPath === route.path ? "page" : undefined}
              aria-label={label}
            >
              <Icon size={19} strokeWidth={2} aria-hidden="true" />
              <span>{t(route.mobileLabelKey)}</span>
            </AppLink>
          );
        })}
      </nav>
    </div>
  );
}
