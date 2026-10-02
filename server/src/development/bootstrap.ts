import { randomUUID } from "node:crypto";
import { EnvironmentError } from "../config/env.ts";
import { inTransaction, type TransactionPool } from "../db/transaction.ts";

export interface BootstrapConfig {
  nodeEnv: "development";
  organizerEmail: string;
  memberEmail: string;
}

export function readBootstrapConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): BootstrapConfig {
  if ((environment.NODE_ENV ?? "development") !== "development") {
    throw new EnvironmentError("Event bootstrap is DEVELOPMENT ONLY.");
  }
  const emails = ["ORGANIZER", "MEMBER"].map((label) => {
    const email = environment[`BUDOGRAPH_${label}_EMAIL`]?.trim().toLowerCase();
    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      /REPLACE_/i.test(email)
    ) {
      throw new EnvironmentError(
        `BUDOGRAPH_${label}_EMAIL must identify an existing controlled development user.`,
      );
    }
    return email;
  });
  if (emails[0] === emails[1])
    throw new EnvironmentError("Controlled development users must differ.");
  return {
    nodeEnv: "development",
    organizerEmail: emails[0]!,
    memberEmail: emails[1]!,
  };
}

export interface BootstrapResult {
  eventId: string;
  organizerMemberId: string;
  memberId: string;
  taskId: string;
  results: { resource: string; result: "created" | "already-exists" }[];
}

// This marker names independent real development data, never frontend seed data.
const eventName = "BudoGraph P1 development responsibility loop";
const taskTitle = "Verify the two-user responsibility loop";

export async function bootstrapDevelopmentEvent(
  pool: TransactionPool,
  config: BootstrapConfig,
): Promise<BootstrapResult> {
  if (config.nodeEnv !== "development")
    throw new EnvironmentError("Event bootstrap is DEVELOPMENT ONLY.");
  return inTransaction(pool, async (database) => {
    // Serializes only explicit setup reruns, not runtime task commands.
    await database.query(
      "SELECT pg_catalog.pg_advisory_xact_lock(1112884303, 1345405779)",
    );
    const users = await database.query(
      'SELECT id, email FROM public."user" WHERE email = ANY($1::TEXT[]) AND active = TRUE ORDER BY id FOR SHARE',
      [[config.organizerEmail, config.memberEmail]],
    );
    const identities = users.rows as { id: string; email: string }[];
    const organizer = identities.find(
      (row) => row.email === config.organizerEmail,
    );
    const member = identities.find((row) => row.email === config.memberEmail);
    if (!organizer || !member || organizer.id === member.id)
      throw new Error("Controlled development users unavailable.");
    const results: BootstrapResult["results"] = [];
    const events = await database.query(
      "SELECT id, archived_at FROM public.event WHERE name = $1 AND owner_user_id = $2 FOR UPDATE",
      [eventName, organizer.id],
    );
    const existingEvent = events.rows[0] as
      { id: string; archived_at: Date | null } | undefined;
    if (events.rows.length > 1 || existingEvent?.archived_at)
      throw new Error("Development Event requires investigation.");
    const eventId = existingEvent?.id ?? randomUUID();
    if (!existingEvent)
      await database.query(
        `INSERT INTO public.event (id, name, start_date, end_date, timezone, owner_user_id)
       VALUES ($1, $2, '2026-10-03', '2026-10-04', 'Europe/Sofia', $3)`,
        [eventId, eventName, organizer.id],
      );
    results.push({
      resource: "event",
      result: existingEvent ? "already-exists" : "created",
    });
    const memberIds: string[] = [];
    for (const [identity, role, label] of [
      [organizer, "ORGANIZER", "organizer-membership"],
      [member, "MEMBER", "member-membership"],
    ] as const) {
      const found = await database.query(
        "SELECT id, access_role, active, deactivated_at FROM public.event_member WHERE event_id = $1 AND user_id = $2 FOR UPDATE",
        [eventId, identity.id],
      );
      const existing = found.rows[0] as
        | {
            id: string;
            access_role: string;
            active: boolean;
            deactivated_at: Date | null;
          }
        | undefined;
      if (
        existing &&
        (existing.access_role !== role ||
          !existing.active ||
          existing.deactivated_at !== null)
      ) {
        throw new Error("Development membership requires investigation.");
      }
      const id = existing?.id ?? randomUUID();
      if (!existing)
        await database.query(
          "INSERT INTO public.event_member (id, event_id, user_id, access_role, operational_role) VALUES ($1, $2, $3, $4, 'Development verification')",
          [id, eventId, identity.id, role],
        );
      memberIds.push(id);
      results.push({
        resource: label,
        result: existing ? "already-exists" : "created",
      });
    }
    const tasks = await database.query(
      "SELECT id, deleted_at FROM public.task WHERE event_id = $1 AND title = $2 FOR UPDATE",
      [eventId, taskTitle],
    );
    const existingTask = tasks.rows[0] as
      { id: string; deleted_at: Date | null } | undefined;
    if (tasks.rows.length > 1 || existingTask?.deleted_at)
      throw new Error("Development task requires investigation.");
    const taskId = existingTask?.id ?? randomUUID();
    if (!existingTask)
      await database.query(
        `INSERT INTO public.task (id, event_id, title, category, context, deadline, created_by, updated_by)
       VALUES ($1, $2, $3, 'development', 'Explicit backend development verification fixture', '2026-10-04', $4, $4)`,
        [taskId, eventId, taskTitle, memberIds[0]],
      );
    results.push({
      resource: "task",
      result: existingTask ? "already-exists" : "created",
    });
    return {
      eventId,
      organizerMemberId: memberIds[0]!,
      memberId: memberIds[1]!,
      taskId,
      results,
    };
  });
}
