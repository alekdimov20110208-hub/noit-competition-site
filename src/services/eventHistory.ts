import { WorkspaceReadFailure } from "./RemoteWorkspaceService.ts";

export interface EventHistoryEntry {
  templateApplication?: {
    templateId: string;
    templateVersion: number;
    operationId: string;
  };
  id: string;
  eventId: string;
  action: string;
  createdAt: string;
  actor: { userId: string; memberId: string | null; name: string };
  target: {
    type: string;
    id: string;
    title: string | null;
    available: boolean;
  };
  version: number | null;
  previousVersion: number | null;
  changedFields: string[];
  stateChanges: { field: string; before: string | null; after: string }[];
}
export interface EventHistoryPage {
  eventId: string;
  entries: EventHistoryEntry[];
  nextCursor: string | null;
}
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function invalid(): never {
  throw new WorkspaceReadFailure("invalid");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
}
function text(value: unknown): string {
  return typeof value === "string" ? value : invalid();
}
function id(value: unknown): string {
  const result = text(value);
  return uuid.test(result) ? result.toLowerCase() : invalid();
}
function version(value: unknown): number | null {
  return value === null
    ? null
    : typeof value === "number" && Number.isSafeInteger(value) && value > 0
      ? value
      : invalid();
}
export function historyPrecedes(
  a: EventHistoryEntry,
  b: EventHistoryEntry,
): boolean {
  return (
    a.createdAt > b.createdAt || (a.createdAt === b.createdAt && a.id > b.id)
  );
}
export function readEventHistory(
  value: unknown,
  eventId: string,
): EventHistoryPage {
  const body = record(value);
  if (
    id(body.eventId) !== eventId ||
    !Array.isArray(body.entries) ||
    body.entries.length > 50
  )
    invalid();
  const entries = body.entries.map((value): EventHistoryEntry => {
    const row = record(value),
      actor = record(row.actor),
      target = record(row.target);
    const createdAt = text(row.createdAt);
    if (
      id(row.eventId) !== eventId ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(createdAt) ||
      !Number.isFinite(Date.parse(createdAt)) ||
      typeof target.available !== "boolean" ||
      !Array.isArray(row.changedFields) ||
      row.changedFields.length > 20 ||
      !Array.isArray(row.stateChanges) ||
      row.stateChanges.length > 4
    )
      invalid();
    const action = text(row.action),
      type = text(target.type),
      userId = text(actor.userId);
    if (!action.trim() || !type.trim() || !userId.trim()) invalid();
    const recordedVersion = version(row.version),
      previousVersion = version(row.previousVersion);
    if (
      previousVersion !== null &&
      recordedVersion !== null &&
      previousVersion >= recordedVersion
    )
      invalid();
    const targetId = id(target.id);
    if (type === "event" && targetId !== eventId) invalid();
    let templateApplication: EventHistoryEntry["templateApplication"];
    if (row.templateApplication !== undefined) {
      const origin = record(row.templateApplication);
      if (
        !["task.created", "TEMPLATE_APPLIED"].includes(action) ||
        origin.templateId !== "international-aikido-seminar" ||
        origin.templateVersion !== 1
      )
        invalid();
      templateApplication = {
        templateId: origin.templateId,
        templateVersion: origin.templateVersion,
        operationId: id(origin.operationId),
      };
    }
    return {
      ...(templateApplication ? { templateApplication } : {}),
      id: id(row.id),
      eventId,
      action,
      createdAt,
      actor: {
        userId,
        memberId: actor.memberId === null ? null : id(actor.memberId),
        name: text(actor.name),
      },
      target: {
        type,
        id: targetId,
        title: target.title === null ? null : text(target.title),
        available: target.available,
      },
      version: recordedVersion,
      previousVersion,
      changedFields: row.changedFields.map(text),
      stateChanges: row.stateChanges.map((value) => {
        const change = record(value);
        const field = text(change.field),
          after = text(change.after),
          before = change.before === null ? null : text(change.before);
        const states =
          field === "status"
            ? ["not-started", "in-progress", "blocked", "completed"]
            : ["present", "absent"];
        if (
          !["status", "decision", "response", "planB"].includes(field) ||
          !states.includes(after) ||
          (before !== null && !states.includes(before))
        )
          invalid();
        return { field, before, after };
      }),
    };
  });
  if (
    new Set(entries.map((entry) => entry.id)).size !== entries.length ||
    entries.some(
      (entry, i) => i > 0 && !historyPrecedes(entries[i - 1]!, entry),
    )
  )
    invalid();
  const nextCursor = body.nextCursor === null ? null : id(body.nextCursor);
  if (
    nextCursor !== null &&
    (entries.length !== 50 || nextCursor !== entries.at(-1)?.id)
  )
    invalid();
  return { eventId, entries, nextCursor };
}
