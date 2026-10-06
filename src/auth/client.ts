import { createAuthClient } from "better-auth/client";
import { AuthFailure, readCurrentUser, type AuthTransport } from "./state.ts";

// Use the official pinned client for cookie-based commands. Do not subscribe to
// its full-session atom: /api/me supplies only the application's safe identity.
const client = createAuthClient({
  basePath: "/api/auth",
  disableDefaultFetchPlugins: true,
  fetchOptions: { credentials: "same-origin", timeout: 10_000, retry: 0 },
});

function commandFailure(status: number, signingIn: boolean): AuthFailure {
  if (signingIn && (status === 400 || status === 401 || status === 403)) {
    return new AuthFailure("invalid");
  }
  return new AuthFailure(status >= 500 ? "unavailable" : "unexpected");
}

export const browserAuthTransport: AuthTransport = {
  async currentUser() {
    let response: Response;
    try {
      response = await fetch("/api/me", {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new AuthFailure("unavailable");
    }
    if (response.status === 401) return null;
    if (!response.ok) throw commandFailure(response.status, false);
    try {
      return readCurrentUser(await response.json());
    } catch {
      throw new AuthFailure("unexpected");
    }
  },
  async signIn(email, password) {
    try {
      const { error } = await client.signIn.email({ email, password });
      if (error) {
        if (error.code === "EMAIL_NOT_VERIFIED")
          throw new AuthFailure("verification");
        throw commandFailure(error.status, true);
      }
    } catch (error) {
      if (error instanceof AuthFailure) throw error;
      throw new AuthFailure("unavailable");
    }
  },
  async signOut() {
    try {
      const { error } = await client.signOut();
      if (error) throw commandFailure(error.status, false);
    } catch (error) {
      if (error instanceof AuthFailure) throw error;
      throw new AuthFailure("unavailable");
    }
  },
};
