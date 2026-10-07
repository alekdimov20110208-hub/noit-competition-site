import { useId, useLayoutEffect, useRef } from "react";
import { AppLink } from "../../components/AppLink.tsx";
import { EmptyState } from "../../components/EmptyState.tsx";
import { TASK_PRIORITY_MESSAGE_KEYS } from "../../domain/labels.ts";
import type { Task, TeamMember } from "../../domain/types.ts";
import { isTaskOverdue } from "../../domain/workspace.ts";
import { useI18n } from "../../i18n/index.ts";
import { createTaskHref } from "../../routes.ts";
import { changeHref } from "../../routes.ts";
import type { ChangeAttentionItem } from "../../domain/changeCoordination.ts";
import type { ChangeError } from "../../services/changes.ts";
import { ChangeReadNotice } from "./ChangeReadNotice.tsx";
import { revealFocusTarget } from "../../navigationFocus.ts";
import { getAttentionActionKey, getAttentionReason } from "./helpers.ts";

interface OperationalFocusProps {
  tasks: Task[];
  coordination: ChangeAttentionItem[];
  changesAvailable: boolean;
  changeReadError: ChangeError | null;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  members: Map<string, Pick<TeamMember, "id" | "name" | "role">>;
  now: Date;
  onOpenTask: (taskId: string) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function OperationalFocus({
  tasks,
  coordination,
  changesAvailable,
  changeReadError,
  onRefresh,
  onNavigate,
  members,
  now,
  onOpenTask,
  expanded,
  onExpandedChange,
}: OperationalFocusProps) {
  const i18n = useI18n();
  const { t, formatTaskDeadline } = i18n;
  const listId = useId();
  const disclosureRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const button = disclosureRef.current;
    if (button && document.activeElement === button) revealFocusTarget(button);
  }, [expanded]);
  const items = [
    ...tasks.map((task) => ({ kind: "task" as const, task })),
    ...coordination.map((item) => ({ kind: "change" as const, item })),
  ];
  const visibleItems = expanded ? items : items.slice(0, 5);

  return (
    <section className="operational-focus" aria-labelledby="focus-title">
      <header className="dashboard-section-heading">
        <div>
          <h2 id="focus-title">{t("dashboard.attention.title")}</h2>
        </div>
      </header>

      {!changesAvailable && (
        <ChangeReadNotice error={changeReadError} onRetry={onRefresh} />
      )}
      {items.length === 0 && changesAvailable ? (
        <EmptyState
          title={t("dashboard.attention.empty.title")}
          description={t("dashboard.attention.empty.description")}
        />
      ) : (
        <ol className="focus-list" id={listId}>
          {visibleItems.map((item) => {
            if (item.kind === "change") {
              const { change, reason } = item.item;
              return (
                <li key={`change:${change.id}`}>
                  <AppLink
                    href={changeHref(change.eventId, change.id)}
                    onNavigate={onNavigate}
                    className="focus-item"
                    data-change-attention-id={change.id}
                  >
                    <span className="focus-item__body">
                      <strong>{change.title}</strong>
                      <span className="focus-item__action">
                        {t(`change.attention.${reason}`)}
                      </span>
                      <span className="focus-item__reason">
                        {t(`change.attention.${reason}.help`)}
                      </span>
                      <span className="focus-item__meta">
                        {t("change.attention.kind")}
                      </span>
                    </span>
                  </AppLink>
                </li>
              );
            }
            const task = item.task;
            const overdue = isTaskOverdue(task, now);
            const owner = members.get(task.ownerId);
            const risk =
              task.status === "blocked" || overdue ? "critical" : "normal";

            return (
              <li key={`task:${task.id}`}>
                <AppLink
                  href={createTaskHref(task.id)}
                  onNavigate={() => onOpenTask(task.id)}
                  className={`focus-item focus-item--${risk}`}
                  data-task-focus-key={`focus:${task.id}`}
                >
                  <span className="focus-item__body">
                    <strong>{task.title}</strong>
                    <span className="focus-item__action">
                      {t(getAttentionActionKey(task, overdue))}
                    </span>
                    <span className="focus-item__reason">
                      {getAttentionReason(task, now, i18n)}
                    </span>
                    <span className="focus-item__meta">
                      <span>
                        {t("taskDetails.owner")}:{" "}
                        {owner?.name ?? t("common.unassigned")}
                      </span>
                      <time dateTime={task.deadline}>
                        {t(
                          overdue
                            ? "dashboard.attention.wasDue"
                            : "dashboard.attention.due",
                          {
                            date: formatTaskDeadline(
                              task.deadline,
                              task.deadlineTime,
                            ),
                          },
                        )}
                      </time>
                      <span
                        className={`focus-item__priority focus-item__priority--${task.priority}`}
                      >
                        {t("taskDetails.priority")}:{" "}
                        {t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
                      </span>
                    </span>
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ol>
      )}
      {items.length > 5 && (
        <button
          ref={disclosureRef}
          type="button"
          className="text-button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true });
            onExpandedChange(!expanded);
          }}
        >
          {t(
            expanded
              ? "dashboard.attention.showLess"
              : "dashboard.attention.showMore",
          )}
        </button>
      )}
    </section>
  );
}
