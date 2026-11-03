import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthShell } from "../auth/AuthShell.tsx";
import { useI18n } from "../i18n/index.ts";
import {
  signupCommand,
  validateSignup,
  type SignupError,
} from "../auth/signup.ts";
import {
  loginHref,
  replaceAuthLocation,
  safeReturnTo,
} from "../auth/routing.ts";
import { setPendingVerification } from "../auth/accountSafety.ts";

export function SignupPage({ enabled }: { enabled: boolean | null }) {
  const { t, language } = useI18n();
  const [submitting, setSubmitting] = useState(false),
    [show, setShow] = useState(false);
  const [error, setError] = useState<SignupError | null>(null);
  const busy = useRef(false),
    title = useRef<HTMLHeadingElement>(null),
    notice = useRef<HTMLParagraphElement>(null);
  const returnTo = safeReturnTo(
    new URLSearchParams(window.location.search).get("returnTo"),
  );
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [enabled]);
  useEffect(() => {
    if (error) notice.current?.focus();
  }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || enabled !== true) return;
    const form = event.currentTarget,
      data = new FormData(form);
    const fields = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "")
        .trim()
        .toLowerCase(),
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
      returnTo,
    };
    const invalid = validateSignup(fields);
    if (invalid) {
      setError(invalid);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const failure = await signupCommand(fields, language);
      setError(failure);
      if (!failure) {
        setPendingVerification(fields.email, returnTo);
        replaceAuthLocation("/verify-email?pending=1");
      }
    } finally {
      for (const name of ["password", "confirmPassword"]) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.value = "";
      }
      busy.current = false;
      setSubmitting(false);
    }
  }
  return (
    <AuthShell>
      <section
        className="auth-entry login-entry"
        aria-labelledby="signup-title"
      >
        <h1 id="signup-title" ref={title} tabIndex={-1}>
          {t(
            enabled === null
              ? "auth.checking"
              : enabled
                ? "signup.title"
                : "signup.closed",
          )}
        </h1>
        {enabled !== null && (
          <p className="login-intro">
            {t(enabled ? "signup.intro" : "signup.closedDetail")}
          </p>
        )}
        {enabled === true && (
          <form onSubmit={submit} aria-busy={submitting}>
            <div className="login-field">
              <label htmlFor="signup-name">{t("signup.name")}</label>
              <input
                id="signup-name"
                name="name"
                autoComplete="nickname"
                required
                maxLength={100}
                readOnly={submitting}
                aria-invalid={error === "invalidName" || undefined}
                aria-describedby={
                  error === "invalidName" ? "signup-error" : undefined
                }
              />
            </div>
            <div className="login-field">
              <label htmlFor="signup-email">{t("auth.email")}</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                readOnly={submitting}
                aria-invalid={error === "invalidEmail" || undefined}
                aria-describedby={
                  error === "invalidEmail" ? "signup-error" : undefined
                }
              />
            </div>
            <p id="signup-password-hint" className="login-message">
              {t("signup.passwordHint")}
            </p>
            <div className="login-field">
              <label htmlFor="signup-password">{t("auth.password")}</label>
              <input
                id="signup-password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                readOnly={submitting}
                aria-invalid={error === "invalidPassword" || undefined}
                aria-describedby={`signup-password-hint${error === "invalidPassword" ? " signup-error" : ""}`}
              />
            </div>
            <div className="login-field">
              <label htmlFor="signup-confirm">{t("signup.confirm")}</label>
              <input
                id="signup-confirm"
                name="confirmPassword"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                readOnly={submitting}
                aria-invalid={error === "mismatch" || undefined}
                aria-describedby={
                  error === "mismatch" ? "signup-error" : undefined
                }
              />
            </div>
            <button
              type="button"
              className="button signup-visibility"
              onClick={() => setShow((value) => !value)}
              aria-pressed={show}
              aria-controls="signup-password signup-confirm"
              disabled={submitting}
            >
              {t(show ? "signup.hide" : "signup.show")}
            </button>
            {error && (
              <p
                id="signup-error"
                className="login-error"
                role="alert"
                tabIndex={-1}
                ref={notice}
              >
                {t(`signup.${error}`)}
              </p>
            )}
            <button
              type="submit"
              className="button button--primary login-submit"
              disabled={submitting}
            >
              {t(submitting ? "signup.submitting" : "signup.submit")}
            </button>
          </form>
        )}
        <a className="auth-secondary-link" href={loginHref(returnTo)}>
          {t("signup.login")}
        </a>
      </section>
    </AuthShell>
  );
}
