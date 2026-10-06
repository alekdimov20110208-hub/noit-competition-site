import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthShell } from "../auth/AuthShell.tsx";
import { useI18n } from "../i18n/index.ts";
import { auth } from "../auth/runtime.ts";
import type { AuthError } from "../auth/state.ts";
import { setPendingVerification } from "../auth/accountSafety.ts";
import { replaceAuthLocation, safeReturnTo } from "../auth/routing.ts";

export function LoginPage({
  bootstrapError,
  expired,
}: {
  bootstrapError: AuthError | null;
  expired: boolean;
}) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const busy = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    busy.current = true;
    setSubmitting(true);
    setError(null);
    const failure = await auth.signIn(
      String(data.get("email") ?? ""),
      String(data.get("password") ?? ""),
    );
    // Password stays only in the input/request; discard it after every attempt.
    const password = form.elements.namedItem("password");
    if (password instanceof HTMLInputElement) password.value = "";
    setError(failure);
    setSubmitting(false);
    busy.current = false;
    if (failure === "verification") {
      const returnTo = safeReturnTo(
        new URLSearchParams(window.location.search).get("returnTo"),
      );
      setPendingVerification(String(data.get("email") ?? ""), returnTo);
      replaceAuthLocation("/verify-email?pending=1");
    }
  }

  const visibleError = error ?? bootstrapError;
  return (
    <AuthShell
      className="login-workspace"
      context={
        <section
          className="auth-context login-context"
          aria-labelledby="auth-context-title"
        >
          <p className="auth-eyebrow">{t("auth.context")}</p>
          <h2 id="auth-context-title">{t("auth.contextDetail")}</h2>
          <dl className="auth-relationships">
            <div>
              <dt>{t("auth.event")}</dt>
              <dd>{t("auth.eventDetail")}</dd>
            </div>
            <div>
              <dt>{t("auth.responsibility")}</dt>
              <dd>{t("auth.responsibilityDetail")}</dd>
            </div>
            <div>
              <dt>{t("auth.decision")}</dt>
              <dd>{t("auth.decisionDetail")}</dd>
            </div>
          </dl>
        </section>
      }
    >
      <section className="auth-entry login-entry" aria-labelledby="login-title">
        <h1 id="login-title" tabIndex={-1} ref={titleRef}>
          {t("auth.title")}
        </h1>
        <p className="login-intro">{t("auth.intro")}</p>
        {expired && !visibleError && (
          <p className="login-message" role="status">
            {t("auth.expired")}
          </p>
        )}
        <form onSubmit={submit} aria-busy={submitting}>
          <div className="login-field">
            <label htmlFor="login-email">{t("auth.email")}</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              readOnly={submitting}
              aria-describedby={visibleError ? "login-error" : undefined}
              aria-invalid={error === "invalid" || undefined}
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">{t("auth.password")}</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              readOnly={submitting}
              aria-describedby={visibleError ? "login-error" : undefined}
              aria-invalid={error === "invalid" || undefined}
            />
          </div>
          {visibleError && (
            <p
              id="login-error"
              className="login-error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              {t(`auth.error.${visibleError}`)}
            </p>
          )}
          <button
            type="submit"
            className="button button--primary login-submit"
            disabled={submitting}
          >
            {t(submitting ? "auth.submitting" : "auth.submit")}
          </button>
        </form>
        <a className="auth-secondary-link" href="/forgot-password">
          {t("safety.forgot")}
        </a>
      </section>
    </AuthShell>
  );
}
