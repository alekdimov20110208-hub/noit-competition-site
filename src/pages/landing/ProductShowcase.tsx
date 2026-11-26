import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
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

type ModuleId = (typeof MODULES)[number]["id"];
type LoadedImage = { image: string; url: string; alt: string };

function ShowcaseImage({ image, alt }: { image: string; alt: string }) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<{
    current: LoadedImage | null;
    previous: LoadedImage | null;
  }>({ current: null, previous: null });
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestedImage = useRef(image);
  requestedImage.current = image;
  const ready = loaded.current?.image === image;
  const error = failed === image;
  const previous = ready ? loaded.previous : loaded.current;
  return (
    <div className="landing-product-image-frame" aria-busy={!ready && !error}>
      {!error && previous && (
        <img
          className="landing-product-image-previous"
          src={previous.url}
          alt=""
          aria-hidden="true"
          width={3200}
          height={2100}
        />
      )}
      {!error && (
        <a
          className="landing-product-image-link"
          href={`${image}.webp`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t("landing.screenshotOpen")} — ${alt}`}
        >
          <img
            key={`${image}-${attempt}`}
            className={ready ? "is-ready" : "is-loading"}
            src={`${image}-1600.webp`}
            srcSet={`${image}-960.webp 960w, ${image}-1600.webp 1600w`}
            sizes="(min-width: 1440px) 940px, (min-width: 1100px) 66vw, calc(100vw - 48px)"
            width={3200}
            height={2100}
            loading="lazy"
            decoding="async"
            alt={alt}
            onLoad={async (event) => {
              const element = event.currentTarget;
              try {
                await element.decode();
              } catch {
                if (requestedImage.current === image) setFailed(image);
                return;
              }
              if (requestedImage.current !== image) return;
              setLoaded((state) => ({
                previous:
                  state.current?.image === image
                    ? state.previous
                    : state.current,
                current: { image, url: element.currentSrc, alt },
              }));
            }}
            onError={() => {
              if (requestedImage.current === image) setFailed(image);
            }}
          />
        </a>
      )}
      {!ready && !error && (
        <span className="landing-product-image-status" role="status">
          {t("landing.screenshotLoading")}
        </span>
      )}
      {error && (
        <div className="landing-product-image-error" role="status">
          <p>{t("landing.screenshotError")}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(null);
              setAttempt((value) => value + 1);
            }}
          >
            {t("landing.screenshotRetry")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ProductShowcase() {
  const { t } = useI18n();
  const { language } = usePreferences();
  const [selected, setSelected] = useState<ModuleId>("tasks");
  const figure = useRef<HTMLElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Light captures keep the register readable against either landing theme.
  const image = `/landing/product/${selected}-${language}-light`;
  const title = t(`landing.${selected}Title`);
  function select(id: ModuleId) {
    setSelected(id);
    if (window.matchMedia("(max-width: 1099px)").matches)
      figure.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? MODULES.length - 1
          : ["ArrowDown", "ArrowRight"].includes(event.key)
            ? (index + 1) % MODULES.length
            : ["ArrowUp", "ArrowLeft"].includes(event.key)
              ? (index + MODULES.length - 1) % MODULES.length
              : null;
    if (next === null) return;
    event.preventDefault();
    buttons.current[next]?.focus({ preventScroll: true });
    select(MODULES[next]!.id);
  }
  return (
    <div className="landing-product-showcase">
      <ul className="landing-product-modules">
        {MODULES.map(({ id, icon: Icon }, index) => (
          <li key={id}>
            <button
              type="button"
              className="landing-product-module"
              aria-pressed={selected === id}
              aria-controls="landing-product-screen"
              aria-labelledby={`landing-module-${id}`}
              ref={(button) => {
                buttons.current[index] = button;
              }}
              onClick={() => select(id)}
              onKeyDown={(event) => navigate(event, index)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>
                <span
                  className="landing-product-module-title"
                  id={`landing-module-${id}`}
                >
                  {t(`landing.${id}Title`)}
                </span>
                <span className="landing-product-module-body">
                  {t(`landing.${id}Body`)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <figure
        className="landing-product-figure"
        id="landing-product-screen"
        ref={figure}
        aria-label={title}
      >
        <ShowcaseImage
          image={image}
          alt={`${title} — ${t("landing.screenshotCaption")}`}
        />
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
