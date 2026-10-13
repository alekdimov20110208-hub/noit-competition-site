export interface ArchiveAttempt {
  commandId: string;
  expectedVersion: number;
  confirmationName: string;
}
const memory = new Map<string, ArchiveAttempt>();
const scope = (userId: string, eventId: string) =>
  `budograph:archive:v1:${encodeURIComponent(userId)}:${eventId}`;
function session(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}
export function readArchiveAttempt(
  userId: string,
  eventId: string,
  storage = session(),
): ArchiveAttempt | null {
  const key = scope(userId, eventId);
  try {
    const value = storage?.getItem(key);
    if (value) {
      const a = JSON.parse(value) as ArchiveAttempt;
      if (
        typeof a.commandId === "string" &&
        /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(a.commandId) &&
        Number.isSafeInteger(a.expectedVersion) &&
        a.expectedVersion > 0 &&
        a.expectedVersion <= 2147483647 &&
        typeof a.confirmationName === "string" &&
        a.confirmationName.length > 0 &&
        a.confirmationName.length <= 200 &&
        !a.confirmationName.includes("\u0000") &&
        !/[\uD800-\uDFFF]/u.test(a.confirmationName)
      )
        return a;
    }
  } catch {
    /* Tab storage is a recovery hint, never authority. */
  }
  return memory.get(key) ?? null;
}
export function rememberArchiveAttempt(
  userId: string,
  eventId: string,
  attempt: ArchiveAttempt,
  storage = session(),
) {
  const key = scope(userId, eventId);
  memory.set(key, attempt);
  try {
    storage?.setItem(key, JSON.stringify(attempt));
  } catch {
    /* In-tab fallback. */
  }
}
export function forgetArchiveAttempt(
  userId: string,
  eventId: string,
  storage = session(),
) {
  const key = scope(userId, eventId);
  memory.delete(key);
  try {
    storage?.removeItem(key);
  } catch {
    /* Server receipts remain immutable. */
  }
}
