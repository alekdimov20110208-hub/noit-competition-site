import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  getAuthenticatedUser,
  requireAuthenticatedUser,
} from "../auth/session.ts";
import type { AuthIntegration } from "./auth.ts";
import type { InvitationService } from "../invitations/service.ts";
import { InvitationError } from "../invitations/model.ts";
import {
  emailLocale,
  type TransactionalEmailService,
} from "../email/service.ts";
import { createEmailThrottle } from "../email/throttle.ts";

export function registerInvitationRoutes(
  app: FastifyInstance,
  authentication: AuthIntegration,
  service: InvitationService,
  email?: TransactionalEmailService,
) {
  const throttleEmail = createEmailThrottle(Date.now, {
    identity: 30,
    ip: 60,
    global: 100,
  });
  async function delivery(
    result: Awaited<ReturnType<InvitationService["create"]>>,
    locale: unknown,
  ) {
    const development = authentication.developmentInviteLinks ?? false;
    let status = "development_link";
    if (result.emailJob && email?.dispatch) {
      try {
        status = (await email.dispatch(result.emailJob, 1)).accepted
          ? "sent"
          : "failed";
      } catch {
        status = "failed";
      }
    } else if (email?.enabled) {
      try {
        await email.send({
          kind: "invitation",
          to: result.invitation.email,
          url: new URL(
            `/invite/${result.token}`,
            authentication.publicAppUrl ?? authentication.baseURL,
          ).href,
          locale: emailLocale(locale),
          eventName: result.eventName,
          expiresAt: result.invitation.expiresAt,
        });
        status = "sent";
      } catch {
        status = "failed";
      }
    } else if (!development) status = "failed";
    return {
      invitation: result.invitation,
      delivery: status,
      ...(development
        ? { developmentInvitePath: `/invite/${result.token}` }
        : {}),
    };
  }
  const origins = new Set(
    authentication.taskMutationOrigins ?? [
      new URL(authentication.baseURL).origin,
    ],
  );
  // Bounded single-process abuse control. Production scaling needs shared storage.
  const attempts = new Map<string, { count: number; expires: number }>();
  async function limit(request: FastifyRequest, registration = false) {
    if (authentication.controls) {
      await authentication.controls.invitation(
        request.ip,
        registration,
        registration
          ? ((request.params as { token?: string }).token ?? "")
          : "",
      );
      return;
    }
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
      await limit(request);
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
        const user = await actor(request, true);
        if (authentication.controls)
          await authentication.controls.email(
            "invitation-mail",
            request.ip,
            user.id,
          );
        else if (!throttleEmail(request.ip, user.id))
          throw new InvitationError(429, "RATE_LIMITED");
        const result = await service.create(
          user,
          request.params.eventId,
          request.body,
          emailLocale(request.headers["x-budograph-locale"]),
        );
        const response = await delivery(
          result,
          request.headers["x-budograph-locale"],
        );
        return reply.code(201).send(response);
      },
    );
    routes.post<{ Params: Scoped }>(
      "/api/events/:eventId/invitations/:invitationId/resend",
      { bodyLimit: 1024 },
      async (request) => {
        const user = await actor(request, true);
        if (authentication.controls)
          await authentication.controls.email(
            "invitation-mail",
            request.ip,
            user.id,
          );
        else if (!throttleEmail(request.ip, user.id))
          throw new InvitationError(429, "RATE_LIMITED");
        if (request.body && Object.keys(request.body).length)
          throw new InvitationError(400, "INVALID_INPUT");
        return delivery(
          await service.resend(
            user,
            request.params.eventId,
            request.params.invitationId,
            emailLocale(request.headers["x-budograph-locale"]),
          ),
          request.headers["x-budograph-locale"],
        );
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
        await limit(request, true);
        if (await getAuthenticatedUser(authentication.auth, request))
          throw new InvitationError(403, "SIGN_OUT_REQUIRED");
        return service.register(
          request.params.token,
          request.body,
          emailLocale(request.headers["x-budograph-locale"]),
          email?.enabled === true,
        );
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
