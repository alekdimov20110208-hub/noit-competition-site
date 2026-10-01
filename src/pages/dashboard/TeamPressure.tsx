import { ArrowRight } from "lucide-react";
import { EmptyState } from "../../components/EmptyState.tsx";
import {
  HIGH_ACTIVE_LOAD_THRESHOLD,
  type TeamWorkload,
} from "../../domain/workspace.ts";
import { useI18n, type MessageKey } from "../../i18n/index.ts";
import { getInitials } from "../../utils/format.ts";
import { DashboardDisclosure } from "./DashboardDisclosure.tsx";
import {
  getWorkloadSignal,
  partitionTeamPressure,
  type WorkloadSignal,
} from "./helpers.ts";

const PRESSURE_PREVIEW_LIMIT = 3;

const WORKLOAD_SIGNAL_KEYS = {
  blocked: "dashboard.workload.signal.blocked",
  overdue: "dashboard.workload.signal.overdue",
  high: "dashboard.workload.signal.high",
  unassigned: "dashboard.workload.signal.unassigned",
  clear: "dashboard.workload.signal.clear",
} satisfies Record<WorkloadSignal, MessageKey>;

interface TeamPressureProps {
  workloads: TeamWorkload[];
  onNavigate: (path: string) => void;
}

export function TeamPressure({ workloads, onNavigate }: TeamPressureProps) {
  const { t, plural, formatNumber } = useI18n();
  const { pressure, quiet } = partitionTeamPressure(workloads);
  const preview = pressure.slice(0, PRESSURE_PREVIEW_LIMIT);
  const overflow = pressure.slice(PRESSURE_PREVIEW_LIMIT);

  function renderPressure(workload: TeamWorkload) {
    const signal = getWorkloadSignal(workload);
    return (
      <article
        className={`pressure-row pressure-row--${signal}`}
        key={workload.member.id}
      >
        <div className="avatar avatar--small" aria-hidden="true">
          {getInitials(workload.member.name)}
        </div>
        <span className="pressure-row__identity">
          <strong>{workload.member.name}</strong>
          <span>{workload.member.role}</span>
        </span>
        <span className="pressure-row__signal">
          {t(WORKLOAD_SIGNAL_KEYS[signal], {
            threshold: formatNumber(HIGH_ACTIVE_LOAD_THRESHOLD),
          })}
        </span>
        <span className="pressure-row__counts">
          {t("dashboard.workload.pressureSummary", {
            blocked: formatNumber(workload.blocked),
            overdue: formatNumber(workload.overdue),
            active: formatNumber(workload.active),
          })}
        </span>
      </article>
    );
  }

  return (
    <section className="team-pressure" aria-labelledby="team-pressure-title">
      <header className="dashboard-section-heading dashboard-section-heading--action">
        <div>
          <h2 id="team-pressure-title">{t("dashboard.workload.title")}</h2>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => onNavigate("/team")}
        >
          {t("dashboard.workload.view")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </header>
      <p className="dashboard-section-description">
        {t("dashboard.workload.description")}
      </p>

      {workloads.length === 0 ? (
        <EmptyState
          title={t("dashboard.workload.empty.title")}
          description={t("dashboard.workload.empty.description")}
        />
      ) : pressure.length === 0 ? (
        <EmptyState
          title={t("dashboard.workload.noPressure.title")}
          description={t("dashboard.workload.noPressure.description")}
        />
      ) : (
        <div className="pressure-list">
          {preview.map(renderPressure)}
          {overflow.length > 0 && (
            <DashboardDisclosure
              className="team-pressure__overflow"
              expandedLabel={t("dashboard.workload.collapse")}
              collapsedLabel={plural(overflow.length, {
                one: "dashboard.workload.expand.one",
                other: "dashboard.workload.expand.other",
              })}
            >
              <div>{overflow.map(renderPressure)}</div>
            </DashboardDisclosure>
          )}
        </div>
      )}

      {quiet.length > 0 && (
        <DashboardDisclosure
          className="team-pressure__quiet"
          expandedLabel={t("dashboard.workload.collapse")}
          collapsedLabel={plural(quiet.length, {
            one: "dashboard.workload.quiet.one",
            other: "dashboard.workload.quiet.other",
          })}
        >
          <ul>
            {quiet.map((workload) => (
              <li key={workload.member.id}>{workload.member.name}</li>
            ))}
          </ul>
        </DashboardDisclosure>
      )}
    </section>
  );
}
