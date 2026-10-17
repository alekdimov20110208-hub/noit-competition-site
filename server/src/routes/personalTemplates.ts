import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "../auth/session.ts";
import { EventCommandError } from "../events/model.ts";
import type { PersonalTemplateService } from "../templates/library.ts";
import type { AuthIntegration } from "./auth.ts";
export function registerPersonalTemplateRoutes(
  app: FastifyInstance,
  authentication: AuthIntegration,
  library: PersonalTemplateService,
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
    routes.get("/api/templates/mine", async (request) => {
      const user = await requireAuthenticatedUser(authentication.auth, request),
        q = request.query as Record<string, unknown>;
      if (
        Object.keys(q).some((k) => k !== "after") ||
        (q.after !== undefined && typeof q.after !== "string")
      )
        throw new EventCommandError(400, "INVALID_TEMPLATE_COMMAND");
      return library.list(user, q.after as string | undefined);
    });
    routes.get<{ Params: { templateId: string } }>(
      "/api/templates/mine/:templateId",
      async (request) => {
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        if (Object.keys(request.query as object).length)
          throw new EventCommandError(400, "INVALID_TEMPLATE_COMMAND");
        return library.detail(user, request.params.templateId);
      },
    );
    routes.get<{ Params: { eventId: string } }>(
      "/api/events/:eventId/templates/source",
      async (request) => {
        const user = await requireAuthenticatedUser(
            authentication.auth,
            request,
          ),
          q = request.query as Record<string, unknown>;
        if (
          Object.keys(q).some((k) => k !== "after") ||
          (q.after !== undefined && typeof q.after !== "string")
        )
          throw new EventCommandError(400, "INVALID_TEMPLATE_COMMAND");
        return library.source(
          user,
          request.params.eventId,
          q.after as string | undefined,
        );
      },
    );
    routes.post<{ Params: { eventId: string } }>(
      "/api/events/:eventId/templates/save",
      { bodyLimit: 1100000 },
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
        return reply
          .code(201)
          .send(
            await library.save(
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
