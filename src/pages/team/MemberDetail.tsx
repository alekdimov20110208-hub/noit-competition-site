import { AppLink } from "../../components/AppLink.tsx";
import { StatusBadge } from "../../components/StatusBadge.tsx";
import {
  TASK_PRIORITY_MESSAGE_KEYS,
  TASK_STATUS_MESSAGE_KEYS,
} from "../../domain/labels.ts";
import { getDeadlineTiming } from "../../domain/taskTiming.ts";
import type { Task } from "../../domain/types.ts";
import { useI18n } from "../../i18n/index.ts";
import { createTaskHref } from "../../routes.ts";
import { revealFocusTarget } from "../../navigationFocus.ts";
import type { TeamSection } from "../../teamNavigation.ts";
import { getTaskStatusTone } from "../../utils/statusTone.ts";
import { getAttentionReason } from "../dashboard/helpers.ts";
import { getPreviewLimits, type MemberSummary } from "./helpers.ts";

interface Props {
  summary: MemberSummary;
  now: Date;
  expanded: TeamSection[];
  onExpand: (section: TeamSection, open: boolean) => void;
  onOpenTask: (taskId: string, section: TeamSection, focusKey: string) => void;
  onNavigate: (href: string) => void;
  onEngage: () => void;
}

export function MemberDetail({
  summary,
  now,
  expanded,
  onExpand,
  onOpenTask,
  onNavigate,
  onEngage,
}: Props) {
  const i18n = useI18n();
  const { t, formatDate, formatNumber } = i18n;
  const limits = getPreviewLimits(
    summary.attention.length,
    summary.upcoming.length,
  );
  function row(task: Task, section: TeamSection) {
    const timing = getDeadlineTiming(task.deadline, now);
    const focusKey = `team:${summary.member.id}:${section}:${task.id}`;
    return (
      <li className="team-work-row" key={task.id} data-team-task={task.id}>
        <AppLink
          className="team-work-row__link"
          href={createTaskHref(task.id)}
          data-task-focus-key={focusKey}
          onNavigate={() => onOpenTask(task.id, section, focusKey)}
        >
          {task.title}
        </AppLink>
        <div className="team-work-row__context">
          <span>{task.category}</span>
          {task.priority !== "normal" && (
            <span>{t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}</span>
          )}
          {timing === "invalid" ? (
            <span>{t("team.workspace.invalid")}</span>
          ) : (
            <time dateTime={task.deadline}>{formatDate(task.deadline)}</time>
          )}
          {section === "upcoming" &&
            (timing === "today" || timing === "near" || timing === "later") && (
              <span className="team-work-row__timing">
                {t(`team.workspace.${timing}`)}
              </span>
            )}
        </div>
        <div className="team-work-row__state">
          <StatusBadge
            compact
            tone={getTaskStatusTone(task.status)}
            label={t(TASK_STATUS_MESSAGE_KEYS[task.status])}
          />
          <span
            className={task.acknowledged ? "team-accepted" : "team-unaccepted"}
          >
            {t(
              task.acknowledged
                ? "taskDetails.acknowledged"
                : "taskDetails.acknowledgementNeeded",
            )}
          </span>
        </div>
        {section === "attention" && (
          <p
            className={`team-work-row__reason ${task.status === "blocked" || timing === "overdue" ? "team-work-row__reason--risk" : ""}`}
          >
            {getAttentionReason(task, now, i18n)}
          </p>
        )}
      </li>
    );
  }
  function queue(section: "attention" | "upcoming") {
    const tasks = summary[section];
    const open = expanded.includes(section);
    const limit = limits[section];
    return (
      <section
        className="team-work-section"
        aria-labelledby={`team-${section}-heading`}
      >
        <h3 id={`team-${section}-heading`}>
          {t(`team.workspace.${section}`)}{" "}
          <span>{formatNumber(tasks.length)}</span>
        </h3>
        {tasks.length ? (
          <ul id={`team-${section}-list`} className="team-work-list">
            {(open ? tasks : tasks.slice(0, limit)).map((task) =>
              row(task, section),
            )}
          </ul>
        ) : (
          <p className="team-empty-copy">
            {t(
              section === "attention"
                ? "team.workspace.noAttention"
                : "team.workspace.noUpcoming",
            )}
            <small>
              {t(
                section === "attention"
                  ? "team.workspace.noAttentionDescription"
                  : "team.workspace.noUpcomingDescription",
              )}
            </small>
          </p>
        )}
        {tasks.length > limit && (
          <button
            className="team-disclosure-button"
            type="button"
            data-team-disclosure={section}
            aria-expanded={open}
            aria-controls={`team-${section}-list`}
            onClick={(event) => {
              const button = event.currentTarget;
              onExpand(section, !open);
              if (open)
                requestAnimationFrame(() => {
                  button.scrollIntoView({
                    block: "nearest",
                    behavior: "instant",
                  });
                  if (!button.closest(".team-sheet")) revealFocusTarget(button);
                });
            }}
          >
            {open
              ? t("team.workspace.less")
              : t("team.workspace.more", {
                  count: formatNumber(tasks.length - limit),
                })}
          </button>
        )}
      </section>
    );
  }
  return (
    <div
      className="team-detail"
      id="team-member-detail"
      onFocusCapture={onEngage}
      onPointerDownCapture={onEngage}
    >
      <header className="team-detail__identity">
        <h2 id="team-member-heading" tabIndex={-1}>
          {summary.member.name}
        </h2>
        <p className="team-detail__role">{summary.member.role}</p>
        {summary.categories.length > 0 && (
          <p className="team-detail__areas">{summary.categories.join(" · ")}</p>
        )}
      </header>
      <dl className="team-facts">
        {(
          [
            ["open", summary.open],
            ["attention", summary.attention.length],
            ["overdue", summary.overdue],
            ["blocked", summary.blocked],
            ["notAccepted", summary.notAccepted],
          ] as const
        )
          .filter(([, value], index) => index < 2 || value > 0)
          .map(([key, value]) => (
            <div key={key}>
              <dt>{t(`team.workspace.${key}`)}</dt>
              <dd>{formatNumber(value)}</dd>
            </div>
          ))}
      </dl>
      <p className="team-detail__note">{t("team.workspace.summaryNote")}</p>
      {summary.assigned === 0 ? (
        <p className="team-empty-copy">
          {t("team.workspace.noTasks")}
          <small>{t("team.workspace.noTasksDescription")}</small>
        </p>
      ) : summary.open === 0 ? (
        <p className="team-empty-copy">{t("team.workspace.noOpen")}</p>
      ) : (
        <>
          {queue("attention")}
          {queue("upcoming")}
        </>
      )}
      {(["other", "completed"] as const).map(
        (section) =>
          summary[section].length > 0 && (
            <details
              className="team-history"
              key={section}
              open={expanded.includes(section)}
              onToggle={(event) => {
                if (event.currentTarget.open !== expanded.includes(section))
                  onExpand(section, event.currentTarget.open);
              }}
            >
              <summary data-team-disclosure={section}>
                {t(`team.workspace.${section}`)}{" "}
                <span>{formatNumber(summary[section].length)}</span>
                {expanded.includes(section) && (
                  <span className="team-history__less">
                    {t("team.workspace.less")}
                  </span>
                )}
              </summary>
              <ul className="team-work-list">
                {summary[section].map((task) => row(task, section))}
              </ul>
            </details>
          ),
      )}
      <footer className="team-detail__footer">
        <AppLink href="/tasks" onNavigate={onNavigate}>
          {t("team.workspace.openTasks")} <span aria-hidden="true">→</span>
        </AppLink>
        <span>{t("team.workspace.allEventTasks")}</span>
        <p>{t("team.workspace.acceptanceNote")}</p>
      </footer>
    </div>
  );
}
