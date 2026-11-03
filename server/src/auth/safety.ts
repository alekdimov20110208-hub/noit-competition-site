import { setTimeout as delay } from "node:timers/promises";
import type { TransactionDatabase } from "../db/transaction.ts";

export const authMailResponseFloorMs = 750;

// Reject ambiguous inputs, then pass this exact value to both the account gate
// and the native endpoint. Never inherit Better Auth's body/query fallback rules.
export function canonicalResetToken(
  body: Record<string, unknown>,
  query: URLSearchParams,
) {
  const tokens = query.getAll("token");
  if (tokens.length > 1) return;
  const valid = (value: unknown): value is string =>
    typeof value === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(value);
  const hasBody = Object.hasOwn(body, "token");
  if (hasBody && !valid(body.token)) return;
  if (tokens.length && !valid(tokens[0])) return;
  if (hasBody && tokens.length && body.token !== tokens[0]) return;
  return hasBody ? (body.token as string) : tokens[0];
}

export function isAuthMailRequest(request: Request, path: string) {
  return (
    request.method === "POST" &&
    [
      "/api/auth/request-password-reset",
      "/api/auth/send-verification-email",
    ].includes(path)
  );
}

// Wait after releasing SQL. Provider I/O is exclusively the durable worker's
// responsibility. This absorbs normal local DB/native endpoint timing variance;
// it cannot promise constant time during arbitrary database stalls or outages.
export async function authMailResponse<T>(
  work: () => Promise<T>,
  clock = { now: () => performance.now(), wait: (ms: number) => delay(ms) },
) {
  const start = clock.now();
  try {
    return await work();
  } finally {
    const remaining = authMailResponseFloorMs - (clock.now() - start);
    if (remaining > 0) await clock.wait(remaining);
  }
}

export function genericAuthMailResponse() {
  return Response.json(
    { status: true },
    { headers: { "cache-control": "no-store" } },
  );
}

// Better Auth 1.7.7 uses plain reset-password:<random> identifiers and user IDs
// as values. Delete only that purpose, on the account-gated owned transaction.
// Existing runtime SELECT/DELETE privileges suffice; no new DB capability.
export async function invalidateResetTokens(
  database: TransactionDatabase,
  userId: string,
) {
  await database.query(
    "DELETE FROM public.verification WHERE value=$1 AND identifier LIKE 'reset-password:%'",
    [userId],
  );
}
