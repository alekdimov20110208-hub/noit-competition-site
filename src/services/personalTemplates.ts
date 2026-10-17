import type { TaskFields } from "./taskAuthoring.ts";
import { validateTaskFields } from "./taskAuthoring.ts";
export interface PersonalItem {
  id: string;
  title: string;
  category: string;
  context: string;
  priority: TaskFields["priority"];
  dayOffset: number;
  deadlineTime: string | null;
}
export interface PersonalTemplate {
  id: string;
  version: number;
  name: string;
  description: string;
  createdAt: string;
  items: PersonalItem[];
}
export interface TemplateCard extends Omit<PersonalTemplate, "items"> {
  itemCount: number;
}
export interface SourceItem {
  id: string;
  version: number;
  title: string;
  category: string;
  originalContext: string;
  priority: TaskFields["priority"];
  deadline: string;
  deadlineTime: string | null;
  dayOffset: number | null;
}
export interface TemplateSource {
  eventId: string;
  eventVersion: number;
  startDate: string;
  items: SourceItem[];
  nextCursor: string | null;
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
export interface SaveBody {
  name: string;
  description: string;
  expectedEventVersion: number;
  items: SaveItem[];
  confirmed: true;
}
export interface SaveAttempt {
  eventId: string;
  operationId: string;
  body: SaveBody;
}
export interface SaveResult {
  operationId: string;
  templateId: string;
  templateVersion: number;
  itemCount: number;
}
export const templateUuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
export class LibraryFailure extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new LibraryFailure("invalid");
  return v as Record<string, unknown>;
};
export function readPersonalTemplate(value: unknown): PersonalTemplate {
  const r = record(value);
  if (
    typeof r.id !== "string" ||
    !templateUuid.test(r.id) ||
    r.version !== 1 ||
    typeof r.name !== "string" ||
    !r.name.trim() ||
    r.name.length > 200 ||
    typeof r.description !== "string" ||
    r.description.length > 2000 ||
    typeof r.createdAt !== "string" ||
    !Number.isFinite(Date.parse(r.createdAt)) ||
    !Array.isArray(r.items) ||
    r.items.length < 1 ||
    r.items.length > 50
  )
    throw new LibraryFailure("invalid");
  const items = r.items.map((v) => {
    const item = record(v);
    if (
      typeof item.id !== "string" ||
      !templateUuid.test(item.id) ||
      !Number.isInteger(item.dayOffset) ||
      Math.abs(item.dayOffset as number) > 3660 ||
      typeof item.title !== "string" ||
      typeof item.category !== "string" ||
      typeof item.context !== "string"
    )
      throw new LibraryFailure("invalid");
    const fields = {
      title: item.title,
      category: item.category,
      context: item.context,
      priority: item.priority,
      deadline: "2000-01-01",
      deadlineTime: item.deadlineTime,
      reminderOffsets: [],
    } as TaskFields;
    if (Object.keys(validateTaskFields(fields)).length)
      throw new LibraryFailure("invalid");
    return {
      id: item.id,
      title: fields.title,
      category: fields.category,
      context: fields.context,
      priority: fields.priority,
      dayOffset: item.dayOffset as number,
      deadlineTime: fields.deadlineTime,
    };
  });
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw new LibraryFailure("invalid");
  return {
    id: r.id,
    version: 1,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt,
    items,
  };
}
export class PersonalTemplateService {
  private readonly transport: typeof fetch;
  constructor(transport: typeof fetch = (...args) => fetch(...args)) {
    this.transport = transport;
  }
  private async request(
    url: string,
    body?: object,
    key?: string,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.transport(url, {
        method: body ? "POST" : "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        headers: body
          ? { "content-type": "application/json", "idempotency-key": key! }
          : {},
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new LibraryFailure(body ? "uncertain" : "unavailable");
    }
    if (!response.ok) {
      let code = "";
      try {
        code = String(record(await response.json()).code ?? "");
      } catch {
        /*safe status*/
      }
      throw new LibraryFailure(
        response.status === 401
          ? "unauthenticated"
          : response.status === 403
            ? "forbidden"
            : response.status === 409
              ? code === "IDEMPOTENCY_KEY_REUSED"
                ? "key-reused"
                : "conflict"
              : response.status === 400
                ? "invalid"
                : body
                  ? "uncertain"
                  : "unavailable",
      );
    }
    try {
      return await response.json();
    } catch {
      throw new LibraryFailure(body ? "uncertain" : "invalid");
    }
  }
  async list(after?: string) {
    const r = record(
      await this.request(
        "/api/templates/mine" +
          (after ? "?after=" + encodeURIComponent(after) : ""),
      ),
    );
    if (
      !Array.isArray(r.templates) ||
      r.templates.length > 50 ||
      (r.nextCursor !== null &&
        (typeof r.nextCursor !== "string" || !templateUuid.test(r.nextCursor)))
    )
      throw new LibraryFailure("invalid");
    for (const value of r.templates) {
      const card = record(value);
      readPersonalTemplate({
        ...card,
        items: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            title: "Validation",
            category: "",
            context: "",
            priority: "normal",
            dayOffset: 0,
            deadlineTime: null,
          },
        ],
      });
      if (
        !Number.isInteger(card.itemCount) ||
        (card.itemCount as number) < 1 ||
        (card.itemCount as number) > 50
      )
        throw new LibraryFailure("invalid");
    }
    return r as unknown as {
      templates: TemplateCard[];
      nextCursor: string | null;
    };
  }
  async detail(id: string) {
    if (!templateUuid.test(id)) throw new LibraryFailure("invalid");
    const r = readPersonalTemplate(
      await this.request("/api/templates/mine/" + id),
    );
    if (r.id !== id) throw new LibraryFailure("invalid");
    return r;
  }
  async source(id: string, after?: string) {
    if (!templateUuid.test(id)) throw new LibraryFailure("invalid");
    const r = record(
      await this.request(
        `/api/events/${id}/templates/source` +
          (after ? "?after=" + encodeURIComponent(after) : ""),
      ),
    );
    if (
      r.eventId !== id ||
      !Number.isInteger(r.eventVersion) ||
      (r.eventVersion as number) < 1 ||
      typeof r.startDate !== "string" ||
      !Array.isArray(r.items) ||
      r.items.length > 50 ||
      (r.nextCursor !== null &&
        (typeof r.nextCursor !== "string" || !templateUuid.test(r.nextCursor)))
    )
      throw new LibraryFailure("invalid");
    for (const value of r.items) {
      const item = record(value);
      if (
        !Number.isInteger(item.version) ||
        (item.version as number) < 1 ||
        typeof item.originalContext !== "string" ||
        item.originalContext.length > 5000
      )
        throw new LibraryFailure("invalid");
      readPersonalTemplate({
        id,
        version: 1,
        name: "Source validation",
        description: "",
        createdAt: "2000-01-01T00:00:00Z",
        items: [
          {
            ...item,
            context: "",
            dayOffset: item.dayOffset === null ? 0 : item.dayOffset,
          },
        ],
      });
      if (
        Object.keys(
          validateTaskFields({
            title: item.title,
            category: item.category,
            context: "",
            priority: item.priority,
            deadline: item.deadline,
            deadlineTime: item.deadlineTime,
          } as TaskFields),
        ).length
      )
        throw new LibraryFailure("invalid");
    }
    return r as unknown as TemplateSource;
  }
  async save(attempt: SaveAttempt): Promise<SaveResult> {
    const r = record(
      await this.request(
        `/api/events/${attempt.eventId}/templates/save`,
        attempt.body,
        attempt.operationId,
      ),
    );
    if (
      r.operationId !== attempt.operationId ||
      typeof r.templateId !== "string" ||
      !templateUuid.test(r.templateId) ||
      r.templateVersion !== 1 ||
      r.itemCount !== attempt.body.items.length
    )
      throw new LibraryFailure("uncertain");
    return r as unknown as SaveResult;
  }
}
// Only the reviewed request is retained for a lost response in this browser tab.
// No original descriptions, session tokens or successful library cache.
const memory = new Map<string, SaveAttempt>();
const key = (user: string) =>
  "budograph:template-save:v1:" + encodeURIComponent(user);
export function saveRecovery(user: string, attempt: SaveAttempt | null) {
  if (attempt) memory.set(key(user), attempt);
  else memory.delete(key(user));
  try {
    if (attempt) sessionStorage.setItem(key(user), JSON.stringify(attempt));
    else sessionStorage.removeItem(key(user));
  } catch {
    /*in-tab fallback*/
  }
}
export function readSaveRecovery(user: string): SaveAttempt | null {
  try {
    const a = JSON.parse(
      sessionStorage.getItem(key(user)) ?? "null",
    ) as SaveAttempt | null;
    if (
      a &&
      templateUuid.test(a.eventId) &&
      templateUuid.test(a.operationId) &&
      a.body?.confirmed === true &&
      a.body.items?.length > 0 &&
      a.body.items.length <= 50
    )
      return a;
  } catch {
    /*in-tab fallback*/
  }
  return memory.get(key(user)) ?? null;
}
