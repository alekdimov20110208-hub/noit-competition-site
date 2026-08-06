import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { translate } from "../i18n/messages.ts";
import { PreferencesContext, type PreferencesContextValue } from "./context.ts";
import {
  detectDeviceLanguage,
  loadPreferences,
  resolvePreferenceSelection,
  savePreferences,
  type PreferenceStorage,
} from "./storage.ts";
import {
  observeSystemTheme,
  readSystemTheme,
  resolveTheme,
  THEME_META_COLORS,
  type MatchMedia,
} from "./theme.ts";
import type {
  Language,
  PreferenceStorageError,
  ResolvedTheme,
  StoredPreferences,
  ThemePreference,
} from "./types.ts";

interface InitialPreferenceState {
  preferences: StoredPreferences;
  deviceLanguage: Language;
  systemTheme: ResolvedTheme;
  storage: PreferenceStorage | null;
  storageError: PreferenceStorageError | null;
}

interface BrowserStorageResult {
  storage: PreferenceStorage | null;
  error: Extract<PreferenceStorageError, "read"> | null;
}

function getBrowserStorage(): BrowserStorageResult {
  if (typeof window === "undefined") {
    return { storage: null, error: null };
  }

  try {
    return { storage: window.localStorage, error: null };
  } catch {
    return { storage: null, error: "read" };
  }
}

function getMatchMedia(): MatchMedia | null {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }
  return window.matchMedia.bind(window);
}

function getInitialState(): InitialPreferenceState {
  const browserStorage = getBrowserStorage();
  const loaded = loadPreferences(browserStorage.storage);
  const deviceLanguage =
    typeof navigator === "undefined"
      ? "en"
      : detectDeviceLanguage(
          navigator.languages.length > 0
            ? navigator.languages
            : navigator.language,
        );

  return {
    preferences: loaded.preferences,
    deviceLanguage,
    systemTheme: readSystemTheme(getMatchMedia()),
    storage: browserStorage.storage,
    storageError: browserStorage.error ?? loaded.error,
  };
}

function applyDocumentPreferences(
  language: Language,
  resolvedTheme: ResolvedTheme,
): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.lang = language;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  document.title = translate(language, "meta.title");

  const description = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  );
  if (description) {
    description.content = translate(language, "meta.description");
  }

  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (themeColor) {
    themeColor.content = THEME_META_COLORS[resolvedTheme];
  }
}

interface PreferencesProviderProps {
  children: ReactNode;
}

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const [initial] = useState(getInitialState);
  const [preferences, setPreferences] = useState(initial.preferences);
  const [systemTheme, setSystemTheme] = useState(initial.systemTheme);
  const [storageError, setStorageError] = useState(initial.storageError);
  const preferencesRef = useRef(preferences);
  const storageRef = useRef(initial.storage);

  const { language, themePreference } = resolvePreferenceSelection(
    preferences,
    initial.deviceLanguage,
  );
  const resolvedTheme = resolveTheme(themePreference, systemTheme === "dark");

  const commitPreferences = useCallback((next: StoredPreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
    const result = savePreferences(storageRef.current, next);
    setStorageError(result.error);
  }, []);

  const setLanguage = useCallback(
    (nextLanguage: Language) => {
      commitPreferences({
        ...preferencesRef.current,
        version: 1,
        language: nextLanguage,
      });
    },
    [commitPreferences],
  );

  const setThemePreference = useCallback(
    (nextTheme: ThemePreference) => {
      commitPreferences({
        ...preferencesRef.current,
        version: 1,
        theme: nextTheme,
      });
    },
    [commitPreferences],
  );

  useEffect(() => {
    if (themePreference !== "system") return;
    const matchMedia = getMatchMedia();
    if (!matchMedia) return;

    setSystemTheme(readSystemTheme(matchMedia));
    try {
      return observeSystemTheme(matchMedia, setSystemTheme);
    } catch {
      return;
    }
  }, [themePreference]);

  useLayoutEffect(() => {
    applyDocumentPreferences(language, resolvedTheme);
  }, [language, resolvedTheme]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      themePreference,
      resolvedTheme,
      storageError,
      setLanguage,
      setThemePreference,
    }),
    [
      language,
      resolvedTheme,
      setLanguage,
      setThemePreference,
      storageError,
      themePreference,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
