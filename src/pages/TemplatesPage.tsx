import {
  Check,
  ClipboardCopy,
  Info,
  RefreshCcw,
  RotateCcw,
  X,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/PageHeader.tsx";
import type { WorkspaceState } from "../domain/types.ts";
import { useI18n } from "../i18n/index.ts";

interface TemplatesPageProps {
  state: WorkspaceState;
  onReset: () => void;
}

export function TemplatesPage({ state, onReset }: TemplatesPageProps) {
  const { formatNumber, plural, t } = useI18n();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const template = state.templates[0];

  function resetDemo() {
    onReset();
    setShowConfirmation(false);
    setShowSuccess(true);
  }

  if (!template) {
    return (
      <div className="page">
        <PageHeader
          eyebrow={t("templates.eyebrow")}
          title={t("templates.title")}
          description={t("templates.empty")}
        />
      </div>
    );
  }

  const itemCount = template.areas.reduce(
    (total, area) => total + area.items.length,
    0,
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow={t("templates.eyebrow")}
        title={t("templates.title")}
        description={t("templates.description")}
      />

      {showSuccess && (
        <div className="notice notice--success" role="status">
          <Check size={18} aria-hidden="true" />
          <span>{t("templates.restored")}</span>
          <button
            type="button"
            className="icon-button icon-button--small"
            aria-label={t("templates.dismissConfirmation")}
            onClick={() => setShowSuccess(false)}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="template-hero" aria-labelledby="template-name">
        <div className="template-hero__icon" aria-hidden="true">
          <ClipboardCopy size={28} />
        </div>
        <div className="template-hero__content">
          <p className="eyebrow">{t("templates.baseline")}</p>
          <h2 id="template-name">{template.name}</h2>
          <p>{template.description}</p>
          <div className="template-hero__meta">
            <span>
              {plural(template.durationDays, {
                one: "templates.duration.one",
                other: "templates.duration.other",
              })}
            </span>
            <span>
              {plural(template.areas.length, {
                one: "templates.areas.one",
                other: "templates.areas.other",
              })}
            </span>
            <span>
              {plural(itemCount, {
                one: "templates.prompts.one",
                other: "templates.prompts.other",
              })}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setShowConfirmation(true)}
        >
          <RotateCcw size={16} aria-hidden="true" /> {t("templates.reset")}
        </button>
      </section>

      {showConfirmation && (
        <section className="reset-confirmation" aria-labelledby="reset-title">
          <span aria-hidden="true">
            <RefreshCcw size={22} />
          </span>
          <div>
            <h2 id="reset-title">{t("templates.reset.title")}</h2>
            <p>{t("templates.reset.description")}</p>
          </div>
          <div>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setShowConfirmation(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={resetDemo}
            >
              {t("templates.reset.confirm")}
            </button>
          </div>
        </section>
      )}

      <div className="template-note">
        <Info size={18} aria-hidden="true" />
        <p>
          <strong>{t("templates.preview.title")}</strong>{" "}
          {t("templates.preview.description")}
        </p>
      </div>

      <section
        className="template-area-grid"
        aria-label={t("templates.areaLabel")}
      >
        {template.areas.map((area, index) => (
          <article className="template-area" key={area.name}>
            <span className="template-area__number" aria-hidden="true">
              {formatNumber(index + 1, {
                minimumIntegerDigits: 2,
                useGrouping: false,
              })}
            </span>
            <h2>{area.name}</h2>
            <ul>
              {area.items.map((item) => (
                <li key={item}>
                  <span aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
