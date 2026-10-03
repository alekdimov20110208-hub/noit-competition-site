import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { BrandWordmark } from "../components/BrandWordmark.tsx";
import { useI18n } from "../i18n/index.ts";
import { auth, useAuth } from "./runtime.ts";
import { replaceAuthLocation } from "./routing.ts";
import type { AuthError } from "./state.ts";

export function AccountControl({ mobile = false }: { mobile?: boolean }) {
  const { t } = useI18n();
  const state = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const pending = useRef(false);
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
      <span className="account-control__name">
        {state.user.name || state.user.email}
      </span>
      <button type="button" onClick={logout} disabled={busy}>
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
    <details className="account-control account-control--mobile">
      <summary aria-label={t("auth.account")}>
        <BrandWordmark compact />
      </summary>
      <div className="account-control__menu">{controls}</div>
    </details>
  ) : (
    <div className="account-control account-control--desktop">{controls}</div>
  );
}
