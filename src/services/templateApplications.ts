import { AIKIDO_SEMINAR_STARTER as catalog } from "../domain/eventTemplates.ts";
import { resolveTemplateDeadline } from "../domain/templateDates.ts";
import { createI18n } from "../i18n/createI18n.ts";
import { readRemoteEvent, type TaskEvent } from "./RemoteWorkspaceService.ts";
import type { TaskFields } from "./taskAuthoring.ts";

export interface TemplateSelection {
  templateId: string;
  templateVersion: number;
  itemIds: string[];
  language: "bg" | "en";
}
export interface TemplateReview extends TemplateSelection {
  event: TaskEvent;
  reviewRevision: string;
  canApply: boolean;
  matchingTaskCount: number;
  items: (TaskFields & {
    itemId: string;
    assignedMemberId: null;
    accepted: false;
    status: "not-started";
  })[];
}
export interface TemplateAttempt extends TemplateSelection {
  operationId: string;
  expectedEventVersion: number;
  reviewRevision: string;
  confirmed: true;
}
export interface TemplateResult extends TemplateSelection {
  eventId: string;
  operationId: string;
  createdCount: number;
  taskIds: string[];
}
export type TemplateFailureCode =
  | "invalid"
  | "unauthenticated"
  | "forbidden"
  | "archived"
  | "unavailable"
  | "conflict"
  | "key-reused"
  | "uncertain";
export class TemplateFailure extends Error {
  readonly code: TemplateFailureCode;
  constructor(code: TemplateFailureCode) {
    super(code);
    this.code = code;
  }
}
const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function invalid(): never {
  throw new TemplateFailure("invalid");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
}
export function templateSelection(
  itemIds: readonly string[],
  language: "bg" | "en",
): TemplateSelection {
  const ordered = catalog.items
    .filter((item) => itemIds.includes(item.id))
    .map((item) => item.id);
  if (
    !ordered.length ||
    ordered.length !== itemIds.length ||
    new Set(itemIds).size !== itemIds.length
  )
    invalid();
  return {
    templateId: catalog.id,
    templateVersion: catalog.version,
    itemIds: ordered,
    language,
  };
}
export function readTemplateReview(
  value: unknown,
  eventId: string,
  selection: TemplateSelection,
): TemplateReview {
  try {
    const row = record(value),
      event = readRemoteEvent(row.event),
      i18n = createI18n(selection.language);
    for (const key of [
      "templateId",
      "templateVersion",
      "itemIds",
      "language",
    ] as const)
      if (!same(row[key], selection[key])) invalid();
    const expected = catalog.items
      .filter((item) => selection.itemIds.includes(item.id))
      .map((item) => ({
        title: i18n.t(item.titleKey),
        category: i18n.t(item.categoryKey),
        context: i18n.t(item.contextKey),
        priority: item.priority,
        ...resolveTemplateDeadline(
          event.startDate,
          item.dayOffset,
          item.deadlineTime,
        ),
        reminderOffsets: [],
        itemId: item.id,
        assignedMemberId: null,
        accepted: false,
        status: "not-started",
      }));
    if (
      event.id !== eventId ||
      typeof row.reviewRevision !== "string" ||
      !hash.test(row.reviewRevision) ||
      row.canApply !==
        (!event.archived && event.membership.accessRole === "ORGANIZER") ||
      !Number.isSafeInteger(row.matchingTaskCount) ||
      (row.matchingTaskCount as number) < 0 ||
      !Array.isArray(row.items) ||
      row.items.length !== expected.length
    )
      invalid();
    const items = row.items.map((value, index) => {
      const item = record(value),
        canonical = expected[index]!;
      for (const [key, expectedValue] of Object.entries(canonical))
        if (!same(item[key], expectedValue)) invalid();
      return canonical as TemplateReview["items"][number];
    });
    return {
      ...selection,
      event,
      items,
      reviewRevision: row.reviewRevision,
      canApply: row.canApply as boolean,
      matchingTaskCount: row.matchingTaskCount as number,
    };
  } catch {
    return invalid();
  }
}
export function validTemplateAttempt(value: unknown): value is TemplateAttempt {
  try {
    const a = record(value),
      selection = templateSelection(
        a.itemIds as string[],
        a.language as "bg" | "en",
      );
    return (
      ["bg", "en"].includes(String(a.language)) &&
      a.templateId === selection.templateId &&
      a.templateVersion === selection.templateVersion &&
      same(a.itemIds, selection.itemIds) &&
      typeof a.operationId === "string" &&
      uuid.test(a.operationId) &&
      typeof a.reviewRevision === "string" &&
      hash.test(a.reviewRevision) &&
      a.confirmed === true &&
      Number.isSafeInteger(a.expectedEventVersion) &&
      (a.expectedEventVersion as number) > 0 &&
      (a.expectedEventVersion as number) <= 2147483647
    );
  } catch {
    return false;
  }
}
export function readTemplateResult(
  value: unknown,
  eventId: string,
  attempt: TemplateAttempt,
): TemplateResult {
  try {
    const row = record(value);
    for (const key of [
      "templateId",
      "templateVersion",
      "itemIds",
      "language",
      "operationId",
    ] as const)
      if (!same(row[key], attempt[key])) invalid();
    if (
      row.eventId !== eventId ||
      row.createdCount !== attempt.itemIds.length ||
      !Array.isArray(row.taskIds) ||
      row.taskIds.length !== row.createdCount ||
      new Set(row.taskIds).size !== row.taskIds.length ||
      row.taskIds.some((id) => typeof id !== "string" || !uuid.test(id))
    )
      invalid();
    return {
      eventId,
      operationId: attempt.operationId,
      templateId: attempt.templateId,
      templateVersion: attempt.templateVersion,
      itemIds: [...attempt.itemIds],
      language: attempt.language,
      createdCount: row.createdCount as number,
      taskIds: row.taskIds as string[],
    };
  } catch {
    throw new TemplateFailure("uncertain");
  }
}

export class TemplateApplicationService {
  private readonly transport: typeof fetch;
  constructor(transport: typeof fetch = (...args) => fetch(...args)) {
    this.transport = transport;
  }
  private async request(
    eventId: string,
    kind: "preview" | "apply",
    body: object,
    key?: string,
    signal?: AbortSignal,
  ) {
    if (!uuid.test(eventId)) invalid();
    let response: Response;
    try {
      response = await this.transport(
        `/api/events/${eventId}/templates/${kind}`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "content-type": "application/json",
            ...(key ? { "idempotency-key": key } : {}),
          },
          body: JSON.stringify(body),
          signal: signal ?? AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new TemplateFailure(kind === "apply" ? "uncertain" : "unavailable");
    }
    if (!response.ok) {
      let reason = "";
      try {
        reason = String(record(await response.json()).code ?? "");
      } catch {
        /* sanitized status below */
      }
      const code: TemplateFailureCode =
        response.status === 401
          ? "unauthenticated"
          : response.status === 403
            ? reason === "EVENT_ARCHIVED"
              ? "archived"
              : "forbidden"
            : response.status === 409
              ? reason === "IDEMPOTENCY_KEY_REUSED"
                ? "key-reused"
                : [
                      "EVENT_VERSION_CONFLICT",
                      "TEMPLATE_REVIEW_CONFLICT",
                      "TEMPLATE_VERSION_CONFLICT",
                    ].includes(reason)
                  ? "conflict"
                  : "uncertain"
              : response.status === 400
                ? "invalid"
                : response.status === 404
                  ? "unavailable"
                  : kind === "apply"
                    ? "uncertain"
                    : "unavailable";
      throw new TemplateFailure(code);
    }
    try {
      return await response.json();
    } catch {
      throw new TemplateFailure(kind === "apply" ? "uncertain" : "invalid");
    }
  }
  async preview(
    eventId: string,
    selection: TemplateSelection,
    signal?: AbortSignal,
  ) {
    return readTemplateReview(
      await this.request(eventId, "preview", selection, undefined, signal),
      eventId,
      selection,
    );
  }
  async apply(eventId: string, attempt: TemplateAttempt) {
    const { operationId, ...body } = attempt;
    return readTemplateResult(
      await this.request(eventId, "apply", body, operationId),
      eventId,
      attempt,
    );
  }
}

// Recovery metadata only. Never stores Tasks, successful outcomes or auth data.
const memory = new Map<string, TemplateAttempt>();
const recoveryKey = (userId: string, eventId: string) =>
  `budograph:template-apply:v1:${encodeURIComponent(userId)}:${eventId}`;
function storage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}
export function readTemplateAttempt(
  userId: string,
  eventId: string,
  store = storage(),
): TemplateAttempt | null {
  const key = recoveryKey(userId, eventId);
  try {
    const value: unknown = JSON.parse(store?.getItem(key) ?? "null");
    if (validTemplateAttempt(value)) return value;
  } catch {
    /* in-tab fallback */
  }
  return memory.get(key) ?? null;
}
export function rememberTemplateAttempt(
  userId: string,
  eventId: string,
  attempt: TemplateAttempt,
  store = storage(),
) {
  if (!validTemplateAttempt(attempt)) invalid();
  const key = recoveryKey(userId, eventId);
  memory.set(key, attempt);
  try {
    store?.setItem(key, JSON.stringify(attempt));
  } catch {
    /* in-tab fallback; receipt is durable */
  }
}
export function forgetTemplateAttempt(
  userId: string,
  eventId: string,
  store = storage(),
) {
  const key = recoveryKey(userId, eventId);
  memory.delete(key);
  try {
    store?.removeItem(key);
  } catch {
    /* no canonical result is stored here */
  }
}
