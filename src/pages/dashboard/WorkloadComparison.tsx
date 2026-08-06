import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/EmptyState.tsx";
import { StatusBadge } from "../../components/StatusBadge.tsx";
import {
  HIGH_ACTIVE_LOAD_THRESHOLD,
  type TeamWorkload,
} from "../../domain/workspace.ts";
import { useI18n, type MessageKey } from "../../i18n/index.ts";
import { getInitials } from "../../utils/format.ts";
import {
  getWorkloadSignal,
  workloadSignalTone,
  type WorkloadSignal,
} from "./helpers.ts";

const WORKLOAD_PREVIEW_LIMIT = 5;

const WORKLOAD_SIGNAL_KEYS = {
  blocked: "dashboard.workload.signal.blocked",
  overdue: "dashboard.workload.signal.overdue",
  high: "dashboard.workload.signal.high",
  unassigned: "dashboard.workload.signal.unassigned",
  clear: "dashboard.workload.signal.clear",
} satisfies Record<WorkloadSignal, MessageKey>;

interface WorkloadComparisonProps {
  workloads: TeamWorkload[];
  onNavigate: (path: string) => void;
}

export function WorkloadComparison({
  workloads,
  onNavigate,
}: WorkloadComparisonProps) {
  const { t, plural, formatNumber, formatPercent } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const preview = workloads.slice(0, WORKLOAD_PREVIEW_LIMIT);
  const overflow = workloads.slice(WORKLOAD_PREVIEW_LIMIT);

  function renderWorkload(workload: TeamWorkload) {
    const completion = workload.assigned
      ? Math.round((workload.completed / workload.assigned) * 100)
      : null;
    const signal = getWorkloadSignal(workload);
    const signalLabel = t(WORKLOAD_SIGNAL_KEYS[signal], {
      threshold: formatNumber(HIGH_ACTIVE_LOAD_THRESHOLD),
    });

    return (
      <article className="workload-row" key={workload.member.id}>
        <div className="avatar avatar--small" aria-hidden="true">
          {getInitials(workload.member.name)}
        </div>
        <div className="workload-row__body">
          <div className="workload-row__heading">
            <span className="workload-row__identity">
              <strong>{workload.member.name}</strong>
              <span>
                {t("dashboard.workload.activeRisk", {
                  active: formatNumber(workload.active),
                  risk: formatNumber(workload.atRisk),
                })}
              </span>
            </span>
            <StatusBadge
              compact
              tone={workloadSignalTone(signal)}
              label={signalLabel}
            />
          </div>
          <dl className="workload-row__stats">
            <div>
              <dt>{t("team.assigned")}</dt>
              <dd>{formatNumber(workload.assigned)}</dd>
            </div>
            <div>
              <dt>{t("dashboard.summary.completed")}</dt>
              <dd>{formatNumber(workload.completed)}</dd>
            </div>
            <div>
              <dt>{t("dashboard.summary.active")}</dt>
              <dd>{formatNumber(workload.active)}</dd>
            </div>
            <div>
              <dt>{t("dashboard.summary.blocked")}</dt>
              <dd>{formatNumber(workload.blocked)}</dd>
            </div>
            <div>
              <dt>{t("dashboard.summary.overdue")}</dt>
              <dd>{formatNumber(workload.overdue)}</dd>
            </div>
          </dl>
          {completion !== null && (
            <div
              className="progress-track"
              role="progressbar"
              aria-label={t("dashboard.workload.progressLabel", {
                name: workload.member.name,
              })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion}
            >
              <span style={{ width: `${completion}%` }} />
            </div>
          )}
        </div>
        <strong
          className="workload-row__count"
          aria-hidden={completion === null ? true : undefined}
        >
          {completion === null ? "—" : formatPercent(completion)}
        </strong>
      </article>
    );
  }

  return (
    <section className="panel panel--workload" aria-labelledby="workload-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{t("dashboard.workload.eyebrow")}</p>
          <h2 id="workload-title">{t("dashboard.workload.title")}</h2>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => onNavigate("/team")}
        >
          {t("dashboard.workload.view")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      {workloads.length === 0 ? (
        <EmptyState
          title={t("dashboard.workload.empty.title")}
          description={t("dashboard.workload.empty.description")}
        />
      ) : (
        <div className="workload-list">
          {preview.map(renderWorkload)}
          {overflow.length > 0 && (
            <details
              className="dashboard-overflow"
              open={expanded}
              onToggle={(event) => setExpanded(event.currentTarget.open)}
            >
              <summary className="dashboard-overflow__summary">
                {expanded
                  ? t("dashboard.workload.collapse")
                  : plural(overflow.length, {
                      one: "dashboard.workload.expand.one",
                      other: "dashboard.workload.expand.other",
                    })}
              </summary>
              <div className="dashboard-overflow__content">
                {overflow.map(renderWorkload)}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
