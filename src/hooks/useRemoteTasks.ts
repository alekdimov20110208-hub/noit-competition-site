import { useEffect, useState, useSyncExternalStore } from "react";
import { auth } from "../auth/runtime.ts";
import { RemoteWorkspaceService } from "../services/RemoteWorkspaceService.ts";
import { TaskReadController } from "../services/taskReadState.ts";

export function useRemoteTasks(enabled: boolean, userId: string) {
  const [controller] = useState(
    () =>
      new TaskReadController(new RemoteWorkspaceService(), auth.expireSession),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  useEffect(() => {
    if (!enabled) return;
    void controller.load();
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
  }, [controller, enabled, userId]);
  return { ...state, retry: controller.load, mutate: controller.mutate };
}
