import { useMemo } from "react";
import { usePreferences } from "../preferences/usePreferences.ts";
import { createI18n, type I18nApi } from "./createI18n.ts";

export function useI18n(): I18nApi {
  const { language } = usePreferences();
  return useMemo(() => createI18n(language), [language]);
}
