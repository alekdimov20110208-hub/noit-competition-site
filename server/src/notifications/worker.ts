import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { inTransaction, type TransactionPool } from "../db/transaction.ts";

export const REMINDER_INTERVAL_MS = 30_000;
// Deterministic clock boundary, no public API to advance the production clock.
export function createReminderWorker(
  pool: TransactionPool,
  clock: () => Date = () => new Date(),
) {
  return {
    async run() {
      const now = clock();
      if (!Number.isFinite(now.getTime()))
        throw new Error("Invalid reminder clock.");
      // Every approved offset is <= 1440 elapsed minutes. A due instant still
      // ahead of now cannot have a trigger older than this indexed window.
      const candidates = await inTransaction(pool, async (db) =>
        db.query(
          `
        SELECT r.id,t.id AS task_id,t.event_id FROM public.task_reminder r
        JOIN public.task t ON t.id=r.task_id JOIN public.event e ON e.id=t.event_id
        JOIN public.event_member m ON m.id=t.assigned_member_id AND m.event_id=t.event_id
        JOIN public."user" u ON u.id=m.user_id
        WHERE r.trigger_at <= $1 AND r.trigger_at > $1::TIMESTAMPTZ - INTERVAL '1440 minutes' AND r.due_at > $1 AND t.status <> 'completed' AND t.deleted_at IS NULL
          AND e.archived_at IS NULL AND m.active AND m.deactivated_at IS NULL AND u.active
          AND NOT EXISTS (SELECT 1 FROM public.notification n WHERE n.kind='TASK_DUE_REMINDER'
            AND n.task_id=t.id AND n.recipient_user_id=m.user_id AND n.due_at=r.due_at AND n.reminder_offset_minutes=r.offset_minutes)
        ORDER BY r.trigger_at,r.id LIMIT 100`,
          [now],
        ),
      );
      let delivered = 0;
      for (const value of candidates.rows) {
        const candidate = value as {
          id: string;
          task_id: string;
          event_id: string;
        };
        delivered += await inTransaction(pool, async (db) => {
          // Same Event-before-Task lock order as canonical commands. Recheck live
          // state after locking; a candidate snapshot never decides its recipient.
          const event = await db.query(
            "SELECT id FROM public.event WHERE id=$1 AND archived_at IS NULL FOR SHARE",
            [candidate.event_id],
          );
          if (!event.rows.length) return 0;
          const task = await db.query(
            "SELECT id FROM public.task WHERE id=$1 AND event_id=$2 AND deleted_at IS NULL AND status<>'completed' FOR UPDATE SKIP LOCKED",
            [candidate.task_id, candidate.event_id],
          );
          if (!task.rows.length) return 0;
          await db.query(
            `SELECT m.id FROM public.event_member m JOIN public."user" u ON u.id=m.user_id
            JOIN public.task t ON t.assigned_member_id=m.id WHERE t.id=$1 FOR SHARE OF m,u`,
            [candidate.task_id],
          );
          const deliveryNow = clock();
          const result = await db.query(
            `INSERT INTO public.notification
            (id,event_id,recipient_user_id,kind,task_id,task_title,deadline,deadline_time,timezone,reminder_offset_minutes,due_at,created_at)
            SELECT $1,t.event_id,m.user_id,'TASK_DUE_REMINDER',t.id,t.title,t.deadline,t.deadline_time,e.timezone,r.offset_minutes,r.due_at,$2
            FROM public.task_reminder r JOIN public.task t ON t.id=r.task_id JOIN public.event e ON e.id=t.event_id
            JOIN public.event_member m ON m.id=t.assigned_member_id AND m.event_id=t.event_id JOIN public."user" u ON u.id=m.user_id
            WHERE r.id=$3 AND r.task_id=$4 AND t.event_id=$5 AND r.trigger_at <= $2 AND r.due_at > $2
              AND t.deadline_time IS NOT NULL AND t.status<>'completed' AND t.deleted_at IS NULL
              AND e.archived_at IS NULL AND m.active AND m.deactivated_at IS NULL AND u.active
            ON CONFLICT DO NOTHING RETURNING id`,
            [
              randomUUID(),
              deliveryNow,
              candidate.id,
              candidate.task_id,
              candidate.event_id,
            ],
          );
          return result.rows.length;
        });
      }
      return delivered;
    },
  };
}
export function registerReminderWorker(
  app: FastifyInstance,
  worker: ReturnType<typeof createReminderWorker>,
  interval = REMINDER_INTERVAL_MS,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<unknown> | undefined;
  let stopped = false;
  const tick = () => {
    running = worker
      .run()
      .catch(() => app.log.error("Reminder worker pass failed"))
      .finally(() => {
        running = undefined;
        if (!stopped) {
          timer = setTimeout(tick, interval);
          timer.unref();
        }
      });
  };
  app.addHook("onReady", async () => {
    tick();
  });
  app.addHook("onClose", async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  });
}
