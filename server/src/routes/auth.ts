import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser, type SessionAuth } from "../auth/session.ts";

export interface AuthIntegration {
  auth: SessionAuth & { handler(request: Request): Promise<Response> };
  baseURL: string;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  { auth, baseURL }: AuthIntegration,
) {
  const origin = new URL(baseURL).origin;
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, origin);
      if (url.origin !== origin) {
        return reply.code(400).send({ status: "error" });
      }
      const headers = fromNodeHeaders(request.headers);
      // Fastify's default trustProxy=false resolves the direct peer address.
      // Clients cannot supply the IP header consumed by Better Auth.
      headers.set("x-budograph-client-ip", request.ip);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          ...(request.body !== undefined && request.method !== "GET"
            ? { body: JSON.stringify(request.body) }
            : {}),
        }),
      );
      reply.code(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header("set-cookie", cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });

  app.get("/api/me", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const user = await requireAuthenticatedUser(auth, request);
    return { user };
  });
}
