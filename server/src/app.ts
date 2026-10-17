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
import { registerEventReadRoutes } from "./routes/events.ts";
import type { EventService } from "./events/service.ts";
import { EventCommandError } from "./events/model.ts";
import { InvitationError } from "./invitations/model.ts";
import type { InvitationService } from "./invitations/service.ts";
import { registerInvitationRoutes } from "./routes/invitations.ts";
import { registerChangeRoutes } from "./routes/changes.ts";
import { ChangeCommandError } from "./changes/model.ts";
import type { ChangeService } from "./changes/service.ts";
import type { TransactionalEmailService } from "./email/service.ts";
import type { NotificationService } from "./notifications/service.ts";
import { registerNotificationRoutes } from "./routes/notifications.ts";
import { registerTemplateRoutes } from "./routes/templates.ts";
import type { TemplateApplicationService } from "./templates/service.ts";
import type { PersonalTemplateService } from "./templates/library.ts";
import { registerPersonalTemplateRoutes } from "./routes/personalTemplates.ts";

export interface AppOptions {
  personalTemplates?: PersonalTemplateService;
  templates?: TemplateApplicationService;
  checkDatabase: CheckDatabase;
  logger?: FastifyServerOptions["logger"];
  authentication?: AuthIntegration;
  tasks?: TaskService;
  events?: EventService;
  invitations?: InvitationService;
  changes?: ChangeService;
  email?: TransactionalEmailService;
  notifications?: NotificationService;
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
  personalTemplates,
  templates,
  checkDatabase,
  logger = false,
  authentication,
  tasks,
  events,
  invitations,
  changes,
  email,
  notifications,
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
    if (error instanceof ChangeCommandError) {
      return reply.code(error.statusCode).send({
        status: "error",
        code: error.code,
        ...(error.fields ? { fields: error.fields } : {}),
      });
    }
    if (error instanceof InvitationError) {
      return reply
        .code(error.statusCode)
        .send({ status: "error", code: error.code });
    }
    if (error instanceof EventCommandError) {
      return reply.code(error.statusCode).send({
        status: "error",
        code: error.code,
        ...(error.fields ? { fields: error.fields } : {}),
      });
    }
    if (error instanceof TaskCommandError) {
      return reply.code(error.statusCode).send({
        status: "error",
        code: error.code,
        ...(error.fields ? { fields: error.fields } : {}),
      });
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
  if (authentication && templates)
    registerTemplateRoutes(app, authentication, templates);
  if (authentication && personalTemplates)
    registerPersonalTemplateRoutes(app, authentication, personalTemplates);
  if (authentication && changes)
    registerChangeRoutes(app, authentication, changes);
  if (authentication) registerAuthRoutes(app, authentication);
  if (authentication && tasks) registerTaskRoutes(app, authentication, tasks);
  if (authentication && notifications)
    registerNotificationRoutes(app, authentication, notifications);
  if (authentication && events)
    registerEventReadRoutes(app, authentication, events);
  if (authentication && invitations)
    registerInvitationRoutes(app, authentication, invitations, email);
  return app;
}
