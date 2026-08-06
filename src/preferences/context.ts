import { createContext } from "react";
import type {
  Language,
  PreferenceStorageError,
  ResolvedTheme,
  ThemePreference,
} from "./types.ts";

export interface PreferencesContextValue {
  language: Language;
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  storageError: PreferenceStorageError | null;
  setLanguage: (language: Language) => void;
  setThemePreference: (theme: ThemePreference) => void;
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(
  null,
);
