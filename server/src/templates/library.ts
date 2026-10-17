import { randomUUID } from "node:crypto";
import { UnauthorizedError, type AuthenticatedUser } from "../auth/session.ts";
import {
  inTransaction,
  type TransactionDatabase,
  type TransactionPool,
} from "../db/transaction.ts";
import { EventCommandError, validEventDate } from "../events/model.ts";
import {
  parseTaskAuthoring,
  uuidPattern,
  type TaskFields,
} from "../tasks/model.ts";
import { lockTemplateContext } from "./context.ts";
import { digest, templateEventId, type TemplateSelection } from "./model.ts";

function fail(): never {
  throw new EventCommandError(400, "INVALID_TEMPLATE_COMMAND");
}
function object(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail();
}
function exact(v: Record<string, unknown>, keys: string[]) {
  if (
    Object.keys(v).length !== keys.length ||
    Object.keys(v).some((k) => !keys.includes(k))
  )
    fail();
}
function text(v: unknown, max: number, required = false) {
  if (
    typeof v !== "string" ||
    v.length > max ||
    v.includes("\u0000") ||
    /[\uD800-\uDFFF]/u.test(v) ||
    (required && !v.trim())
  )
    fail();
  return v.trim();
}
function version(v: unknown) {
  if (
    !Number.isSafeInteger(v) ||
    (v as number) < 1 ||
    (v as number) > 2147483647
  )
    fail();
  return v as number;
}
export function calendarOffset(start: string, due: string) {
  if (!validEventDate(start) || !validEventDate(due))
    throw new EventCommandError(400, "INVALID_TEMPLATE_DATE");
  const ordinal = (s: string) => {
    const [y, m, d] = s.split("-").map(Number),
      date = new Date(0);
    date.setUTCFullYear(y!, m! - 1, d!);
    return date.getTime() / 86400000;
  };
  // UTC date fields are Gregorian ordinals, never elapsed Event-local instants.
  const offset = ordinal(due) - ordinal(start);
  if (!Number.isInteger(offset) || Math.abs(offset) > 3660)
    throw new EventCommandError(400, "INVALID_TEMPLATE_DATE");
  return offset;
}
export interface SaveItem {
  sourceTaskId: string;
  expectedTaskVersion: number;
  title: string;
  category: string;
  context: string;
  contextReviewed: boolean;
  priority: TaskFields["priority"];
}
export interface SaveCommand {
  name: string;
  description: string;
  expectedEventVersion: number;
  items: SaveItem[];
  confirmed: true;
}
export function parseSaveCommand(input: unknown): SaveCommand {
  const row = object(input);
  exact(row, [
    "name",
    "description",
    "expectedEventVersion",
    "items",
    "confirmed",
  ]);
  if (
    row.confirmed !== true ||
    !Array.isArray(row.items) ||
    row.items.length < 1 ||
    row.items.length > 50
  )
    fail();
  const items = row.items
    .map((value) => {
      const item = object(value);
      exact(item, [
        "sourceTaskId",
        "expectedTaskVersion",
        "title",
        "category",
        "context",
        "contextReviewed",
        "priority",
      ]);
      if (
        typeof item.sourceTaskId !== "string" ||
        !uuidPattern.test(item.sourceTaskId) ||
        typeof item.contextReviewed !== "boolean" ||
        (item.context !== "" && !item.contextReviewed)
      )
        fail();
      const fields = parseTaskAuthoring({
        title: item.title,
        category: item.category,
        context: item.context,
        priority: item.priority,
        deadline: "2000-01-01",
        deadlineTime: null,
        reminderOffsets: [],
        assignedMemberId: null,
      });
      return {
        sourceTaskId: item.sourceTaskId.toLowerCase(),
        expectedTaskVersion: version(item.expectedTaskVersion),
        title: fields.title!,
        category: fields.category!,
        context: fields.context!,
        priority: fields.priority!,
        contextReviewed: item.contextReviewed,
      };
    })
    .sort((a, b) => a.sourceTaskId.localeCompare(b.sourceTaskId));
  if (new Set(items.map((i) => i.sourceTaskId)).size !== items.length) fail();
  return {
    name: text(row.name, 200, true),
    description: text(row.description, 2000),
    expectedEventVersion: version(row.expectedEventVersion),
    items,
    confirmed: true,
  };
}
async function activeOwner(db: TransactionDatabase, user: AuthenticatedUser) {
  if (!user?.id) throw new UnauthorizedError();
  const r = await db.query(
    'SELECT id FROM public."user" WHERE id=$1 AND active=TRUE FOR SHARE',
    [user.id],
  );
  if (!r.rows.length) throw new UnauthorizedError();
}
export async function loadPersonalBlueprint(
  db: TransactionDatabase,
  user: AuthenticatedUser,
  selection: TemplateSelection,
) {
  const r = await db.query(
    `SELECT v.template_id,v.version,v.name,v.description,v.created_at FROM public.personal_template t
    JOIN public.personal_template_version v ON v.template_id=t.id
    WHERE t.id=$1 AND t.owner_user_id=$2 AND v.version=$3`,
    [selection.templateId, user.id, selection.templateVersion],
  );
  if (!r.rows.length) throw new EventCommandError(404, "NOT_FOUND");
  const items = await db.query(
    `SELECT item_id AS id,title,category,context,priority,day_offset AS "dayOffset",to_char(deadline_time,'HH24:MI') AS "deadlineTime"
    FROM public.personal_template_item WHERE template_id=$1 AND template_version=$2 ORDER BY item_id`,
    [selection.templateId, selection.templateVersion],
  );
  if (
    selection.itemIds.some(
      (id) => !(items.rows as { id: string }[]).some((i) => i.id === id),
    )
  )
    throw new EventCommandError(400, "UNKNOWN_TEMPLATE_ITEM");
  return items.rows as {
    id: string;
    title: string;
    category: string;
    context: string;
    priority: TaskFields["priority"];
    dayOffset: number;
    deadlineTime: string | null;
  }[];
}
export function createPersonalTemplateService(pool: TransactionPool) {
  async function list(user: AuthenticatedUser, after?: string) {
    if (after !== undefined) templateEventId(after);
    return inTransaction(pool, async (db) => {
      await activeOwner(db, user);
      const r = await db.query(
        `SELECT t.id,v.version,v.name,v.description,v.created_at,
       (SELECT count(*)::INTEGER FROM public.personal_template_item i WHERE i.template_id=t.id AND i.template_version=v.version) AS "itemCount"
       FROM public.personal_template t JOIN public.personal_template_version v ON v.template_id=t.id AND v.version=1
       WHERE t.owner_user_id=$1 AND ($2::UUID IS NULL OR t.id>$2::UUID) ORDER BY t.id LIMIT 51`,
        [user.id, after ?? null],
      );
      const rows = (
        r.rows as {
          id: string;
          version: number;
          name: string;
          description: string;
          created_at: Date;
          itemCount: number;
        }[]
      ).slice(0, 50);
      return {
        templates: rows.map((r) => ({
          ...r,
          created_at: undefined,
          createdAt: r.created_at.toISOString(),
        })),
        nextCursor: r.rows.length > 50 ? rows.at(-1)!.id : null,
      };
    });
  }
  async function detail(user: AuthenticatedUser, id: string) {
    templateEventId(id);
    return inTransaction(pool, async (db) => {
      await activeOwner(db, user);
      const r = await db.query(
        `SELECT t.id,v.version,v.name,v.description,v.created_at FROM public.personal_template t JOIN public.personal_template_version v ON v.template_id=t.id AND v.version=1 WHERE t.id=$1 AND t.owner_user_id=$2`,
        [id, user.id],
      );
      if (!r.rows.length) throw new EventCommandError(404, "NOT_FOUND");
      const row = r.rows[0] as {
        id: string;
        version: number;
        name: string;
        description: string;
        created_at: Date;
      };
      const items = await loadPersonalBlueprint(db, user, {
        templateId: id,
        templateVersion: 1,
        itemIds: [],
        language: "en",
      });
      return {
        id: row.id,
        version: row.version,
        name: row.name,
        description: row.description,
        createdAt: row.created_at.toISOString(),
        items,
      };
    });
  }
  async function source(
    user: AuthenticatedUser,
    target: string,
    after?: string,
  ) {
    if (!user?.id) throw new UnauthorizedError();
    const eventId = templateEventId(target);
    if (after !== undefined) templateEventId(after);
    return inTransaction(pool, async (db) => {
      const { event } = await lockTemplateContext(db, user, eventId, true);
      const r = await db.query(
        `SELECT id,version,title,category,priority,context AS "originalContext",to_char(deadline,'YYYY-MM-DD') AS deadline,to_char(deadline_time,'HH24:MI') AS "deadlineTime"
        FROM public.task WHERE event_id=$1 AND deleted_at IS NULL AND ($2::UUID IS NULL OR id>$2::UUID) ORDER BY id LIMIT 51`,
        [eventId, after ?? null],
      );
      const rows = (
        r.rows as {
          id: string;
          version: number;
          title: string;
          category: string;
          priority: TaskFields["priority"];
          originalContext: string;
          deadline: string;
          deadlineTime: string | null;
        }[]
      ).slice(0, 50);
      return {
        eventId,
        eventVersion: event.version,
        startDate: event.start_date,
        items: rows.map((r) => ({
          ...r,
          dayOffset: (() => {
            try {
              return calendarOffset(event.start_date, r.deadline);
            } catch {
              return null;
            }
          })(),
        })),
        nextCursor: r.rows.length > 50 ? rows.at(-1)!.id : null,
      };
    });
  }
  async function save(
    user: AuthenticatedUser,
    target: string,
    key: unknown,
    input: unknown,
  ) {
    if (!user?.id) throw new UnauthorizedError();
    const eventId = templateEventId(target),
      command = parseSaveCommand(input);
    if (typeof key !== "string" || !uuidPattern.test(key))
      throw new EventCommandError(400, "INVALID_IDEMPOTENCY_KEY");
    const operationId = key.toLowerCase(),
      requestDigest = digest({
        kind: "PERSONAL_TEMPLATE_SAVE_V1",
        actor: user.id,
        eventId,
        command,
      });
    return inTransaction(pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        JSON.stringify(["template-save", user.id, operationId]),
      ]);
      const { event } = await lockTemplateContext(db, user, eventId, true);
      const receipts = await db.query(
        "SELECT source_event_id,template_id,request_digest FROM public.personal_template_save_receipt WHERE actor_user_id=$1 AND operation_id=$2",
        [user.id, operationId],
      );
      if (receipts.rows.length) {
        const r = receipts.rows[0] as {
          source_event_id: string;
          request_digest: string;
          template_id: string;
        };
        if (r.source_event_id !== eventId || r.request_digest !== requestDigest)
          throw new EventCommandError(409, "IDEMPOTENCY_KEY_REUSED");
        return {
          operationId,
          templateId: r.template_id,
          templateVersion: 1,
          itemCount: command.items.length,
        };
      }
      if (event.version !== command.expectedEventVersion)
        throw new EventCommandError(409, "EVENT_VERSION_CONFLICT");
      const tasks = await db.query(
        `SELECT id,version,to_char(deadline,'YYYY-MM-DD') AS deadline,to_char(deadline_time,'HH24:MI') AS "deadlineTime" FROM public.task
        WHERE event_id=$1 AND id=ANY($2::UUID[]) AND deleted_at IS NULL ORDER BY id FOR SHARE`,
        [eventId, command.items.map((i) => i.sourceTaskId)],
      );
      const sourceTasks = tasks.rows as {
        id: string;
        version: number;
        deadline: string;
        deadlineTime: string | null;
      }[];
      if (
        sourceTasks.length !== command.items.length ||
        command.items.some(
          (i) =>
            !sourceTasks.some(
              (t) =>
                t.id === i.sourceTaskId && t.version === i.expectedTaskVersion,
            ),
        )
      )
        throw new EventCommandError(409, "SOURCE_TASK_VERSION_CONFLICT");
      const id = randomUUID();
      await db.query(
        "INSERT INTO public.personal_template(id,owner_user_id) VALUES($1,$2)",
        [id, user.id],
      );
      await db.query(
        "INSERT INTO public.personal_template_version(template_id,version,name,description) VALUES($1,1,$2,$3)",
        [id, command.name, command.description],
      );
      for (const [position, item] of command.items.entries()) {
        const task = sourceTasks.find((t) => t.id === item.sourceTaskId)!;
        await db.query(
          `INSERT INTO public.personal_template_item(template_id,template_version,item_id,position,title,category,context,priority,day_offset,deadline_time)
          VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9::TIME)`,
          [
            id,
            randomUUID(),
            position,
            item.title,
            item.category,
            item.context,
            item.priority,
            calendarOffset(event.start_date, task.deadline),
            task.deadlineTime,
          ],
        );
      }
      await db.query(
        "INSERT INTO public.personal_template_save_receipt(actor_user_id,operation_id,source_event_id,template_id,request_digest) VALUES($1,$2,$3,$4,$5)",
        [user.id, operationId, eventId, id, requestDigest],
      );
      return {
        operationId,
        templateId: id,
        templateVersion: 1,
        itemCount: command.items.length,
      };
    });
  }
  return { list, detail, source, save };
}
export type PersonalTemplateService = ReturnType<
  typeof createPersonalTemplateService
>;
