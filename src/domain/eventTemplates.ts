import type { TaskPriority } from "./types.ts";
import type { TEMPLATE_EN_MESSAGES } from "../i18n/templateMessages.ts";

type TemplateTextKey = keyof typeof TEMPLATE_EN_MESSAGES;

export interface StarterTemplateItem {
  readonly id: string;
  readonly titleKey: TemplateTextKey;
  readonly categoryKey: TemplateTextKey;
  readonly contextKey: TemplateTextKey;
  readonly priority: TaskPriority;
  readonly dayOffset: number;
  readonly deadlineTime: string | null;
  readonly reminderOffsets: readonly number[];
}

export interface StarterTemplate {
  readonly id: string;
  readonly version: number;
  readonly titleKey: TemplateTextKey;
  readonly descriptionKey: TemplateTextKey;
  readonly items: readonly StarterTemplateItem[];
}

// Curated product content. No Event, Task, owner or saved-template identity.
export const AIKIDO_SEMINAR_STARTER: StarterTemplate = {
  id: "international-aikido-seminar",
  version: 1,
  titleKey: "templates.t1.seminar.title",
  descriptionKey: "templates.t1.seminar.description",
  items: [
    {
      id: "team-briefing",
      titleKey: "templates.t1.team.title",
      categoryKey: "templates.t1.category.team",
      contextKey: "templates.t1.team.context",
      priority: "important",
      dayOffset: -7,
      deadlineTime: null,
      reminderOffsets: [],
    },
    {
      id: "instructor-airport-pickup",
      titleKey: "templates.t1.pickup.title",
      categoryKey: "templates.t1.category.transport",
      contextKey: "templates.t1.pickup.context",
      priority: "important",
      dayOffset: -1,
      deadlineTime: null,
      reminderOffsets: [],
    },
    {
      id: "hotel-check-in",
      titleKey: "templates.t1.hotel.title",
      categoryKey: "templates.t1.category.accommodation",
      contextKey: "templates.t1.hotel.context",
      priority: "normal",
      dayOffset: -1,
      deadlineTime: "15:00",
      reminderOffsets: [],
    },
    {
      id: "training-session-preparation",
      titleKey: "templates.t1.training.title",
      categoryKey: "templates.t1.category.training",
      contextKey: "templates.t1.training.context",
      priority: "important",
      dayOffset: 0,
      deadlineTime: "08:30",
      reminderOffsets: [],
    },
  ],
};
