import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  getAuthenticatedUser,
  requireAuthenticatedUser,
} from "../auth/session.ts";
import type { AuthIntegration } from "./auth.ts";
import type { InvitationService } from "../invitations/service.ts";
import { InvitationError } from "../invitations/model.ts";

export function registerInvitationRoutes(
  app: FastifyInstance,
  authentication: AuthIntegration,
  service: InvitationService,
) {
  const origins = new Set(
    authentication.taskMutationOrigins ?? [
      new URL(authentication.baseURL).origin,
    ],
  );
  // Bounded single-process abuse control. Production scaling needs shared storage.
  const attempts = new Map<string, { count: number; expires: number }>();
  function limit(request: FastifyRequest, registration = false) {
    const now = Date.now(),
      key = `${registration ? "registration" : "invitation"}:${request.ip}`;
    for (const [id, value] of attempts)
      if (value.expires <= now) attempts.delete(id);
    let entry = attempts.get(key);
    if (!entry) {
      if (attempts.size >= 10_000)
        throw new InvitationError(429, "RATE_LIMITED");
      entry = { count: 0, expires: now + 60_000 };
      attempts.set(key, entry);
    }
    if (++entry.count > (registration ? 5 : 120))
      throw new InvitationError(429, "RATE_LIMITED");
  }
  function origin(request: FastifyRequest) {
    if (
      !origins.has(request.headers.origin ?? "") ||
      request.headers["sec-fetch-site"] === "cross-site"
    )
      throw new InvitationError(403, "UNTRUSTED_ORIGIN");
  }
  async function actor(request: FastifyRequest, write = false) {
    const user = await requireAuthenticatedUser(authentication.auth, request);
    if (write) origin(request);
    return user;
  }
  app.register(async (routes) => {
    routes.addHook("onRequest", async (request, reply) => {
      reply.header("cache-control", "no-store");
      reply.header("referrer-policy", "no-referrer");
      limit(request);
    });
    type Scoped = { eventId: string; invitationId: string };
    type Token = { token: string };
    routes.get<{ Params: Scoped }>(
      "/api/events/:eventId/invitations",
      async (request) => ({
        invitations: await service.list(
          await actor(request),
          request.params.eventId,
        ),
      }),
    );
    routes.post<{ Params: Scoped }>(
      "/api/events/:eventId/invitations",
      { bodyLimit: 1024 },
      async (request, reply) => {
        const result = await service.create(
          await actor(request, true),
          request.params.eventId,
          request.body,
        );
        // Relative route uses the application's current origin, never an untrusted Host.
        return reply.code(201).send({
          invitation: result.invitation,
          developmentInvitePath: `/invite/${result.token}`,
          delivery: "development_link",
        });
      },
    );
    routes.post<{ Params: Scoped }>(
      "/api/events/:eventId/invitations/:invitationId/revoke",
      { bodyLimit: 1024 },
      async (request) => ({
        invitation: await service.revoke(
          await actor(request, true),
          request.params.eventId,
          request.params.invitationId,
          request.body,
        ),
      }),
    );
    routes.get<{ Params: Token }>("/api/invitations/:token", async (request) =>
      service.lookup(request.params.token),
    );
    routes.post<{ Params: Token }>(
      "/api/invitations/:token/register",
      { bodyLimit: 4096 },
      async (request) => {
        origin(request);
        limit(request, true);
        if (await getAuthenticatedUser(authentication.auth, request))
          throw new InvitationError(403, "SIGN_OUT_REQUIRED");
        return service.register(request.params.token, request.body);
      },
    );
    routes.post<{ Params: Token }>(
      "/api/invitations/:token/accept",
      { bodyLimit: 1024 },
      async (request) =>
        service.accept(
          await actor(request, true),
          request.params.token,
          request.body,
        ),
    );
  });
}
