import assert from "node:assert/strict";
import test from "node:test";
import {
  detectDeviceLanguage,
  loadPreferences,
  parsePreferences,
  resolvePreferenceSelection,
  savePreferences,
  type PreferenceStorage,
} from "./storage.ts";
import {
  observeSystemTheme,
  readSystemTheme,
  resolveTheme,
  SYSTEM_DARK_QUERY,
} from "./theme.ts";
import { PREFERENCES_STORAGE_KEY } from "./types.ts";

class MemoryStorage implements PreferenceStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test("device-language detection selects Bulgarian only for a primary bg locale", () => {
  assert.equal(detectDeviceLanguage("bg-BG"), "bg");
  assert.equal(detectDeviceLanguage(["BG", "en-GB"]), "bg");
  assert.equal(detectDeviceLanguage(["en-US", "bg-BG"]), "en");
  assert.equal(detectDeviceLanguage(undefined), "en");
  assert.equal(detectDeviceLanguage(["", "bg-BG"]), "bg");
});

test("preference parsing is versioned and preserves independently valid fields", () => {
  assert.deepEqual(parsePreferences(null), { version: 1 });
  assert.deepEqual(parsePreferences("{broken"), { version: 1 });
  assert.deepEqual(
    parsePreferences(
      JSON.stringify({ version: 1, language: "bg", theme: "dark" }),
    ),
    { version: 1, language: "bg", theme: "dark" },
  );
  assert.deepEqual(
    parsePreferences(
      JSON.stringify({ version: 1, language: "de", theme: "light" }),
    ),
    { version: 1, theme: "light" },
  );
  assert.deepEqual(
    parsePreferences(JSON.stringify({ version: 2, language: "bg" })),
    { version: 1 },
  );
});

test("persisted choices override device defaults while missing choices keep them", () => {
  assert.deepEqual(resolvePreferenceSelection({ version: 1 }, "bg"), {
    language: "bg",
    themePreference: "system",
  });
  assert.deepEqual(
    resolvePreferenceSelection(
      { version: 1, language: "en", theme: "dark" },
      "bg",
    ),
    { language: "en", themePreference: "dark" },
  );
});

test("preference load and explicit save use the isolated v1 storage key", () => {
  const storage = new MemoryStorage();
  assert.deepEqual(loadPreferences(storage), {
    preferences: { version: 1 },
    error: null,
  });

  assert.deepEqual(
    savePreferences(storage, {
      version: 1,
      language: "bg",
      theme: "system",
    }),
    { ok: true, error: null },
  );
  assert.equal(
    storage.values.get(PREFERENCES_STORAGE_KEY),
    JSON.stringify({ version: 1, language: "bg", theme: "system" }),
  );
  assert.deepEqual(loadPreferences(storage), {
    preferences: { version: 1, language: "bg", theme: "system" },
    error: null,
  });
});

test("preference adapters safely report storage failures", () => {
  const failingStorage: PreferenceStorage = {
    getItem() {
      throw new Error("read failed");
    },
    setItem() {
      throw new Error("write failed");
    },
  };

  assert.deepEqual(loadPreferences(failingStorage), {
    preferences: { version: 1 },
    error: "read",
  });
  assert.deepEqual(
    savePreferences(failingStorage, { version: 1, theme: "dark" }),
    { ok: false, error: "write" },
  );
});

test("theme resolution follows explicit preferences and the system fallback", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(readSystemTheme(null), "light");
});

test("system-theme observation emits live matchMedia changes and cleans up", () => {
  let registered: ((event: MediaQueryListEvent) => void) | undefined;
  let removed: ((event: MediaQueryListEvent) => void) | undefined;
  const mediaQuery = {
    matches: false,
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      assert.equal(type, "change");
      if (typeof listener === "function") {
        registered = listener as unknown as (
          event: MediaQueryListEvent,
        ) => void;
      }
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      assert.equal(type, "change");
      if (typeof listener === "function") {
        removed = listener as unknown as (event: MediaQueryListEvent) => void;
      }
    },
  } as unknown as MediaQueryList;
  const observed: string[] = [];
  const matchMedia = (query: string) => {
    assert.equal(query, SYSTEM_DARK_QUERY);
    return mediaQuery;
  };

  const stop = observeSystemTheme(matchMedia, (theme) => observed.push(theme));
  registered?.({ matches: true } as MediaQueryListEvent);
  registered?.({ matches: false } as MediaQueryListEvent);
  stop();

  assert.deepEqual(observed, ["dark", "light"]);
  assert.equal(removed, registered);
});
