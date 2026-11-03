import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "../auth/session.ts";
import type { EventService } from "../events/service.ts";
import { EventCommandError } from "../events/model.ts";
import { OperationalError } from "../operations/limits.ts";
import type { AuthIntegration } from "./auth.ts";

export function registerEventReadRoutes(
  app: FastifyInstance,
  authentication: AuthIntegration,
  events: EventService,
) {
  app.get("/api/events", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const user = await requireAuthenticatedUser(authentication.auth, request);
    return { events: await events.list(user) };
  });
  if (events.history)
    app.get<{ Params: { eventId: string }; Querystring: { before?: unknown } }>(
      "/api/events/:eventId/history",
      async (request, reply) => {
        reply.header("cache-control", "no-store");
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        if (
          Object.keys(request.query).some((key) => key !== "before") ||
          (request.query.before !== undefined &&
            typeof request.query.before !== "string")
        )
          throw new EventCommandError(400, "INVALID_HISTORY_CURSOR");
        return events.history!(
          user,
          request.params.eventId,
          request.query.before as string | undefined,
        );
      },
    );
  if (events.removedTask)
    app.get<{ Params: { eventId: string; taskId: string } }>(
      "/api/events/:eventId/task-history/:taskId",
      async (request, reply) => {
        reply.header("cache-control", "no-store");
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        return events.removedTask!(
          user,
          request.params.eventId,
          request.params.taskId,
        );
      },
    );
  const origins = new Set(
    authentication.taskMutationOrigins ?? [
      new URL(authentication.baseURL).origin,
    ],
  );
  if (events.clearPreview)
    app.get<{ Params: { eventId: string } }>(
      "/api/events/:eventId/tasks/clear-preview",
      async (request, reply) => {
        reply.header("cache-control", "no-store");
        const user = await requireAuthenticatedUser(
          authentication.auth,
          request,
        );
        if (Object.keys(request.query as object).length)
          throw new EventCommandError(400, "INVALID_CLEAR_COMMAND");
        return events.clearPreview!(user, request.params.eventId);
      },
    );
  app.register(async (routes) => {
    routes.addHook("onRequest", async (_request, reply) => {
      reply.header("cache-control", "no-store");
    });
    async function actor(
      request: Parameters<typeof requireAuthenticatedUser>[1],
    ) {
      const user = await requireAuthenticatedUser(authentication.auth, request);
      if (
        !origins.has(request.headers.origin ?? "") ||
        request.headers["sec-fetch-site"] === "cross-site"
      )
        throw new EventCommandError(403, "UNTRUSTED_ORIGIN");
      return user;
    }
    if (events.create)
      routes.post(
        "/api/events",
        { bodyLimit: 4096 },
        async (request, reply) => {
          const user = await actor(request);
          await authentication.controls?.eventCreation(request.ip, user.id);
          const event = await events.create!(user, request.body);
          return reply.code(201).send({ event });
        },
      );
    if (events.update)
      routes.patch<{ Params: { eventId: string } }>(
        "/api/events/:eventId",
        { bodyLimit: 4096 },
        async (request) => {
          const user = await actor(request);
          return {
            event: await events.update!(
              user,
              request.params.eventId,
              request.body,
            ),
          };
        },
      );
    if (events.clearTasks)
      routes.post<{ Params: { eventId: string } }>(
        "/api/events/:eventId/tasks/clear",
        { bodyLimit: 4096 },
        async (request) => {
          const user = await actor(request);
          return events.clearTasks!(
            user,
            request.params.eventId,
            request.headers["idempotency-key"],
            request.body,
          );
        },
      );
    if (events.archive)
      routes.post<{ Params: { eventId: string } }>(
        "/api/events/:eventId/archive",
        { bodyLimit: 4096 },
        async (request) => {
          const user = await actor(request);
          return {
            event: await events.archive!(
              user,
              request.params.eventId,
              request.headers["idempotency-key"],
              request.body,
            ),
          };
        },
      );
    if (events.duplicate)
      routes.post<{ Params: { eventId: string } }>(
        "/api/events/:eventId/duplicate",
        { bodyLimit: 4096 },
        async (request, reply) => {
          const user = await actor(request);
          let creationDenied: OperationalError | undefined;
          try {
            await authentication.controls?.eventCreation(request.ip, user.id);
          } catch (error) {
            if (
              !(error instanceof OperationalError) ||
              error.statusCode !== 429
            )
              throw error;
            creationDenied = error;
          }
          const event = await events.duplicate!(
            user,
            request.params.eventId,
            request.headers["idempotency-key"],
            request.body,
            creationDenied,
          );
          // Exact accepted replay has the same response shape/status as success.
          return reply.code(201).send({ event });
        },
      );
  });
}
