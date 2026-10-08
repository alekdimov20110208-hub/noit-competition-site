export interface CurrentUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export type AuthError =
  "invalid" | "unavailable" | "unexpected" | "verification";
export class AuthFailure extends Error {
  readonly code: AuthError;
  constructor(code: AuthError) {
    super("Authentication request failed.");
    this.code = code;
  }
}

export type AuthState =
  | { status: "loading"; user: null; error: null }
  | {
      status: "authenticated";
      user: CurrentUser;
      error: null;
      accountBusy?: boolean;
    }
  | { status: "unauthenticated"; user: null; error: AuthError | null };

export interface AuthTransport {
  currentUser(): Promise<CurrentUser | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

export function readCurrentUser(value: unknown): CurrentUser {
  if (typeof value !== "object" || value === null || !("user" in value)) {
    throw new AuthFailure("unexpected");
  }
  const user = value.user;
  if (typeof user !== "object" || user === null)
    throw new AuthFailure("unexpected");
  if (
    !("id" in user) ||
    typeof user.id !== "string" ||
    !user.id ||
    !("name" in user) ||
    typeof user.name !== "string" ||
    !("email" in user) ||
    typeof user.email !== "string" ||
    !user.email
  )
    throw new AuthFailure("unexpected");
  return Object.freeze({ id: user.id, name: user.name, email: user.email });
}

function safeFailure(error: unknown): AuthError {
  return error instanceof AuthFailure ? error.code : "unexpected";
}

export class AuthController {
  private state: AuthState = { status: "loading", user: null, error: null };
  private listeners = new Set<() => void>();
  private checking: Promise<void> | null = null;
  private revision = 0;
  private submitting = false;
  private accountBusy = false;

  private transport: AuthTransport;
  constructor(transport: AuthTransport) {
    this.transport = transport;
  }

  getSnapshot = (): AuthState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(state: AuthState) {
    this.state =
      state.status === "authenticated"
        ? {
            status: state.status,
            user: state.user,
            error: null,
            ...(this.accountBusy ? { accountBusy: true } : {}),
          }
        : state;
    for (const listener of this.listeners) listener();
  }

  // A protected backend read's 401 is authoritative. Invalidate outstanding
  // identity checks so an earlier /api/me response cannot restore stale data.
  expireSession = () => {
    ++this.revision;
    this.publish({ status: "unauthenticated", user: null, error: null });
  };

  setAccountBusy = (busy: boolean) => {
    this.accountBusy = busy;
    if (this.state.status === "authenticated") this.publish(this.state);
  };

  // Bypass a coalesced read started before a write. A later logout/expiry wins.
  refreshIdentity = async (
    expectedId: string,
  ): Promise<AuthError | "expired" | null> => {
    if (this.state.user?.id !== expectedId || this.submitting) return "expired";
    const revision = ++this.revision;
    try {
      const user = await this.transport.currentUser();
      if (revision !== this.revision || this.state.user?.id !== expectedId)
        return "expired";
      if (!user || user.id !== expectedId) {
        this.expireSession();
        return "expired";
      }
      this.publish({
        status: "authenticated",
        user: readCurrentUser({ user }),
        error: null,
      });
      return null;
    } catch (error) {
      // A confirmed write with failed refresh must not become optimistic identity.
      return revision === this.revision ? safeFailure(error) : "expired";
    }
  };

  refresh = (): Promise<void> => {
    if (this.submitting) return Promise.resolve();
    if (this.checking) return this.checking;
    const revision = this.revision;
    const check = async () => {
      try {
        const user = await this.transport.currentUser();
        if (revision !== this.revision) return;
        this.publish(
          user
            ? {
                status: "authenticated",
                user: readCurrentUser({ user }),
                error: null,
              }
            : { status: "unauthenticated", user: null, error: null },
        );
      } catch (error) {
        if (revision !== this.revision) return;
        this.publish({
          status: "unauthenticated",
          user: null,
          error: safeFailure(error),
        });
      }
    };
    this.checking = check().finally(() => {
      this.checking = null;
    });
    return this.checking;
  };

  signIn = async (
    email: string,
    password: string,
  ): Promise<AuthError | null> => {
    if (this.submitting) return null;
    this.submitting = true;
    ++this.revision;
    try {
      await this.transport.signIn(email.trim(), password);
      const user = await this.transport.currentUser();
      if (!user) throw new AuthFailure("unexpected");
      this.publish({
        status: "authenticated",
        user: readCurrentUser({ user }),
        error: null,
      });
      return null;
    } catch (error) {
      this.publish({ status: "unauthenticated", user: null, error: null });
      return safeFailure(error);
    } finally {
      this.submitting = false;
    }
  };

  signOut = async (): Promise<AuthError | null> => {
    // Avoid competing cookie rotation and logout responses in this browser.
    if (this.state.status === "authenticated" && this.state.accountBusy)
      return "unexpected";
    if (this.submitting) return null;
    this.submitting = true;
    ++this.revision;
    try {
      // Keep the current identity until the server confirms invalidation.
      await this.transport.signOut();
      this.publish({ status: "unauthenticated", user: null, error: null });
      return null;
    } catch (error) {
      return safeFailure(error);
    } finally {
      this.submitting = false;
    }
  };
}
