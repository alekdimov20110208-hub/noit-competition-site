export { PreferencesProvider } from "./PreferencesProvider.tsx";
export { PreferencesContext, type PreferencesContextValue } from "./context.ts";
export { usePreferences } from "./usePreferences.ts";
export {
  detectDeviceLanguage,
  isLanguage,
  isThemePreference,
  loadPreferences,
  parsePreferences,
  resolvePreferenceSelection,
  savePreferences,
  type LoadPreferencesResult,
  type PreferenceStorage,
  type ResolvedPreferenceSelection,
  type SavePreferencesResult,
} from "./storage.ts";
export {
  observeSystemTheme,
  readSystemTheme,
  resolveTheme,
  SYSTEM_DARK_QUERY,
  THEME_META_COLORS,
  type MatchMedia,
} from "./theme.ts";
export {
  EMPTY_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  type Language,
  type PreferenceStorageError,
  type ResolvedTheme,
  type StoredPreferences,
  type ThemePreference,
} from "./types.ts";
