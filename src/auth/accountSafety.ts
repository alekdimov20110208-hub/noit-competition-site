import { safeReturnTo } from "./routing.ts";
let pending: { email: string; returnTo: string } | null = null;
// Transient continuation only; email and bearer tokens never enter browser storage.
export function setPendingVerification(email: string, returnTo: string) {
  pending = { email, returnTo: safeReturnTo(returnTo) };
}
export function takePendingVerification() {
  return pending;
}
export function readResetToken(search: string) {
  const token = new URLSearchParams(search).get("token");
  return token && /^[A-Za-z0-9_-]{16,128}$/.test(token) ? token : null;
}
export async function accountSafetyCommand(
  path: "request-password-reset" | "send-verification-email" | "reset-password",
  fields: Record<string, string>,
  locale: string,
) {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "content-type": "application/json",
        "x-budograph-locale": locale,
      },
      body: JSON.stringify(fields),
    });
    if (response.status === 429) return "limited" as const;
    if (!response.ok)
      return response.status >= 500
        ? ("unavailable" as const)
        : ("invalid" as const);
    return null;
  } catch {
    return "unavailable" as const;
  }
}
