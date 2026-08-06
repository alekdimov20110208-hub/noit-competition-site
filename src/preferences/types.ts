export const PREFERENCES_STORAGE_KEY = "budograph.preferences.v1";

export type Language = "bg" | "en";

export type ThemePreference = "system" | "light" | "dark";

export type ResolvedTheme = Exclude<ThemePreference, "system">;

export interface StoredPreferences {
  version: 1;
  language?: Language;
  theme?: ThemePreference;
}

export type PreferenceStorageError = "read" | "write";

export const EMPTY_PREFERENCES: StoredPreferences = Object.freeze({
  version: 1,
});
