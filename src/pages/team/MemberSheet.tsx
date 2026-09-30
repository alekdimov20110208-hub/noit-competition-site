import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "../../i18n/index.ts";
import { isVisibleFocusTarget } from "../../navigationFocus.ts";

interface Props {
  children: ReactNode;
  onClose: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export function MemberSheet({ children, onClose, scrollRef, onScroll }: Props) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    document.body.classList.add("team-sheet-open");
    // TeamPage owns initial/return focus. Cleanup must not steal TaskDrawer focus.
    return () => {
      if (root) root.inert = wasInert;
      document.body.classList.remove("team-sheet-open");
    };
  }, []);
  return createPortal(
    <div
      className="team-sheet"
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-member-heading"
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = [
          ...(panel.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), summary, [tabindex="0"]',
          ) ?? []),
        ].filter(isVisibleFocusTarget);
        const first = focusable[0],
          last = focusable.at(-1);
        const active = document.activeElement;
        if (
          event.shiftKey &&
          (active === first || !focusable.includes(active as HTMLElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (active === last || !focusable.includes(active as HTMLElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="team-sheet__topbar">
        <span>{t("team.workspace.detail")}</span>
        <button
          className="team-sheet__close"
          type="button"
          aria-label={t("team.workspace.close")}
          onClick={onClose}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="team-sheet__body" ref={scrollRef} onScroll={onScroll}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
