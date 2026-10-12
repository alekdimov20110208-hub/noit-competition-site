import type { EventFields, TaskEvent } from "./RemoteWorkspaceService.ts";
import { validateEventForm } from "../pages/events/helpers.ts";

export function duplicateEventDefaults(
  source: TaskEvent,
  suffix: string,
): EventFields {
  // Limit UTF-16 length without splitting a surrogate pair at the suffix boundary.
  let name = source.name.slice(0, 200 - suffix.length);
  if (/[\uD800-\uDBFF]$/.test(name)) name = name.slice(0, -1);
  return {
    name: `${name}${suffix}`,
    startDate: "",
    endDate: "",
    timezone: source.timezone,
  };
}

export interface DuplicateAttempt {
  commandId: string;
  expectedVersion: number;
  fields: EventFields;
}
const memory = new Map<string, DuplicateAttempt>();
const scope = (userId: string, sourceId: string) =>
  `budograph:duplicate:v1:${encodeURIComponent(userId)}:${sourceId}`;
function session(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export function readDuplicateAttempt(
  userId: string,
  sourceId: string,
  storage = session(),
): DuplicateAttempt | null {
  const key = scope(userId, sourceId);
  try {
    const value = storage?.getItem(key);
    if (value) {
      const draft = JSON.parse(value) as DuplicateAttempt;
      if (
        typeof draft.commandId === "string" &&
        /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(draft.commandId) &&
        Number.isSafeInteger(draft.expectedVersion) &&
        draft.expectedVersion > 0 &&
        draft.fields &&
        ["name", "startDate", "endDate", "timezone"].every(
          (k) => typeof draft.fields[k as keyof EventFields] === "string",
        ) &&
        !Object.keys(validateEventForm(draft.fields)).length
      )
        return draft;
    }
  } catch {
    /* Invalid/unavailable tab storage never grants authority. */
  }
  return memory.get(key) ?? null;
}

export function rememberDuplicateAttempt(
  userId: string,
  sourceId: string,
  draft: DuplicateAttempt,
  storage = session(),
) {
  const key = scope(userId, sourceId);
  memory.set(key, draft);
  try {
    storage?.setItem(key, JSON.stringify(draft));
  } catch {
    /* In-tab recovery remains available. */
  }
}

export function forgetDuplicateAttempt(
  userId: string,
  sourceId: string,
  storage = session(),
) {
  const key = scope(userId, sourceId);
  memory.delete(key);
  try {
    storage?.removeItem(key);
  } catch {
    /* No server receipt is removed. */
  }
}
