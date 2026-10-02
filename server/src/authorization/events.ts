import type { AuthenticatedUser } from "../auth/session.ts";

export type AccessRole = "ORGANIZER" | "MEMBER";

export interface EventMembership {
  readonly id: string;
  readonly eventId: string;
  readonly userId: string;
  readonly accessRole: AccessRole;
  readonly operationalRole: string;
  readonly active: boolean;
  readonly deactivatedAt: Date | null;
  readonly version: number;
}

export interface AssignedTask {
  readonly id: string;
  readonly eventId: string;
  readonly assignedMemberId: string | null;
  readonly version: number;
}

// Compatible with pg.Pool or a checked-out transaction client. No ORM is needed.
export interface AuthorizationDatabase {
  query(text: string, values: unknown[]): Promise<{ rows: unknown[] }>;
}

export class AuthorizationError extends Error {
  readonly statusCode: 403 | 404;

  constructor(statusCode: 403 | 404) {
    super(statusCode === 404 ? "Resource not found." : "Action forbidden.");
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
  }
}

const businessId = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function membershipFromRow(row: unknown): EventMembership | null {
  if (typeof row !== "object" || row === null) return null;
  const member = row as Record<string, unknown>;
  if (
    typeof member.id !== "string" ||
    typeof member.event_id !== "string" ||
    typeof member.user_id !== "string" ||
    !["ORGANIZER", "MEMBER"].includes(String(member.access_role)) ||
    typeof member.operational_role !== "string" ||
    typeof member.active !== "boolean" ||
    !(
      member.deactivated_at === null || member.deactivated_at instanceof Date
    ) ||
    typeof member.version !== "number" ||
    !Number.isInteger(member.version) ||
    member.version < 1
  ) {
    return null;
  }
  return Object.freeze({
    id: member.id,
    eventId: member.event_id,
    userId: member.user_id,
    accessRole: member.access_role as AccessRole,
    operationalRole: member.operational_role,
    active: member.active,
    deactivatedAt: member.deactivated_at as Date | null,
    version: member.version,
  });
}

export interface EventAuthorizationOptions<Request> {
  database: AuthorizationDatabase;
  // Bind this to the Better Auth session boundary. Never to request body fields.
  requireAuthenticatedUser: (request: Request) => Promise<AuthenticatedUser>;
}

export function createEventAuthorization<Request>({
  database,
  requireAuthenticatedUser,
}: EventAuthorizationOptions<Request>) {
  async function getEventMembership(
    request: Request,
    eventId: string,
  ): Promise<EventMembership | null> {
    // Authentication always precedes identifiers, membership, and permissions.
    const user = await requireAuthenticatedUser(request);
    if (!businessId.test(eventId)) return null;
    const { rows } = await database.query(
      `SELECT member.id, member.event_id, member.user_id, member.access_role,
              member.operational_role, member.active, member.deactivated_at, member.version
       FROM public.event_member AS member
       JOIN public."user" AS identity ON identity.id = member.user_id
       WHERE member.event_id = $1 AND member.user_id = $2 AND identity.active = TRUE`,
      [eventId, user.id],
    );
    const membership = membershipFromRow(rows[0]);
    // Defense in depth: a miswired query boundary cannot authorize foreign rows.
    return membership?.eventId === eventId && membership.userId === user.id
      ? membership
      : null;
  }

  async function requireActiveEventMembership(
    request: Request,
    eventId: string,
  ): Promise<EventMembership> {
    const membership = await getEventMembership(request, eventId);
    if (!membership?.active || membership.deactivatedAt !== null) {
      throw new AuthorizationError(404);
    }
    return membership;
  }

  async function requireOrganizerMembership(
    request: Request,
    eventId: string,
  ): Promise<EventMembership> {
    const membership = await requireActiveEventMembership(request, eventId);
    if (membership.accessRole !== "ORGANIZER") {
      throw new AuthorizationError(403);
    }
    return membership;
  }

  async function requireOwnAssignedTask(
    request: Request,
    eventId: string,
    taskId: string,
  ): Promise<{ membership: EventMembership; task: AssignedTask }> {
    const membership = await requireActiveEventMembership(request, eventId);
    if (!businessId.test(taskId)) throw new AuthorizationError(404);
    const { rows } = await database.query(
      `SELECT id, event_id, assigned_member_id, version
       FROM public.task
       WHERE event_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [eventId, taskId],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row || row.id !== taskId || row.event_id !== eventId) {
      throw new AuthorizationError(404);
    }
    if (row.assigned_member_id !== membership.id) {
      throw new AuthorizationError(403);
    }
    if (
      typeof row.version !== "number" ||
      !Number.isInteger(row.version) ||
      row.version < 1
    ) {
      throw new AuthorizationError(404);
    }
    return {
      membership,
      task: Object.freeze({
        id: taskId,
        eventId,
        assignedMemberId: membership.id,
        version: row.version,
      }),
    };
  }

  return Object.freeze({
    getEventMembership,
    requireActiveEventMembership,
    requireOrganizerMembership,
    requireOwnAssignedTask,
  });
}
