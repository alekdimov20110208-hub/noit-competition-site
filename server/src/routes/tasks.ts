import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "../auth/session.ts";
import type { AuthIntegration } from "./auth.ts";
import { TaskCommandError, type TaskCommand } from "../tasks/model.ts";
import type { TaskService } from "../tasks/service.ts";

export function registerTaskRoutes(
  app: FastifyInstance,
  authentication: AuthIntegration,
  service: TaskService,
) {
  // Isolated plugin hook: protected task reads must never enter a shared cache.
  app.register(async (routes) => {
    routes.addHook("onRequest", async (_request, reply) => {
      reply.header("cache-control", "no-store");
    });
    type Params = { eventId: string; taskId: string };
    routes.get<{ Params: Params }>(
      "/api/events/:eventId/members",
      async (request) => {
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        return {
          members: await service.readAssignableMembers(
            user,
            request.params.eventId,
          ),
        };
      },
    );
    routes.get<{ Params: Params }>(
      "/api/events/:eventId/tasks",
      async (request) => {
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        return service.readForWorkspace(user, request.params.eventId);
      },
    );
    routes.get<{ Params: Params }>(
      "/api/events/:eventId/tasks/:taskId",
      async (request) => {
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        const [task] = await service.read(
          user,
          request.params.eventId,
          request.params.taskId,
        );
        return { task };
      },
    );
    const origin = new URL(authentication.baseURL).origin;
    const origins = new Set(authentication.taskMutationOrigins ?? [origin]);
    for (const editing of [false, true]) {
      routes.route<{ Params: Params }>({
        method: editing ? "PATCH" : "POST",
        url: editing
          ? "/api/events/:eventId/tasks/:taskId"
          : "/api/events/:eventId/tasks",
        bodyLimit: 32768,
        async handler(request, reply) {
          const user = await requireAuthenticatedUser(
            authentication.auth,
            request,
          );
          if (
            !origins.has(request.headers.origin ?? "") ||
            request.headers["sec-fetch-site"] === "cross-site"
          )
            throw new TaskCommandError(403, "UNTRUSTED_ORIGIN");
          const task = editing
            ? await service.updateDetails(
                user,
                request.params.eventId,
                request.params.taskId,
                request.body,
              )
            : await service.create(user, request.params.eventId, request.body);
          return reply.code(editing ? 200 : 201).send({ task });
        },
      });
    }
    for (const [kind, method] of [
      ["assignment", "POST"],
      ["acceptance", "PUT"],
      ["status", "PATCH"],
    ] as const) {
      routes.route<{ Params: Params }>({
        method,
        url: `/api/events/:eventId/tasks/:taskId/${kind}`,
        bodyLimit: 4096,
        async handler(request) {
          const user = await requireAuthenticatedUser(
            authentication.auth,
            request,
          );
          // Cookie writes require the explicit trusted origin, even for CLI
          // callers. SameSite alone cannot protect against a hostile sibling.
          if (
            !origins.has(request.headers.origin ?? "") ||
            request.headers["sec-fetch-site"] === "cross-site"
          ) {
            throw new TaskCommandError(403, "UNTRUSTED_ORIGIN");
          }
          return {
            task: await service.mutate(
              user,
              request.params.eventId,
              request.params.taskId,
              kind satisfies TaskCommand["kind"],
              request.body,
            ),
          };
        },
      });
    }
  });
}
