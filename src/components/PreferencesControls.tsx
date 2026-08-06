import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useI18n, type MessageKey } from "../i18n/index.ts";
import {
  usePreferences,
  type Language,
  type ThemePreference,
} from "../preferences/index.ts";

interface LanguageOption {
  value: Language;
  shortLabelKey: MessageKey;
  actionLabelKey: MessageKey;
}

const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  {
    value: "bg",
    shortLabelKey: "preferences.language.short.bg",
    actionLabelKey: "preferences.language.select.bg",
  },
  {
    value: "en",
    shortLabelKey: "preferences.language.short.en",
    actionLabelKey: "preferences.language.select.en",
  },
];

interface ThemeOption {
  value: ThemePreference;
  icon: LucideIcon;
  actionLabelKey: MessageKey;
}

const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    value: "system",
    icon: Monitor,
    actionLabelKey: "preferences.theme.select.system",
  },
  {
    value: "light",
    icon: Sun,
    actionLabelKey: "preferences.theme.select.light",
  },
  {
    value: "dark",
    icon: Moon,
    actionLabelKey: "preferences.theme.select.dark",
  },
];

export function PreferencesControls() {
  const { t } = useI18n();
  const { language, themePreference, setLanguage, setThemePreference } =
    usePreferences();

  return (
    <div className="preference-controls">
      <fieldset
        className="preference-group"
        title={t("preferences.language.group")}
      >
        <legend className="sr-only">{t("preferences.language.group")}</legend>
        {LANGUAGE_OPTIONS.map((option) => {
          const actionLabel = t(option.actionLabelKey);
          return (
            <button
              key={option.value}
              type="button"
              className="preference-button"
              aria-label={actionLabel}
              aria-pressed={language === option.value}
              title={actionLabel}
              onClick={() => setLanguage(option.value)}
            >
              {t(option.shortLabelKey)}
            </button>
          );
        })}
      </fieldset>

      <fieldset
        className="preference-group"
        title={t("preferences.theme.control")}
      >
        <legend className="sr-only">{t("preferences.theme.group")}</legend>
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const actionLabel = t(option.actionLabelKey);
          return (
            <button
              key={option.value}
              type="button"
              className="preference-button"
              aria-label={actionLabel}
              aria-pressed={themePreference === option.value}
              title={actionLabel}
              onClick={() => setThemePreference(option.value)}
            >
              <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
