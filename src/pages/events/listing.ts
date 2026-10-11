import type { TaskEvent } from "../../services/RemoteWorkspaceService.ts";

export function filterEvents(
  events: readonly TaskEvent[],
  archived: boolean,
  query: string,
): TaskEvent[] {
  const search = query.trim().normalize("NFC").toLocaleLowerCase();
  return events.filter(
    (event) =>
      event.archived === archived &&
      event.name.normalize("NFC").toLocaleLowerCase().includes(search),
  );
}

export function canEditEvent(event: TaskEvent): boolean {
  return !event.archived && event.membership.accessRole === "ORGANIZER";
}
