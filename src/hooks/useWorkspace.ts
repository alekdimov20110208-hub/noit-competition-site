import { useCallback, useEffect, useReducer, useState } from "react";
import { createDemoWorkspace } from "../data/demo.ts";
import {
  deserializeWorkspace,
  WORKSPACE_STORAGE_KEY,
  workspaceReducer,
} from "../domain/workspace.ts";
import type {
  ChangeResponseStatus,
  TaskStatus,
  WorkspaceState,
} from "../domain/types.ts";

interface InitialWorkspace {
  state: WorkspaceState;
  persistenceError: string | null;
}

export interface UseWorkspaceResult {
  state: WorkspaceState;
  persistenceError: string | null;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  toggleTaskAcknowledgement: (taskId: string) => void;
  acknowledgeChange: (changeId: string) => void;
  updateChangeStatus: (changeId: string, status: ChangeResponseStatus) => void;
  resetWorkspace: () => void;
}

function loadInitialWorkspace(): InitialWorkspace {
  if (typeof window === "undefined") {
    return { state: createDemoWorkspace(), persistenceError: null };
  }

  try {
    return {
      state: deserializeWorkspace(
        window.localStorage.getItem(WORKSPACE_STORAGE_KEY),
      ),
      persistenceError: null,
    };
  } catch {
    return {
      state: createDemoWorkspace(),
      persistenceError:
        "Browser storage could not be read. Changes will remain available only for this session.",
    };
  }
}

export function useWorkspace(): UseWorkspaceResult {
  const [initialWorkspace] = useState(loadInitialWorkspace);
  const [state, dispatch] = useReducer(
    workspaceReducer,
    initialWorkspace.state,
  );
  const [persistenceError, setPersistenceError] = useState<string | null>(
    initialWorkspace.persistenceError,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
      setPersistenceError(null);
    } catch {
      setPersistenceError(
        "Browser storage could not save the latest workspace changes.",
      );
    }
  }, [state]);

  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    dispatch({
      type: "task/status",
      taskId,
      status,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const toggleTaskAcknowledgement = useCallback((taskId: string) => {
    dispatch({
      type: "task/toggle-acknowledgement",
      taskId,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const acknowledgeChange = useCallback((changeId: string) => {
    dispatch({ type: "change/acknowledge", changeId });
  }, []);

  const updateChangeStatus = useCallback(
    (changeId: string, status: ChangeResponseStatus) => {
      dispatch({ type: "change/status", changeId, status });
    },
    [],
  );

  const resetWorkspace = useCallback(() => {
    dispatch({ type: "workspace/reset" });
  }, []);

  return {
    state,
    persistenceError,
    updateTaskStatus,
    toggleTaskAcknowledgement,
    acknowledgeChange,
    updateChangeStatus,
    resetWorkspace,
  };
}
