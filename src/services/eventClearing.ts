import {
  EventActionFailure,
  readRemoteEvent,
  type TaskEvent,
} from "./RemoteWorkspaceService.ts";
export interface ClearPreview {
  event: TaskEvent;
  scopeRevision: string;
  taskCount: number;
  completedCount: number;
  affectedChangeCount: number;
  reminderCount: number;
}
export interface ClearAttempt {
  commandId: string;
  expectedVersion: number;
  confirmationName: string;
  scopeRevision: string;
  reviewedCount: number;
}
export interface ClearResult {
  id: string;
  event: TaskEvent;
  operationId: string;
  clearedCount: number;
  completedCount: number;
  affectedChangeCount: number;
  reminderCount: number;
}
const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const digest = /^[a-f0-9]{64}$/;
const memory = new Map<string, ClearAttempt>();
const scope = (user: string, event: string) =>
  `budograph:clear:v1:${encodeURIComponent(user)}:${event}`;
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
function storage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}
export function validClearAttempt(a: unknown): a is ClearAttempt {
  if (!a || typeof a !== "object") return false;
  const v = a as ClearAttempt;
  return (
    typeof v.commandId === "string" &&
    uuid.test(v.commandId) &&
    Number.isSafeInteger(v.expectedVersion) &&
    v.expectedVersion > 0 &&
    v.expectedVersion <= 2147483647 &&
    typeof v.confirmationName === "string" &&
    v.confirmationName.length > 0 &&
    v.confirmationName.length <= 200 &&
    !v.confirmationName.includes("\u0000") &&
    !/[\uD800-\uDFFF]/u.test(v.confirmationName) &&
    typeof v.scopeRevision === "string" &&
    digest.test(v.scopeRevision) &&
    count(v.reviewedCount)
  );
}
export function readClearAttempt(
  user: string,
  event: string,
  s = storage(),
): ClearAttempt | null {
  const key = scope(user, event);
  try {
    const raw = s?.getItem(key);
    if (raw) {
      const a: unknown = JSON.parse(raw);
      if (validClearAttempt(a)) return a;
    }
  } catch {
    /* Recovery hint only. */
  }
  return memory.get(key) ?? null;
}
export function rememberClearAttempt(
  user: string,
  event: string,
  a: ClearAttempt,
  s = storage(),
) {
  if (!validClearAttempt(a)) throw new EventActionFailure("invalid");
  const key = scope(user, event);
  memory.set(key, a);
  try {
    s?.setItem(key, JSON.stringify(a));
  } catch {
    /* In-tab fallback. */
  }
}
export function forgetClearAttempt(user: string, event: string, s = storage()) {
  const key = scope(user, event);
  memory.delete(key);
  try {
    s?.removeItem(key);
  } catch {
    /* Durable receipt survives. */
  }
}
export function readClearPreview(
  value: unknown,
  eventId: string,
): ClearPreview {
  const row = value as ClearPreview;
  try {
    if (!row || typeof row !== "object") throw Error();
    const event = readRemoteEvent(row.event);
    if (
      event.id !== eventId ||
      event.archived ||
      event.membership.accessRole !== "ORGANIZER" ||
      !digest.test(row.scopeRevision) ||
      ![
        row.taskCount,
        row.completedCount,
        row.affectedChangeCount,
        row.reminderCount,
      ].every(count) ||
      row.completedCount > row.taskCount
    )
      throw Error();
    return { ...row, event };
  } catch {
    throw new EventActionFailure("invalid");
  }
}
export function readClearResult(
  value: unknown,
  eventId: string,
  attempt: ClearAttempt,
): ClearResult {
  try {
    const row = value as ClearResult,
      event = readRemoteEvent(row.event);
    if (
      row.id !== eventId ||
      event.id !== eventId ||
      row.operationId !== attempt.commandId ||
      event.archived ||
      event.membership.accessRole !== "ORGANIZER" ||
      ![
        row.clearedCount,
        row.completedCount,
        row.affectedChangeCount,
        row.reminderCount,
      ].every(count) ||
      row.clearedCount !== attempt.reviewedCount ||
      row.completedCount > row.clearedCount ||
      event.version !== attempt.expectedVersion + (row.clearedCount ? 1 : 0)
    )
      throw Error();
    return { ...row, event };
  } catch {
    throw new EventActionFailure("uncertain");
  }
}
export async function clearResponseError(response: Response): Promise<never> {
  let code: ConstructorParameters<typeof EventActionFailure>[0] =
    (
      {
        400: "invalid",
        401: "unauthenticated",
        403: "forbidden",
        404: "not-found",
      } as const
    )[response.status as 400] ?? "uncertain";
  if (response.status === 409) {
    try {
      const { code: reason } = (await response.json()) as { code: string };
      if (["EVENT_VERSION_CONFLICT", "TASK_SET_CONFLICT"].includes(reason))
        code = "conflict";
      else if (reason === "IDEMPOTENCY_KEY_REUSED") code = "key-reused";
      else if (reason === "VERSION_LIMIT_REACHED") code = "version-limit";
    } catch {
      /* Unknown response retains held request. */
    }
  }
  throw new EventActionFailure(code);
}
