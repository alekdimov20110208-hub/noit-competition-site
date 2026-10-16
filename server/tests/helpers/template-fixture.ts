// Transactional SQL double, NOT a PostgreSQL engine. It deliberately serializes
// transactions; real advisory/row locking is covered only by isolated PG tests.
import type { TaskRow } from "../../src/tasks/model.ts";
import type { EventRow } from "../../src/events/model.ts";
import type { TransactionPool } from "../../src/db/transaction.ts";
import type { TemplateApplyResult } from "../../src/templates/service.ts";

export const eventId = "11111111-1111-4111-8111-111111111111";
export const actorId = "22222222-2222-4222-8222-222222222222";
export const operationId = "33333333-3333-4333-8333-333333333333";
export const user = {
  id: "template-test-actor",
  name: "Synthetic",
  email: "synthetic@example.invalid",
};
type StoredTask = TaskRow & { event_id: string };
interface Store {
  event: EventRow;
  tasks: StoredTask[];
  activities: {
    eventId: string;
    actorUserId: string;
    actorMemberId: string;
    action: string;
    targetId: string;
    payload: Record<string, unknown>;
  }[];
  receipts: {
    actor_user_id: string;
    operation_id: string;
    event_id: string;
    request_digest: string;
    outcome: TemplateApplyResult;
  }[];
}
export function templateFixture() {
  let store: Store = {
    event: {
      id: eventId,
      name: "Synthetic T2 Event",
      start_date: "2026-11-20",
      end_date: "2026-11-22",
      timezone: "Europe/Sofia",
      archived_at: null,
      version: 1,
      created_at: new Date("2026-10-16T00:00:00Z"),
      updated_at: new Date("2026-10-16T00:00:00Z"),
    },
    tasks: [],
    activities: [],
    receipts: [],
  };
  const options = {
    role: "ORGANIZER",
    membershipActive: true,
    identityActive: true,
    memberVersion: 1,
    failTaskNumber: 0,
    failActivityNumber: 0,
    failReceipt: false,
  };
  const calls: { sql: string; values: unknown[] }[] = [];
  let queue: Promise<void> = Promise.resolve();
  const pool: TransactionPool = {
    async connect() {
      let draft: Store | null = null,
        unlock: (() => void) | null = null,
        taskNumber = 0,
        activityNumber = 0;
      return {
        on() {},
        removeListener() {},
        release() {},
        async query(sql, values = []) {
          calls.push({ sql, values });
          if (sql === "BEGIN") {
            const previous = queue;
            queue = new Promise<void>((resolve) => {
              unlock = resolve;
            });
            await previous;
            draft = structuredClone(store);
            return { rows: [] };
          }
          if (sql === "COMMIT") {
            store = draft!;
            draft = null;
            unlock?.();
            return { rows: [] };
          }
          if (sql === "ROLLBACK") {
            draft = null;
            unlock?.();
            return { rows: [] };
          }
          if (
            sql.startsWith("SET LOCAL") ||
            sql.includes("pg_advisory_xact_lock")
          )
            return { rows: [] };
          if (!draft) throw Error("Query outside transaction");
          if (sql.includes("FROM public.event WHERE"))
            return {
              rows:
                values[0] === draft.event.id
                  ? [structuredClone(draft.event)]
                  : [],
            };
          if (sql.includes("FROM public.event_member member"))
            return {
              rows:
                values[0] === draft.event.id &&
                values[1] === user.id &&
                options.membershipActive &&
                options.identityActive
                  ? [
                      {
                        id: actorId,
                        access_role: options.role,
                        version: options.memberVersion,
                      },
                    ]
                  : [],
            };
          if (sql.includes("SELECT event_id,request_digest,outcome"))
            return {
              rows: draft.receipts.filter(
                (r) =>
                  r.actor_user_id === values[0] && r.operation_id === values[1],
              ),
            };
          if (sql.includes("SELECT id,title,version FROM public.task"))
            return {
              rows: draft.tasks
                .filter(
                  (t) =>
                    t.event_id === values[0] &&
                    (values[1] as string[]).includes(
                      t.title.trim().toLowerCase(),
                    ),
                )
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((t) => ({ id: t.id, title: t.title, version: t.version })),
            };
          if (sql.startsWith("INSERT INTO public.task (")) {
            if (++taskNumber === options.failTaskNumber)
              throw Error("forced Task failure");
            const task: StoredTask = {
              id: values[0] as string,
              event_id: values[1] as string,
              title: values[2] as string,
              category: values[3] as string,
              context: values[4] as string,
              deadline: values[5] as string,
              priority: values[6] as TaskRow["priority"],
              assigned_member_id: values[7] as string | null,
              deadlineTime: values[9] as string | null,
              status: "not-started",
              accepted_by_member_id: null,
              accepted_at: null,
              version: 1,
              updated_at: new Date("2026-10-16T00:00:00Z"),
              reminderOffsets: [],
            };
            draft.tasks.push(task);
            return { rows: [task] };
          }
          if (sql.startsWith("DELETE FROM public.task_reminder"))
            return { rows: [] };
          if (sql.startsWith("INSERT INTO public.activity_entry")) {
            if (++activityNumber === options.failActivityNumber)
              throw Error("forced History failure");
            const aggregate = sql.includes("'TEMPLATE_APPLIED'");
            draft.activities.push({
              eventId: values[1] as string,
              actorUserId: values[2] as string,
              actorMemberId: values[3] as string,
              action: aggregate ? "TEMPLATE_APPLIED" : "task.created",
              targetId: values[aggregate ? 1 : 4] as string,
              payload: JSON.parse(
                values[aggregate ? 4 : 5] as string,
              ) as Record<string, unknown>,
            });
            return { rows: [] };
          }
          if (
            sql.startsWith("INSERT INTO public.template_application_receipt")
          ) {
            if (options.failReceipt) throw Error("forced receipt failure");
            if (
              draft.receipts.some(
                (r) =>
                  r.actor_user_id === values[0] && r.operation_id === values[1],
              )
            )
              throw Error("duplicate receipt");
            draft.receipts.push({
              actor_user_id: values[0] as string,
              operation_id: values[1] as string,
              event_id: values[2] as string,
              request_digest: values[5] as string,
              outcome: JSON.parse(values[6] as string) as TemplateApplyResult,
            });
            return { rows: [] };
          }
          throw Error(`Unexpected SQL in template fixture: ${sql}`);
        },
      };
    },
  };
  return {
    pool,
    calls,
    options,
    get store() {
      return store;
    },
  };
}
