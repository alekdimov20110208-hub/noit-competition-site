import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { fileURLToPath } from "node:url";
import { readDeploymentEnv } from "./config/deployment.ts";
import { verifyProductionSchema } from "./db/production-schema.ts";
import { registerEmailWorker } from "./email/worker.ts";
import { exclusiveReminderWorker } from "./notifications/exclusive.ts";
import { createApp } from "./app.ts";
import { EnvironmentError, readServerEnv } from "./config/env.ts";
import { createDatabasePool } from "./db/pool.ts";
import {
  guardProductionDatabasePool,
  readProductionDatabaseIdentity,
  validateRuntimeConnection,
} from "./db/identity.ts";
import { createShutdown } from "./shutdown.ts";
import { createEmailTasks } from "./email/service.ts";
import { createApplicationServices } from "./runtime.ts";
import {
  createReminderWorker,
  registerReminderWorker,
} from "./notifications/worker.ts";

async function main() {
  let app: FastifyInstance | undefined;
  let pool: Pool | undefined;
  let stopping = false;
  const emailTasks = createEmailTasks();

  const shutdown = createShutdown({
    closeApp: async () => {
      await app?.close();
      await emailTasks.drain();
    },
    closeDatabase: async () => {
      await pool?.end();
    },
    onFailure: (stage) => {
      app?.log.error({ stage }, "Backend shutdown failed");
    },
  });

  const removeSignalHandlers = () => {
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
  };

  const stop = async () => {
    stopping = true;
    try {
      if (!(await shutdown())) process.exitCode = 1;
    } finally {
      removeSignalHandlers();
    }
  };

  function handleSignal() {
    void stop();
  }

  try {
    const config = readServerEnv();
    const deployment = readDeploymentEnv();
    const identity = deployment.production
      ? readProductionDatabaseIdentity()
      : undefined;
    if (identity) validateRuntimeConnection(config.databaseUrl, identity);
    pool = createDatabasePool(config, () => {
      app?.log.error(
        { dependency: "postgresql" },
        "Idle database client failed",
      );
    });
    const database = pool;
    if (identity) guardProductionDatabasePool(database, identity);
    if (deployment.production) {
      const directory = fileURLToPath(
        new URL(
          import.meta.url.endsWith(".ts")
            ? "../migrations/"
            : "../../migrations/",
          import.meta.url,
        ),
      );
      await verifyProductionSchema(database, directory);
    }
    const { emailOperations, ...services } = createApplicationServices(
      database,
      config,
      emailTasks,
      (kind) => app?.log.warn({ kind }, "Transactional email delivery failed"),
    );
    app = createApp({
      production: deployment.production,
      trustedProxyIps: deployment.trustedProxyIps,
      ...(deployment.serveFrontend
        ? {
            frontendRoot: fileURLToPath(
              new URL(
                import.meta.url.endsWith(".ts")
                  ? "../../dist/"
                  : "../../../dist/",
                import.meta.url,
              ),
            ),
          }
        : {}),
      ...services,
      logger: { level: "info" },
    });

    if (emailOperations) registerEmailWorker(app, emailOperations);

    if (deployment.reminderWorkerEnabled)
      registerReminderWorker(
        app,
        exclusiveReminderWorker(database, createReminderWorker(database)),
      );
    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    if (!stopping) {
      process.exitCode = 1;
      const message =
        error instanceof EnvironmentError
          ? error.message
          : "Backend startup failed; check server configuration";
      if (app) app.log.error(message);
      else process.stderr.write(`${message}\n`);
    }
    await stop();
  }
}

await main();
