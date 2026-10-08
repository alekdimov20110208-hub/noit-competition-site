import type { AuthController } from "./state.ts";

export function validDisplayName(value: string) {
  const name = value.trim();
  return Boolean(
    name &&
    name.length <= 100 &&
    !/[\p{Cc}\p{Cf}\p{Cs}<>]/u.test(name) &&
    /[\p{L}\p{N}]/u.test(name),
  );
}

export function avatarInitials(name: string): string {
  const words =
    name.normalize("NFC").match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu) ?? [];
  const selected =
    words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return (
    selected
      .map((word) => [...segmenter.segment(word ?? "")][0]?.segment ?? "")
      .join("")
      .toLocaleUpperCase()
      .slice(0, 8) || "?"
  );
}

export type ProfileError =
  | "invalidName"
  | "invalidPassword"
  | "mismatch"
  | "wrongPassword"
  | "expired"
  | "reauthenticate"
  | "limited"
  | "unavailable"
  | "refresh"
  | "failed"
  | "busy";
export type ProfileCommand = "update-user" | "change-password";
export type ProfileTransport = (
  path: ProfileCommand,
  fields: Record<string, string | boolean>,
) => Promise<ProfileError | null>;

export const profileCommand: ProfileTransport = async (path, fields) => {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (response.status === 401) return "expired";
    if (response.status === 429) return "limited";
    if (response.status >= 500) return "unavailable";
    const result = (await response.json()) as {
      status?: unknown;
      code?: string;
    };
    if (response.ok) return result.status === true ? null : "failed";
    if (result.code === "INVALID_PASSWORD") return "wrongPassword";
    if (result.code === "SESSION_EXPIRED") return "reauthenticate";
    if (result.code === "ACCOUNT_BUSY") return "busy";
    return "failed";
  } catch {
    return "unavailable";
  }
};

export class ProfileController {
  private pending = false;
  private auth: AuthController;
  private transport: ProfileTransport;
  constructor(
    auth: AuthController,
    transport: ProfileTransport = profileCommand,
  ) {
    this.auth = auth;
    this.transport = transport;
  }
  async run(
    path: ProfileCommand,
    fields: Record<string, string | boolean>,
  ): Promise<ProfileError | null> {
    if (this.pending) return "busy";
    const state = this.auth.getSnapshot();
    if (state.status !== "authenticated") return "expired";
    // A command can outlive its page. Keep exclusion across page instances.
    if (state.accountBusy) return "busy";
    const user = state.user;
    this.pending = true;
    this.auth.setAccountBusy(true);
    try {
      const error = await this.transport(path, fields);
      if (error === "expired") this.auth.expireSession();
      if (error) return error;
      const refreshed = await this.auth.refreshIdentity(user.id);
      return refreshed === "expired" ? "expired" : refreshed ? "refresh" : null;
    } finally {
      this.pending = false;
      this.auth.setAccountBusy(false);
    }
  }
}
