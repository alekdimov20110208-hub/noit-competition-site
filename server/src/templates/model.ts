import { createHash } from "node:crypto";
import { validEventDate, EventCommandError } from "../events/model.ts";
import {
  parseTaskAuthoring,
  uuidPattern,
  type TaskFields,
} from "../tasks/model.ts";
import { SEMINAR_BLUEPRINT as blueprint } from "./catalog.ts";

export type TemplateLanguage = "bg" | "en";
export interface TemplateSelection {
  templateId: string;
  templateVersion: number;
  itemIds: string[];
  language: TemplateLanguage;
}
export interface TemplateApplyCommand extends TemplateSelection {
  expectedEventVersion: number;
  reviewRevision: string;
  confirmed: true;
}
export interface ResolvedTemplateItem extends TaskFields {
  itemId: string;
  assignedMemberId: null;
  accepted: false;
  status: "not-started";
}
export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function templateEventId(value: string) {
  if (!uuidPattern.test(value)) throw new EventCommandError(400, "INVALID_ID");
  return value.toLowerCase();
}
export function parseTemplateSelection(
  input: unknown,
  applying = false,
): TemplateSelection | TemplateApplyCommand {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new EventCommandError(400, "INVALID_TEMPLATE_COMMAND");
  const row = input as Record<string, unknown>;
  const allowed = [
    "templateId",
    "templateVersion",
    "itemIds",
    "language",
    ...(applying
      ? ["expectedEventVersion", "reviewRevision", "confirmed"]
      : []),
  ];
  if (
    Object.keys(row).some((k) => !allowed.includes(k)) ||
    Object.keys(row).length !== allowed.length ||
    typeof row.templateId !== "string" ||
    row.templateId.length > 100 ||
    !Number.isSafeInteger(row.templateVersion) ||
    !["bg", "en"].includes(String(row.language)) ||
    !Array.isArray(row.itemIds) ||
    row.itemIds.length === 0 ||
    row.itemIds.length > 50 ||
    row.itemIds.some((id) => typeof id !== "string" || id.length > 100) ||
    new Set(row.itemIds).size !== row.itemIds.length
  )
    throw new EventCommandError(400, "INVALID_TEMPLATE_COMMAND");
  const personal = uuidPattern.test(row.templateId);
  if (row.templateId !== blueprint.id && !personal)
    throw new EventCommandError(400, "UNKNOWN_TEMPLATE");
  if (
    (personal &&
      ((row.templateVersion as number) < 1 ||
        (row.templateVersion as number) > 2147483647)) ||
    (!personal && row.templateVersion !== blueprint.version)
  )
    throw new EventCommandError(409, "TEMPLATE_VERSION_CONFLICT");
  if (
    row.itemIds.some((id) =>
      personal
        ? !uuidPattern.test(id as string)
        : !blueprint.items.some((item) => item.id === id),
    )
  )
    throw new EventCommandError(400, "UNKNOWN_TEMPLATE_ITEM");
  const selection: TemplateSelection = {
    templateId: personal ? row.templateId.toLowerCase() : blueprint.id,
    templateVersion: row.templateVersion as number,
    itemIds: personal
      ? (row.itemIds as string[]).map((id) => id.toLowerCase()).sort()
      : blueprint.items
          .filter((item) => (row.itemIds as string[]).includes(item.id))
          .map((item) => item.id),
    language: row.language as TemplateLanguage,
  };
  if (new Set(selection.itemIds).size !== selection.itemIds.length)
    throw new EventCommandError(400, "INVALID_TEMPLATE_COMMAND");
  if (!applying) return selection;
  if (
    !Number.isSafeInteger(row.expectedEventVersion) ||
    (row.expectedEventVersion as number) < 1 ||
    (row.expectedEventVersion as number) > 2147483647 ||
    typeof row.reviewRevision !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.reviewRevision) ||
    row.confirmed !== true
  )
    throw new EventCommandError(400, "INVALID_TEMPLATE_COMMAND");
  return {
    ...selection,
    expectedEventVersion: row.expectedEventVersion as number,
    reviewRevision: row.reviewRevision,
    confirmed: true,
  };
}

// Uses UTC calendar fields only as a Gregorian calculator. No Event instant and
// no 24-hour duration; parity tests protect the accepted T1 date contract.
export function resolveBlueprintDate(start: string, offset: number) {
  if (
    !validEventDate(start) ||
    !Number.isSafeInteger(offset) ||
    Math.abs(offset) > 3660
  )
    throw new EventCommandError(400, "INVALID_TEMPLATE_DATE");
  const [year, month, day] = start.split("-").map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year!, month! - 1, day! + offset);
  const resultYear = calendar.getUTCFullYear();
  if (
    !Number.isFinite(calendar.getTime()) ||
    resultYear < 1 ||
    resultYear > 9999
  )
    throw new EventCommandError(400, "INVALID_TEMPLATE_DATE");
  return calendar.toISOString().slice(0, 10);
}
export function resolveBlueprint(
  selection: TemplateSelection,
  startDate: string,
  personalItems?: {
    id: string;
    title: string;
    category: string;
    context: string;
    priority: TaskFields["priority"];
    dayOffset: number;
    deadlineTime: string | null;
  }[],
): ResolvedTemplateItem[] {
  const items = personalItems
    ? personalItems.map((item) => ({
        ...item,
        text: {
          bg: {
            title: item.title,
            category: item.category,
            context: item.context,
          },
          en: {
            title: item.title,
            category: item.category,
            context: item.context,
          },
        },
      }))
    : blueprint.items;
  return items
    .filter((item) => selection.itemIds.includes(item.id))
    .map((item) => {
      const fields = {
        ...item.text[selection.language],
        priority: item.priority,
        deadline: resolveBlueprintDate(startDate, item.dayOffset),
        deadlineTime: item.deadlineTime,
        reminderOffsets: [],
      };
      parseTaskAuthoring({ ...fields, assignedMemberId: null });
      return {
        ...fields,
        itemId: item.id,
        assignedMemberId: null,
        accepted: false,
        status: "not-started",
      };
    });
}
