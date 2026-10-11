import { useEffect, useMemo, useSyncExternalStore } from "react";
import { auth } from "../auth/runtime.ts";
import {
  emptyTasksWorkspace,
  RemoteWorkspaceService,
} from "../services/RemoteWorkspaceService.ts";
import { TaskReadController } from "../services/taskReadState.ts";

export function useRemoteTasks(
  enabled: boolean,
  userId: string,
  selectedEventId: string | null = null,
  listingOnly = false,
) {
  // A new identity receives a new store during render, before effects can run.
  const identityScope = useMemo(
    () => ({
      userId,
      controller: new TaskReadController(
        new RemoteWorkspaceService(),
        auth.expireSession,
      ),
    }),
    [userId],
  );
  const controller = identityScope.controller;
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  useEffect(() => {
    if (!enabled) return;
    const refetch = () => {
      if (document.visibilityState === "visible") void controller.load();
    };
    window.addEventListener("focus", refetch);
    window.addEventListener("online", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      window.removeEventListener("online", refetch);
      document.removeEventListener("visibilitychange", refetch);
      controller.clear();
    };
  }, [controller, enabled]);
  useEffect(() => {
    if (!enabled) return;
    controller.selectEvent(selectedEventId, listingOnly);
    void controller.load();
  }, [controller, enabled, selectedEventId, listingOnly]);
  // URL scope changes synchronously. Never paint former-Event rows under the
  // next Event URL while waiting for the selection effect to cancel/read.
  const visible =
    !enabled ||
    controller.getSelectedEventId() !== selectedEventId ||
    controller.getListingOnly() !== listingOnly ||
    (selectedEventId &&
      state.workspace.currentEventId &&
      selectedEventId !== state.workspace.currentEventId)
      ? {
          ...state,
          status: "loading" as const,
          workspace: emptyTasksWorkspace(),
          error: null,
          mutation: null,
        }
      : state;
  return {
    ...visible,
    retry: controller.load,
    mutate: controller.mutate,
    refreshEvents: controller.refreshEvents,
    getEvent: controller.getEvent,
    createEvent: controller.createEvent,
    updateEvent: controller.updateEvent,
    createTask: controller.createTask,
    updateTaskDetails: controller.updateTaskDetails,
    getTask: controller.getTask,
    setTaskAuthoringOpen: controller.setTaskAuthoringOpen,
  };
}
