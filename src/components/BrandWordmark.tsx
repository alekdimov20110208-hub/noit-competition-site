import { useI18n } from "../i18n/index.ts";

interface BrandWordmarkProps {
  compact?: boolean;
}

// Replace this isolated component when the author's final hand-drawn logo is ready.
export function BrandWordmark({ compact = false }: BrandWordmarkProps) {
  const { t } = useI18n();

  return (
    <div className="brand-wordmark" aria-label="BudoGraph">
      <span className="brand-wordmark__text">BudoGraph</span>
      {!compact && (
        <span className="brand-wordmark__tag">{t("brand.tagline")}</span>
      )}
    </div>
  );
}
