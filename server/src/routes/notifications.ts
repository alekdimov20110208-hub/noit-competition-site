import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "../auth/session.ts";
import type { AuthIntegration } from "./auth.ts";
import type { NotificationService } from "../notifications/service.ts";
import { TaskCommandError } from "../tasks/model.ts";

export function registerNotificationRoutes(
  app: FastifyInstance,
  authentication: AuthIntegration,
  service: NotificationService,
) {
  app.register(async (routes) => {
    routes.addHook("onRequest", async (_request, reply) => {
      reply.header("cache-control", "no-store");
    });
    type Params = { eventId: string; notificationId: string };
    routes.get<{ Params: Params }>(
      "/api/events/:eventId/notifications",
      async (request) => {
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        return service.list(user, request.params.eventId);
      },
    );
    const origins = new Set(
      authentication.taskMutationOrigins ?? [
        new URL(authentication.baseURL).origin,
      ],
    );
    for (const all of [false, true])
      routes.post<{ Params: Params }>(
        all
          ? "/api/events/:eventId/notifications/read-all"
          : "/api/events/:eventId/notifications/:notificationId/read",
        { bodyLimit: 1024 },
        async (request) => {
          const user = await requireAuthenticatedUser(
            authentication.auth,
            request,
          );
          if (
            !origins.has(request.headers.origin ?? "") ||
            request.headers["sec-fetch-site"] === "cross-site"
          )
            throw new TaskCommandError(403, "UNTRUSTED_ORIGIN");
          if (
            request.body !== undefined &&
            request.body !== null &&
            (typeof request.body !== "object" ||
              Array.isArray(request.body) ||
              Object.keys(request.body).length)
          )
            throw new TaskCommandError(400, "INVALID_COMMAND");
          return all
            ? service.markAllRead(user, request.params.eventId)
            : service.markRead(
                user,
                request.params.eventId,
                request.params.notificationId,
              );
        },
      );
  });
}
