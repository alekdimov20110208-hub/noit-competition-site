import {
  EMPTY_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  type Language,
  type PreferenceStorageError,
  type StoredPreferences,
  type ThemePreference,
} from "./types.ts";

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LoadPreferencesResult {
  preferences: StoredPreferences;
  error: Extract<PreferenceStorageError, "read"> | null;
}

export interface SavePreferencesResult {
  ok: boolean;
  error: Extract<PreferenceStorageError, "write"> | null;
}

export interface ResolvedPreferenceSelection {
  language: Language;
  themePreference: ThemePreference;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isLanguage(value: unknown): value is Language {
  return value === "bg" || value === "en";
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function detectDeviceLanguage(
  languageTags: readonly string[] | string | null | undefined,
): Language {
  const tags = typeof languageTags === "string" ? [languageTags] : languageTags;
  const primaryTag = tags?.find((tag) => tag.trim().length > 0);
  return primaryTag?.trim().toLowerCase().startsWith("bg") ? "bg" : "en";
}

export function resolvePreferenceSelection(
  preferences: StoredPreferences,
  deviceLanguage: Language,
): ResolvedPreferenceSelection {
  return {
    language: preferences.language ?? deviceLanguage,
    themePreference: preferences.theme ?? "system",
  };
}

export function parsePreferences(
  serialized: string | null | undefined,
): StoredPreferences {
  if (!serialized) return EMPTY_PREFERENCES;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || parsed.version !== 1) return EMPTY_PREFERENCES;

    const language = isLanguage(parsed.language) ? parsed.language : undefined;
    const theme = isThemePreference(parsed.theme) ? parsed.theme : undefined;

    return {
      version: 1,
      ...(language ? { language } : {}),
      ...(theme ? { theme } : {}),
    };
  } catch {
    return EMPTY_PREFERENCES;
  }
}

export function loadPreferences(
  storage: PreferenceStorage | null | undefined,
): LoadPreferencesResult {
  if (!storage) {
    return { preferences: EMPTY_PREFERENCES, error: null };
  }

  try {
    return {
      preferences: parsePreferences(storage.getItem(PREFERENCES_STORAGE_KEY)),
      error: null,
    };
  } catch {
    return { preferences: EMPTY_PREFERENCES, error: "read" };
  }
}

export function savePreferences(
  storage: PreferenceStorage | null | undefined,
  preferences: StoredPreferences,
): SavePreferencesResult {
  if (!storage) return { ok: false, error: "write" };

  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "write" };
  }
}
