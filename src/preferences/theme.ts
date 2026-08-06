import type { ResolvedTheme, ThemePreference } from "./types.ts";

export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export const THEME_META_COLORS: Record<ResolvedTheme, string> = {
  light: "#f4f1eb",
  dark: "#0b111a",
};

export type MatchMedia = (query: string) => MediaQueryList;

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  return systemPrefersDark ? "dark" : "light";
}

export function readSystemTheme(
  matchMedia: MatchMedia | null | undefined,
): ResolvedTheme {
  if (!matchMedia) return "light";

  try {
    return matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function observeSystemTheme(
  matchMedia: MatchMedia,
  listener: (theme: ResolvedTheme) => void,
): () => void {
  const mediaQuery = matchMedia(SYSTEM_DARK_QUERY);
  const handleChange = (event: MediaQueryListEvent) => {
    listener(event.matches ? "dark" : "light");
  };

  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
}
