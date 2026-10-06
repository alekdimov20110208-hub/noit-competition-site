import type { RemoteChange } from "../services/changes.ts";
import type { TaskEvent } from "../services/RemoteWorkspaceService.ts";

export type ChangeCoordinationState =
  "decision-pending" | "decision-recorded" | "plan-b-prepared";
export type ChangeAttentionReason =
  "needs-owner" | "needs-decision" | "needs-response";
export interface ChangeAttentionItem {
  change: RemoteChange;
  reason: ChangeAttentionReason;
}

export function getEventChanges(
  changes: readonly RemoteChange[],
  eventId: string,
): RemoteChange[] {
  return changes
    .filter((change) => change.eventId === eventId)
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
        a.id.localeCompare(b.id),
    );
}

export function getChangeCoordinationState(
  change: Pick<RemoteChange, "decision" | "planB">,
): ChangeCoordinationState {
  if (!change.decision) return "decision-pending";
  return change.planB ? "plan-b-prepared" : "decision-recorded";
}

export function getPersonalChangeAttention(
  changes: readonly RemoteChange[],
  event: Pick<TaskEvent, "id" | "membership">,
): ChangeAttentionItem[] {
  return getEventChanges(changes, event.id).flatMap((change) => {
    let reason: ChangeAttentionReason | null = null;
    if (!change.responseOwner && event.membership.accessRole === "ORGANIZER")
      reason = "needs-owner";
    else if (change.responseOwner?.id === event.membership.id) {
      if (!change.decision) reason = "needs-decision";
      else if (!change.response) reason = "needs-response";
    }
    return reason ? [{ change, reason }] : [];
  });
}
