import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useI18n } from "../../i18n/index.ts";
import { usePreferences } from "../../preferences/index.ts";
import "./product-showcase.css";

const MODULES = [
  { id: "tasks", icon: ClipboardList },
  { id: "kanban", icon: LayoutGrid },
  { id: "calendar", icon: CalendarDays },
  { id: "team", icon: Users },
  { id: "templates", icon: RefreshCw },
  { id: "changes", icon: ShieldAlert },
] as const;

export function ProductShowcase() {
  const { t } = useI18n();
  const { language } = usePreferences();
  // Light captures keep the register readable against either landing theme.
  const image = `/landing/product/tasks-${language}-light`;
  return (
    <div className="landing-product-showcase">
      <ul className="landing-product-modules">
        {MODULES.map(({ id, icon: Icon }) => (
          <li key={id}>
            <Icon size={20} aria-hidden="true" />
            <div>
              <h3>{t(`landing.${id}Title`)}</h3>
              <p>{t(`landing.${id}Body`)}</p>
            </div>
          </li>
        ))}
      </ul>
      <figure className="landing-product-figure">
        <a
          className="landing-product-image-link"
          href={`${image}.webp`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("landing.screenshotOpen")}
        >
          <img
            src={`${image}-1600.webp`}
            srcSet={`${image}-960.webp 960w, ${image}-1600.webp 1600w, ${image}.webp 3200w`}
            sizes="(min-width: 1440px) 940px, (min-width: 1100px) 66vw, calc(100vw - 48px)"
            width={3200}
            height={2100}
            loading="lazy"
            decoding="async"
            alt={t("landing.screenshotAlt")}
          />
        </a>
        <figcaption>
          <span>{t("landing.screenshotCaption")}</span>
          <a href={`${image}.webp`} target="_blank" rel="noopener noreferrer">
            {t("landing.screenshotFull")}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </figcaption>
      </figure>
    </div>
  );
}
