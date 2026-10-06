import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AppLink } from "../components/AppLink.tsx";
import { BudoSelect } from "../components/BudoSelect.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { TASK_STATUS_MESSAGE_KEYS } from "../domain/labels.ts";
import { useI18n, type MessageKey } from "../i18n/index.ts";
import { getChangeCoordinationState } from "../domain/changeCoordination.ts";
import { auth } from "../auth/runtime.ts";
import { changeHref, createTaskHref, eventHref } from "../routes.ts";
import {
  ChangeService,
  ChangeFailure,
  authoredChange,
  validateChangeFields,
  type RemoteChange,
  type ChangeFields,
  type ChangeFieldErrors,
  type ChangeError,
} from "../services/changes.ts";
import type {
  TaskEvent,
  TasksWorkspace,
} from "../services/RemoteWorkspaceService.ts";
import { getTaskStatusTone } from "../utils/statusTone.ts";
import "./changes/changes.css";

const service = new ChangeService();
const fieldMessages = {
  title: "change.validation.title",
  context: "change.validation.context",
  responseOwnerMemberId: "change.validation.owner",
  affectedTaskIds: "change.validation.tasks",
  expectedVersion: "change.error.invalid",
  decision: "change.validation.decision",
  response: "change.validation.response",
  planB: "change.validation.planB",
} as const satisfies Record<keyof ChangeFieldErrors, MessageKey>;

function ChangeForm({
  event,
  change,
  workspace,
  onSuccess,
  onCancel,
}: {
  event: TaskEvent;
  change?: RemoteChange;
  workspace: TasksWorkspace;
  onSuccess: (change: RemoteChange) => void;
  onCancel: () => void;
}) {
  const { t, formatDate } = useI18n();
  const [fields, setFields] = useState<ChangeFields>(() =>
    change
      ? authoredChange(change)
      : {
          title: "",
          context: "",
          responseOwnerMemberId: null,
          affectedTaskIds: [],
          decision: null,
          response: null,
          planB: null,
        },
  );
  // A draft's version stays fixed until an explicit reload after a conflict.
  const [version, setVersion] = useState(change?.version ?? null);
  const [errors, setErrors] = useState<ChangeFieldErrors>({});
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const request = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null),
    notice = useRef<HTMLDivElement>(null);
  const members = workspace.activeMembers ?? [];
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      form.current?.querySelector<HTMLInputElement>("#change-title")?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (message && !pending) notice.current?.focus();
  }, [message, pending]);
  const set = <K extends keyof ChangeFields>(
    key: K,
    value: ChangeFields[K],
  ) => {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  async function run(reload = false) {
    if (request.current || (!reload && needsReload)) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    try {
      if (reload && change) {
        const current = await service.get(
          event.id,
          change.id,
          controller.signal,
        );
        controller.signal.throwIfAborted();
        setFields(authoredChange(current));
        setVersion(current.version);
        setErrors({});
        setNeedsReload(false);
        setMessage("change.reloaded");
      } else {
        const saved = await service.save(
          event.id,
          fields,
          controller.signal,
          change && version !== null
            ? { id: change.id, expectedVersion: version }
            : undefined,
        );
        controller.signal.throwIfAborted();
        onSuccess(saved);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = error instanceof ChangeFailure ? error.code : "unavailable";
      if (code === "unauthenticated") auth.expireSession();
      setMessage(
        code === "unavailable"
          ? "change.save.unavailable"
          : `change.error.${code}`,
      );
      if (code === "conflict") setNeedsReload(true);
      if (error instanceof ChangeFailure) setErrors(error.fields);
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPending(false);
      }
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const validation = validateChangeFields(fields);
    if (
      fields.responseOwnerMemberId &&
      !members.some((person) => person.id === fields.responseOwnerMemberId)
    )
      validation.responseOwnerMemberId = "INVALID_OWNER";
    if (
      fields.affectedTaskIds.some(
        (id) => !workspace.tasks.some((task) => task.id === id),
      )
    )
      validation.affectedTaskIds = "INVALID_TASKS";
    setErrors(validation);
    setMessage(null);
    const first = Object.keys(validation)[0];
    if (first) {
      form.current
        ?.querySelector<HTMLElement>(
          first === "responseOwnerMemberId"
            ? "#change-owner-trigger"
            : first === "affectedTaskIds"
              ? ".change-selection input"
              : `#change-${first}`,
        )
        ?.focus();
      return;
    }
    void run();
  }
  const error = (key: keyof ChangeFieldErrors) =>
    errors[key] ? (
      <span className="change-field-error" id={`change-error-${key}`}>
        {t(fieldMessages[key])}
      </span>
    ) : null;
  return (
    <form
      className="change-form"
      ref={form}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented && !pending) {
          e.preventDefault();
          onCancel();
        }
      }}
      noValidate
      aria-busy={pending}
    >
      <h2>{t(change ? "change.edit" : "change.record")}</h2>
      {message && (
        <div className="notice" role="alert" tabIndex={-1} ref={notice}>
          <span>{t(message)}</span>
          {needsReload && (
            <button
              className="button button--secondary"
              type="button"
              disabled={pending}
              onClick={() => void run(true)}
            >
              {t("change.reload")}
            </button>
          )}
        </div>
      )}
      <fieldset disabled={pending}>
        <div className="change-field">
          <label htmlFor="change-title">{t("change.title.label")}</label>
          <input
            id="change-title"
            value={fields.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={200}
            required
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "change-error-title" : undefined}
          />
          {error("title")}
        </div>
        <div className="change-field">
          <label htmlFor="change-context">{t("change.context")}</label>
          <textarea
            id="change-context"
            rows={4}
            value={fields.context}
            onChange={(e) => set("context", e.target.value)}
            maxLength={5000}
            aria-invalid={Boolean(errors.context)}
            aria-describedby={
              errors.context ? "change-error-context" : undefined
            }
          />
          {error("context")}
        </div>
        <div className="change-field">
          <BudoSelect
            id="change-owner"
            label={t("change.owner")}
            value={fields.responseOwnerMemberId ?? ""}
            onChange={(value) => set("responseOwnerMemberId", value || null)}
            disabled={pending}
            invalid={Boolean(errors.responseOwnerMemberId)}
            describedBy={`change-owner-help${errors.responseOwnerMemberId ? " change-error-responseOwnerMemberId" : ""}`}
            options={[
              { value: "", label: t("change.noOwner") },
              ...members.map((person) => ({
                value: person.id,
                label: person.name,
              })),
              ...(fields.responseOwnerMemberId &&
              !members.some(
                (person) => person.id === fields.responseOwnerMemberId,
              )
                ? [
                    {
                      value: fields.responseOwnerMemberId,
                      label: t("change.owner.unavailable"),
                    },
                  ]
                : []),
            ]}
          />
          <small id="change-owner-help">{t("change.owner.help")}</small>
          {error("responseOwnerMemberId")}
        </div>
        <fieldset
          className="change-selection"
          aria-describedby={`change-selection-help${errors.affectedTaskIds ? " change-error-affectedTaskIds" : ""}`}
          aria-invalid={Boolean(errors.affectedTaskIds)}
        >
          <legend>{t("change.tasks")}</legend>
          <p id="change-selection-help">{t("change.select.help")}</p>
          {!workspace.tasks.length && <p>{t("change.select.empty")}</p>}
          {workspace.tasks.map((task) => (
            <label className="change-choice" key={task.id}>
              <input
                type="checkbox"
                value={task.id}
                checked={fields.affectedTaskIds.includes(task.id)}
                onChange={(e) =>
                  set(
                    "affectedTaskIds",
                    e.target.checked
                      ? [...fields.affectedTaskIds, task.id].sort()
                      : fields.affectedTaskIds.filter((id) => id !== task.id),
                  )
                }
              />
              <span>
                <strong>{task.title}</strong>
                <span className="change-choice__context">
                  {workspace.teamMembers.find(
                    (person) => person.id === task.assignedMemberId,
                  )?.name ?? t("common.unassigned")}
                  <span aria-hidden="true"> · </span>
                  {formatDate(task.deadline)}
                  <span aria-hidden="true"> · </span>
                  {t(TASK_STATUS_MESSAGE_KEYS[task.status])}
                </span>
              </span>
            </label>
          ))}
          {error("affectedTaskIds")}
        </fieldset>
        <fieldset className="change-coordination-form">
          <legend>{t("change.coordination")}</legend>
          <p className="change-help">{t("change.coordination.help")}</p>
          {(["decision", "response", "planB"] as const).map((key) => (
            <div className="change-field" key={key}>
              <label htmlFor={`change-${key}`}>{t(`change.${key}`)}</label>
              <small id={`change-${key}-help`}>{t(`change.${key}.help`)}</small>
              <textarea
                id={`change-${key}`}
                rows={key === "decision" ? 3 : 4}
                value={fields[key] ?? ""}
                onChange={(e) =>
                  set(key, e.target.value === "" ? null : e.target.value)
                }
                maxLength={key === "decision" ? 2000 : 5000}
                aria-invalid={Boolean(errors[key])}
                aria-describedby={`change-${key}-help${errors[key] ? ` change-error-${key}` : ""}`}
              />
              {error(key)}
            </div>
          ))}
        </fieldset>
      </fieldset>
      <div className="change-actions">
        <button
          className="button button--primary"
          type="submit"
          disabled={pending || needsReload}
        >
          {t(pending ? "change.saving" : "change.save")}
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={pending}
          onClick={onCancel}
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function ChangesPage({
  event,
  changeId,
  workspace,
  onNavigate,
}: {
  event: TaskEvent;
  changeId?: string | null;
  workspace: TasksWorkspace;
  onNavigate: (href: string) => void;
}) {
  const { t, formatDate, formatDateTime, formatNumber } = useI18n(
    event.timezone,
  );
  const [data, setData] = useState<RemoteChange[] | null>(null);
  const [failure, setFailure] = useState<ChangeError | null>(null);
  const [editing, setEditing] = useState(false);
  const request = useRef<AbortController | null>(null);
  const action = useRef<HTMLButtonElement>(null);
  const authoring =
    event.membership.accessRole === "ORGANIZER" && !event.archived;
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFailure(null);
    setData(null);
    try {
      const values = changeId
        ? [await service.get(event.id, changeId, controller.signal)]
        : await service.list(event.id, controller.signal);
      if (!controller.signal.aborted) setData(values);
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = error instanceof ChangeFailure ? error.code : "unavailable";
      if (code === "unauthenticated") auth.expireSession();
      setFailure(code);
    }
  }, [event.id, changeId]);
  useEffect(() => {
    void load();
    return () => {
      request.current?.abort();
    };
  }, [load]);
  // Focus/online refetch are on-demand; no polling, timers or background jobs.
  useEffect(() => {
    const refresh = () => {
      if (!editing && document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [editing, load]);
  const selected = changeId ? data?.[0] : undefined;
  function closeForm() {
    setEditing(false);
    requestAnimationFrame(() => action.current?.focus());
  }
  function saved(change: RemoteChange) {
    setEditing(false);
    if (!changeId) onNavigate(changeHref(event.id, change.id));
    else {
      setData([change]);
      requestAnimationFrame(() => action.current?.focus());
    }
  }
  return (
    <div className="page page--changes" aria-busy={!data && !failure}>
      {changeId && (
        <AppLink
          className="change-back"
          href={eventHref(event.id, "/changes")}
          onNavigate={onNavigate}
        >
          {t("change.back")}
        </AppLink>
      )}
      <PageHeader
        title={selected?.title ?? t("change.title")}
        description={t("change.description")}
        actions={
          data && (
            <>
              {!editing && (
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => void load()}
                >
                  {t("change.refresh")}
                </button>
              )}
              {authoring && !editing && (
                <button
                  className="button button--primary"
                  type="button"
                  ref={action}
                  onClick={() => setEditing(true)}
                >
                  {t(changeId ? "change.edit" : "change.record")}
                </button>
              )}
            </>
          )
        }
      />
      {failure ? (
        <div className="notice" role="alert">
          <span>{t(`change.error.${failure}`)}</span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void load()}
          >
            {t("tasks.remote.retry")}
          </button>
        </div>
      ) : !data ? (
        <p role="status">{t("change.loading")}</p>
      ) : editing && authoring ? (
        <ChangeForm
          event={event}
          workspace={workspace}
          change={selected}
          onSuccess={saved}
          onCancel={closeForm}
        />
      ) : selected ? (
        <article className="change-detail">
          <section className="change-narrative" aria-labelledby="change-what">
            <div>
              <h2 id="change-what">{t("change.what")}</h2>
              <p className="change-context">
                {selected.context || t("change.context.empty")}
              </p>
              <dl className="change-metadata">
                <div>
                  <dt>{t("change.reporter")}</dt>
                  <dd>{selected.reporter.name}</dd>
                </div>
                <div>
                  <dt>{t("change.created")}</dt>
                  <dd>
                    <time dateTime={selected.createdAt}>
                      {formatDateTime(selected.createdAt)}
                    </time>
                  </dd>
                </div>
                {selected.updatedAt !== selected.createdAt && (
                  <div>
                    <dt>{t("change.updated")}</dt>
                    <dd>
                      <time dateTime={selected.updatedAt}>
                        {formatDateTime(selected.updatedAt)}
                      </time>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </section>
          <section
            className="change-impact"
            aria-labelledby="change-impact-title"
          >
            <h2 id="change-impact-title">{t("change.impact")}</h2>
            <p className="change-help">{t("change.impact.help")}</p>
            <dl className="change-impact-summary">
              <div>
                <dt>{t("change.tasks")}</dt>
                <dd className="change-impact-count">
                  {formatNumber(selected.impact.taskCount)}
                </dd>
              </div>
              <div>
                <dt>{t("change.people")}</dt>
                <dd>
                  {selected.impact.people.length ? (
                    <ul>
                      {selected.impact.people.map((person) => (
                        <li key={person.id}>{person.name}</li>
                      ))}
                    </ul>
                  ) : (
                    t("change.people.empty")
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("change.deadlines")}</dt>
                <dd>
                  {selected.impact.deadlines.length ? (
                    <ul>
                      {selected.impact.deadlines.map((deadline) => (
                        <li key={deadline}>
                          <time dateTime={deadline}>
                            {formatDate(deadline)}
                          </time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    t("change.deadlines.empty")
                  )}
                </dd>
              </div>
            </dl>
            <h3>{t("change.tasks")}</h3>
            {!selected.affectedTasks.length ? (
              <p>{t("change.tasks.empty")}</p>
            ) : (
              <ul className="change-impact-tasks">
                {selected.affectedTasks.map((task) => (
                  <li className="change-impact-task" key={task.id}>
                    <AppLink
                      className="change-task-title"
                      href={createTaskHref(task.id, event.id)}
                      onNavigate={onNavigate}
                    >
                      {task.title}
                    </AppLink>
                    <dl>
                      <div>
                        <dt>{t("change.responsible")}</dt>
                        <dd>
                          {task.assignedMember?.name ?? t("common.unassigned")}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("change.deadline")}</dt>
                        <dd>
                          {task.deadline ? (
                            <time dateTime={task.deadline}>
                              {formatDate(task.deadline)}
                            </time>
                          ) : (
                            t("change.noDeadline")
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("change.status")}</dt>
                        <dd>
                          <StatusBadge
                            tone={getTaskStatusTone(task.status)}
                            label={t(TASK_STATUS_MESSAGE_KEYS[task.status])}
                          />
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section
            className="change-coordination"
            aria-labelledby="change-coordination-title"
          >
            <h2 id="change-coordination-title">{t("change.coordination")}</h2>
            <section
              className="change-response"
              aria-labelledby="change-owner-title"
              aria-describedby="change-owner-description"
            >
              <h3 id="change-owner-title">{t("change.owner")}</h3>
              <p className="change-response__name">
                {selected.responseOwner?.name ?? t("change.noOwner")}
              </p>
              <p id="change-owner-description">{t("change.owner.help")}</p>
            </section>
            <p className="change-help">{t("change.coordination.help")}</p>
            <div className="change-primary-response">
              <section
                aria-labelledby="change-decision-title"
                aria-describedby="change-decision-description"
              >
                <h3 id="change-decision-title">{t("change.decision")}</h3>
                <p className="change-help" id="change-decision-description">
                  {t("change.decision.description")}
                </p>
                <p
                  className={
                    selected.decision ? "change-authored-text" : "change-help"
                  }
                >
                  {selected.decision?.text ?? t("change.decision.empty")}
                </p>
                {selected.decision && (
                  <dl className="change-metadata">
                    <div>
                      <dt>{t("change.decision.author")}</dt>
                      <dd>{selected.decision.authoredBy.name}</dd>
                    </div>
                    <div>
                      <dt>{t("change.updated")}</dt>
                      <dd>
                        <time dateTime={selected.decision.updatedAt}>
                          {formatDateTime(selected.decision.updatedAt)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                )}
              </section>
              <section
                aria-labelledby="change-response-title"
                aria-describedby="change-response-description"
              >
                <h3 id="change-response-title">{t("change.response")}</h3>
                <p className="change-help" id="change-response-description">
                  {t("change.response.description")}
                </p>
                <p
                  className={
                    selected.response ? "change-authored-text" : "change-help"
                  }
                >
                  {selected.response ?? t("change.response.empty")}
                </p>
              </section>
            </div>
            <section
              className="change-fallback"
              aria-labelledby="change-planB-title"
              aria-describedby="change-planB-description"
            >
              <h3 id="change-planB-title">{t("change.planB")}</h3>
              <p className="change-help" id="change-planB-description">
                {t("change.planB.description")}
              </p>
              <p
                className={
                  selected.planB ? "change-authored-text" : "change-help"
                }
              >
                {selected.planB ?? t("change.planB.empty")}
              </p>
            </section>
          </section>
          {!authoring && <p className="change-help">{t("change.readOnly")}</p>}
        </article>
      ) : !data.length ? (
        <EmptyState
          title={t("change.empty")}
          description={t(
            authoring ? "change.empty.organizer" : "change.empty.member",
          )}
        />
      ) : (
        <ol className="change-register">
          {data.map((change) => (
            <li key={change.id}>
              <div className="change-register__main">
                <AppLink
                  className="change-register__title"
                  href={changeHref(event.id, change.id)}
                  onNavigate={onNavigate}
                >
                  {change.title}
                </AppLink>
                {change.context && <p>{change.context}</p>}
                <time dateTime={change.createdAt}>
                  {formatDateTime(change.createdAt)}
                </time>
                <p className="change-register__state">
                  {t(`change.state.${getChangeCoordinationState(change)}`)}
                </p>
              </div>
              <dl className="change-register__impact">
                <div>
                  <dt>{t("change.owner")}</dt>
                  <dd>{change.responseOwner?.name ?? t("change.noOwner")}</dd>
                </div>
                <div>
                  <dt>{t("change.tasks")}</dt>
                  <dd>{formatNumber(change.impact.taskCount)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
