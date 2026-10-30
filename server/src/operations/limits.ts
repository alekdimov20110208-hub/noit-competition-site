import { isIP } from "node:net";
import type { AuthorizationDatabase } from "../authorization/events.ts";
import { privateIdentifier } from "./crypto.ts";

export class OperationalError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly retryAfter?: number;
  constructor(statusCode = 503, code = "UNAVAILABLE", retryAfter?: number) {
    super("Operational control unavailable.");
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
export interface LimitRule {
  key: string;
  max: number;
  windowMs: number;
  mode: "fixed" | "rolling" | "day" | "month";
}
export function createSharedControls(
  database: AuthorizationDatabase,
  hmacKey: string,
  trustedClientIp = true,
) {
  const rule = (
    scope: string,
    value: string,
    max: number,
    windowMs: number,
    mode: LimitRule["mode"] = "fixed",
  ): LimitRule => ({
    key: privateIdentifier(hmacKey, scope, value),
    max,
    windowMs,
    mode,
  });
  async function consume(rules: LimitRule[]) {
    try {
      const result = await database.query(
        "SELECT budograph_private.consume_limits($1::jsonb) AS result",
        [JSON.stringify(rules)],
      );
      const value = (
        result.rows[0] as {
          result?: { allowed?: unknown; retryAfter?: unknown };
        }
      )?.result;
      if (
        typeof value?.allowed !== "boolean" ||
        !Number.isInteger(value.retryAfter)
      )
        throw Error();
      return { allowed: value.allowed, retryAfter: value.retryAfter as number };
    } catch {
      throw new OperationalError();
    }
  }
  async function requireLimit(rules: LimitRule[]) {
    const result = await consume(rules);
    if (!result.allowed)
      throw new OperationalError(429, "RATE_LIMITED", result.retryAfter);
  }
  function peer(ip: string) {
    if (!trustedClientIp || !isIP(ip)) throw new OperationalError();
    return ip.toLowerCase();
  }
  function identity(value: string) {
    if (!value || value.length > 512 || /\s/.test(value.trim()))
      throw new OperationalError(400, "INVALID_INPUT");
    return value.trim().toLowerCase();
  }
  return {
    consume,
    rule,
    async email(
      action: "authmail" | "invitation-mail",
      ip: string,
      value: string,
    ) {
      const invitation = action === "invitation-mail";
      await requireLimit([
        rule(
          `${action}:identity`,
          identity(value),
          invitation ? 30 : 3,
          900000,
        ),
        rule(`${action}:ip`, peer(ip), invitation ? 60 : 10, 900000),
        rule(`${action}:global`, "all", 100, 900000),
      ]);
    },
    async invitation(ip: string, registration = false, token = "") {
      const scope = registration ? "invitation-register" : "invitation-read";
      await requireLimit([
        rule(`${scope}:ip`, peer(ip), registration ? 5 : 120, 60000),
        ...(registration && token
          ? [rule(`${scope}:token`, identity(token), 5, 60000)]
          : []),
      ]);
    },
    async account(ip: string, email: string) {
      await requireLimit([
        rule("profile:identity", identity(email), 20, 60000),
        rule("profile:ip", peer(ip), 60, 60000),
      ]);
    },
    async auth(request: Request, path: string) {
      const ip = peer(request.headers.get("x-budograph-client-ip") ?? "");
      const endpoint = path.replace(/^\/api\/auth/, "");
      const sensitive = [
        "/sign-in",
        "/sign-up",
        "/change-password",
        "/change-email",
      ].some((p) => endpoint.startsWith(p));
      const mail =
        [
          "/request-password-reset",
          "/send-verification-email",
          "/email-otp/send-verification-otp",
          "/email-otp/request-password-reset",
        ].includes(endpoint) || endpoint.startsWith("/forget-password");
      const windowMs = mail ? 60000 : 10000,
        max = sensitive || mail ? 3 : 100;
      const known = [
        "/sign-in/email",
        "/sign-up/email",
        "/change-password",
        "/change-email",
        "/request-password-reset",
        "/send-verification-email",
        "/reset-password",
        "/verify-email",
        "/update-user",
        "/sign-out",
        "/get-session",
      ];
      const scope = known.includes(endpoint) ? endpoint : "other";
      let email: unknown;
      try {
        const body: unknown = await request.clone().json();
        if (body && typeof body === "object" && "email" in body)
          email = body.email;
      } catch {
        /* Native validation remains authoritative. */
      }
      const canonical =
        typeof email === "string" &&
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
          ? email.trim().toLowerCase()
          : undefined;
      await requireLimit([
        rule(`auth:${scope}:ip`, ip, max, windowMs, "rolling"),
        ...(canonical
          ? [
              rule(
                `auth:${scope}:identity`,
                canonical,
                max,
                windowMs,
                "rolling",
              ),
            ]
          : []),
        rule("auth:global", "all", 1000, 60000),
      ]);
    },
    async delivery() {
      return consume([
        rule("delivery:second", "all", 1, 1000),
        rule("delivery:day", "all", 80, 86400000, "day"),
        rule("delivery:month", "all", 2400, 2678400000, "month"),
      ]);
    },
    async cleanup(batch = 100) {
      try {
        return (
          await database.query(
            "SELECT budograph_private.cleanup_operations($1) AS result",
            [batch],
          )
        ).rows[0];
      } catch {
        throw new OperationalError();
      }
    },
  };
}
export type SharedControls = ReturnType<typeof createSharedControls>;
