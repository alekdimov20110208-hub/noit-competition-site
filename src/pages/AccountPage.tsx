import { useEffect, useRef, useState, type FormEvent } from "react";
import { auth } from "../auth/runtime.ts";
import {
  avatarInitials,
  ProfileController,
  validDisplayName,
  type ProfileError,
} from "../auth/profile.ts";
import type { CurrentUser } from "../auth/state.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { PreferencesControls } from "../components/PreferencesControls.tsx";
import { useI18n } from "../i18n/index.ts";
import "./account.css";

type Notice =
  { error: ProfileError } | { success: "saved" | "passwordSaved" } | null;

export function AccountPage({ user }: { user: CurrentUser }) {
  const { t } = useI18n();
  const [controller] = useState(() => new ProfileController(auth));
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState<"name" | "password" | "reload" | null>(null);
  const [nameNotice, setNameNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const pending = useRef(false);
  const personalMessage = useRef<HTMLParagraphElement>(null);
  const securityMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => setName(user.name), [user.name]);
  useEffect(() => {
    if (nameNotice) personalMessage.current?.focus();
  }, [nameNotice]);
  useEffect(() => {
    if (passwordNotice) securityMessage.current?.focus();
  }, [passwordNotice]);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setNameNotice(null);
    if (!validDisplayName(name)) {
      setNameNotice({ error: "invalidName" });
      return;
    }
    pending.current = true;
    setBusy("name");
    try {
      const error = await controller.run("update-user", { name: name.trim() });
      setNameNotice(error ? { error } : { success: "saved" });
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    setPasswordNotice(null);
    if (
      !currentPassword ||
      currentPassword.length > 128 ||
      newPassword.length < 8 ||
      newPassword.length > 128
    ) {
      setPasswordNotice({ error: "invalidPassword" });
      return;
    }
    if (newPassword !== data.get("confirmation")) {
      setPasswordNotice({ error: "mismatch" });
      return;
    }
    pending.current = true;
    setBusy("password");
    try {
      const error = await controller.run("change-password", {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      setPasswordNotice(error ? { error } : { success: "passwordSaved" });
    } finally {
      // Passwords live only in this form and the in-flight request.
      form.reset();
      pending.current = false;
      setBusy(null);
    }
  }
  async function reloadAccount(section: "name" | "password") {
    if (pending.current) return;
    pending.current = true;
    setBusy("reload");
    try {
      const failure = await auth.refreshIdentity(user.id);
      const notice: Notice = failure
        ? { error: failure === "expired" ? "expired" : "unavailable" }
        : null;
      if (section === "name") setNameNotice(notice);
      else setPasswordNotice(notice);
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }
  function message(notice: Notice, section: "name" | "password") {
    if (!notice) return null;
    const error = "error" in notice;
    return (
      <>
        <p
          id={`profile-${section}-notice`}
          className={`profile-message${error ? " profile-message--error" : ""}`}
          role={error ? "alert" : "status"}
          tabIndex={-1}
          ref={section === "name" ? personalMessage : securityMessage}
        >
          {t(`profile.${error ? notice.error : notice.success}`)}
        </p>
        {error &&
          ["refresh", "unavailable", "failed"].includes(notice.error) && (
            <button
              className="button button--secondary"
              type="button"
              disabled={!!busy}
              onClick={() => void reloadAccount(section)}
            >
              {t("profile.reload")}
            </button>
          )}
      </>
    );
  }
  return (
    <div className="page profile-page">
      <PageHeader
        title={t("profile.title")}
        description={t("profile.description")}
      />
      <section className="profile-section" aria-labelledby="profile-personal">
        <div className="profile-section__intro">
          <h2 id="profile-personal">{t("profile.personal")}</h2>
          <p>{t("profile.personalDetail")}</p>
        </div>
        <form
          onSubmit={saveName}
          aria-busy={busy === "name"}
          className="profile-form"
        >
          <div className="profile-avatar-row">
            <span
              className="account-avatar account-avatar--large"
              aria-hidden="true"
            >
              {avatarInitials(user.name)}
            </span>
            <p>{t("profile.avatarHint")}</p>
          </div>
          <div className="profile-field">
            <label htmlFor="profile-name">{t("profile.name")}</label>
            <input
              id="profile-name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameNotice(null);
              }}
              maxLength={100}
              required
              readOnly={!!busy}
              aria-invalid={
                nameNotice &&
                "error" in nameNotice &&
                nameNotice.error === "invalidName"
                  ? true
                  : undefined
              }
              aria-describedby={`profile-name-hint${nameNotice ? " profile-name-notice" : ""}`}
            />
            <p id="profile-name-hint" className="profile-hint">
              {t("profile.nameHint")}
            </p>
          </div>
          <div className="profile-field">
            <label htmlFor="profile-email">{t("profile.email")}</label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={user.email}
              readOnly
              aria-describedby="profile-email-hint"
            />
            <p id="profile-email-hint" className="profile-hint">
              {t("profile.emailHint")}
            </p>
          </div>
          <button
            className="button button--primary"
            type="submit"
            disabled={!!busy || name.trim() === user.name}
          >
            {t(busy === "name" ? "profile.saving" : "profile.save")}
          </button>
          {message(nameNotice, "name")}
        </form>
      </section>
      <section className="profile-section" aria-labelledby="profile-security">
        <div className="profile-section__intro">
          <h2 id="profile-security">{t("profile.security")}</h2>
          <p>{t("profile.securityDetail")}</p>
        </div>
        <form
          onSubmit={changePassword}
          aria-busy={busy === "password"}
          className="profile-form"
        >
          {(["currentPassword", "newPassword", "confirmation"] as const).map(
            (field) => (
              <div className="profile-field" key={field}>
                <label htmlFor={`profile-${field}`}>
                  {t(
                    field === "confirmation"
                      ? "profile.confirmPassword"
                      : `profile.${field}`,
                  )}
                </label>
                <input
                  id={`profile-${field}`}
                  name={field}
                  type="password"
                  autoComplete={
                    field === "currentPassword"
                      ? "current-password"
                      : "new-password"
                  }
                  minLength={field === "currentPassword" ? 1 : 8}
                  maxLength={128}
                  required
                  readOnly={!!busy}
                  aria-invalid={
                    passwordNotice &&
                    "error" in passwordNotice &&
                    ["wrongPassword", "mismatch", "invalidPassword"].includes(
                      passwordNotice.error,
                    )
                      ? true
                      : undefined
                  }
                  aria-describedby={`profile-password-hint${passwordNotice ? " profile-password-notice" : ""}`}
                />
              </div>
            ),
          )}
          <p className="profile-hint" id="profile-password-hint">
            {t("profile.passwordHint")}
          </p>
          <p className="profile-hint">{t("profile.sessionPolicy")}</p>
          <button
            className="button button--secondary"
            type="submit"
            disabled={!!busy}
          >
            {t(
              busy === "password" ? "profile.saving" : "profile.changePassword",
            )}
          </button>
          {message(passwordNotice, "password")}
        </form>
      </section>
      <section
        className="profile-section"
        aria-labelledby="profile-preferences"
      >
        <div className="profile-section__intro">
          <h2 id="profile-preferences">{t("profile.preferences")}</h2>
          <p>{t("profile.preferencesDetail")}</p>
        </div>
        <div className="profile-form profile-preferences">
          <PreferencesControls />
        </div>
      </section>
      <section
        className="profile-section"
        aria-labelledby="profile-notifications"
      >
        <div className="profile-section__intro">
          <h2 id="profile-notifications">{t("profile.notifications")}</h2>
        </div>
        <p className="profile-hint">{t("profile.notificationsDetail")}</p>
      </section>
    </div>
  );
}
