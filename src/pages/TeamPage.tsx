import { useLocalCalendarNow } from "../hooks/useLocalCalendarNow.ts";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../components/EmptyState.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { TASK_STATUS_MESSAGE_KEYS } from "../domain/labels.ts";
import {
  getTeamWorkload,
  HIGH_ACTIVE_LOAD_THRESHOLD,
  isTaskOverdue,
} from "../domain/workspace.ts";
import type { WorkspaceState } from "../domain/types.ts";
import { useI18n } from "../i18n/index.ts";
import { getInitials } from "../utils/format.ts";
import { getTaskStatusTone } from "../utils/statusTone.ts";

interface TeamPageProps {
  state: WorkspaceState;
}

export function TeamPage({ state }: TeamPageProps) {
  const { count, formatDate, formatNumber, t } = useI18n();
  const now = useLocalCalendarNow();
  const initialMember =
    state.teamMembers.find((member) => member.isOrganizer) ??
    state.teamMembers[0];
  const [selectedMemberId, setSelectedMemberId] = useState(
    initialMember?.id ?? "",
  );
  const eventTasks = state.tasks.filter(
    (task) => task.eventId === state.currentEventId,
  );
  const workloads = getTeamWorkload(state.teamMembers, eventTasks, now);
  const selectedMember = state.teamMembers.find(
    (member) => member.id === selectedMemberId,
  );
  const selectedTasks = eventTasks
    .filter((task) => task.ownerId === selectedMemberId)
    .sort((first, second) => first.deadline.localeCompare(second.deadline));

  function workloadLabel(active: number, atRisk: number) {
    if (atRisk > 0) {
      return count(atRisk, {
        one: "team.load.atRisk.one",
        other: "team.load.atRisk.other",
      });
    }
    if (active >= HIGH_ACTIVE_LOAD_THRESHOLD) return t("team.load.high");
    if (active >= 2) return t("team.load.steady");
    return t("team.load.available");
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t("team.eyebrow")}
        title={t("team.title")}
        description={t("team.description")}
      />

      <section className="team-grid" aria-label={t("team.listLabel")}>
        {workloads.map((workload) => {
          const selected = workload.member.id === selectedMemberId;
          const memberHeadingId = `team-member-${workload.member.id}`;
          return (
            <article
              className={`team-card ${selected ? "team-card--selected" : ""}`}
              aria-labelledby={memberHeadingId}
              key={workload.member.id}
            >
              <div className="team-card__top">
                <span className="avatar avatar--large" aria-hidden="true">
                  {getInitials(workload.member.name)}
                </span>
                {workload.member.isOrganizer && (
                  <span className="organizer-label">
                    <ShieldCheck size={13} aria-hidden="true" />
                    {t("team.organizer")}
                  </span>
                )}
              </div>
              <h2 id={memberHeadingId}>{workload.member.name}</h2>
              <p>{workload.member.role}</p>
              <dl className="team-card__metrics">
                <div>
                  <dt>{t("team.assigned")}</dt>
                  <dd>{formatNumber(workload.assigned)}</dd>
                </div>
                <div>
                  <dt>{t("team.completed")}</dt>
                  <dd>{formatNumber(workload.completed)}</dd>
                </div>
                <div>
                  <dt>{t("team.atRisk")}</dt>
                  <dd className={workload.atRisk ? "text-warning" : undefined}>
                    {formatNumber(workload.atRisk)}
                  </dd>
                </div>
              </dl>
              <span className="team-card__load">
                {workload.atRisk > 0 ? (
                  <AlertTriangle size={15} aria-hidden="true" />
                ) : (
                  <UserRoundCheck size={15} aria-hidden="true" />
                )}
                {workloadLabel(workload.active, workload.atRisk)}
              </span>
              <button
                type="button"
                className="team-card__select"
                aria-controls="member-tasks-panel"
                aria-label={t("team.reviewTasksFor", {
                  name: workload.member.name,
                })}
                aria-pressed={selected}
                onClick={() => setSelectedMemberId(workload.member.id)}
              >
                {selected ? t("team.selected") : t("team.reviewTasks")}
              </button>
            </article>
          );
        })}
      </section>

      <section
        id="member-tasks-panel"
        className="panel member-panel"
        aria-labelledby="member-tasks-title"
      >
        <div className="member-panel__header">
          <div className="avatar avatar--large" aria-hidden="true">
            {selectedMember ? getInitials(selectedMember.name) : "—"}
          </div>
          <div>
            <p className="eyebrow">{t("team.selected")}</p>
            <h2 id="member-tasks-title">
              {selectedMember?.name ?? t("team.noSelection")}
            </h2>
            <p>{selectedMember?.role}</p>
          </div>
        </div>

        {selectedTasks.length === 0 ? (
          <EmptyState
            title={t("team.empty.title")}
            description={t("team.empty.description")}
          />
        ) : (
          <div className="member-task-list">
            {selectedTasks.map((task) => {
              const overdue = isTaskOverdue(task, now);
              return (
                <article className="member-task" key={task.id}>
                  <span className="member-task__icon" aria-hidden="true">
                    {task.status === "completed" ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <ClipboardList size={18} />
                    )}
                  </span>
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.context}</p>
                  </div>
                  <div className="member-task__meta">
                    <span className={overdue ? "text-warning" : undefined}>
                      {formatDate(task.deadline)}
                      {overdue && ` · ${t("taskDetails.overdue")}`}
                    </span>
                    <StatusBadge
                      compact
                      tone={getTaskStatusTone(task.status)}
                      label={t(TASK_STATUS_MESSAGE_KEYS[task.status])}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
