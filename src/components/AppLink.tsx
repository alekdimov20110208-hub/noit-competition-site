import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { eventHref, parseAppLocation, APP_ROUTES } from "../routes.ts";

interface AppLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
> {
  href: string;
  onNavigate: (href: string) => void;
  children: ReactNode;
}

export function AppLink({
  href,
  onNavigate,
  children,
  ...anchorProps
}: AppLinkProps) {
  const location = parseAppLocation(
    window.location.pathname,
    window.location.search,
  );
  const url = new URL(href, window.location.origin);
  const scopedHref =
    location.eventId &&
    url.origin === window.location.origin &&
    APP_ROUTES.some((route) => route.path === url.pathname)
      ? eventHref(
          location.eventId,
          parseAppLocation(url.pathname, url.search).path,
          parseAppLocation(url.pathname, url.search).taskId,
        )
      : href;
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
    onNavigate(scopedHref);
  }

  return (
    <a {...anchorProps} href={scopedHref} onClick={handleClick}>
      {children}
    </a>
  );
}
