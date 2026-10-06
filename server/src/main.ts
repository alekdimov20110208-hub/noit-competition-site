import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createApp } from "./app.ts";
import { createAuth, trustedApplicationOrigins } from "./auth/auth.ts";
import { EnvironmentError, readServerEnv } from "./config/env.ts";
import { createDatabasePool } from "./db/pool.ts";
import { createShutdown } from "./shutdown.ts";
import { createTaskService } from "./tasks/service.ts";
import { createEventService } from "./events/service.ts";
import { createInvitationService } from "./invitations/service.ts";
import { createChangeService } from "./changes/service.ts";
import {
  createEmailTasks,
  createTransactionalEmailService,
} from "./email/service.ts";
import { verificationCallback } from "./routes/auth.ts";

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
    pool = createDatabasePool(config, () => {
      app?.log.error(
        { dependency: "postgresql" },
        "Idle database client failed",
      );
    });
    const database = pool;
    const email = createTransactionalEmailService(config, (kind) =>
      app?.log.warn({ kind }, "Transactional email delivery failed"),
    );
    const registration = createAuth(database, config, {
      invitationRegistration: true,
      email,
      emailTasks,
    });
    app = createApp({
      email,
      changes: createChangeService(database),
      tasks: createTaskService(database),
      events: createEventService(database),
      invitations: createInvitationService(
        database,
        async (fields, locale, returnTo) => {
          await registration.api.signUpEmail({
            body: {
              ...fields,
              callbackURL: verificationCallback(
                config.publicAppUrl,
                returnTo,
                locale ?? "bg",
              ),
            },
            headers: new Headers({ "x-budograph-locale": locale ?? "bg" }),
          });
        },
        email.enabled,
      ),
      authentication: {
        auth: createAuth(database, config, { email, emailTasks }),
        baseURL: config.betterAuthUrl,
        taskMutationOrigins: trustedApplicationOrigins(config),
        publicAppUrl: config.publicAppUrl,
        emailEnabled: email.enabled,
        developmentInviteLinks: config.nodeEnv !== "production",
      },
      checkDatabase: async () => {
        // pg supports per-query timeouts; @types/pg omits this config field.
        const query = { text: "SELECT 1", query_timeout: 5_000 };
        await database.query(query);
      },
      logger: { level: "info" },
    });

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
