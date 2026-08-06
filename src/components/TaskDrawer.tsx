import {
  AlertTriangle,
  CalendarDays,
  Check,
  CircleDot,
  Link2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import {
  TASK_PRIORITY_MESSAGE_KEYS,
  TASK_STATUS_MESSAGE_KEYS,
} from "../domain/labels.ts";
import { isTaskOverdue } from "../domain/workspace.ts";
import type { Task, TaskStatus, TeamMember } from "../domain/types.ts";
import { useI18n } from "../i18n/index.ts";
import { getTaskStatusTone } from "../utils/statusTone.ts";
import { StatusBadge } from "./StatusBadge.tsx";

interface TaskDrawerProps {
  task: Task | null;
  owner: TeamMember | undefined;
  onClose: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onToggleAcknowledgement: (taskId: string) => void;
}

export function TaskDrawer({
  task,
  owner,
  onClose,
  onStatusChange,
  onToggleAcknowledgement,
}: TaskDrawerProps) {
  const { formatDate, formatDateTime, t } = useI18n();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const taskId = task?.id;

  useEffect(() => {
    if (!taskId) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusableElements = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === firstElement || !drawer.contains(activeElement)) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else if (
        activeElement === lastElement ||
        !drawer.contains(activeElement)
      ) {
        event.preventDefault();
        firstElement?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("drawer-open");

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("drawer-open");
      previousActiveElement?.focus();
    };
  }, [taskId, onClose]);

  if (!task) return null;

  const overdue = isTaskOverdue(task);

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        className="task-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
      >
        <div className="task-drawer__topbar">
          <span>{t("taskDetails.title")}</span>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            aria-label={t("taskDetails.close")}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="task-drawer__content">
          <div className="task-drawer__heading">
            <div className="task-drawer__badges">
              <StatusBadge
                tone={overdue ? "warning" : getTaskStatusTone(task.status)}
                label={
                  overdue
                    ? t("taskDetails.overdue")
                    : t(TASK_STATUS_MESSAGE_KEYS[task.status])
                }
              />
              <StatusBadge
                tone={task.priority === "critical" ? "critical" : "neutral"}
                label={t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
              />
            </div>
            <h2 id="task-drawer-title">{task.title}</h2>
            <p>{task.context}</p>
          </div>

          <dl className="detail-grid">
            <div>
              <dt>
                <UserRound size={15} aria-hidden="true" />{" "}
                {t("taskDetails.owner")}
              </dt>
              <dd>{owner?.name ?? t("common.unassigned")}</dd>
            </div>
            <div>
              <dt>
                <CalendarDays size={15} aria-hidden="true" />{" "}
                {t("taskDetails.deadline")}
              </dt>
              <dd>{formatDate(task.deadline)}</dd>
            </div>
            <div>
              <dt>
                <CircleDot size={15} aria-hidden="true" />{" "}
                {t("taskDetails.category")}
              </dt>
              <dd>{task.category}</dd>
            </div>
            <div>
              <dt>{t("taskDetails.lastUpdated")}</dt>
              <dd>{formatDateTime(task.updatedAt)}</dd>
            </div>
          </dl>

          <div className="field-stack">
            <label htmlFor={`drawer-status-${task.id}`}>
              {t("taskDetails.currentStatus")}
            </label>
            <select
              id={`drawer-status-${task.id}`}
              value={task.status}
              onChange={(event) =>
                onStatusChange(task.id, event.target.value as TaskStatus)
              }
            >
              {Object.entries(TASK_STATUS_MESSAGE_KEYS).map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key)}
                </option>
              ))}
            </select>
          </div>

          {(task.blockedBy || task.blocks) && (
            <section
              className="relationship-card"
              aria-label={t("taskDetails.relationships")}
            >
              <div className="relationship-card__title">
                <Link2 size={17} aria-hidden="true" />
                <strong>{t("taskDetails.operationalContext")}</strong>
              </div>
              {task.blockedBy && (
                <div>
                  <span>{t("taskDetails.blockedBy")}</span>
                  <p>{task.blockedBy}</p>
                </div>
              )}
              {task.blocks && (
                <div>
                  <span>{t("taskDetails.whatThisBlocks")}</span>
                  <p>{task.blocks}</p>
                </div>
              )}
            </section>
          )}

          <section className="acknowledgement-card">
            <div>
              <strong>
                {task.acknowledged
                  ? t("taskDetails.acknowledged")
                  : t("taskDetails.acknowledgementNeeded")}
              </strong>
              <p>
                {task.acknowledged
                  ? t("taskDetails.acknowledgedDescription")
                  : t("taskDetails.acknowledgementNeededDescription")}
              </p>
            </div>
            <button
              type="button"
              className={`button ${task.acknowledged ? "button--secondary" : "button--primary"}`}
              onClick={() => onToggleAcknowledgement(task.id)}
            >
              {task.acknowledged ? (
                <>
                  <X size={16} aria-hidden="true" />{" "}
                  {t("taskDetails.markUnacknowledged")}
                </>
              ) : (
                <>
                  <Check size={16} aria-hidden="true" />{" "}
                  {t("taskDetails.acknowledge")}
                </>
              )}
            </button>
          </section>

          {overdue && task.status !== "completed" && (
            <div className="notice notice--warning">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{t("taskDetails.overdueNotice")}</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
