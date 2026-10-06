import type { ChangeError } from "../../services/changes.ts";
import { useI18n } from "../../i18n/index.ts";

export function ChangeReadNotice({
  error,
  onRetry,
}: {
  error: ChangeError | null;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="notice"
      role={error ? "alert" : "status"}
      data-change-read-state={error ? "error" : "loading"}
    >
      <span>{t(error ? `change.error.${error}` : "change.loading")}</span>
      {error && (
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
