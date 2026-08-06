import type { TaskCounts } from "../../domain/workspace.ts";
import { useI18n } from "../../i18n/index.ts";

interface OperationalSummaryProps {
  counts: TaskCounts;
}

export function OperationalSummary({ counts }: OperationalSummaryProps) {
  const { t, formatNumber } = useI18n();

  return (
    <section
      className="panel operational-summary"
      aria-labelledby="operational-summary-title"
    >
      <div className="panel__header">
        <div>
          <p className="eyebrow">{t("dashboard.summary.label")}</p>
          <h2 id="operational-summary-title">{t("dashboard.summary.tasks")}</h2>
        </div>
      </div>
      <dl className="operational-summary__metrics">
        <div className="operational-metric">
          <dt>{t("dashboard.summary.total")}</dt>
          <dd>{formatNumber(counts.total)}</dd>
        </div>
        <div className="operational-metric operational-metric--success">
          <dt>{t("dashboard.summary.completed")}</dt>
          <dd>{formatNumber(counts.completed)}</dd>
        </div>
        <div className="operational-metric operational-metric--progress">
          <dt>{t("dashboard.summary.active")}</dt>
          <dd>{formatNumber(counts.active)}</dd>
        </div>
        <div className="operational-metric operational-metric--blocked">
          <dt>{t("dashboard.summary.blocked")}</dt>
          <dd>{formatNumber(counts.blocked)}</dd>
        </div>
        <div className="operational-metric operational-metric--warning">
          <dt>{t("dashboard.summary.overdue")}</dt>
          <dd>{formatNumber(counts.overdue)}</dd>
        </div>
      </dl>
      <p className="operational-summary__explanation">
        <strong>
          {t("dashboard.summary.completed")} + {t("dashboard.summary.active")} +{" "}
          {t("dashboard.summary.blocked")} = {t("dashboard.summary.total")}
        </strong>
        <span>
          {t("dashboard.summary.active")}: {t("dashboard.summary.activeHint")} ·{" "}
          {t("dashboard.summary.overdue")}: {t("dashboard.summary.overdueHint")}
        </span>
      </p>
    </section>
  );
}
