import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useI18n } from "../../i18n/index.ts";
import { eventHref, createTaskHref } from "../../routes.ts";
import type { TaskEvent } from "../../services/RemoteWorkspaceService.ts";
import { TemplateApplicationController } from "../../services/templateApplicationState.ts";
import {
  TemplateApplicationService,
  templateSelection,
} from "../../services/templateApplications.ts";
import "./application.css";
import type { PersonalTemplate } from "../../services/personalTemplates.ts";
import {
  isCuratedIdentity,
  type CuratedTemplate,
} from "../../domain/curatedTemplates.ts";

export function TemplateApplicationPanel({
  userId,
  eventId,
  event,
  selected,
  onRefresh,
  onUnauthorized,
  onNavigate,
  personal,
  curated,
}: {
  userId: string;
  eventId: string;
  event: TaskEvent | null;
  selected: readonly string[];
  onRefresh: () => Promise<void>;
  onUnauthorized: () => void;
  onNavigate: (href: string) => void;
  personal?: PersonalTemplate;
  curated?: CuratedTemplate;
}) {
  const blueprint = curated ?? personal;
  const { t, language, formatTaskDeadline } = useI18n();
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;
  const controller = useMemo(
    () =>
      new TemplateApplicationController(
        userId,
        eventId,
        new TemplateApplicationService(undefined, blueprint),
        () => refreshRef.current(),
        () => unauthorizedRef.current(),
      ),
    [userId, eventId, blueprint],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const [confirmedRevision, setConfirmedRevision] = useState<string | null>(
    null,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    controller.activate();
    return controller.dispose;
  }, [controller]);
  useEffect(() => {
    if (state.review || state.result || state.error) heading.current?.focus();
  }, [state.review, state.result, state.error]);
  const review = state.review;
  const matches =
    review &&
    review.templateId === (blueprint?.id ?? "international-aikido-seminar") &&
    review.language === language &&
    review.itemIds.length === selected.length &&
    review.itemIds.every((id) => selected.includes(id)) &&
    event &&
    event.id === review.event.id;
  const allowed =
    event && !event.archived && event.membership.accessRole === "ORGANIZER";
  return (
    <section
      className="template-application"
      aria-labelledby="template-application-heading"
      aria-busy={state.pending !== null}
    >
      <h2 id="template-application-heading" ref={heading} tabIndex={-1}>
        {t(state.result ? "templates.t2.accepted" : "templates.t2.heading")}
      </h2>
      <p>{t("templates.t2.adds")}</p>
      {state.error && (
        <p className="notice" role="alert">
          {t(`templates.t2.error.${state.error}`)}
        </p>
      )}
      {state.result ? (
        <div role="status">
          <p>
            {t("templates.t2.success", { count: state.result.createdCount })}
          </p>
          <p className="template-application__operation">
            {t("templates.t2.operation", { id: state.result.operationId })}
          </p>
          {state.refreshFailed && (
            <p role="alert">{t("templates.t2.refreshFailed")}</p>
          )}
          <div className="template-application__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => onNavigate(eventHref(eventId, "/tasks"))}
            >
              {t("templates.t2.openTasks")}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => onNavigate(eventHref(eventId, "/history"))}
            >
              {t("templates.t4.history")}
            </button>
            {state.result.taskIds.map((id, index) => (
              <button
                type="button"
                className="button button--quiet"
                key={id}
                onClick={() => onNavigate(createTaskHref(id, eventId))}
              >
                {t("templates.t2.openCreated", { number: index + 1 })}
              </button>
            ))}
            {state.refreshFailed && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void controller.refreshConfirmed()}
              >
                {t("templates.t2.refresh")}
              </button>
            )}
            <button
              type="button"
              className="button button--quiet"
              onClick={controller.startNew}
            >
              {t("templates.t2.new")}
            </button>
          </div>
        </div>
      ) : state.attempt ? (
        <div>
          <p>
            {t(
              state.attempt.templateId === "international-aikido-seminar"
                ? "templates.t3.builtin"
                : isCuratedIdentity(state.attempt.templateId)
                  ? "templates.t4.library"
                  : "templates.t3.mine",
            )}{" "}
            · {state.attempt.templateId} · v{state.attempt.templateVersion}
          </p>
          <p>{t("templates.t2.recovery")}</p>
          <p className="template-application__operation">
            {t("templates.t2.operation", { id: state.attempt.operationId })}
          </p>
          <button
            type="button"
            className="button button--secondary"
            disabled={
              Boolean(state.pending) || !allowed || state.error === "key-reused"
            }
            onClick={() => void controller.apply()}
          >
            {t(
              state.pending === "apply"
                ? "templates.t2.applying"
                : "templates.t2.recover",
            )}
          </button>
        </div>
      ) : (
        <>
          {!event && <p>{t("templates.t2.needsEvent")}</p>}
          <button
            type="button"
            className="button button--secondary"
            disabled={!event || selected.length === 0 || Boolean(state.pending)}
            onClick={() => {
              setConfirmedRevision(null);
              void controller.review(
                templateSelection(selected, language, blueprint),
              );
            }}
          >
            {t(
              state.pending === "review"
                ? "templates.t2.reviewing"
                : "templates.t2.review",
            )}
          </button>
          {review && (
            <div className="template-application__review">
              <h3>{review.event.name}</h3>
              <p>
                {review.event.startDate} · {review.event.timezone} ·{" "}
                {review.language.toUpperCase()}
              </p>
              <p>
                {t("templates.t2.duplicates", {
                  count: review.matchingTaskCount,
                })}
              </p>
              <ol>
                {review.items.map((item) => (
                  <li key={item.itemId}>
                    <strong>{item.title}</strong>
                    <p>{item.context}</p>
                    <p>
                      {item.category} · {t(`priority.${item.priority}`)} ·{" "}
                      {formatTaskDeadline(item.deadline, item.deadlineTime)}
                    </p>
                    <p>
                      {t(
                        item.deadlineTime === null
                          ? "templates.t1.dateOnly"
                          : "templates.t2.localTime",
                      )}{" "}
                      · {t("templates.t2.initial")}
                    </p>
                  </li>
                ))}
              </ol>
              {!matches && <p role="alert">{t("templates.t2.changed")}</p>}
              {!review.canApply || !allowed ? (
                <p>{t("templates.t2.readOnly")}</p>
              ) : (
                <>
                  <label className="template-application__confirmation">
                    <input
                      type="checkbox"
                      checked={confirmedRevision === review.reviewRevision}
                      disabled={!matches}
                      onChange={(e) =>
                        setConfirmedRevision(
                          e.target.checked ? review.reviewRevision : null,
                        )
                      }
                    />
                    {t("templates.t2.confirm", {
                      count: review.items.length,
                      name: review.event.name,
                    })}
                  </label>
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={
                      !matches ||
                      confirmedRevision !== review.reviewRevision ||
                      Boolean(state.pending)
                    }
                    onClick={() => void controller.apply()}
                  >
                    {t("templates.t2.apply")}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
