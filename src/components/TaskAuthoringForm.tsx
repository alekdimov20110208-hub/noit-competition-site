import { isTaskDeadlineTime } from "../domain/taskDeadlineTime.ts";
import { getCalendarDayNumber } from "../domain/taskTiming.ts";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BudoSelect } from "./BudoSelect.tsx";
import { TASK_PRIORITY_MESSAGE_KEYS } from "../domain/labels.ts";
import { useI18n, type MessageKey } from "../i18n/index.ts";
import {
  TaskAuthoringFailure,
  TaskActionFailure,
  type RemoteTask,
  type TaskAssignee,
} from "../services/RemoteWorkspaceService.ts";
import {
  authoredFields,
  validateTaskFields,
  type TaskFields,
  type TaskFieldErrors,
} from "../services/taskAuthoring.ts";
import "./taskAuthoring.css";
import { REMINDER_OFFSETS } from "../domain/taskReminders.ts";
import { reminderPresetKey } from "../i18n/notificationMessages.ts";

export interface TaskAuthoringFormProps {
  task?: RemoteTask;
  members: TaskAssignee[];
  blocked: boolean;
  onSave: (
    fields: TaskFields,
    assignedMemberId: string | null,
    expectedVersion: number | null,
    signal: AbortSignal,
  ) => Promise<RemoteTask>;
  onReload: (signal: AbortSignal) => Promise<RemoteTask>;
  onSuccess: (task: RemoteTask) => void;
  onCancel: () => void;
  onPending: (pending: boolean) => void;
}

export function TaskAuthoringForm({
  task,
  members,
  blocked,
  onSave,
  onReload,
  onSuccess,
  onCancel,
  onPending,
}: TaskAuthoringFormProps) {
  const { t } = useI18n();
  // An open draft keeps its original version even when focus refreshes the list.
  const [fields, setFields] = useState<TaskFields>(() =>
    task
      ? authoredFields(task)
      : {
          title: "",
          category: "",
          context: "",
          deadline: "",
          deadlineTime: null,
          reminderOffsets: [],
          priority: "normal",
        },
  );
  const [version, setVersion] = useState(task?.version ?? null);
  const [timeEnabled, setTimeEnabled] = useState(
    task?.deadlineTime !== null && task?.deadlineTime !== undefined,
  );
  const [assignee, setAssignee] = useState("");
  const [errors, setErrors] = useState<TaskFieldErrors>({});
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const cancellation = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      form.current
        ?.querySelector<HTMLInputElement>("#task-author-title")
        ?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      cancellation.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (message && !pending) notice.current?.focus();
  }, [message, pending]);
  function change<K extends keyof TaskFields>(key: K, value: TaskFields[K]) {
    setFields((current) => ({
      ...current,
      [key]: value,
      ...(key === "deadlineTime" && value === null
        ? { reminderOffsets: [] }
        : {}),
    }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  async function reload(signal: AbortSignal) {
    const latest = await onReload(signal);
    signal.throwIfAborted();
    setFields(authoredFields(latest));
    setTimeEnabled(latest.deadlineTime !== null);
    setVersion(latest.version);
    setErrors({});
    setNeedsReload(false);
    setMessage("tasks.authoring.conflict");
  }
  async function run(reloading: boolean) {
    if (cancellation.current || (!reloading && (needsReload || blocked)))
      return;
    const request = new AbortController();
    cancellation.current = request;
    setPending(true);
    onPending(true);
    try {
      if (reloading) await reload(request.signal);
      else {
        const canonical = await onSave(
          {
            ...fields,
            title: fields.title.trim(),
            category: fields.category.trim(),
            context: fields.context.trim(),
          },
          assignee || null,
          version,
          request.signal,
        );
        if (!request.signal.aborted) onSuccess(canonical);
      }
    } catch (error) {
      if (request.signal.aborted) return;
      if (
        error instanceof TaskActionFailure &&
        error.code === "conflict" &&
        task
      ) {
        setNeedsReload(true);
        try {
          await reload(request.signal);
        } catch {
          if (!request.signal.aborted)
            setMessage("tasks.authoring.conflictRefresh");
        }
      } else {
        const code =
          error instanceof TaskActionFailure ? error.code : "unavailable";
        setMessage(
          reloading
            ? "tasks.authoring.conflictRefresh"
            : code === "invalid"
              ? "tasks.authoring.invalid"
              : code === "unavailable"
                ? "tasks.authoring.unavailable"
                : `tasks.actions.${code}`,
        );
        if (error instanceof TaskAuthoringFailure) setErrors(error.fields);
      }
    } finally {
      if (!request.signal.aborted) {
        cancellation.current = null;
        setPending(false);
        onPending(false);
      }
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateTaskFields(fields);
    if (!task && assignee && !members.some((member) => member.id === assignee))
      validation.assignedMemberId = "INVALID_ASSIGNEE";
    setErrors(validation);
    setMessage(null);
    const first = Object.keys(validation)[0];
    if (first) {
      form.current
        ?.querySelector<HTMLElement>(
          `#task-author-${first}${first === "priority" || first === "assignedMemberId" ? "-trigger" : ""}`,
        )
        ?.focus();
      return;
    }
    void run(false);
  }
  const errorKey = (field: keyof TaskFieldErrors): MessageKey =>
    field === "reminderOffsets"
      ? "reminders.error"
      : field === "deadlineTime"
        ? "tasks.authoring.timeError"
        : field === "deadline"
          ? "tasks.authoring.dateError"
          : field === "assignedMemberId"
            ? "tasks.authoring.assigneeError"
            : field === "priority"
              ? "tasks.authoring.priorityError"
              : "tasks.authoring.textError";
  return (
    <form
      ref={form}
      className="task-authoring-form"
      noValidate
      onSubmit={submit}
      aria-busy={pending}
    >
      <h2 id="task-drawer-title">
        {t(task ? "tasks.authoring.edit" : "tasks.authoring.create")}
      </h2>
      {message && (
        <div ref={notice} className="notice" tabIndex={-1} role="alert">
          <span>{t(message)}</span>
          {needsReload && (
            <button
              className="button button--quiet"
              type="button"
              disabled={pending}
              onClick={() => void run(true)}
            >
              {t("tasks.authoring.reload")}
            </button>
          )}
        </div>
      )}
      <fieldset disabled={pending}>
        {(["title", "category", "context", "deadline"] as const).map(
          (field) => (
            <div className="task-authoring-field" key={field}>
              <label htmlFor={`task-author-${field}`}>
                {t(`tasks.authoring.${field}`)}
              </label>
              {field === "context" ? (
                <textarea
                  id={`task-author-${field}`}
                  value={fields[field]}
                  maxLength={5000}
                  rows={4}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={
                    errors[field] ? `task-author-${field}-error` : undefined
                  }
                  onChange={(event) => change(field, event.target.value)}
                />
              ) : (
                <input
                  id={`task-author-${field}`}
                  type={field === "deadline" ? "date" : "text"}
                  value={fields[field]}
                  required={field === "title" || field === "deadline"}
                  maxLength={
                    field === "title"
                      ? 200
                      : field === "category"
                        ? 100
                        : undefined
                  }
                  min={field === "deadline" ? "0001-01-01" : undefined}
                  max={field === "deadline" ? "9999-12-31" : undefined}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={
                    errors[field]
                      ? `task-author-${field}-error`
                      : field === "deadline"
                        ? "task-author-date-help"
                        : undefined
                  }
                  onChange={(event) => change(field, event.target.value)}
                />
              )}
              {errors[field] && (
                <span
                  className="task-authoring-error"
                  id={`task-author-${field}-error`}
                >
                  {t(errorKey(field))}
                </span>
              )}
              {field === "deadline" && (
                <>
                  <small id="task-author-date-help">
                    {t("tasks.authoring.dateHelp")}
                  </small>
                  <button
                    className="text-button task-authoring-time-toggle"
                    type="button"
                    aria-expanded={timeEnabled}
                    aria-controls="task-author-time-control"
                    onClick={() => {
                      change("deadlineTime", null);
                      setTimeEnabled(!timeEnabled);
                      if (!timeEnabled)
                        requestAnimationFrame(() =>
                          form.current
                            ?.querySelector<HTMLInputElement>(
                              "#task-author-deadlineTime",
                            )
                            ?.focus(),
                        );
                    }}
                  >
                    {t(
                      timeEnabled
                        ? "tasks.authoring.removeTime"
                        : "tasks.authoring.addTime",
                    )}
                  </button>
                  {timeEnabled && (
                    <div
                      className="task-authoring-time"
                      id="task-author-time-control"
                    >
                      <label htmlFor="task-author-deadlineTime">
                        {t("tasks.authoring.time")}
                      </label>
                      <input
                        id="task-author-deadlineTime"
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        placeholder="HH:mm"
                        value={fields.deadlineTime ?? ""}
                        aria-invalid={Boolean(errors.deadlineTime)}
                        aria-describedby={`task-author-time-help${errors.deadlineTime ? " task-author-deadlineTime-error" : ""}`}
                        onChange={(event) =>
                          change("deadlineTime", event.target.value || null)
                        }
                      />
                      <small id="task-author-time-help">
                        {t("tasks.authoring.timeHelp")}
                      </small>
                      {errors.deadlineTime && (
                        <span
                          className="task-authoring-error"
                          id="task-author-deadlineTime-error"
                        >
                          {t(errorKey("deadlineTime"))}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ),
        )}
        <BudoSelect
          id="task-author-priority"
          className="task-authoring-field"
          label={t("tasks.authoring.priority")}
          value={fields.priority}
          invalid={Boolean(errors.priority)}
          describedBy={
            errors.priority ? "task-author-priority-error" : undefined
          }
          options={(["normal", "important", "critical"] as const).map(
            (value) => ({ value, label: t(TASK_PRIORITY_MESSAGE_KEYS[value]) }),
          )}
          disabled={pending}
          onChange={(value) => change("priority", value)}
        />
        {errors.priority && (
          <p
            id="task-author-priority-error"
            className="task-authoring-error"
            role="alert"
          >
            {t(errorKey("priority"))}
          </p>
        )}
        {!task && (
          <>
            <BudoSelect
              id="task-author-assignedMemberId"
              className="task-authoring-field"
              label={t("tasks.authoring.assignee")}
              value={assignee}
              invalid={Boolean(errors.assignedMemberId)}
              describedBy={
                errors.assignedMemberId
                  ? "task-author-assignedMemberId-error"
                  : undefined
              }
              options={[
                { value: "", label: t("common.unassigned") },
                ...members.map((member) => ({
                  value: member.id,
                  label: member.name + (member.role ? ` · ${member.role}` : ""),
                })),
              ]}
              disabled={pending}
              onChange={(value) => {
                setAssignee(value);
                setErrors((current) => ({
                  ...current,
                  assignedMemberId: undefined,
                }));
              }}
            />
            {errors.assignedMemberId && (
              <p
                id="task-author-assignedMemberId-error"
                className="task-authoring-error"
                role="alert"
              >
                {t(errorKey("assignedMemberId"))}
              </p>
            )}
            <p className="task-authoring-help">{t("tasks.authoring.help")}</p>
          </>
        )}
        <fieldset
          className="task-reminders"
          disabled={
            pending ||
            !isTaskDeadlineTime(fields.deadlineTime) ||
            getCalendarDayNumber(fields.deadline) === null
          }
          aria-describedby="task-reminder-help"
        >
          <legend>{t("reminders.title")}</legend>
          {REMINDER_OFFSETS.map((offset) => (
            <label key={offset}>
              <input
                type="checkbox"
                id={`task-reminder-${offset}`}
                checked={fields.reminderOffsets?.includes(offset) ?? false}
                onChange={(event) =>
                  change(
                    "reminderOffsets",
                    event.target.checked
                      ? [...(fields.reminderOffsets ?? []), offset].sort(
                          (a, b) => b - a,
                        )
                      : (fields.reminderOffsets ?? []).filter(
                          (value) => value !== offset,
                        ),
                  )
                }
              />
              <span>{t(reminderPresetKey(offset))}</span>
            </label>
          ))}
        </fieldset>
        <small id="task-reminder-help">
          {t(
            fields.deadlineTime
              ? "reminders.removeTime"
              : "reminders.requiresTime",
          )}
        </small>
        {errors.reminderOffsets && (
          <p
            id="task-author-reminderOffsets"
            tabIndex={-1}
            role="alert"
            className="task-authoring-error"
          >
            {t("reminders.error")}
          </p>
        )}
      </fieldset>
      <div className="task-authoring-actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={pending || blocked || needsReload}
        >
          {t(
            pending
              ? "tasks.authoring.pending"
              : task
                ? "tasks.authoring.save"
                : "tasks.authoring.create",
          )}
        </button>
        <button
          type="button"
          className="button button--quiet"
          disabled={pending}
          onClick={onCancel}
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
