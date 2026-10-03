import type { TaskReadState } from "../services/taskReadState.ts";
import { useI18n } from "../i18n/index.ts";
import { EmptyState } from "./EmptyState.tsx";

export function WorkspaceReadNotice({
  state,
  team,
  onRetry,
}: {
  state: TaskReadState;
  team: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={team ? "page team-page" : "page page--dashboard"}
      aria-busy={state.status === "loading" || undefined}
    >
      <header
        className={team ? "team-page__heading" : "dashboard-section-heading"}
      >
        <h1>{t(team ? "team.title" : "nav.dashboard")}</h1>
      </header>
      {state.status === "ready" ? (
        <EmptyState
          title={t("tasks.remote.noEvent.title")}
          description={t("tasks.remote.noEvent.description")}
        />
      ) : (
        <div
          className="notice"
          role={state.status === "error" ? "alert" : "status"}
        >
          <span>
            {t(
              state.status === "loading"
                ? "workspace.loading"
                : state.error === "forbidden"
                  ? "workspace.forbidden"
                  : "workspace.error",
            )}
          </span>
          {state.status === "error" && (
            <button
              type="button"
              className="button button--secondary"
              onClick={onRetry}
            >
              {t("tasks.remote.retry")}
            </button>
          )}
        </div>
      )}
      {state.status === "ready" && (
        <button
          type="button"
          className="button button--secondary"
          onClick={onRetry}
        >
          {t("tasks.remote.retry")}
        </button>
      )}
    </div>
  );
}
