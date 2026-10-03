import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "../auth/session.ts";
import type { EventReadService } from "../events/service.ts";
import type { AuthIntegration } from "./auth.ts";

export function registerEventReadRoutes(
  app: FastifyInstance,
  authentication: AuthIntegration,
  events: EventReadService,
) {
  app.get("/api/events", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const user = await requireAuthenticatedUser(authentication.auth, request);
    return { events: await events.list(user) };
  });
}
