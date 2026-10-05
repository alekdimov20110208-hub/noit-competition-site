import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "../auth/session.ts";
import type { AuthIntegration } from "./auth.ts";
import { ChangeCommandError } from "../changes/model.ts";
import type { ChangeService } from "../changes/service.ts";

export function registerChangeRoutes(
  app: FastifyInstance,
  authentication: AuthIntegration,
  service: ChangeService,
) {
  app.register(async (routes) => {
    routes.addHook("onRequest", async (_request, reply) => {
      reply.header("cache-control", "no-store");
    });
    type Params = { eventId: string; changeId: string };
    routes.get<{ Params: Params }>(
      "/api/events/:eventId/changes",
      async (request) => {
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        return { changes: await service.read(user, request.params.eventId) };
      },
    );
    routes.get<{ Params: Params }>(
      "/api/events/:eventId/changes/:changeId",
      async (request) => {
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        const [change] = await service.read(
          user,
          request.params.eventId,
          request.params.changeId,
        );
        return { change };
      },
    );
    const origins = new Set(
      authentication.taskMutationOrigins ?? [
        new URL(authentication.baseURL).origin,
      ],
    );
    for (const editing of [false, true])
      routes.route<{ Params: Params }>({
        method: editing ? "PATCH" : "POST",
        url: `/api/events/:eventId/changes${editing ? "/:changeId" : ""}`,
        bodyLimit: 65536,
        async handler(request, reply) {
          const user = await requireAuthenticatedUser(
            authentication.auth,
            request,
          );
          if (
            !origins.has(request.headers.origin ?? "") ||
            request.headers["sec-fetch-site"] === "cross-site"
          )
            throw new ChangeCommandError(403, "UNTRUSTED_ORIGIN");
          const change = editing
            ? await service.update(
                user,
                request.params.eventId,
                request.params.changeId,
                request.body,
              )
            : await service.create(user, request.params.eventId, request.body);
          return reply.code(editing ? 200 : 201).send({ change });
        },
      });
  });
}
