import type {
  StarterTemplate,
  StarterTemplateItem,
} from "../../domain/eventTemplates.ts";
import { resolveTemplateDeadline } from "../../domain/templateDates.ts";
import type { TaskEvent } from "../../services/RemoteWorkspaceService.ts";
import type { TaskReadState } from "../../services/taskReadState.ts";

export function toggleTemplateItem(
  template: StarterTemplate,
  selected: readonly string[],
  itemId: string,
): string[] {
  const next = new Set(selected);
  if (next.has(itemId)) next.delete(itemId);
  else next.add(itemId);
  return template.items
    .filter((item) => next.has(item.id))
    .map((item) => item.id);
}

export function templatePreviewEvent(
  state: Pick<TaskReadState, "status" | "workspace" | "error">,
  requestedEventId: string | null,
): TaskEvent | null {
  if (state.status !== "ready" || state.error !== null) return null;
  const eventId = requestedEventId ?? state.workspace.currentEventId;
  return (
    state.workspace.events.find(
      (event) =>
        event.id === eventId && event.id === state.workspace.currentEventId,
    ) ?? null
  );
}

export function previewTemplateItem(
  item: StarterTemplateItem,
  event: TaskEvent | null,
) {
  if (!event) return { status: "no-event" as const };
  try {
    return {
      status: "ready" as const,
      ...resolveTemplateDeadline(
        event.startDate,
        item.dayOffset,
        item.deadlineTime,
      ),
    };
  } catch {
    return { status: "invalid" as const };
  }
}
