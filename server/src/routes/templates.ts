import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "../auth/session.ts";
import { EventCommandError } from "../events/model.ts";
import type { TemplateApplicationService } from "../templates/service.ts";
import type { AuthIntegration } from "./auth.ts";

export function registerTemplateRoutes(
  app: FastifyInstance,
  authentication: AuthIntegration,
  templates: TemplateApplicationService,
) {
  const origins = new Set(
    authentication.taskMutationOrigins ?? [
      new URL(authentication.baseURL).origin,
    ],
  );
  app.register(async (routes) => {
    routes.addHook("onRequest", async (_request, reply) => {
      reply.header("cache-control", "no-store");
    });
    for (const operation of ["preview", "apply"] as const)
      routes.post<{ Params: { eventId: string } }>(
        `/api/events/:eventId/templates/${operation}`,
        { bodyLimit: 4096 },
        async (request, reply) => {
          const user = await requireAuthenticatedUser(
            authentication.auth,
            request,
          );
          if (
            !origins.has(request.headers.origin ?? "") ||
            request.headers["sec-fetch-site"] === "cross-site"
          )
            throw new EventCommandError(403, "UNTRUSTED_ORIGIN");
          if (Object.keys(request.query as object).length)
            throw new EventCommandError(400, "INVALID_TEMPLATE_COMMAND");
          if (operation === "preview")
            return templates.preview(
              user,
              request.params.eventId,
              request.body,
            );
          return reply
            .code(201)
            .send(
              await templates.apply(
                user,
                request.params.eventId,
                request.headers["idempotency-key"],
                request.body,
              ),
            );
        },
      );
  });
}
