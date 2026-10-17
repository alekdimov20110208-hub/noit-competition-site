import {
  curatedCategories,
  curatedDifficulties,
  isCuratedIdentity,
  isCuratedItemId,
  type CuratedTemplate,
} from "../domain/curatedTemplates.ts";
import { resolveTemplateDeadline } from "../domain/templateDates.ts";
import { TemplateFailure } from "./templateApplications.ts";

function invalid(): never {
  throw new TemplateFailure("invalid");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
}
function keys(row: Record<string, unknown>, allowed: string[]) {
  if (
    Object.keys(row).length !== allowed.length ||
    Object.keys(row).some((key) => !allowed.includes(key))
  )
    invalid();
}
function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim() && value.length <= max
    ? value
    : invalid();
}
function localized(value: unknown, max: number) {
  const row = record(value);
  keys(row, ["bg", "en"]);
  const result = { bg: text(row.bg, max), en: text(row.en, max) };
  if (result.bg === result.en || !/[А-Яа-я]/u.test(result.bg)) invalid();
  return result;
}
export function readCuratedCatalog(value: unknown): CuratedTemplate[] {
  const row = record(value);
  keys(row, ["catalogVersion", "templates"]);
  if (
    row.catalogVersion !== 1 ||
    !Array.isArray(row.templates) ||
    row.templates.length > 50
  )
    invalid();
  const ids = new Set<string>();
  return row.templates.map((value): CuratedTemplate => {
    const entry = record(value);
    keys(entry, [
      "kind",
      "id",
      "version",
      "name",
      "description",
      "audience",
      "category",
      "difficulty",
      "durationDays",
      "items",
      "itemCount",
    ]);
    const id = text(entry.id, 100);
    if (
      !isCuratedIdentity(id) ||
      ids.has(id) ||
      entry.kind !== "curated" ||
      entry.version !== 1 ||
      !curatedCategories.some((category) => category === entry.category) ||
      !curatedDifficulties.some(
        (difficulty) => difficulty === entry.difficulty,
      ) ||
      (entry.durationDays !== null &&
        (!Number.isSafeInteger(entry.durationDays) ||
          Number(entry.durationDays) < 1 ||
          Number(entry.durationDays) > 31)) ||
      !Array.isArray(entry.items) ||
      entry.items.length < 6 ||
      entry.items.length > 50 ||
      entry.itemCount !== entry.items.length
    )
      invalid();
    ids.add(id);
    const itemIds = new Set<string>();
    const items = entry.items.map((value): CuratedTemplate["items"][number] => {
      const item = record(value);
      keys(item, [
        "id",
        "dayOffset",
        "priority",
        "deadlineTime",
        "reminderOffsets",
        "text",
      ]);
      const itemId = text(item.id, 100);
      if (
        !isCuratedItemId(itemId) ||
        itemIds.has(itemId) ||
        !["normal", "important", "critical"].includes(String(item.priority)) ||
        !Number.isSafeInteger(item.dayOffset) ||
        Math.abs(Number(item.dayOffset)) > 3660 ||
        !Array.isArray(item.reminderOffsets) ||
        item.reminderOffsets.length ||
        (item.deadlineTime !== null &&
          (typeof item.deadlineTime !== "string" ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.deadlineTime)))
      )
        invalid();
      itemIds.add(itemId);
      // Validation only; dates for the selected Event are resolved separately.
      resolveTemplateDeadline(
        "2026-11-20",
        Number(item.dayOffset),
        item.deadlineTime as string | null,
      );
      const translations = record(item.text);
      keys(translations, ["bg", "en"]);
      const readText = (value: unknown) => {
        const t = record(value);
        keys(t, ["title", "category", "context"]);
        return {
          title: text(t.title, 200),
          category: text(t.category, 100),
          context: text(t.context, 5000),
        };
      };
      const content = {
        bg: readText(translations.bg),
        en: readText(translations.en),
      };
      if (
        content.bg.title === content.en.title ||
        content.bg.context === content.en.context ||
        !/[А-Яа-я]/u.test(content.bg.context)
      )
        invalid();
      return {
        id: itemId,
        dayOffset: item.dayOffset as number,
        deadlineTime: item.deadlineTime as string | null,
        priority: item.priority as CuratedTemplate["items"][number]["priority"],
        reminderOffsets: [],
        text: content,
      };
    });
    return {
      kind: "curated",
      id,
      version: 1,
      name: localized(entry.name, 200),
      description: localized(entry.description, 2000),
      audience: localized(entry.audience, 2000),
      category: entry.category as CuratedTemplate["category"],
      difficulty: entry.difficulty as CuratedTemplate["difficulty"],
      durationDays: entry.durationDays as number | null,
      itemCount: items.length,
      items,
    };
  });
}
export async function fetchCuratedCatalog(
  signal: AbortSignal,
  transport: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await transport("/api/templates/curated", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch {
    throw new TemplateFailure("unavailable");
  }
  if (!response.ok)
    throw new TemplateFailure(
      response.status === 401 ? "unauthenticated" : "unavailable",
    );
  try {
    return readCuratedCatalog(await response.json());
  } catch {
    throw new TemplateFailure("invalid");
  }
}
