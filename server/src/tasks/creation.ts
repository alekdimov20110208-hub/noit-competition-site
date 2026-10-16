import { randomUUID } from "node:crypto";
import type { TransactionDatabase } from "../db/transaction.ts";
import {
  taskColumns,
  type TaskRow,
  type TaskAuthoringCommand,
} from "./model.ts";

export async function saveTaskReminders(
  database: TransactionDatabase,
  taskId: string,
  offsets: number[],
) {
  await database.query(
    "DELETE FROM public.task_reminder WHERE task_id=$1 AND NOT (offset_minutes=ANY($2::INTEGER[]))",
    [taskId, offsets],
  );
  for (const offset of offsets)
    await database.query(
      `INSERT INTO public.task_reminder (id,task_id,offset_minutes,due_at,trigger_at)
    VALUES ($1,$2,$3,clock_timestamp(),clock_timestamp()) ON CONFLICT (task_id,offset_minutes) DO NOTHING`,
      [randomUUID(), taskId, offset],
    );
}

// Requires an already authorized transaction and validated authored fields.
// Both single-task authoring and curated-template application use this primitive.
export async function insertAuthoredTaskRecord(
  database: TransactionDatabase,
  eventId: string,
  actorMemberId: string,
  command: TaskAuthoringCommand,
  taskId: string,
): Promise<TaskRow> {
  const inserted = await database.query(
    `INSERT INTO public.task (id, event_id, title, category, context, deadline, priority, assigned_member_id, created_by, updated_by, deadline_time)
           VALUES ($1, $2, $3, $4, $5, $6::DATE, $7, $8, $9, $9, $10::TIME) RETURNING ${taskColumns}`,
    [
      taskId,
      eventId,
      command.title,
      command.category,
      command.context,
      command.deadline,
      command.priority,
      command.assignedMemberId,
      actorMemberId,
      command.deadlineTime,
    ],
  );
  const after = inserted.rows[0] as TaskRow;
  await saveTaskReminders(database, taskId, command.reminderOffsets ?? []);
  after.reminderOffsets = command.reminderOffsets ?? [];
  return after;
}
