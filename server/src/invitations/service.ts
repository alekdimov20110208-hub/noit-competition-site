import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "../auth/session.ts";
import { UnauthorizedError } from "../auth/session.ts";
import {
  inTransaction,
  type TransactionPool,
  type TransactionDatabase,
} from "../db/transaction.ts";
import type { AuthorizationDatabase } from "../authorization/events.ts";
import { uuidPattern } from "../tasks/model.ts";
import { OperationalError } from "../operations/limits.ts";
import {
  exactInput,
  generateInvitationToken,
  hashInvitationToken,
  InvitationError,
  invitationDto,
  invitationLifetimeSeconds,
  invitationState,
  normalizeEmail,
  parseInvitedEmail,
  type InvitationRow,
} from "./model.ts";

type Database = TransactionPool & AuthorizationDatabase;
export type RegisterInvitedAccount = (
  fields: {
    email: string;
    name: string;
    password: string;
  },
  locale?: "bg" | "en",
  returnTo?: string,
  database?: TransactionDatabase,
) => Promise<void | (() => Promise<void>)>;
const columns = `id, event_id, invited_email, inviter_user_id, created_at, expires_at,
  accepted_at, accepted_user_id, revoked_at, expires_at <= clock_timestamp() AS expired`;
function authenticated(user: AuthenticatedUser) {
  if (!user?.id) throw new UnauthorizedError();
}
function eventId(value: string) {
  if (!uuidPattern.test(value)) throw new InvitationError(404, "NOT_FOUND");
  return value.toLowerCase();
}
async function lockEvent(tx: TransactionDatabase, id: string) {
  const result = await tx.query(
    "SELECT id, name, archived_at FROM public.event WHERE id=$1 FOR UPDATE",
    [id],
  );
  const row = result.rows[0] as
    { id: string; name: string; archived_at: Date | null } | undefined;
  if (!row) throw new InvitationError(404, "NOT_FOUND");
  return row;
}
async function organizer(
  tx: TransactionDatabase,
  id: string,
  user: AuthenticatedUser,
) {
  const result = await tx.query(
    `SELECT member.id, member.access_role FROM public.event_member member
    JOIN public."user" identity ON identity.id=member.user_id
    WHERE member.event_id=$1 AND member.user_id=$2 AND member.active=TRUE
      AND member.deactivated_at IS NULL AND identity.active=TRUE FOR SHARE OF member, identity`,
    [id, user.id],
  );
  const actor = result.rows[0] as
    { id: string; access_role: string } | undefined;
  if (!actor) throw new InvitationError(404, "NOT_FOUND");
  if (actor.access_role !== "ORGANIZER")
    throw new InvitationError(403, "FORBIDDEN");
  return actor.id;
}
async function activity(
  tx: TransactionDatabase,
  row: InvitationRow,
  user: AuthenticatedUser,
  memberId: string,
  action: string,
) {
  await tx.query(
    `INSERT INTO public.activity_entry
    (id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload,created_at)
    VALUES ($1,$2,$3,$4,$5,'invitation',$6,'{}'::JSONB,clock_timestamp())`,
    [randomUUID(), row.event_id, user.id, memberId, action, row.id],
  );
}
function joinable(row: InvitationRow, archived: Date | null) {
  const state = invitationState(row);
  if (state !== "pending")
    throw new InvitationError(
      state === "accepted" ? 409 : 410,
      `INVITATION_${state.toUpperCase()}`,
    );
  if (archived !== null)
    throw new InvitationError(410, "INVITATION_UNAVAILABLE");
}
export function createInvitationService(
  database: Database,
  registerAccount?: RegisterInvitedAccount,
  requireVerifiedEmail = false,
  prepareRegistration: () => Promise<void> = async () => {},
  recordEmail?: (
    tx: TransactionDatabase,
    result: {
      invitation: ReturnType<typeof invitationDto>;
      token: string;
      eventName: string;
    },
    locale?: "bg" | "en",
  ) => Promise<string>,
) {
  async function lockedToken<T>(
    token: string,
    work: (
      tx: TransactionDatabase,
      row: InvitationRow,
      event: Awaited<ReturnType<typeof lockEvent>>,
    ) => Promise<T>,
  ) {
    const hash = hashInvitationToken(token);
    return inTransaction(database, async (tx) => {
      // Discover scope, then use the existing Event-before-business-row lock order.
      const scope = await tx.query(
        "SELECT event_id FROM public.event_invitation WHERE token_hash=$1",
        [hash],
      );
      const id = (scope.rows[0] as { event_id: string } | undefined)?.event_id;
      if (!id) throw new InvitationError(404, "NOT_FOUND");
      const event = await lockEvent(tx, id);
      const result = await tx.query(
        `SELECT ${columns} FROM public.event_invitation WHERE token_hash=$1 AND event_id=$2 FOR UPDATE`,
        [hash, id],
      );
      const row = result.rows[0] as InvitationRow | undefined;
      if (!row) throw new InvitationError(404, "NOT_FOUND");
      return work(tx, row, event);
    });
  }
  return {
    async create(
      user: AuthenticatedUser,
      scope: string,
      input: unknown,
      locale?: "bg" | "en",
    ) {
      authenticated(user);
      const id = eventId(scope),
        email = parseInvitedEmail(exactInput(input, ["email"]).email);
      return inTransaction(database, async (tx) => {
        const event = await lockEvent(tx, id),
          actor = await organizer(tx, id, user);
        if (event.archived_at !== null)
          throw new InvitationError(403, "EVENT_ARCHIVED");
        const members = await tx.query(
          `SELECT member.active FROM public.event_member member
          JOIN public."user" identity ON identity.id=member.user_id
          WHERE member.event_id=$1 AND lower(btrim(identity.email))=$2 FOR SHARE OF member, identity`,
          [id, email],
        );
        if (members.rows.length)
          throw new InvitationError(
            409,
            (members.rows[0] as { active: boolean }).active
              ? "ALREADY_MEMBER"
              : "INACTIVE_MEMBER",
          );
        const pending = await tx.query(
          `SELECT id FROM public.event_invitation WHERE event_id=$1 AND invited_email=$2
          AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > clock_timestamp()`,
          [id, email],
        );
        if (pending.rows.length)
          throw new InvitationError(409, "ALREADY_PENDING");
        const token = generateInvitationToken();
        const result = await tx.query(
          `INSERT INTO public.event_invitation (id,event_id,invited_email,inviter_user_id,token_hash,expires_at)
          VALUES ($1,$2,$3,$4,$5,clock_timestamp()+$6*interval '1 second') RETURNING ${columns}`,
          [
            randomUUID(),
            id,
            email,
            user.id,
            hashInvitationToken(token),
            invitationLifetimeSeconds,
          ],
        );
        const row = result.rows[0] as InvitationRow;
        await activity(tx, row, user, actor, "invitation.created");
        // One response only. No token retrieval, raw-token persistence or history.
        const created = {
          invitation: invitationDto(row),
          token,
          eventName: event.name,
        };
        return {
          ...created,
          ...(recordEmail
            ? { emailJob: await recordEmail(tx, created, locale) }
            : {}),
        };
      });
    },
    async list(user: AuthenticatedUser, scope: string) {
      authenticated(user);
      const id = eventId(scope);
      return inTransaction(database, async (tx) => {
        await lockEvent(tx, id);
        await organizer(tx, id, user);
        const result = await tx.query(
          `SELECT ${columns} FROM public.event_invitation WHERE event_id=$1
          AND accepted_at IS NULL AND revoked_at IS NULL ORDER BY created_at,id`,
          [id],
        );
        return (result.rows as InvitationRow[]).map(invitationDto);
      });
    },
    async resend(
      user: AuthenticatedUser,
      scope: string,
      invitationId: string,
      locale?: "bg" | "en",
    ) {
      authenticated(user);
      const id = eventId(scope),
        invite = eventId(invitationId);
      return inTransaction(database, async (tx) => {
        const event = await lockEvent(tx, id);
        await organizer(tx, id, user);
        const result = await tx.query(
          `SELECT ${columns} FROM public.event_invitation WHERE event_id=$1 AND id=$2 FOR UPDATE`,
          [id, invite],
        );
        const row = result.rows[0] as InvitationRow | undefined;
        if (!row) throw new InvitationError(404, "NOT_FOUND");
        joinable(row, event.archived_at);
        const members = await tx.query(
          `SELECT member.id FROM public.event_member member JOIN public."user" identity ON identity.id=member.user_id WHERE member.event_id=$1 AND lower(btrim(identity.email))=$2 FOR SHARE OF member, identity`,
          [id, row.invited_email],
        );
        if (members.rows.length)
          throw new InvitationError(409, "ALREADY_MEMBER");
        const token = generateInvitationToken();
        await tx.query(
          "UPDATE public.event_invitation SET token_hash=$2 WHERE id=$1",
          [invite, hashInvitationToken(token)],
        );
        // Latest resend invalidates old links; original expiry and invitation ID remain.
        const resent = {
          invitation: invitationDto(row),
          token,
          eventName: event.name,
        };
        return {
          ...resent,
          ...(recordEmail
            ? { emailJob: await recordEmail(tx, resent, locale) }
            : {}),
        };
      });
    },
    async revoke(
      user: AuthenticatedUser,
      scope: string,
      invitationId: string,
      input: unknown,
    ) {
      authenticated(user);
      exactInput(input ?? {}, []);
      const id = eventId(scope),
        invite = eventId(invitationId);
      return inTransaction(database, async (tx) => {
        const event = await lockEvent(tx, id),
          actor = await organizer(tx, id, user);
        if (event.archived_at !== null)
          throw new InvitationError(403, "EVENT_ARCHIVED");
        const result = await tx.query(
          `SELECT ${columns} FROM public.event_invitation WHERE event_id=$1 AND id=$2 FOR UPDATE`,
          [id, invite],
        );
        const row = result.rows[0] as InvitationRow | undefined;
        if (!row) throw new InvitationError(404, "NOT_FOUND");
        if (row.revoked_at) return invitationDto(row);
        joinable(row, null);
        const updated = await tx.query(
          `UPDATE public.event_invitation SET revoked_at=clock_timestamp() WHERE id=$1 RETURNING ${columns}`,
          [invite],
        );
        await activity(tx, row, user, actor, "invitation.revoked");
        return invitationDto(updated.rows[0] as InvitationRow);
      });
    },
    async lookup(token: string) {
      const hash = hashInvitationToken(token);
      const result = await database.query(
        `SELECT invite.invited_email, invite.expires_at, invite.accepted_at, invite.revoked_at,
        invite.expires_at <= clock_timestamp() AS expired, event.name, event.archived_at
        FROM public.event_invitation invite JOIN public.event event ON event.id=invite.event_id WHERE invite.token_hash=$1`,
        [hash],
      );
      const row = result.rows[0] as
        | (InvitationRow & { name: string; archived_at: Date | null })
        | undefined;
      if (!row) throw new InvitationError(404, "NOT_FOUND");
      const state = invitationState(row);
      if (state !== "pending") return { state };
      if (row.archived_at !== null) return { state: "unavailable" };
      return {
        state,
        eventName: row.name,
        email: row.invited_email,
        expiresAt: row.expires_at.toISOString(),
      };
    },
    async register(
      token: string,
      input: unknown,
      locale?: "bg" | "en",
      verificationRequired = false,
    ) {
      const fields = exactInput(input, ["name", "password"]);
      if (
        typeof fields.name !== "string" ||
        !fields.name.trim() ||
        fields.name.trim().length > 100 ||
        // eslint-disable-next-line no-control-regex -- Reject unsafe control characters before PostgreSQL.
        /[\u0000-\u001f\u007f\ud800-\udfff]/u.test(fields.name) ||
        typeof fields.password !== "string" ||
        fields.password.length < 8 ||
        fields.password.length > 128
      )
        throw new InvitationError(400, "INVALID_REGISTRATION");
      if (!registerAccount) throw new InvitationError(503, "UNAVAILABLE");
      await prepareRegistration();
      const dispatch = await lockedToken(token, async (tx, row, event) => {
        joinable(row, event.archived_at);
        // The runtime callback binds Better Auth to this owned transaction.
        // Only a post-COMMIT email effect may escape the transaction callback.
        let afterCommit: void | (() => Promise<void>);
        try {
          afterCommit = await registerAccount(
            {
              email: row.invited_email,
              name: fields.name!.toString().trim(),
              password: fields.password as string,
            },
            locale,
            `/invite/${token}`,
            tx,
          );
        } catch (error) {
          if (error instanceof OperationalError) throw error;
          throw new InvitationError(400, "REGISTRATION_FAILED");
        }
        // Clock-based expiry can change while hashing, even with the row locked.
        const refreshed = await tx.query(
          `SELECT ${columns} FROM public.event_invitation WHERE id=$1`,
          [row.id],
        );
        joinable(refreshed.rows[0] as InvitationRow, event.archived_at);
        return afterCommit;
      });
      await dispatch?.();
      return {
        status: verificationRequired
          ? "verification_required"
          : "sign_in_required",
      };
    },
    async accept(user: AuthenticatedUser, token: string, input: unknown) {
      authenticated(user);
      exactInput(input ?? {}, []);
      return lockedToken(token, async (tx, row, event) => {
        const identities = await tx.query(
          'SELECT id,email,"emailVerified" FROM public."user" WHERE id=$1 AND active=TRUE FOR SHARE',
          [user.id],
        );
        const identity = identities.rows[0] as
          { id: string; email: string; emailVerified: boolean } | undefined;
        if (!identity) throw new UnauthorizedError();
        if (normalizeEmail(identity.email) !== row.invited_email)
          throw new InvitationError(403, "WRONG_ACCOUNT");
        if (requireVerifiedEmail && !identity.emailVerified)
          throw new InvitationError(403, "EMAIL_NOT_VERIFIED");
        const members = await tx.query(
          `SELECT id,access_role,active,deactivated_at FROM public.event_member
          WHERE event_id=$1 AND user_id=$2 FOR SHARE`,
          [row.event_id, user.id],
        );
        let member = members.rows[0] as
          | {
              id: string;
              access_role: string;
              active: boolean;
              deactivated_at: Date | null;
            }
          | undefined;
        if (row.accepted_at) {
          if (
            row.accepted_user_id !== user.id ||
            !member?.active ||
            member.deactivated_at !== null ||
            event.archived_at !== null
          )
            throw new InvitationError(409, "INVITATION_UNAVAILABLE");
          return { eventId: row.event_id, status: "already_accepted" };
        }
        joinable(row, event.archived_at);
        if (member && (!member.active || member.deactivated_at !== null))
          throw new InvitationError(409, "INACTIVE_MEMBER");
        if (!member) {
          const id = randomUUID();
          await tx.query(
            `INSERT INTO public.event_member (id,event_id,user_id,access_role,operational_role,active)
            VALUES ($1,$2,$3,'MEMBER','',TRUE)`,
            [id, row.event_id, user.id],
          );
          member = {
            id,
            access_role: "MEMBER",
            active: true,
            deactivated_at: null,
          };
        }
        const consumed = await tx.query(
          `UPDATE public.event_invitation SET accepted_at=clock_timestamp(),accepted_user_id=$2
           WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL
             AND expires_at > clock_timestamp() RETURNING id`,
          [row.id, user.id],
        );
        if (!consumed.rows.length)
          throw new InvitationError(410, "INVITATION_EXPIRED");
        await activity(tx, row, user, member.id, "invitation.accepted");
        return { eventId: row.event_id, status: "accepted" };
      });
    },
  };
}
export type InvitationService = ReturnType<typeof createInvitationService>;
