import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/index.ts";
import type { TaskEvent } from "../../services/RemoteWorkspaceService.ts";
import {
  LibraryFailure,
  PersonalTemplateService,
  readSaveRecovery,
  saveRecovery,
  type PersonalTemplate,
  type TemplateCard,
  type TemplateSource,
  type SaveItem,
  type SaveAttempt,
  type SaveResult,
} from "../../services/personalTemplates.ts";
import { resolveTemplateDeadline } from "../../domain/templateDates.ts";
import { TemplateApplicationPanel } from "./TemplateApplicationPanel.tsx";
import "./personal.css";
const service = new PersonalTemplateService();
export function MyTemplates({
  userId,
  event,
  targetEventId,
  onRefresh,
  onUnauthorized,
  onNavigate,
}: {
  userId: string;
  event: TaskEvent | null;
  targetEventId: string | null;
  onRefresh: () => Promise<void>;
  onUnauthorized: () => void;
  onNavigate: (href: string) => void;
}) {
  const { t, formatTaskDeadline } = useI18n();
  const [cards, setCards] = useState<TemplateCard[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PersonalTemplate | null>(null),
    [selected, setSelected] = useState<string[]>([]);
  const [source, setSource] = useState<TemplateSource | null>(null),
    [draft, setDraft] = useState<SaveItem[]>([]),
    [reviewing, setReviewing] = useState(false);
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [attempt, setAttempt] = useState<SaveAttempt | null>(() =>
      readSaveRecovery(userId),
    ),
    [saved, setSaved] = useState<SaveResult | null>(null);
  const alive = useRef(true),
    pending = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const allowed =
    event && !event.archived && event.membership.accessRole === "ORGANIZER";
  const report = (e: unknown) => {
    const code = e instanceof LibraryFailure ? e.code : "unavailable";
    setError(code);
    if (code === "unauthenticated") onUnauthorized();
  };
  async function run(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      if (alive.current) report(e);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function load(after?: string) {
    await run(async () => {
      const r = await service.list(after);
      if (!alive.current) return;
      setCards((current) =>
        after ? [...current, ...r.templates] : r.templates,
      );
      setCursor(r.nextCursor);
    });
  }
  const initialLoad = useRef(load);
  useEffect(() => {
    alive.current = true;
    void initialLoad.current();
    return () => {
      alive.current = false;
    };
  }, []); // Page is keyed by session and Event.
  useEffect(() => {
    if (detail || source || saved || error) heading.current?.focus();
  }, [detail, source, saved, error]);
  const change = (id: string, fields: Partial<SaveItem>) => {
    setConfirmed(false);
    setDraft((rows) =>
      rows.map((r) => (r.sourceTaskId === id ? { ...r, ...fields } : r)),
    );
  };
  async function open(id: string) {
    await run(async () => {
      const r = await service.detail(id);
      if (!alive.current) return;
      setDetail(r);
      setSelected(r.items.map((i) => i.id));
      setSource(null);
      setSaved(null);
    });
  }
  async function loadSource(after?: string) {
    if (!event) return;
    await run(async () => {
      const r = await service.source(event.id, after);
      if (!alive.current) return;
      if (after && source && source.eventVersion !== r.eventVersion)
        throw new LibraryFailure("conflict");
      setSource((current) =>
        after && current ? { ...r, items: [...current.items, ...r.items] } : r,
      );
      if (!after) {
        setDraft([]);
        setReviewing(false);
        setName("");
        setDescription("");
        setConfirmed(false);
        setSaved(null);
        setDetail(null);
      }
    });
  }
  async function save() {
    if (pending.current) return;
    if (!event && !attempt) return;
    let held = attempt;
    if (!held) {
      if (!source || !confirmed || !draft.length) return;
      held = {
        eventId: event!.id,
        operationId: crypto.randomUUID(),
        body: {
          name,
          description,
          expectedEventVersion: source.eventVersion,
          items: draft,
          confirmed: true,
        },
      };
      saveRecovery(userId, held);
      setAttempt(held);
    }
    const original = held;
    await run(async () => {
      try {
        const result = await service.save(original);
        if (!alive.current) return;
        saveRecovery(userId, null);
        setAttempt(null);
        setSaved(result);
        setSource(null);
        setReviewing(false);
        // Save success is independent from a subsequent list refresh.
        try {
          const list = await service.list();
          if (alive.current) {
            setCards(list.templates);
            setCursor(list.nextCursor);
          }
        } catch (e) {
          if (alive.current) report(e);
        }
      } catch (e) {
        if (
          alive.current &&
          e instanceof LibraryFailure &&
          e.code === "conflict"
        ) {
          saveRecovery(userId, null);
          setAttempt(null);
          setConfirmed(false);
          setSource(null);
          setReviewing(false);
        }
        throw e;
      }
    });
  }
  return (
    <section
      className="personal-templates"
      aria-labelledby="my-templates-heading"
      aria-busy={busy}
    >
      <h2 id="my-templates-heading" ref={heading} tabIndex={-1}>
        {t("templates.t3.mine")}
      </h2>
      {event && (
        <p>
          <strong>{event.name}</strong> · {event.startDate} · {event.timezone}
        </p>
      )}
      <p>{t("templates.t3.private")}</p>
      {busy && <p role="status">{t("templates.t3.loading")}</p>}
      {error && (
        <p role="alert">{t(`templates.t3.error.${error as "unavailable"}`)}</p>
      )}
      {attempt ? (
        <div className="notice">
          <p>{t("templates.t3.uncertain")}</p>
          <p>{attempt.operationId}</p>
          <button
            className="button button--secondary"
            disabled={busy || error === "key-reused"}
            onClick={() => void save()}
          >
            {t("templates.t3.recover")}
          </button>
        </div>
      ) : (
        <>
          {saved && (
            <div role="status">
              <p>{t("templates.t3.saved")}</p>
              <p>{t("templates.t2.operation", { id: saved.operationId })}</p>
              <button
                className="button button--primary"
                onClick={() => void open(saved.templateId)}
                disabled={busy}
              >
                {t("templates.t3.open")}
              </button>
            </div>
          )}
          {!detail && !source && (
            <>
              <button
                className="button button--primary"
                disabled={!allowed || busy}
                onClick={() => void loadSource()}
              >
                {t("templates.t3.saveFrom")}
              </button>
              {!allowed && <p>{t("templates.t3.chooseEvent")}</p>}
              {!cards.length && !busy && !error && (
                <p role="status">{t("templates.t3.empty")}</p>
              )}
              {error && (
                <button
                  className="button button--secondary"
                  onClick={() => void load()}
                  disabled={busy}
                >
                  {t("templates.t3.retry")}
                </button>
              )}
              <div className="personal-templates__cards">
                {cards.map((card) => (
                  <article key={card.id}>
                    <h3>{card.name}</h3>
                    <p>{card.description}</p>
                    <p>
                      {t("templates.t3.count", {
                        count: card.itemCount,
                        version: card.version,
                      })}
                    </p>
                    <button
                      className="button button--secondary"
                      disabled={busy}
                      onClick={() => void open(card.id)}
                    >
                      {t("templates.t3.open")}
                    </button>
                  </article>
                ))}
              </div>
              {cursor && (
                <button
                  className="button button--secondary"
                  disabled={busy}
                  onClick={() => void load(cursor)}
                >
                  {t("templates.t3.more")}
                </button>
              )}
            </>
          )}
          {(detail || source) && (
            <button
              className="button button--quiet"
              disabled={busy}
              onClick={() => {
                setDetail(null);
                setSource(null);
                setError(null);
              }}
            >
              {t("templates.t3.back")}
            </button>
          )}
          {source && (
            <>
              <p className="notice">{t("templates.t3.sensitive")}</p>
              {!reviewing ? (
                <fieldset>
                  <legend>{t("templates.t3.source")}</legend>
                  {!source.items.length && <p>{t("templates.t3.noTasks")}</p>}
                  {source.items.map((item) => (
                    <label className="personal-templates__choice" key={item.id}>
                      <input
                        type="checkbox"
                        checked={draft.some((d) => d.sourceTaskId === item.id)}
                        disabled={
                          busy ||
                          item.dayOffset === null ||
                          (!draft.some((d) => d.sourceTaskId === item.id) &&
                            draft.length >= 50)
                        }
                        onChange={(e) => {
                          setConfirmed(false);
                          setDraft((rows) =>
                            e.target.checked
                              ? [
                                  ...rows,
                                  {
                                    sourceTaskId: item.id,
                                    expectedTaskVersion: item.version,
                                    title: item.title,
                                    category: item.category,
                                    priority: item.priority,
                                    context: "",
                                    contextReviewed: false,
                                  },
                                ]
                              : rows.filter((r) => r.sourceTaskId !== item.id),
                          );
                        }}
                      />
                      {item.title}
                      {item.dayOffset === null && (
                        <span>{t("templates.t1.invalidDate")}</span>
                      )}
                    </label>
                  ))}
                  {source.nextCursor && (
                    <button
                      className="button button--secondary"
                      disabled={busy}
                      onClick={() => void loadSource(source.nextCursor!)}
                    >
                      {t("templates.t3.more")}
                    </button>
                  )}
                  <button
                    className="button button--primary"
                    disabled={busy || !draft.length}
                    onClick={() => setReviewing(true)}
                  >
                    {t("templates.t3.review")}
                  </button>
                </fieldset>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <label>
                    {t("templates.t3.name")}
                    <input
                      required
                      maxLength={200}
                      value={name}
                      onChange={(e) => {
                        setConfirmed(false);
                        setName(e.target.value);
                      }}
                    />
                  </label>
                  <label>
                    {t("templates.t3.description")}
                    <textarea
                      aria-label={t("templates.t3.description")}
                      maxLength={2000}
                      value={description}
                      onChange={(e) => {
                        setConfirmed(false);
                        setDescription(e.target.value);
                      }}
                    />
                  </label>
                  {draft.map((item) => {
                    const original = source.items.find(
                      (i) => i.id === item.sourceTaskId,
                    )!;
                    return (
                      <fieldset key={item.sourceTaskId}>
                        <legend>{item.title}</legend>
                        <label>
                          {t("templates.t3.title")}
                          <input
                            required
                            maxLength={200}
                            value={item.title}
                            onChange={(e) =>
                              change(item.sourceTaskId, {
                                title: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          {t("templates.t3.category")}
                          <input
                            maxLength={100}
                            value={item.category}
                            onChange={(e) =>
                              change(item.sourceTaskId, {
                                category: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          {t("templates.t3.priority")}
                          <select
                            value={item.priority}
                            onChange={(e) =>
                              change(item.sourceTaskId, {
                                priority: e.target
                                  .value as SaveItem["priority"],
                              })
                            }
                          >
                            {(["normal", "important", "critical"] as const).map(
                              (p) => (
                                <option value={p} key={p}>
                                  {t(`priority.${p}`)}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <p>
                          {t("templates.t3.offset", {
                            days:
                              original.dayOffset ??
                              t("templates.t1.invalidDate"),
                            time:
                              original.deadlineTime ??
                              t("templates.t1.dateOnly"),
                          })}
                        </p>
                        <details>
                          <summary>{t("templates.t3.original")}</summary>
                          <p className="personal-templates__context">
                            {original.originalContext}
                          </p>
                          <button
                            className="button button--quiet"
                            type="button"
                            onClick={() =>
                              change(item.sourceTaskId, {
                                context: original.originalContext,
                                contextReviewed: false,
                              })
                            }
                          >
                            {t("templates.t3.include")}
                          </button>
                        </details>
                        <label>
                          {t("templates.t3.context")}
                          <textarea
                            aria-label={t("templates.t3.context")}
                            maxLength={5000}
                            value={item.context}
                            onChange={(e) =>
                              change(item.sourceTaskId, {
                                context: e.target.value,
                                contextReviewed: false,
                              })
                            }
                          />
                        </label>
                        <label className="personal-templates__choice">
                          <input
                            type="checkbox"
                            checked={item.contextReviewed}
                            onChange={(e) =>
                              change(item.sourceTaskId, {
                                contextReviewed: e.target.checked,
                              })
                            }
                          />
                          {t("templates.t3.includeConfirm")}
                        </label>
                      </fieldset>
                    );
                  })}
                  <label className="personal-templates__choice">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    {t("templates.t3.confirm")}
                  </label>
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={
                      busy ||
                      !confirmed ||
                      !name.trim() ||
                      draft.some((i) => i.context.trim() && !i.contextReviewed)
                    }
                  >
                    {t(busy ? "templates.t3.saving" : "templates.t3.save")}
                  </button>
                </form>
              )}
            </>
          )}
          {detail && (
            <>
              <h3>{detail.name}</h3>
              <p>{detail.description}</p>
              <p>
                {t("templates.t3.count", {
                  count: detail.items.length,
                  version: detail.version,
                })}
              </p>
              <fieldset>
                <legend>{t("templates.t3.select")}</legend>
                {detail.items.map((item) => {
                  let due = "";
                  try {
                    if (event) {
                      const d = resolveTemplateDeadline(
                        event.startDate,
                        item.dayOffset,
                        item.deadlineTime,
                      );
                      due = formatTaskDeadline(d.deadline, d.deadlineTime);
                    }
                  } catch {
                    due = t("templates.t1.invalidDate");
                  }
                  return (
                    <article key={item.id}>
                      <label className="personal-templates__choice">
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          onChange={(e) =>
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, item.id]
                                : ids.filter((id) => id !== item.id),
                            )
                          }
                        />
                        {item.title}
                      </label>
                      <p className="personal-templates__context">
                        {item.context}
                      </p>
                      <p>
                        {item.category} · {t(`priority.${item.priority}`)}
                      </p>
                      <p>
                        {t("templates.t3.offset", {
                          days: item.dayOffset,
                          time: item.deadlineTime ?? t("templates.t1.dateOnly"),
                        })}
                      </p>
                      <p>{due || t("templates.t1.needsEvent")}</p>
                    </article>
                  );
                })}
              </fieldset>
              {targetEventId ? (
                <TemplateApplicationPanel
                  personal={detail}
                  userId={userId}
                  eventId={targetEventId}
                  event={event}
                  selected={selected}
                  onRefresh={onRefresh}
                  onUnauthorized={onUnauthorized}
                  onNavigate={onNavigate}
                />
              ) : (
                <p>{t("templates.t2.needsEvent")}</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
