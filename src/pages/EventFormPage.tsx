import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader.tsx";
import { revealFocusTarget } from "../navigationFocus.ts";
import { useI18n, type MessageKey } from "../i18n/index.ts";
import {
  EventActionFailure,
  type TaskEvent,
  type EventFields,
} from "../services/RemoteWorkspaceService.ts";
import {
  browserEventTimezone,
  eventTimezoneOptions,
  validateEventForm,
  type EventFormErrors,
} from "./events/helpers.ts";
import "./events/events.css";

const ERROR_KEYS = {
  name: "events.validation.name",
  date: "events.validation.date",
  dateOrder: "events.validation.dateOrder",
  timezone: "events.validation.timezone",
} as const satisfies Record<string, MessageKey>;
const ACTION_ERROR_KEYS = {
  invalid: "events.error.invalid",
  unauthenticated: "events.error.unauthenticated",
  forbidden: "events.error.forbidden",
  "not-found": "events.error.not-found",
  unavailable: "events.error.unavailable",
  conflict: "events.error.conflict",
} as const satisfies Record<string, MessageKey>;

function eventFields(event: TaskEvent): EventFields {
  return {
    name: event.name,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
  };
}

interface EventFormPageProps {
  event?: TaskEvent;
  onSave: (
    fields: EventFields,
    expectedVersion: number | null,
    signal: AbortSignal,
  ) => Promise<TaskEvent>;
  onReload: (signal: AbortSignal) => Promise<TaskEvent>;
  onSuccess: (event: TaskEvent) => void;
  onCancel: () => void;
  onManage: () => void;
}

export function EventFormPage({
  event,
  onSave,
  onReload,
  onSuccess,
  onCancel,
  onManage,
}: EventFormPageProps) {
  const { t } = useI18n();
  // Refetches must never silently rebase an open draft or its expected version.
  const [fields, setFields] = useState<EventFields>(() =>
    event
      ? eventFields(event)
      : {
          name: "",
          startDate: "",
          endDate: "",
          timezone: browserEventTimezone(),
        },
  );
  const [expectedVersion, setExpectedVersion] = useState<number | null>(
    event?.version ?? null,
  );
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const cancellation = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const messageElement = useRef<HTMLDivElement>(null);
  const focusReveal = useRef<number | null>(null);
  const timezoneOptions = useMemo(
    () => eventTimezoneOptions(fields.timezone),
    [fields.timezone],
  );
  useEffect(
    () => () => {
      cancellation.current?.abort();
      if (focusReveal.current !== null)
        window.cancelAnimationFrame(focusReveal.current);
    },
    [],
  );
  useEffect(() => {
    if (!message || pending) return;
    const frame = window.requestAnimationFrame(() =>
      messageElement.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [message, pending]);
  async function reload(signal: AbortSignal) {
    const canonical = await onReload(signal);
    if (signal.aborted) return;
    setFields(eventFields(canonical));
    setExpectedVersion(canonical.version);
    setErrors({});
    setNeedsReload(false);
    setMessage("events.error.conflict");
  }
  async function retryReload() {
    if (cancellation.current) return;
    const request = new AbortController();
    cancellation.current = request;
    setPending(true);
    try {
      await reload(request.signal);
    } catch {
      if (!request.signal.aborted) setMessage("events.error.conflictRefresh");
    } finally {
      if (!request.signal.aborted) {
        setPending(false);
        cancellation.current = null;
      }
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (cancellation.current || needsReload) return;
    const validation = validateEventForm(fields);
    setErrors(validation);
    setMessage(null);
    const firstInvalid = Object.keys(validation)[0];
    if (firstInvalid) {
      form.current
        ?.querySelector<HTMLInputElement>(`#event-${firstInvalid}`)
        ?.focus();
      return;
    }
    const request = new AbortController();
    cancellation.current = request;
    setPending(true);
    try {
      const canonical = await onSave(
        { ...fields, name: fields.name.trim() },
        expectedVersion,
        request.signal,
      );
      if (!request.signal.aborted) onSuccess(canonical);
    } catch (error) {
      if (request.signal.aborted) return;
      if (error instanceof EventActionFailure && error.code === "conflict") {
        setNeedsReload(true);
        try {
          await reload(request.signal);
        } catch {
          if (!request.signal.aborted)
            setMessage("events.error.conflictRefresh");
        }
      } else {
        const code =
          error instanceof EventActionFailure ? error.code : "unavailable";
        setMessage(ACTION_ERROR_KEYS[code]);
        if (error instanceof EventActionFailure && error.fields) {
          const serverErrors: EventFormErrors = {};
          for (const field of [
            "name",
            "startDate",
            "endDate",
            "timezone",
          ] as const) {
            if (error.fields[field])
              serverErrors[field] =
                error.fields[field] === "END_BEFORE_START"
                  ? "dateOrder"
                  : field === "name"
                    ? "name"
                    : field === "timezone"
                      ? "timezone"
                      : "date";
          }
          setErrors(serverErrors);
        }
      }
    } finally {
      if (!request.signal.aborted) {
        setPending(false);
        cancellation.current = null;
      }
    }
  }
  function change(field: keyof EventFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }
  function input(field: "name" | "startDate" | "endDate") {
    const error = errors[field];
    return (
      <div className="event-field">
        <label htmlFor={`event-${field}`}>{t(`events.${field}`)}</label>
        <input
          id={`event-${field}`}
          name={field}
          type={field === "name" ? "text" : "date"}
          value={fields[field]}
          required
          maxLength={field === "name" ? 200 : undefined}
          min={field === "name" ? undefined : "0001-01-01"}
          max={field === "name" ? undefined : "9999-12-31"}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? `event-${field}-error${field !== "name" ? " event-dates-help" : ""}`
              : field === "name"
                ? "event-name-help"
                : "event-dates-help"
          }
          onChange={(e) => change(field, e.target.value)}
        />
        {field === "name" && (
          <span className="event-field__help" id="event-name-help">
            {t("events.name.help")}
          </span>
        )}
        {error && (
          <span className="event-field__error" id={`event-${field}-error`}>
            {t(ERROR_KEYS[error])}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="page page--event-authoring">
      <PageHeader
        title={t(event ? "events.edit" : "events.create")}
        description={t(
          event ? "events.edit.description" : "events.create.description",
        )}
        actions={
          <button
            type="button"
            className="button button--secondary"
            onClick={onManage}
            disabled={pending}
          >
            {t("events.backToManagement")}
          </button>
        }
      />
      <form
        ref={form}
        className="event-form"
        onSubmit={(e) => void submit(e)}
        onFocusCapture={(e) => {
          const target = e.target;
          if (!(target instanceof HTMLElement)) return;
          if (focusReveal.current !== null)
            window.cancelAnimationFrame(focusReveal.current);
          focusReveal.current = window.requestAnimationFrame(() => {
            focusReveal.current = null;
            if (document.activeElement === target) revealFocusTarget(target);
          });
        }}
        noValidate
        aria-busy={pending}
      >
        {message && (
          <div
            ref={messageElement}
            className="notice"
            role="alert"
            tabIndex={-1}
          >
            <span>{t(message)}</span>
            {needsReload && (
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void retryReload()}
                disabled={pending}
              >
                {t("events.reload")}
              </button>
            )}
          </div>
        )}
        <fieldset disabled={pending || needsReload}>
          <legend className="event-form__legend">{t("events.details")}</legend>
          <p className="event-form__context">{t("events.required")}</p>
          {input("name")}
          <h2 className="event-form__section">{t("events.schedule")}</h2>
          <p className="event-field__help" id="event-dates-help">
            {t("events.dates.help")}
          </p>
          <div className="event-form__dates">
            {input("startDate")}
            {input("endDate")}
          </div>
          <div className="event-field">
            <label htmlFor="event-timezone">{t("events.timezone")}</label>
            <input
              id="event-timezone"
              name="timezone"
              list="event-timezones"
              value={fields.timezone}
              required
              autoComplete="off"
              aria-invalid={Boolean(errors.timezone)}
              aria-describedby={`event-timezone-help${errors.timezone ? " event-timezone-error" : ""}`}
              onChange={(e) => change("timezone", e.target.value)}
            />
            <datalist id="event-timezones">
              {timezoneOptions.map((zone) => (
                <option
                  key={zone}
                  value={zone}
                  label={zone.replaceAll("_", " ").replaceAll("/", " / ")}
                />
              ))}
            </datalist>
            <span className="event-field__help" id="event-timezone-help">
              {t("events.timezone.help")}
            </span>
            {errors.timezone && (
              <span className="event-field__error" id="event-timezone-error">
                {t("events.validation.timezone")}
              </span>
            )}
          </div>
        </fieldset>
        {!event && <p className="event-form__context">{t("events.fresh")}</p>}
        <div className="event-form__actions">
          <button
            className="button button--primary"
            type="submit"
            disabled={pending || needsReload}
          >
            {t(
              pending
                ? "events.pending"
                : event
                  ? "events.save"
                  : "events.create",
            )}
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={onCancel}
            disabled={pending}
          >
            {t("common.cancel")}
          </button>
        </div>
        <span className="sr-only" role="status">
          {pending ? t("events.pending") : ""}
        </span>
      </form>
    </div>
  );
}
