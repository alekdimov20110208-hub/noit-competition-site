import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthShell } from "../auth/AuthShell.tsx";
import { useI18n } from "../i18n/index.ts";
import {
  accountSafetyCommand,
  readResetToken,
  takePendingVerification,
} from "../auth/accountSafety.ts";
import { loginHref, safeReturnTo } from "../auth/routing.ts";
import { auth } from "../auth/runtime.ts";
export function AccountSafetyPage({
  mode,
}: {
  mode: "forgot" | "reset" | "verify";
}) {
  const { t, language } = useI18n();
  const [continuation] = useState(() =>
    mode === "verify" ? takePendingVerification() : null,
  );
  const [token] = useState(() => readResetToken(window.location.search));
  const params = new URLSearchParams(window.location.search);
  // A bare visit offers verification; only the auth callback announces success.
  // This marker is UI context, never authorization or a verification flag.
  const pending =
    mode === "verify" &&
    !params.has("error") &&
    params.get("status") !== "verified";
  const failed = params.has("error") || (mode === "reset" && !token);
  const returnTo = safeReturnTo(
    continuation?.returnTo ?? params.get("returnTo"),
  );
  const [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<
    "limited" | "invalid" | "unavailable" | "mismatch" | null
  >(null);
  const locked = useRef(false),
    title = useRef<HTMLHeadingElement>(null),
    notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [mode]);
  useEffect(() => {
    if (done || error) notice.current?.focus();
  }, [done, error]);
  useEffect(() => {
    // Remove reset credentials from address/history once captured in component memory.
    if (mode === "reset")
      window.history.replaceState({}, "", "/reset-password");
  }, [mode]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setError(null);
    if (mode === "reset" && data.get("password") !== data.get("confirm")) {
      setError("mismatch");
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      const failure = await accountSafetyCommand(
        mode === "forgot"
          ? "request-password-reset"
          : mode === "reset"
            ? "reset-password"
            : "send-verification-email",
        mode === "reset"
          ? {
              token: token ?? "",
              newPassword: String(data.get("password") ?? ""),
            }
          : { email: String(data.get("email") ?? ""), returnTo },
        language,
      );
      setError(failure);
      if (!failure) {
        setDone(true);
        if (mode === "reset") auth.expireSession();
      }
    } finally {
      for (const name of ["password", "confirm"]) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.value = "";
      }
      locked.current = false;
      setBusy(false);
    }
  }
  const heading = done
    ? mode === "reset"
      ? "safety.resetDone"
      : "safety.sent"
    : mode === "verify" && !pending
      ? failed
        ? "safety.verifyFailed"
        : "safety.verified"
      : (`safety.${mode}` as const);
  return (
    <AuthShell>
      <section
        className="auth-entry login-entry"
        aria-labelledby="safety-title"
      >
        <h1 id="safety-title" ref={title} tabIndex={-1}>
          {t(heading)}
        </h1>
        <p className="login-intro">
          {t(
            mode === "verify" && !pending
              ? failed
                ? "safety.verifyFailedDetail"
                : "safety.verifiedDetail"
              : mode === "reset"
                ? "safety.resetDetail"
                : mode === "forgot"
                  ? "safety.forgotDetail"
                  : "safety.verifyDetail",
          )}
        </p>
        {done && (
          <p role="status" tabIndex={-1} ref={notice}>
            {t(mode === "reset" ? "safety.resetDoneDetail" : "safety.generic")}
          </p>
        )}
        {failed && mode === "reset" && (
          <p role="alert">{t("safety.invalid")}</p>
        )}
        {!done && !failed && (mode !== "verify" || pending) && (
          <form onSubmit={submit} aria-busy={busy}>
            {mode === "reset" ? (
              <>
                <div className="login-field">
                  <label htmlFor="reset-password">
                    {t("safety.newPassword")}
                  </label>
                  <input
                    id="reset-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    readOnly={busy}
                    aria-describedby={error ? "safety-error" : undefined}
                  />
                </div>
                <div className="login-field">
                  <label htmlFor="reset-confirm">
                    {t("safety.confirmPassword")}
                  </label>
                  <input
                    id="reset-confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    readOnly={busy}
                    aria-describedby={error ? "safety-error" : undefined}
                  />
                </div>
              </>
            ) : (
              <div className="login-field">
                <label htmlFor="safety-email">{t("auth.email")}</label>
                <input
                  id="safety-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  defaultValue={continuation?.email ?? ""}
                  required
                  readOnly={busy}
                  aria-describedby={error ? "safety-error" : undefined}
                />
              </div>
            )}
            <button
              className="button button--primary login-submit"
              type="submit"
              disabled={busy}
            >
              {t(
                busy
                  ? "safety.sending"
                  : mode === "forgot"
                    ? "safety.request"
                    : mode === "reset"
                      ? "safety.save"
                      : "safety.resend",
              )}
            </button>
          </form>
        )}
        {error && (
          <p
            id="safety-error"
            className="login-error"
            role="alert"
            tabIndex={-1}
            ref={notice}
          >
            {t(`safety.${error}`)}
          </p>
        )}
        {done && pending && (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setDone(false)}
          >
            {t("safety.resend")}
          </button>
        )}
        {mode === "verify" && !pending && failed && (
          <a
            className="button button--secondary"
            href="/verify-email?pending=1"
          >
            {t("safety.resend")}
          </a>
        )}
        <a className="auth-secondary-link" href={loginHref(returnTo)}>
          {t("safety.back")}
        </a>
        {mode === "reset" && failed && (
          <a className="auth-secondary-link" href="/forgot-password">
            {t("safety.forgot")}
          </a>
        )}
      </section>
    </AuthShell>
  );
}
