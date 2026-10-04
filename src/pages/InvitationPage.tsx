import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BrandWordmark } from "../components/BrandWordmark.tsx";
import { PreferencesControls } from "../components/PreferencesControls.tsx";
import { auth, useAuth } from "../auth/runtime.ts";
import { loginHref, replaceAuthLocation } from "../auth/routing.ts";
import { eventHref } from "../routes.ts";
import { useI18n } from "../i18n/index.ts";
import {
  InvitationFailure,
  type InvitationSummary,
  type InviteError,
} from "../services/invitations.ts";
import { RemoteWorkspaceService } from "../services/RemoteWorkspaceService.ts";
import "../components/invitations.css";

export function InvitationPage({ token }: { token: string | null }) {
  const { t, formatDateTime } = useI18n(),
    identity = useAuth();
  const service = useMemo(() => new RemoteWorkspaceService().invitations, []);
  const [summary, setSummary] = useState<InvitationSummary | null>(null),
    [error, setError] = useState<InviteError | null>(null),
    [busy, setBusy] = useState(false),
    [register, setRegister] = useState(false),
    [revision, setRevision] = useState(0);
  const abort = useRef<AbortController | null>(null),
    submitting = useRef(false),
    errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const request = new AbortController();
    abort.current = request;
    setSummary(null);
    setError(null);
    if (!token) {
      setError("invalid");
      return;
    }
    void service
      .lookup(token, request.signal)
      .then(setSummary)
      .catch((error) => {
        if (!request.signal.aborted)
          setError(
            error instanceof InvitationFailure ? error.code : "unavailable",
          );
      });
    return () => {
      request.abort();
    };
  }, [token, service, revision]);
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const wrong =
    summary?.state === "pending" &&
    identity.user &&
    identity.user.email.trim().toLowerCase() !== summary.email;
  async function command(work: (signal: AbortSignal) => Promise<void>) {
    if (submitting.current || !token) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const request = new AbortController();
    abort.current?.abort();
    abort.current = request;
    try {
      await work(request.signal);
    } catch (error) {
      if (!request.signal.aborted) {
        const code =
          error instanceof InvitationFailure ? error.code : "unavailable";
        if (code === "unauthenticated") auth.expireSession();
        setError(code);
      }
    } finally {
      if (!request.signal.aborted) setBusy(false);
      submitting.current = false;
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    if (summary?.state !== "pending") return;
    await command(async (signal) => {
      const password = String(data.get("password") ?? "");
      try {
        await service.register(
          token!,
          String(data.get("name") ?? ""),
          password,
          signal,
        );
        signal.throwIfAborted();
        const failure = await auth.signIn(summary.email, password);
        if (failure) throw new InvitationFailure("registration");
        setRegister(false);
      } finally {
        const input = form.elements.namedItem("password");
        if (input instanceof HTMLInputElement) input.value = "";
      }
    });
  }
  const signIn = () => replaceAuthLocation(loginHref(window.location.pathname));
  return (
    <div className="auth-screen">
      <header className="auth-header">
        <BrandWordmark compact />
        <PreferencesControls />
      </header>
      <main className="login-workspace invite-workspace" id="main-content">
        <section
          className="invite-entry"
          aria-labelledby="invitation-title"
          aria-busy={busy}
        >
          <h1 id="invitation-title">{t("invite.title")}</h1>
          {!summary && !error && <p role="status">{t("invite.loading")}</p>}
          {summary?.state === "pending" && (
            <>
              <p>{t("invite.context", { name: summary.eventName })}</p>
              <p>{t("invite.for", { email: summary.email })}</p>
              <p>
                {t("invite.expires", {
                  date: formatDateTime(summary.expiresAt),
                })}
              </p>
            </>
          )}
          {summary && summary.state !== "pending" && (
            <p role="status">{t(`invite.state.${summary.state}`)}</p>
          )}
          {wrong ? (
            <>
              <p role="alert">{t("invite.wrong")}</p>
              <button
                className="button button--secondary"
                disabled={busy}
                onClick={() =>
                  void command(async () => {
                    const failure = await auth.signOut();
                    if (failure) throw new InvitationFailure("unavailable");
                  })
                }
              >
                {t("invite.signOut")}
              </button>
            </>
          ) : (
            summary &&
            (summary.state === "pending" || summary.state === "accepted") && (
              <>
                {identity.user ? (
                  <div className="invitation-actions">
                    <button
                      type="button"
                      className="button button--primary"
                      disabled={busy}
                      onClick={() =>
                        void command(async (signal) => {
                          const eventId = await service.accept(token!, signal);
                          signal.throwIfAborted();
                          replaceAuthLocation(eventHref(eventId));
                        })
                      }
                    >
                      {t(
                        busy
                          ? "invite.creating"
                          : summary.state === "accepted"
                            ? "invite.joined"
                            : "invite.join",
                      )}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="invitation-actions">
                      <button
                        type="button"
                        className="button button--primary"
                        disabled={busy}
                        onClick={signIn}
                      >
                        {t("invite.signIn")}
                      </button>
                      {summary.state === "pending" && (
                        <button
                          type="button"
                          className="button button--secondary"
                          disabled={busy}
                          onClick={() => setRegister(true)}
                        >
                          {t("invite.register")}
                        </button>
                      )}
                    </div>
                    {register && summary.state === "pending" && (
                      <form onSubmit={create} aria-busy={busy}>
                        <p>{t("invite.new")}</p>
                        <div className="login-field">
                          <label htmlFor="invite-email">
                            {t("invite.email")}
                          </label>
                          <input
                            id="invite-email"
                            type="email"
                            value={summary.email}
                            readOnly
                          />
                        </div>
                        <div className="login-field">
                          <label htmlFor="invite-name">
                            {t("invite.name")}
                          </label>
                          <input
                            id="invite-name"
                            name="name"
                            autoComplete="name"
                            maxLength={100}
                            required
                            readOnly={busy}
                            autoFocus
                            aria-describedby={
                              error ? "invite-page-error" : undefined
                            }
                          />
                        </div>
                        <div className="login-field">
                          <label htmlFor="invite-password">
                            {t("invite.password")}
                          </label>
                          <input
                            id="invite-password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            maxLength={128}
                            required
                            readOnly={busy}
                            aria-describedby={
                              error ? "invite-page-error" : undefined
                            }
                          />
                        </div>
                        <div className="invitation-actions">
                          <button
                            type="submit"
                            className="button button--primary"
                            disabled={busy}
                          >
                            {t(busy ? "invite.creating" : "invite.register")}
                          </button>
                          <button
                            type="button"
                            className="button button--secondary"
                            disabled={busy}
                            onClick={() => setRegister(false)}
                          >
                            {t("invite.cancel")}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </>
            )
          )}
          {error && (
            <p
              id="invite-page-error"
              className="login-error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              {t(`invite.error.${error}`)}
            </p>
          )}
          {error && (
            <button
              type="button"
              className="button button--secondary"
              disabled={busy}
              onClick={() => setRevision((value) => value + 1)}
            >
              {t("invite.retry")}
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
