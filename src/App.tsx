import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/AppShell.tsx";
import { useWorkspace } from "./hooks/useWorkspace.ts";
import { ChangesPage } from "./pages/ChangesPage.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { TasksPage } from "./pages/TasksPage.tsx";
import { TeamPage } from "./pages/TeamPage.tsx";
import { TemplatesPage } from "./pages/TemplatesPage.tsx";
import { normalizePath } from "./routes.ts";

export default function App() {
  const [currentPath, setCurrentPath] = useState(() =>
    normalizePath(window.location.pathname),
  );
  const {
    state,
    persistenceError,
    updateTaskStatus,
    toggleTaskAcknowledgement,
    acknowledgeChange,
    updateChangeStatus,
    resetWorkspace,
  } = useWorkspace();

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(normalizePath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    const normalizedPath = normalizePath(path);
    if (window.location.pathname !== normalizedPath) {
      window.history.pushState({}, "", normalizedPath);
    }
    setCurrentPath(normalizedPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const currentEvent =
    state.events.find((event) => event.id === state.currentEventId) ??
    state.events[0];

  if (!currentEvent) {
    return (
      <main className="fatal-state">
        <h1>No event data is available</h1>
        <p>Restore the fictional demonstration workspace to continue.</p>
        <button className="button button--primary" onClick={resetWorkspace}>
          Restore demo workspace
        </button>
      </main>
    );
  }

  let page = <DashboardPage state={state} onNavigate={navigate} />;

  if (currentPath === "/tasks") {
    page = (
      <TasksPage
        state={state}
        onStatusChange={updateTaskStatus}
        onToggleAcknowledgement={toggleTaskAcknowledgement}
      />
    );
  } else if (currentPath === "/team") {
    page = <TeamPage state={state} />;
  } else if (currentPath === "/changes") {
    page = (
      <ChangesPage
        state={state}
        onAcknowledge={acknowledgeChange}
        onStatusChange={updateChangeStatus}
      />
    );
  } else if (currentPath === "/templates") {
    page = <TemplatesPage state={state} onReset={resetWorkspace} />;
  }

  return (
    <AppShell
      currentPath={currentPath}
      event={currentEvent}
      persistenceError={persistenceError}
      onNavigate={navigate}
    >
      {page}
    </AppShell>
  );
}
