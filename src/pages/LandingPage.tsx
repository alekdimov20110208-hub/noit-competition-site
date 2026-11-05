import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutGrid,
  Menu,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { BrandWordmark } from "../components/BrandWordmark.tsx";
import { PreferencesControls } from "../components/PreferencesControls.tsx";
import { useI18n } from "../i18n/index.ts";
import {
  FeatureExample,
  WorkspaceExample,
} from "./landing/ProductExamples.tsx";
import "./landing/landing.css";

const MODULES = [
  { id: "tasks", icon: ClipboardList },
  { id: "kanban", icon: LayoutGrid },
  { id: "calendar", icon: CalendarDays },
  { id: "team", icon: Users },
  { id: "templates", icon: RefreshCw },
  { id: "changes", icon: ShieldAlert },
] as const;

const SECTIONS = [
  { id: "features", label: "landing.features" },
  { id: "why-budograph", label: "landing.why" },
  { id: "how-it-works", label: "landing.how" },
  { id: "faq", label: "landing.faq" },
] as const;

const BENEFITS = [1, 2, 3] as const;
const STEPS = [1, 2, 3, 4, 5] as const;
const FAQ = [1, 2, 3, 4, 5, 6, 7] as const;

function LandingHeader({ signupEnabled }: { signupEnabled: boolean }) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  return (
    <header className="landing-header">
      <div
        className="landing-container landing-header-inner"
        onKeyDown={(event) => {
          if (event.key === "Escape" && menuOpen) {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <a className="landing-brand" href="/" aria-label="BudoGraph">
          <BrandWordmark compact />
        </a>
        <button
          type="button"
          className="landing-menu"
          ref={menuButton}
          aria-expanded={menuOpen}
          aria-controls="landing-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Menu size={17} aria-hidden="true" />
          <span className="landing-menu-label">{t("landing.menu")}</span>
        </button>
        <nav
          className="landing-nav"
          id="landing-nav"
          aria-label={t("landing.nav")}
          data-open={menuOpen}
        >
          {SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => {
                if (menuOpen)
                  document.getElementById(id)?.focus({ preventScroll: true });
                setMenuOpen(false);
              }}
            >
              {t(label)}
            </a>
          ))}
        </nav>
        <div className="landing-header-actions">
          <PreferencesControls />
          {signupEnabled && (
            <a className="landing-header-signup" href="/signup">
              {t("landing.createAccount")}
            </a>
          )}
          <a
            className="button button--secondary landing-header-login"
            href="/login"
          >
            {t("landing.signIn")}
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}

export function LandingPage({
  signupEnabled,
}: {
  signupEnabled: boolean | null;
}) {
  const { t } = useI18n();
  const accessDetail =
    signupEnabled === null
      ? null
      : t(signupEnabled ? "landing.accessOpen" : "landing.accessClosed");
  return (
    <div className="landing">
      <a className="landing-skip" href="#main-content">
        {t("landing.skip")}
      </a>
      <LandingHeader signupEnabled={signupEnabled === true} />
      <main id="main-content" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero-inner">
            <div className="landing-hero-copy">
              <p className="landing-kicker">{t("landing.eyebrow")}</p>
              <h1 id="landing-title">
                {t("landing.heroLead")} <span>{t("landing.heroClose")}</span>
              </h1>
              <p className="landing-hero-lead">{t("landing.heroBody")}</p>
              <div className="landing-actions">
                <a className="button button--primary" href="/login">
                  {t("landing.signIn")}
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a className="landing-anchor" href="#how-it-works">
                  {t("landing.seeHow")}
                  <ArrowDown size={16} aria-hidden="true" />
                </a>
              </div>
              <p className="landing-hero-examples">
                {t("landing.heroExamples")}
              </p>
            </div>
            <WorkspaceExample />
          </div>
        </section>

        <section
          id="why-budograph"
          className="landing-section landing-container landing-why"
          aria-labelledby="landing-why-title"
          tabIndex={-1}
        >
          <div className="landing-section-intro">
            <p className="landing-kicker">{t("landing.why")}</p>
            <h2 id="landing-why-title">{t("landing.whyTitle")}</h2>
            <p>{t("landing.whyBody")}</p>
          </div>
          <ol className="landing-benefits">
            {BENEFITS.map((number) => (
              <li key={number}>
                <span aria-hidden="true">0{number}</span>
                <div>
                  <h3>{t(`landing.why${number}Title`)}</h3>
                  <p>{t(`landing.why${number}Body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="features"
          className="landing-section landing-features"
          aria-labelledby="landing-features-title"
          tabIndex={-1}
        >
          <div className="landing-container">
            <div className="landing-section-intro landing-features-intro">
              <p className="landing-kicker">{t("landing.features")}</p>
              <h2 id="landing-features-title">{t("landing.featureTitle")}</h2>
              <p>{t("landing.featureBody")}</p>
            </div>
            <div className="landing-feature-grid">
              {MODULES.map(({ id, icon: Icon }) => (
                <article key={id} className="landing-feature">
                  <div className="landing-feature-label">
                    <Icon size={20} aria-hidden="true" />
                    <h3>{t(`landing.${id}Title`)}</h3>
                  </div>
                  <p>{t(`landing.${id}Body`)}</p>
                  <figure className="landing-feature-example">
                    <figcaption>{t("landing.example")}</figcaption>
                    <FeatureExample module={id} />
                  </figure>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="landing-section landing-container landing-how"
          aria-labelledby="landing-how-title"
          tabIndex={-1}
        >
          <div className="landing-section-intro">
            <p className="landing-kicker">{t("landing.how")}</p>
            <h2 id="landing-how-title">{t("landing.howTitle")}</h2>
          </div>
          <ol className="landing-steps">
            {STEPS.map((number) => (
              <li key={number}>
                <span aria-hidden="true">0{number}</span>
                <h3>{t(`landing.step${number}Title`)}</h3>
                <p>{t(`landing.step${number}Body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="faq"
          className="landing-section landing-faq"
          aria-labelledby="landing-faq-title"
          tabIndex={-1}
        >
          <div className="landing-container landing-faq-inner">
            <div className="landing-section-intro">
              <p className="landing-kicker">{t("landing.faq")}</p>
              <h2 id="landing-faq-title">{t("landing.faqTitle")}</h2>
              <p>{t("landing.faqIntro")}</p>
            </div>
            <div className="landing-questions">
              {FAQ.map((number) => (
                <details key={number} name="landing-faq">
                  <summary>
                    {t(`landing.faq${number}Question`)}
                    <ChevronDown size={20} aria-hidden="true" />
                  </summary>
                  <p>
                    {number === 7 ? (
                      <>
                        {t("landing.accessBase")}
                        {accessDetail && ` ${accessDetail}`}
                      </>
                    ) : (
                      t(`landing.faq${number}Answer`)
                    )}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-cta" aria-labelledby="landing-cta-title">
          <div className="landing-container landing-cta-inner">
            <div className="landing-section-intro">
              <p className="landing-kicker">BudoGraph</p>
              <h2 id="landing-cta-title">{t("landing.ctaTitle")}</h2>
              <p>
                {t("landing.accessBase")}
                {accessDetail && ` ${accessDetail}`}
              </p>
            </div>
            <div className="landing-actions">
              <a className="button button--primary" href="/login">
                {t("landing.signIn")}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              {signupEnabled === true && (
                <a className="button button--secondary" href="/signup">
                  {t("landing.createAccount")}
                </a>
              )}
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div>
            <a className="landing-brand" href="/" aria-label="BudoGraph">
              <BrandWordmark compact />
            </a>
            <p>{t("landing.footerNote")}</p>
          </div>
          <nav aria-label={t("landing.nav")}>
            {SECTIONS.map(({ id, label }) => (
              <a key={id} href={`#${id}`}>
                {t(label)}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
