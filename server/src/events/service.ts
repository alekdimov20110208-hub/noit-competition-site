import type { AuthenticatedUser } from "../auth/session.ts";
import { UnauthorizedError } from "../auth/session.ts";
import type {
  AuthorizationDatabase,
  AccessRole,
} from "../authorization/events.ts";

export interface AccessibleEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
  membership: { id: string; accessRole: AccessRole };
}

export function createEventReadService(database: AuthorizationDatabase) {
  return {
    async list(user: AuthenticatedUser): Promise<AccessibleEvent[]> {
      if (!user?.id) throw new UnauthorizedError();
      const { rows } = await database.query(
        `SELECT event.id, event.name, to_char(event.start_date, 'YYYY-MM-DD') AS start_date,
                to_char(event.end_date, 'YYYY-MM-DD') AS end_date, event.timezone,
                member.id AS member_id, member.access_role
         FROM public.event AS event
         JOIN public.event_member AS member ON member.event_id = event.id
         JOIN public."user" AS identity ON identity.id = member.user_id
         WHERE member.user_id = $1 AND member.active = TRUE
           AND member.deactivated_at IS NULL AND identity.active = TRUE
         ORDER BY event.start_date, event.id`,
        [user.id],
      );
      return rows.map((value) => {
        const row = value as {
          id: string;
          name: string;
          start_date: string;
          end_date: string;
          timezone: string;
          member_id: string;
          access_role: AccessRole;
        };
        return {
          id: row.id,
          name: row.name,
          startDate: row.start_date,
          endDate: row.end_date,
          timezone: row.timezone,
          membership: { id: row.member_id, accessRole: row.access_role },
        };
      });
    },
  };
}

export type EventReadService = ReturnType<typeof createEventReadService>;
