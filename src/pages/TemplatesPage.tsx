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

interface TemplatesPageProps {
  state: WorkspaceState;
  onReset: () => void;
}

export function TemplatesPage({ state, onReset }: TemplatesPageProps) {
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
          eyebrow="Reusable structure"
          title="Templates"
          description="No local event template is available."
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
        eyebrow="Reusable structure"
        title="Templates"
        description="Preview a focused seminar baseline and restore the fictional event when you need a clean demonstration."
      />

      {showSuccess && (
        <div className="notice notice--success" role="status">
          <Check size={18} aria-hidden="true" />
          <span>The fictional demonstration event has been restored.</span>
          <button
            type="button"
            className="icon-button icon-button--small"
            aria-label="Dismiss confirmation"
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
          <p className="eyebrow">Seminar baseline</p>
          <h2 id="template-name">{template.name}</h2>
          <p>{template.description}</p>
          <div className="template-hero__meta">
            <span>{template.durationDays}-day event</span>
            <span>{template.areas.length} preparation areas</span>
            <span>{itemCount} checklist prompts</span>
          </div>
        </div>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setShowConfirmation(true)}
        >
          <RotateCcw size={16} aria-hidden="true" /> Reset demo event
        </button>
      </section>

      {showConfirmation && (
        <section className="reset-confirmation" aria-labelledby="reset-title">
          <span aria-hidden="true">
            <RefreshCcw size={22} />
          </span>
          <div>
            <h2 id="reset-title">Restore the original demonstration data?</h2>
            <p>
              This replaces task and change updates stored in this browser with
              the fictional seminar baseline.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setShowConfirmation(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={resetDemo}
            >
              Reset local data
            </button>
          </div>
        </section>
      )}

      <div className="template-note">
        <Info size={18} aria-hidden="true" />
        <p>
          <strong>Preview only.</strong> Phase 1 keeps template editing
          intentionally simple. These prompts create structure; they do not
          replace organizer judgment, venue rules, or direct coordination.
        </p>
      </div>

      <section
        className="template-area-grid"
        aria-label="Template preparation areas"
      >
        {template.areas.map((area, index) => (
          <article className="template-area" key={area.name}>
            <span className="template-area__number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
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
