import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import type { Event } from "../domain/types.ts";
import { APP_ROUTES } from "../routes.ts";
import { formatShortDate } from "../utils/format.ts";
import { BrandWordmark } from "./BrandWordmark.tsx";

interface AppShellProps {
  currentPath: string;
  event: Event;
  persistenceError: string | null;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

interface NavLinkProps {
  path: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
  className?: string;
  label: string;
}

function NavLink({
  path,
  currentPath,
  onNavigate,
  children,
  className = "",
  label,
}: NavLinkProps) {
  const active = currentPath === path;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onNavigate(path);
  }

  return (
    <a
      href={path}
      className={className}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

export function AppShell({
  currentPath,
  event,
  persistenceError,
  onNavigate,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar__brand">
          <BrandWordmark />
        </div>

        <div className="sidebar__event" aria-label="Current event">
          <div className="sidebar__event-label">Current event</div>
          <strong>{event.name}</strong>
          <span>
            {formatShortDate(event.startDate)}–{formatShortDate(event.endDate)}
          </span>
          <span>
            <MapPin size={13} aria-hidden="true" /> {event.location}
          </span>
        </div>

        <nav className="sidebar__nav">
          <p>Organizer</p>
          {APP_ROUTES.map((route) => {
            const Icon = route.icon;
            return (
              <NavLink
                key={route.path}
                path={route.path}
                currentPath={currentPath}
                onNavigate={onNavigate}
                className="sidebar__link"
                label={route.label}
              >
                <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                <span>{route.label}</span>
                <ChevronRight
                  className="sidebar__link-arrow"
                  size={15}
                  aria-hidden="true"
                />
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <span className="demo-dot" aria-hidden="true" />
          Local prototype · fictional data
        </div>
      </aside>

      <div className="mobile-header">
        <BrandWordmark compact />
        <div className="mobile-header__event">
          <CalendarDays size={15} aria-hidden="true" />
          <span>{event.name}</span>
        </div>
      </div>

      <main className="app-main" id="main-content" tabIndex={-1}>
        {persistenceError && (
          <div className="notice notice--warning" role="status">
            <strong>Local changes could not be saved.</strong>
            <span>{persistenceError}</span>
          </div>
        )}
        {children}
      </main>

      <nav className="mobile-nav" aria-label="Primary navigation">
        {APP_ROUTES.map((route) => {
          const Icon = route.icon;
          return (
            <NavLink
              key={route.path}
              path={route.path}
              currentPath={currentPath}
              onNavigate={onNavigate}
              className="mobile-nav__link"
              label={route.label}
            >
              <Icon size={19} strokeWidth={2} aria-hidden="true" />
              <span>{route.mobileLabel}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
