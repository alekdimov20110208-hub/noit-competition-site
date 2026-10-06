export const inviteTokenPattern = /^[A-Za-z0-9_-]{43}$/;
export function invitationPath(token: string) {
  return inviteTokenPattern.test(token) ? `/invite/${token}` : null;
}
export function readInvitationToken(path: string): string | null {
  const match = /^\/invite\/([A-Za-z0-9_-]{43})$/.exec(path);
  return match?.[1] ?? null;
}
export interface PendingInvitation {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  state: "pending" | "expired";
}
export type InvitationSummary =
  | { state: "pending"; eventName: string; email: string; expiresAt: string }
  | { state: "expired" | "revoked" | "accepted" | "unavailable" };
export type InviteError =
  | "invalid"
  | "unavailable"
  | "unauthenticated"
  | "forbidden"
  | "wrong-account"
  | "already-member"
  | "inactive-member"
  | "already-pending"
  | "expired"
  | "revoked"
  | "registration"
  | "rate-limited";
export class InvitationFailure extends Error {
  readonly code: InviteError;
  constructor(code: InviteError) {
    super("Invitation request failed.");
    this.code = code;
  }
}
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InvitationFailure("invalid");
  return value as Record<string, unknown>;
}
function instant(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new InvitationFailure("invalid");
  return value;
}
export function readPendingInvitation(value: unknown): PendingInvitation {
  const row = object(value);
  if (
    typeof row.id !== "string" ||
    !uuid.test(row.id) ||
    typeof row.email !== "string" ||
    row.email.length > 254 ||
    (row.state !== "pending" && row.state !== "expired")
  )
    throw new InvitationFailure("invalid");
  return {
    id: row.id,
    email: row.email,
    state: row.state,
    createdAt: instant(row.createdAt),
    expiresAt: instant(row.expiresAt),
  };
}
export function readInvitationSummary(value: unknown): InvitationSummary {
  const row = object(value);
  if (row.state === "pending") {
    if (typeof row.eventName !== "string" || typeof row.email !== "string")
      throw new InvitationFailure("invalid");
    return {
      state: row.state,
      eventName: row.eventName,
      email: row.email,
      expiresAt: instant(row.expiresAt),
    };
  }
  if (
    row.state === "expired" ||
    row.state === "revoked" ||
    row.state === "accepted" ||
    row.state === "unavailable"
  )
    return { state: row.state };
  throw new InvitationFailure("invalid");
}
const codes: Record<string, InviteError> = {
  WRONG_ACCOUNT: "wrong-account",
  ALREADY_MEMBER: "already-member",
  INACTIVE_MEMBER: "inactive-member",
  ALREADY_PENDING: "already-pending",
  INVITATION_EXPIRED: "expired",
  INVITATION_REVOKED: "revoked",
  REGISTRATION_FAILED: "registration",
  INVALID_REGISTRATION: "registration",
  RATE_LIMITED: "rate-limited",
};
export class InvitationService {
  private request: typeof fetch;
  private locale: () => string;
  constructor(
    request: typeof fetch = fetch,
    locale: () => string = () => "bg",
  ) {
    this.request = request;
    this.locale = locale;
  }
  private async command(path: string, signal: AbortSignal, body?: unknown) {
    let response: Response;
    try {
      const request = this.request;
      response = await request(path, {
        method: body === undefined ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        ...(body === undefined
          ? {}
          : {
              headers: {
                "content-type": "application/json",
                "x-budograph-locale": this.locale(),
              },
              body: JSON.stringify(body),
            }),
      });
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new InvitationFailure("unavailable");
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new InvitationFailure("unavailable");
    }
    signal.throwIfAborted();
    if (!response.ok) {
      const code = object(data).code;
      throw new InvitationFailure(
        typeof code === "string" && codes[code]
          ? codes[code]!
          : response.status === 401
            ? "unauthenticated"
            : response.status === 403
              ? "forbidden"
              : response.status >= 500
                ? "unavailable"
                : "invalid",
      );
    }
    return data;
  }
  async list(eventId: string, signal: AbortSignal) {
    const data = object(
      await this.command(`/api/events/${this.id(eventId)}/invitations`, signal),
    );
    if (!Array.isArray(data.invitations))
      throw new InvitationFailure("invalid");
    const result = data.invitations.map(readPendingInvitation);
    if (new Set(result.map((row) => row.id)).size !== result.length)
      throw new InvitationFailure("invalid");
    return result;
  }
  async create(eventId: string, email: string, signal: AbortSignal) {
    const data = object(
      await this.command(
        `/api/events/${this.id(eventId)}/invitations`,
        signal,
        { email: email.trim() },
      ),
    );
    const row = readPendingInvitation(data.invitation),
      path = data.developmentInvitePath;
    if (
      !["development_link", "sent", "failed"].includes(String(data.delivery)) ||
      (path !== undefined &&
        (typeof path !== "string" || !readInvitationToken(path)))
    )
      throw new InvitationFailure("invalid");
    return {
      invitation: row,
      path: typeof path === "string" ? path : null,
      delivery: data.delivery as "development_link" | "sent" | "failed",
    };
  }
  async resend(eventId: string, invitationId: string, signal: AbortSignal) {
    const data = object(
      await this.command(
        `/api/events/${this.id(eventId)}/invitations/${this.id(invitationId)}/resend`,
        signal,
        {},
      ),
    );
    if (!["development_link", "sent", "failed"].includes(String(data.delivery)))
      throw new InvitationFailure("invalid");
    const path = data.developmentInvitePath;
    if (
      path !== undefined &&
      (typeof path !== "string" || !readInvitationToken(path))
    )
      throw new InvitationFailure("invalid");
    return {
      invitation: readPendingInvitation(data.invitation),
      path: typeof path === "string" ? path : null,
      delivery: data.delivery as "development_link" | "sent" | "failed",
    };
  }
  async revoke(eventId: string, invitationId: string, signal: AbortSignal) {
    await this.command(
      `/api/events/${this.id(eventId)}/invitations/${this.id(invitationId)}/revoke`,
      signal,
      {},
    );
  }
  async lookup(token: string, signal: AbortSignal) {
    return readInvitationSummary(
      await this.command(`/api/invitations/${this.token(token)}`, signal),
    );
  }
  async register(
    token: string,
    name: string,
    password: string,
    signal: AbortSignal,
  ) {
    const result = object(
      await this.command(
        `/api/invitations/${this.token(token)}/register`,
        signal,
        { name, password },
      ),
    );
    if (
      result.status !== "verification_required" &&
      result.status !== "sign_in_required"
    )
      throw new InvitationFailure("invalid");
    return result.status;
  }
  async accept(token: string, signal: AbortSignal) {
    const data = object(
      await this.command(
        `/api/invitations/${this.token(token)}/accept`,
        signal,
        {},
      ),
    );
    if (data.status !== "accepted" && data.status !== "already_accepted")
      throw new InvitationFailure("invalid");
    if (typeof data.eventId !== "string")
      throw new InvitationFailure("invalid");
    return this.id(data.eventId);
  }
  private id(id: string) {
    if (!uuid.test(id)) throw new InvitationFailure("invalid");
    return id;
  }
  private token(token: string) {
    if (!inviteTokenPattern.test(token)) throw new InvitationFailure("invalid");
    return token;
  }
}
export interface InvitationManagementState {
  invitations: PendingInvitation[];
  link: { id: string; path: string } | null;
  busy: boolean;
  error: InviteError | null;
  loaded: boolean;
  delivery?: "development_link" | "sent" | "failed" | null;
}
// One store per Event/identity; dispose aborts requests and invalidates late results.
// Bearer links exist only in this transient store, never browser persistence.
export class InvitationController {
  private service: Pick<InvitationService, "list" | "create" | "revoke"> &
    Partial<Pick<InvitationService, "resend">>;
  private eventId: string;
  private expire: () => void;
  private state: InvitationManagementState = {
    invitations: [],
    link: null,
    busy: false,
    error: null,
    loaded: false,
  };
  private listeners = new Set<() => void>();
  private request: AbortController | null = null;
  private disposed = false;
  constructor(
    service: Pick<InvitationService, "list" | "create" | "revoke"> &
      Partial<Pick<InvitationService, "resend">>,
    eventId: string,
    expire: () => void,
  ) {
    this.service = service;
    this.eventId = eventId;
    this.expire = expire;
  }
  getSnapshot = () => this.state;
  activate = () => {
    this.disposed = false;
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: InvitationManagementState) {
    if (this.disposed) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  dispose = () => {
    this.disposed = true;
    this.request?.abort();
    this.state = {
      invitations: [],
      link: null,
      busy: false,
      error: null,
      loaded: false,
    };
  };
  private async run(work: (signal: AbortSignal) => Promise<void>) {
    if (this.disposed || this.state.busy) return;
    const request = new AbortController();
    this.request = request;
    this.publish({ ...this.state, busy: true, error: null });
    try {
      await work(request.signal);
    } catch (error) {
      if (this.disposed || request.signal.aborted) return;
      const code =
        error instanceof InvitationFailure ? error.code : "unavailable";
      if (code === "unauthenticated") {
        this.dispose();
        this.expire();
        return;
      }
      this.publish({ ...this.state, error: code });
    } finally {
      if (!this.disposed && !request.signal.aborted)
        this.publish({ ...this.state, busy: false });
    }
  }
  load = () =>
    this.run(async (signal) => {
      const invitations = await this.service.list(this.eventId, signal);
      signal.throwIfAborted();
      this.publish({ ...this.state, invitations, loaded: true });
    });
  create = (email: string) =>
    this.run(async (signal) => {
      const created = await this.service.create(this.eventId, email, signal);
      signal.throwIfAborted();
      this.publish({
        ...this.state,
        invitations: [...this.state.invitations, created.invitation],
        link: created.path
          ? { id: created.invitation.id, path: created.path }
          : null,
        delivery: created.delivery,
      });
    });
  resend = (id: string) =>
    this.run(async (signal) => {
      if (!this.service.resend) throw new InvitationFailure("unavailable");
      const result = await this.service.resend(this.eventId, id, signal);
      signal.throwIfAborted();
      this.publish({
        ...this.state,
        link: result.path ? { id, path: result.path } : null,
        delivery: result.delivery,
      });
    });
  revoke = (id: string) =>
    this.run(async (signal) => {
      await this.service.revoke(this.eventId, id, signal);
      signal.throwIfAborted();
      this.publish({
        ...this.state,
        invitations: this.state.invitations.filter((row) => row.id !== id),
        link: this.state.link?.id === id ? null : this.state.link,
      });
    });
}
