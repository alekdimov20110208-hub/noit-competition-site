import { useEffect, useRef, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { AppLink } from "../components/AppLink.tsx";
import { avatarInitials } from "./profile.ts";
import { BrandWordmark } from "../components/BrandWordmark.tsx";
import { useI18n } from "../i18n/index.ts";
import { auth, useAuth } from "./runtime.ts";
import { replaceAuthLocation } from "./routing.ts";
import type { AuthError } from "./state.ts";

export function AccountControl({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate: (href: string) => void;
}) {
  const { t } = useI18n();
  const state = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const pending = useRef(false);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!mobile || state.status !== "authenticated") return;
    function closeOutside(event: Event) {
      const details = menu.current;
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      )
        details.open = false;
    }
    // A touch can blur the summary with no relatedTarget before click fires.
    // Close from the actual outside interaction, not that ambiguous blur.
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [mobile, state.status]);

  if (state.status !== "authenticated") return null;

  async function logout() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const failure = await auth.signOut();
    if (!failure) replaceAuthLocation("/login");
    else setError(failure);
    setBusy(false);
    pending.current = false;
  }

  const controls = (
    <>
      <div className="account-control__identity">
        <span className="account-avatar" aria-hidden="true">
          {avatarInitials(state.user.name)}
        </span>
        <span
          className="account-control__name"
          title={state.user.name || state.user.email}
        >
          {state.user.name || state.user.email}
        </span>
      </div>
      <AppLink
        href="/account"
        onNavigate={(href) => {
          if (menu.current) menu.current.open = false;
          onNavigate(href);
        }}
        className="account-control__profile"
        aria-current={
          window.location.pathname === "/account" ? "page" : undefined
        }
      >
        <UserRound size={16} aria-hidden="true" />
        <span>{t("profile.title")}</span>
      </AppLink>
      <button
        type="button"
        onClick={logout}
        disabled={busy || state.accountBusy}
      >
        <LogOut size={16} aria-hidden="true" />
        <span>{t(busy ? "auth.signingOut" : "auth.logout")}</span>
      </button>
      {error && (
        <p className="account-control__error" role="alert">
          {t("auth.logoutError")}
        </p>
      )}
    </>
  );
  return mobile ? (
    <details
      ref={menu}
      className="account-control account-control--mobile"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
          event.stopPropagation();
        }
      }}
    >
      <summary aria-label={t("auth.account")}>
        <BrandWordmark compact />
      </summary>
      <div className="account-control__menu">{controls}</div>
    </details>
  ) : (
    <div className="account-control account-control--desktop">{controls}</div>
  );
}
