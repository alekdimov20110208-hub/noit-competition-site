export interface ShutdownOptions {
  closeApp: () => Promise<void>;
  closeDatabase: () => Promise<void>;
  onFailure: (stage: "http" | "database") => void;
}

export function createShutdown({
  closeApp,
  closeDatabase,
  onFailure,
}: ShutdownOptions): () => Promise<boolean> {
  let shutdownPromise: Promise<boolean> | undefined;
  const reportFailure = (stage: "http" | "database") => {
    try {
      onFailure(stage);
    } catch {
      // Resource cleanup must still complete if the logging destination fails.
    }
  };

  return () => {
    shutdownPromise ??= Promise.resolve().then(async () => {
      let successful = true;
      try {
        await closeApp();
      } catch {
        successful = false;
        reportFailure("http");
      }

      // The pool must still close when the HTTP close fails, including startup.
      try {
        await closeDatabase();
      } catch {
        successful = false;
        reportFailure("database");
      }

      return successful;
    });
    return shutdownPromise;
  };
}
