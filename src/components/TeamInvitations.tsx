import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { auth } from "../auth/runtime.ts";
import { useI18n } from "../i18n/index.ts";
import {
  InvitationController,
  InvitationService,
} from "../services/invitations.ts";
import "./invitations.css";

export function TeamInvitations({
  eventId,
  archived,
}: {
  eventId: string;
  archived: boolean;
}) {
  const { t, formatDateTime } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button button--secondary team-invite-action"
        disabled={archived}
        onClick={() => setOpen(true)}
      >
        {t("invite.manage")}
      </button>
      {open && (
        <InvitationDialog
          key={eventId}
          eventId={eventId}
          onClose={() => setOpen(false)}
          formatDateTime={formatDateTime}
        />
      )}
    </>
  );
}
function InvitationDialog({
  eventId,
  onClose,
  formatDateTime,
}: {
  eventId: string;
  onClose: () => void;
  formatDateTime: (value: string) => string;
}) {
  const { t, language } = useI18n();
  const controller = useMemo(
    () =>
      new InvitationController(
        new InvitationService(fetch, () => language),
        eventId,
        auth.expireSession,
      ),
    [eventId, language],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef(document.activeElement);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [copy, setCopy] = useState<"copied" | "copyFailed" | null>(null);
  useEffect(() => {
    controller.activate();
    dialog.current?.showModal();
    void controller.load();
    const previous = trigger.current;
    return () => {
      controller.dispose();
      if (previous instanceof HTMLElement)
        previous.focus({ preventScroll: true });
    };
  }, [controller]);
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setCopy(null);
    await controller.create(email);
    if (!controller.getSnapshot().error) form.reset();
  }
  const link = state.link
    ? new URL(state.link.path, window.location.origin).href
    : null;
  return (
    <dialog
      ref={dialog}
      className="invitation-dialog"
      aria-labelledby="invitation-dialog-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        // Keep sequential focus inside the modal instead of entering browser
        // chrome, whose return focus triggers the workspace's existing refetch.
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), [tabindex='0']",
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
    >
      <h2 id="invitation-dialog-title">{t("invite.manage")}</h2>
      <form onSubmit={create} aria-busy={state.busy}>
        <div className="login-field">
          <label htmlFor="invited-email">{t("invite.email")}</label>
          <input
            id="invited-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            readOnly={state.busy}
            autoFocus
            aria-describedby={state.error ? "invitation-error" : undefined}
          />
        </div>
        <div className="invitation-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={state.busy || !state.loaded}
          >
            {t(state.busy ? "invite.creating" : "invite.create")}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
          >
            {t("invite.cancel")}
          </button>
        </div>
      </form>
      {state.error && (
        <p
          id="invitation-error"
          className="login-error"
          role="alert"
          tabIndex={-1}
          ref={errorRef}
        >
          {t(`invite.error.${state.error}`)}
        </p>
      )}
      {state.error && (
        <button
          type="button"
          className="button button--secondary"
          disabled={state.busy}
          onClick={() => void controller.load()}
        >
          {t("invite.retry")}
        </button>
      )}
      {link && (
        <section className="invitation-delivery" aria-label={t("invite.link")}>
          <p>{t("invite.development")}</p>
          <label htmlFor="development-invite-link">{t("invite.link")}</label>
          <input
            id="development-invite-link"
            value={link}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="button button--secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopy("copied");
              } catch {
                setCopy("copyFailed");
              }
            }}
          >
            {t("invite.copy")}
          </button>
          {copy && <p role="status">{t(`invite.${copy}`)}</p>}
        </section>
      )}
      {state.delivery === "sent" && (
        <p role="status">{t("safety.invitationSent")}</p>
      )}
      {state.delivery === "failed" && (
        <p role="alert">{t("safety.invitationFailed")}</p>
      )}
      <section
        className="invitation-pending"
        aria-labelledby="pending-invitation-title"
      >
        <h3 id="pending-invitation-title">{t("invite.pending")}</h3>
        {!state.loaded ? (
          <p role="status">{t("invite.loading")}</p>
        ) : state.invitations.length ? (
          <ul>
            {state.invitations.map((invite) => (
              <li key={invite.id}>
                <div>
                  <strong>{invite.email}</strong>
                  <small>
                    {invite.state === "expired"
                      ? t("invite.expired")
                      : t("invite.expires", {
                          date: formatDateTime(invite.expiresAt),
                        })}
                  </small>
                </div>
                {invite.state === "pending" && (
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={state.busy}
                    onClick={() => void controller.resend(invite.id)}
                    aria-label={`${t("safety.resendInvitation")} ${invite.email}`}
                  >
                    {t("safety.resendInvitation")}
                  </button>
                )}
                {invite.state === "pending" && (
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={state.busy}
                    onClick={() => void controller.revoke(invite.id)}
                    aria-label={`${t("invite.revoke")} ${invite.email}`}
                  >
                    {t("invite.revoke")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("invite.empty")}</p>
        )}
      </section>
    </dialog>
  );
}
