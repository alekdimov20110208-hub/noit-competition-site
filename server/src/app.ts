import Fastify, {
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import { registerHealthRoutes, type CheckDatabase } from "./routes/health.ts";
import { registerAuthRoutes, type AuthIntegration } from "./routes/auth.ts";
import { registerTaskRoutes } from "./routes/tasks.ts";
import type { TaskService } from "./tasks/service.ts";
import { TaskCommandError } from "./tasks/model.ts";

export interface AppOptions {
  checkDatabase: CheckDatabase;
  logger?: FastifyServerOptions["logger"];
  authentication?: AuthIntegration;
  tasks?: TaskService;
}

const standardMethods = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

export function createApp({
  checkDatabase,
  logger = false,
  authentication,
  tasks,
}: AppOptions) {
  const app = Fastify({
    requestIdHeader: false,
    frameworkErrors: (
      error: FastifyError,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const statusCode = error.code === "FST_ERR_MAX_PARAM_LENGTH" ? 414 : 400;
      request.log.warn({ statusCode }, "Invalid request URL");
      reply.code(statusCode).send({ status: "error" });
    },
    logger:
      logger === false
        ? false
        : {
            ...(typeof logger === "object" ? logger : {}),
            // Request URLs, headers, bodies and raw errors can contain secrets.
            // Use a whitelist instead of relying on redacting known field names.
            serializers: {
              req: (request) => ({
                method: standardMethods.has(request.method)
                  ? request.method
                  : "OTHER",
              }),
              res: (reply) => ({ statusCode: reply.statusCode }),
              err: () => ({
                type: "Error",
                message: "Request failed",
                stack: "",
              }),
            },
          },
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ status: "not_found" });
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof TaskCommandError) {
      return reply
        .code(error.statusCode)
        .send({ status: "error", code: error.code });
    }
    const reportedStatus =
      typeof error === "object" && error !== null && "statusCode" in error
        ? error.statusCode
        : undefined;
    const statusCode =
      typeof reportedStatus === "number" &&
      Number.isInteger(reportedStatus) &&
      reportedStatus >= 400 &&
      reportedStatus < 500
        ? reportedStatus
        : 500;

    request.log.error({ statusCode }, "Request failed");
    return reply.code(statusCode).send({ status: "error" });
  });

  registerHealthRoutes(app, checkDatabase);
  if (authentication) registerAuthRoutes(app, authentication);
  if (authentication && tasks) registerTaskRoutes(app, authentication, tasks);
  return app;
}
