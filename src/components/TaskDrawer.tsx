import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
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
import { getInitials } from "../utils/format.ts";
import { getTaskStatusTone } from "../utils/statusTone.ts";
import { BudoSelect, type BudoSelectOption } from "./BudoSelect.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import type { TaskAssignee } from "../services/RemoteWorkspaceService.ts";
import type { TaskMutationState } from "../services/taskReadState.ts";

export interface RemoteTaskControls {
  assignment: boolean;
  acceptance: boolean;
  status: boolean;
  members: TaskAssignee[];
  mutation: TaskMutationState | null;
  disabled: boolean;
  onAssign: (memberId: string | null) => void;
  onRefresh: () => void;
}

const TASK_STATUSES = Object.keys(TASK_STATUS_MESSAGE_KEYS) as TaskStatus[];

interface TaskDrawerProps {
  now: Date;
  task: Task | null;
  owner: Pick<TeamMember, "id" | "name" | "role"> | undefined;
  onClose: () => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onToggleAcknowledgement?: (taskId: string) => void;
  readOnly?: boolean;
  timeZone?: string;
  remoteControls?: RemoteTaskControls;
}

export function TaskDrawer({
  now,
  task,
  owner,
  onClose,
  onStatusChange,
  onToggleAcknowledgement,
  readOnly = false,
  timeZone,
  remoteControls,
}: TaskDrawerProps) {
  const { formatDate, formatDateTime, t } = useI18n(timeZone);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const taskId = task?.id;

  useEffect(() => {
    if (!taskId) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;

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

  const overdue = isTaskOverdue(task, now);
  const priorityTone =
    task.priority === "critical"
      ? "critical"
      : task.priority === "important"
        ? "warning"
        : "neutral";
  const contextId = `task-drawer-context-${task.id}`;
  const pending = remoteControls?.mutation?.pending ?? false;
  const disabled = readOnly || pending || remoteControls?.disabled;
  const statusOptions: readonly BudoSelectOption<TaskStatus>[] =
    TASK_STATUSES.map((status) => ({
      value: status,
      label: t(TASK_STATUS_MESSAGE_KEYS[status]),
    }));

  return (
    <div
      className="drawer-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        className="task-drawer"
        data-remote={remoteControls ? "true" : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
        aria-describedby={contextId}
        aria-description={readOnly ? t("tasks.remote.readOnly") : undefined}
      >
        <div className="task-drawer__topbar">
          <span>
            {t("taskDetails.title")}
            {readOnly && <> · {t("tasks.remote.readOnlyShort")}</>}
          </span>
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
          <header className="task-drawer__identity">
            <span className="task-drawer__category">{task.category}</span>
            <div className="task-drawer__badges">
              <StatusBadge
                tone={getTaskStatusTone(task.status)}
                label={t(TASK_STATUS_MESSAGE_KEYS[task.status])}
              />
              {overdue && (
                <StatusBadge tone="critical" label={t("taskDetails.overdue")} />
              )}
              <StatusBadge
                tone={priorityTone}
                label={t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
              />
            </div>
            <h2 id="task-drawer-title">{task.title}</h2>
            <p id={contextId}>{task.context}</p>
          </header>

          {remoteControls?.mutation &&
            (pending || remoteControls.mutation.message) && (
              <div
                className="task-action-feedback"
                role={pending ? "status" : "alert"}
                aria-atomic="true"
              >
                <span>
                  {pending
                    ? t("tasks.actions.pending")
                    : t(`tasks.actions.${remoteControls.mutation.message!}`)}
                </span>
                {remoteControls.mutation.needsRefresh && (
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={remoteControls.onRefresh}
                  >
                    {t("tasks.actions.refresh")}
                  </button>
                )}
              </div>
            )}

          <section
            className="task-drawer__section"
            aria-labelledby="task-responsibility-heading"
          >
            <div className="task-drawer__section-heading">
              <UserRound size={17} aria-hidden="true" />
              <div>
                <h3 id="task-responsibility-heading">
                  {t("taskDetails.section.responsibility")}
                </h3>
              </div>
            </div>

            <div className="task-responsibility-panel">
              <div className="task-drawer__owner">
                <span className="avatar" aria-hidden="true">
                  {owner ? getInitials(owner.name) : "—"}
                </span>
                <div>
                  <span>{t("taskDetails.owner")}</span>
                  <strong>{owner?.name ?? t("common.unassigned")}</strong>
                  {owner && <small>{owner.role}</small>}
                  {remoteControls?.assignment && (
                    <div className="field-stack task-assignment-select">
                      <label htmlFor={`drawer-assignment-${task.id}`}>
                        {t("tasks.actions.assignment")}
                      </label>
                      <select
                        id={`drawer-assignment-${task.id}`}
                        value={task.ownerId}
                        disabled={disabled}
                        onChange={(event) =>
                          remoteControls.onAssign(event.target.value || null)
                        }
                      >
                        <option value="">{t("common.unassigned")}</option>
                        {owner &&
                          !remoteControls.members.some(
                            (member) => member.id === owner.id,
                          ) && (
                            <option value={owner.id} disabled>
                              {owner.name}
                            </option>
                          )}
                        {remoteControls.members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                            {member.role ? ` · ${member.role}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="task-drawer__acceptance">
                <div
                  className={`task-drawer__acceptance-state ${task.acknowledged ? "task-drawer__acceptance-state--accepted" : ""}`}
                >
                  {task.acknowledged ? (
                    <CheckCircle2 size={18} aria-hidden="true" />
                  ) : (
                    <Circle size={17} aria-hidden="true" />
                  )}
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
                </div>
                {(!remoteControls || remoteControls.acceptance) && (
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={disabled}
                    onClick={() => onToggleAcknowledgement?.(task.id)}
                  >
                    {task.acknowledged ? (
                      <>
                        <X size={16} aria-hidden="true" />{" "}
                        {t(
                          remoteControls
                            ? "tasks.actions.withdraw"
                            : "taskDetails.markUnacknowledged",
                        )}
                      </>
                    ) : (
                      <>
                        <Check size={16} aria-hidden="true" />{" "}
                        {t(
                          remoteControls
                            ? "tasks.actions.accept"
                            : "taskDetails.acknowledge",
                        )}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section
            className="task-drawer__section"
            aria-labelledby="task-progress-heading"
          >
            <div className="task-drawer__section-heading">
              <CircleDot size={17} aria-hidden="true" />
              <div>
                <h3 id="task-progress-heading">
                  {t("taskDetails.section.progress")}
                </h3>
              </div>
            </div>

            <div className="task-progress-panel">
              {!remoteControls || remoteControls.status ? (
                <BudoSelect<TaskStatus>
                  id={`drawer-status-${task.id}`}
                  className="field-stack task-status-select"
                  label={t("taskDetails.currentStatus")}
                  value={task.status}
                  options={statusOptions}
                  disabled={disabled}
                  onChange={(status) => onStatusChange?.(task.id, status)}
                  popupMinWidth={220}
                />
              ) : (
                <div className="field-stack task-status-readout">
                  <span>{t("taskDetails.currentStatus")}</span>
                  <strong>{t(TASK_STATUS_MESSAGE_KEYS[task.status])}</strong>
                </div>
              )}

              <dl className="task-progress-meta">
                <div>
                  <dt>
                    <CalendarDays size={15} aria-hidden="true" />{" "}
                    {t("taskDetails.deadline")}
                  </dt>
                  <dd>
                    <time dateTime={task.deadline}>
                      {formatDate(task.deadline)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>{t("taskDetails.priority")}</dt>
                  <dd>{t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}</dd>
                </div>
              </dl>
            </div>

            {overdue && task.status !== "completed" && (
              <div className="notice notice--warning task-drawer__warning">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{t("taskDetails.overdueNotice")}</span>
              </div>
            )}
          </section>

          {(task.blockedBy || task.blocks) && (
            <section
              className="task-drawer__section"
              aria-labelledby="task-relationships-heading"
            >
              <div className="task-drawer__section-heading">
                <Link2 size={17} aria-hidden="true" />
                <div>
                  <span>{t("taskDetails.relationships")}</span>
                  <h3 id="task-relationships-heading">
                    {t("taskDetails.operationalContext")}
                  </h3>
                </div>
              </div>
              <div className="relationship-card">
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
              </div>
            </section>
          )}

          <section
            className="task-drawer__section task-drawer__section--metadata"
            aria-labelledby="task-metadata-heading"
          >
            <div className="task-drawer__section-heading">
              <div>
                <h3 id="task-metadata-heading">
                  {t("taskDetails.section.metadata")}
                </h3>
              </div>
            </div>
            <dl className="task-drawer__metadata">
              <div>
                <dt>{t("taskDetails.category")}</dt>
                <dd>{task.category}</dd>
              </div>
              <div>
                <dt>{t("taskDetails.lastUpdated")}</dt>
                <dd>{formatDateTime(task.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </aside>
    </div>
  );
}
