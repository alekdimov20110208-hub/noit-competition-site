import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

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
    onNavigate(href);
  }

  return (
    <a {...anchorProps} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
