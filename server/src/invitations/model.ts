import { createHash, randomBytes } from "node:crypto";

export const invitationLifetimeSeconds = 7 * 24 * 60 * 60;
export const invitationTokenPattern = /^[A-Za-z0-9_-]{43}$/;
export class InvitationError extends Error {
  readonly statusCode: number;
  readonly code: string;
  constructor(statusCode: number, code: string) {
    super("Invitation request failed.");
    this.name = "InvitationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
// Matches the ASCII syntax used by Better Auth's pinned z.email() validator.
// No provider-specific alias rewriting; '+' and local-part punctuation remain.
export function parseInvitedEmail(value: unknown): string {
  if (typeof value !== "string")
    throw new InvitationError(400, "INVALID_EMAIL");
  const email = normalizeEmail(value);
  if (
    email.length > 254 ||
    !/^(?!\.)(?!.*\.\.)[a-z0-9_'+.-]*[a-z0-9_+-]@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(
      email,
    )
  )
    throw new InvitationError(400, "INVALID_EMAIL");
  return email;
}
export function exactInput(value: unknown, keys: readonly string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new InvitationError(400, "INVALID_INPUT");
  return value as Record<string, unknown>;
}
export function generateInvitationToken() {
  return randomBytes(32).toString("base64url");
}
export function hashInvitationToken(token: string) {
  if (!invitationTokenPattern.test(token))
    throw new InvitationError(404, "NOT_FOUND");
  return createHash("sha256").update(token).digest("hex");
}
export interface InvitationRow {
  id: string;
  event_id: string;
  invited_email: string;
  inviter_user_id: string;
  created_at: Date;
  expires_at: Date;
  accepted_at: Date | null;
  accepted_user_id: string | null;
  revoked_at: Date | null;
  expired: boolean;
}
export function invitationState(row: InvitationRow) {
  return row.accepted_at
    ? "accepted"
    : row.revoked_at
      ? "revoked"
      : row.expired
        ? "expired"
        : "pending";
}
export function invitationDto(row: InvitationRow) {
  return {
    id: row.id,
    email: row.invited_email,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    state: invitationState(row),
  };
}
