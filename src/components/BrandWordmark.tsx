import { useI18n } from "../i18n/index.ts";

interface BrandWordmarkProps {
  compact?: boolean;
}

export function BrandWordmark({ compact = false }: BrandWordmarkProps) {
  const { t } = useI18n();

  return (
    <div
      className="brand-wordmark"
      role="img"
      aria-label="BudoGraph"
      aria-description={compact ? undefined : t("brand.tagline")}
    >
      <span className="brand-wordmark__mark" aria-hidden="true">
        <img
          className="brand-wordmark__mark-light"
          src="/brand/budograph-monogram.svg"
          width="28"
          height="28"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <img
          className="brand-wordmark__mark-inverse"
          src="/brand/budograph-monogram-inverse.svg"
          width="28"
          height="28"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </span>
      <span className="brand-wordmark__text">BudoGraph</span>
      {!compact && (
        <span className="brand-wordmark__tag">{t("brand.tagline")}</span>
      )}
    </div>
  );
}
