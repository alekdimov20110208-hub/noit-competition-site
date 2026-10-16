import { insertAuthoredTaskRecord, saveTaskReminders } from "./creation.ts";
import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "../auth/session.ts";
import { UnauthorizedError } from "../auth/session.ts";
import { recordTaskAssignment } from "../notifications/service.ts";
import {
  inTransaction,
  type TransactionDatabase,
  type TransactionPool,
} from "../db/transaction.ts";
import {
  parseTaskCommand,
  parseTaskAuthoring,
  TaskCommandError,
  taskColumns,
  taskDto,
  uuidPattern,
  type TaskCommand,
  type TaskDto,
  type TaskRow,
  type TaskFields,
} from "./model.ts";

interface ActorMembership {
  id: string;
  access_role: "ORGANIZER" | "MEMBER";
}

async function authorizeEvent(
  database: TransactionDatabase,
  eventId: string,
  userId: string,
  writing: boolean,
): Promise<ActorMembership> {
  const events = await database.query(
    "SELECT archived_at FROM public.event WHERE id = $1 FOR SHARE",
    [eventId],
  );
  const event = events.rows[0] as { archived_at: Date | null } | undefined;
  // Lock active identity and membership through commit. FOR SHARE also conflicts
  // with non-key updates (active/access_role), unlike FOR KEY SHARE.
  const members = await database.query(
    `SELECT member.id, member.access_role FROM public.event_member AS member
     JOIN public."user" AS identity ON identity.id = member.user_id
     WHERE member.event_id = $1 AND member.user_id = $2
       AND member.active = TRUE AND member.deactivated_at IS NULL AND identity.active = TRUE
     FOR SHARE OF member, identity`,
    [eventId, userId],
  );
  const actor = members.rows[0] as ActorMembership | undefined;
  if (!actor) throw new TaskCommandError(404, "NOT_FOUND");
  if (!event) throw new TaskCommandError(404, "NOT_FOUND");
  // Archive authoring is out of scope; conservatively deny writes to an archive.
  if (writing && event.archived_at !== null)
    throw new TaskCommandError(403, "EVENT_ARCHIVED");
  return actor;
}

async function requireAssignee(
  database: TransactionDatabase,
  eventId: string,
  memberId: string,
) {
  const result = await database.query(
    `SELECT member.id FROM public.event_member AS member
     JOIN public."user" AS identity ON identity.id = member.user_id
     WHERE member.event_id = $1 AND member.id = $2 AND member.active = TRUE
       AND member.deactivated_at IS NULL AND identity.active = TRUE
     FOR SHARE OF member, identity`,
    [eventId, memberId],
  );
  if (!result.rows.length)
    throw new TaskCommandError(404, "ASSIGNEE_NOT_FOUND");
}

function scopedIds(eventId: string, taskId?: string) {
  if (
    !uuidPattern.test(eventId) ||
    (taskId !== undefined && !uuidPattern.test(taskId))
  ) {
    throw new TaskCommandError(400, "INVALID_ID");
  }
  return { eventId: eventId.toLowerCase(), taskId: taskId?.toLowerCase() };
}

export function createTaskService(pool: TransactionPool) {
  async function readSnapshot(
    user: AuthenticatedUser,
    event: string,
    task?: string,
    includeAssignees = false,
  ) {
    if (!user?.id) throw new UnauthorizedError();
    const { eventId, taskId } = scopedIds(event, task);
    return inTransaction(pool, async (database) => {
      await authorizeEvent(database, eventId, user.id, false);
      const result = await database.query(
        `SELECT ${taskColumns} FROM public.task WHERE event_id = $1 AND deleted_at IS NULL
         ${taskId ? "AND id = $2" : ""} ORDER BY deadline, id`,
        taskId ? [eventId, taskId] : [eventId],
      );
      if (taskId && !result.rows.length)
        throw new TaskCommandError(404, "NOT_FOUND");
      const tasks = (result.rows as TaskRow[]).map(taskDto);
      // Only task-referenced membership summaries, including historical inactive
      // assignees. This is task display context, not the Team product/API.
      const members = includeAssignees
        ? await database.query(
            `SELECT member.id, identity.name, member.operational_role AS role
         FROM public.event_member AS member
         JOIN public."user" AS identity ON identity.id = member.user_id
         WHERE member.event_id = $1 AND member.id = ANY($2::UUID[])
         ORDER BY member.id`,
            [
              eventId,
              [
                ...new Set(
                  tasks.flatMap((task) =>
                    task.assignedMemberId ? [task.assignedMemberId] : [],
                  ),
                ),
              ],
            ],
          )
        : { rows: [] };
      return {
        tasks,
        members: members.rows as { id: string; name: string; role: string }[],
      };
    });
  }

  async function read(
    user: AuthenticatedUser,
    event: string,
    task?: string,
  ): Promise<TaskDto[]> {
    return (await readSnapshot(user, event, task)).tasks;
  }

  async function readForWorkspace(user: AuthenticatedUser, event: string) {
    return readSnapshot(user, event, undefined, true);
  }

  async function readAssignableMembers(user: AuthenticatedUser, event: string) {
    if (!user?.id) throw new UnauthorizedError();
    const { eventId } = scopedIds(event);
    return inTransaction(pool, async (database) => {
      await authorizeEvent(database, eventId, user.id, false);
      const { rows } = await database.query(
        `SELECT member.id, identity.name, member.operational_role AS role
         FROM public.event_member AS member
         JOIN public."user" AS identity ON identity.id = member.user_id
         WHERE member.event_id = $1 AND member.active = TRUE
           AND member.deactivated_at IS NULL AND identity.active = TRUE
         ORDER BY identity.name, member.id`,
        [eventId],
      );
      return rows.map((value) => {
        const row = value as { id: string; name: string; role: string };
        return { id: row.id, name: row.name, role: row.role };
      });
    });
  }

  async function mutate(
    user: AuthenticatedUser,
    event: string,
    task: string,
    kind: TaskCommand["kind"],
    input: unknown,
  ): Promise<TaskDto> {
    if (!user?.id) throw new UnauthorizedError();
    const { eventId, taskId } = scopedIds(event, task);
    const command = parseTaskCommand(kind, input);
    return inTransaction(pool, async (database) => {
      const actor = await authorizeEvent(database, eventId, user.id, true);
      if (command.kind === "assignment" && actor.access_role !== "ORGANIZER") {
        throw new TaskCommandError(403, "FORBIDDEN");
      }
      const result = await database.query(
        `SELECT ${taskColumns} FROM public.task
         WHERE event_id = $1 AND id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [eventId, taskId],
      );
      const before = result.rows[0] as TaskRow | undefined;
      if (!before) throw new TaskCommandError(404, "NOT_FOUND");
      if (
        (command.kind === "acceptance" ||
          (command.kind === "status" && actor.access_role !== "ORGANIZER")) &&
        before.assigned_member_id !== actor.id
      )
        throw new TaskCommandError(403, "FORBIDDEN");
      // Check BEFORE no-op handling. A repeated old request is still a conflict.
      if (before.version !== command.expectedVersion)
        throw new TaskCommandError(409, "TASK_VERSION_CONFLICT");

      let assignment = before.assigned_member_id;
      let acceptedBy = before.accepted_by_member_id;
      let acceptedAt = before.accepted_at;
      let status = before.status;
      let action: string;
      let payload: Record<string, unknown>;
      if (command.kind === "assignment") {
        if (command.assignedMemberId)
          await requireAssignee(database, eventId, command.assignedMemberId);
        if (assignment === command.assignedMemberId) return taskDto(before);
        action =
          command.assignedMemberId === null
            ? "task.unassigned"
            : assignment === null
              ? "task.assigned"
              : "task.reassigned";
        assignment = command.assignedMemberId;
        acceptedBy = null;
        acceptedAt = null;
        payload = {
          previousAssignedMemberId: before.assigned_member_id,
          assignedMemberId: assignment,
          previousAcceptedByMemberId: before.accepted_by_member_id,
          previousAcceptedAt: before.accepted_at?.toISOString() ?? null,
          acceptanceCleared: before.accepted_by_member_id !== null,
        };
      } else if (command.kind === "acceptance") {
        if ((acceptedBy !== null) === command.accepted) return taskDto(before);
        if (!command.accepted && acceptedBy !== actor.id)
          throw new TaskCommandError(403, "FORBIDDEN");
        action = command.accepted
          ? "task.accepted"
          : "task.acceptance_withdrawn";
        acceptedBy = command.accepted ? actor.id : null;
        // The database assigns the instant in UPDATE; no client time is used.
        acceptedAt = null;
        payload = {
          assignedMemberId: assignment,
          previousAcceptedByMemberId: before.accepted_by_member_id,
          previousAcceptedAt: before.accepted_at?.toISOString() ?? null,
          acceptedByMemberId: acceptedBy,
        };
      } else {
        if (status === command.status) return taskDto(before);
        action = "task.status_changed";
        status = command.status;
        payload = { previousStatus: before.status, status };
      }
      const updated = await database.query(
        `UPDATE public.task SET assigned_member_id = $3, accepted_by_member_id = $4,
           accepted_at = CASE WHEN $5::BOOLEAN THEN clock_timestamp() ELSE $6::TIMESTAMPTZ END,
           status = $7, version = version + 1, updated_by = $8, updated_at = clock_timestamp()
         WHERE event_id = $1 AND id = $2 AND deleted_at IS NULL AND version = $9
         RETURNING ${taskColumns}`,
        [
          eventId,
          taskId,
          assignment,
          acceptedBy,
          command.kind === "acceptance" && command.accepted,
          acceptedAt,
          status,
          actor.id,
          command.expectedVersion,
        ],
      );
      const after = updated.rows[0] as TaskRow | undefined;
      if (!after) throw new TaskCommandError(409, "TASK_VERSION_CONFLICT");
      await database.query(
        `INSERT INTO public.activity_entry
           (id, event_id, actor_user_id, actor_member_id, action_type, target_type, target_id, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, 'task', $6, $7::JSONB, clock_timestamp())`,
        [
          randomUUID(),
          eventId,
          user.id,
          actor.id,
          action,
          taskId,
          JSON.stringify({
            ...payload,
            acceptedAt: after.accepted_at?.toISOString() ?? null,
            taskVersion: after.version,
          }),
        ],
      );
      if (command.kind === "assignment" && assignment !== null)
        await recordTaskAssignment(database, eventId, taskId!, user.id);
      return taskDto(after);
    });
  }

  async function author(
    user: AuthenticatedUser,
    event: string,
    input: unknown,
    task?: string,
  ): Promise<TaskDto> {
    if (!user?.id) throw new UnauthorizedError();
    const { eventId, taskId } = scopedIds(event, task);
    const editing = taskId !== undefined;
    const command = parseTaskAuthoring(input, editing);
    return inTransaction(pool, async (database) => {
      const actor = await authorizeEvent(database, eventId, user.id, true);
      if (actor.access_role !== "ORGANIZER")
        throw new TaskCommandError(403, "FORBIDDEN");
      let after: TaskRow;
      let payload: Record<string, unknown>;
      const targetId = taskId ?? randomUUID();
      if (editing) {
        const result = await database.query(
          `SELECT ${taskColumns} FROM public.task WHERE event_id = $1 AND id = $2 AND deleted_at IS NULL FOR UPDATE`,
          [eventId, targetId],
        );
        const before = result.rows[0] as TaskRow | undefined;
        if (!before) throw new TaskCommandError(404, "NOT_FOUND");
        if (before.version !== command.expectedVersion)
          throw new TaskCommandError(409, "TASK_VERSION_CONFLICT");
        const changes: Record<string, { before: unknown; after: unknown }> = {};
        const fields: TaskFields = {
          title: command.title ?? before.title,
          category: command.category ?? before.category,
          context: command.context ?? before.context,
          deadline: command.deadline ?? before.deadline,
          deadlineTime: Object.hasOwn(command, "deadlineTime")
            ? command.deadlineTime!
            : before.deadlineTime,
          reminderOffsets:
            command.reminderOffsets ?? before.reminderOffsets ?? [],
          priority: command.priority ?? before.priority,
        };
        if (fields.deadlineTime === null) {
          if (
            Object.hasOwn(command, "deadlineTime") &&
            command.deadlineTime === null
          )
            fields.reminderOffsets = [];
          else if (fields.reminderOffsets.length)
            throw new TaskCommandError(400, "INVALID_TASK_COMMAND", {
              reminderOffsets: "REMINDERS_REQUIRE_TIME",
            });
        }
        before.reminderOffsets ??= [];
        for (const key of Object.keys(fields) as (keyof TaskFields)[]) {
          if (JSON.stringify(fields[key]) !== JSON.stringify(before[key]))
            changes[key] = { before: before[key], after: fields[key] };
        }
        if (!Object.keys(changes).length) return taskDto(before);
        const updated = await database.query(
          `UPDATE public.task SET title = $3, category = $4, context = $5, deadline = $6::DATE,
             priority = $7, updated_by = $8, updated_at = clock_timestamp(), version = version + 1,
             deadline_time = $10::TIME
           WHERE event_id = $1 AND id = $2 AND deleted_at IS NULL AND version = $9 RETURNING ${taskColumns}`,
          [
            eventId,
            targetId,
            fields.title,
            fields.category,
            fields.context,
            fields.deadline,
            fields.priority,
            actor.id,
            command.expectedVersion,
            fields.deadlineTime,
          ],
        );
        after = updated.rows[0] as TaskRow;
        if (!after) throw new TaskCommandError(409, "TASK_VERSION_CONFLICT");
        await saveTaskReminders(database, targetId, fields.reminderOffsets);
        after.reminderOffsets = fields.reminderOffsets;
        payload = {
          changes,
          previousVersion: before.version,
          taskVersion: after.version,
        };
      } else {
        if (command.reminderOffsets?.length && command.deadlineTime === null)
          throw new TaskCommandError(400, "INVALID_TASK_COMMAND", {
            reminderOffsets: "REMINDERS_REQUIRE_TIME",
          });
        if (command.assignedMemberId) {
          try {
            await requireAssignee(database, eventId, command.assignedMemberId);
          } catch (error) {
            if (
              error instanceof TaskCommandError &&
              error.code === "ASSIGNEE_NOT_FOUND"
            )
              throw new TaskCommandError(400, "INVALID_TASK_COMMAND", {
                assignedMemberId: "INVALID_ASSIGNEE",
              });
            throw error;
          }
        }
        after = await insertAuthoredTaskRecord(
          database,
          eventId,
          actor.id,
          command,
          targetId,
        );
        payload = {
          title: after.title,
          category: after.category,
          deadline: after.deadline,
          deadlineTime: after.deadlineTime,
          reminderOffsets: after.reminderOffsets,
          priority: after.priority,
          assignedMemberId: after.assigned_member_id,
          taskVersion: after.version,
        };
      }
      await database.query(
        `INSERT INTO public.activity_entry (id, event_id, actor_user_id, actor_member_id, action_type, target_type, target_id, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, 'task', $6, $7::JSONB, clock_timestamp())`,
        [
          randomUUID(),
          eventId,
          user.id,
          actor.id,
          editing ? "task.updated" : "task.created",
          targetId,
          JSON.stringify(payload),
        ],
      );
      if (!editing && after.assigned_member_id !== null)
        await recordTaskAssignment(database, eventId, targetId, user.id);
      return taskDto(after);
    });
  }

  return {
    read,
    readForWorkspace,
    readAssignableMembers,
    mutate,
    create: (user: AuthenticatedUser, event: string, input: unknown) =>
      author(user, event, input),
    updateDetails: (
      user: AuthenticatedUser,
      event: string,
      task: string,
      input: unknown,
    ) => author(user, event, input, task),
  };
}

export type TaskService = ReturnType<typeof createTaskService>;
