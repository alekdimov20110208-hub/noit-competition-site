import type { TaskPriority } from "./types.ts";

export const curatedCategories = [
  "aikido",
  "examinations",
  "camps",
  "community",
  "logistics",
  "tournaments",
  "workshops",
  "courses",
] as const;
export const curatedDifficulties = [
  "beginner",
  "standard",
  "advanced",
] as const;
export const isCuratedIdentity = (id: string) =>
  id.length <= 100 && /^curated-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id);
export const isCuratedItemId = (id: string) =>
  id.length <= 100 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id);
export interface CuratedText {
  bg: string;
  en: string;
}
export interface CuratedTemplate {
  kind: "curated";
  id: string;
  version: number;
  name: CuratedText;
  description: CuratedText;
  audience: CuratedText;
  category: (typeof curatedCategories)[number];
  difficulty: (typeof curatedDifficulties)[number];
  durationDays: number | null;
  itemCount: number;
  items: {
    id: string;
    priority: TaskPriority;
    dayOffset: number;
    deadlineTime: string | null;
    reminderOffsets: readonly number[];
    text: {
      bg: { title: string; category: string; context: string };
      en: { title: string; category: string; context: string };
    };
  }[];
}

export function filterCuratedTemplates(
  templates: readonly CuratedTemplate[],
  search: string,
  category: string,
  difficulty: string,
  language: "bg" | "en",
) {
  const terms = search
    .trim()
    .toLocaleLowerCase(language)
    .split(/\s+/)
    .filter(Boolean);
  return templates.filter((entry) => {
    if (
      (category && entry.category !== category) ||
      (difficulty && entry.difficulty !== difficulty)
    )
      return false;
    const text = [
      entry.name[language],
      entry.description[language],
      entry.audience[language],
      ...entry.items.flatMap((item) => [
        item.text[language].title,
        item.text[language].category,
        item.text[language].context,
      ]),
    ]
      .join(" ")
      .toLocaleLowerCase(language);
    return terms.every((term) => text.includes(term));
  });
}
