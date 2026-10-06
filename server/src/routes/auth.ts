import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser, type SessionAuth } from "../auth/session.ts";
import { createEmailThrottle } from "../email/throttle.ts";
import { emailLocale } from "../email/service.ts";
import { uuidPattern } from "../tasks/model.ts";

export interface AuthIntegration {
  auth: SessionAuth & { handler(request: Request): Promise<Response> };
  baseURL: string;
  taskMutationOrigins?: readonly string[];
  publicAppUrl?: string;
  emailEnabled?: boolean;
  developmentInviteLinks?: boolean;
}
export function safeEmailReturnTo(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    /[\s\\%]/.test(value) ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "/";
  if (/^\/invite\/[A-Za-z0-9_-]{43}$/.test(value)) return value;
  const url = new URL(value, "https://budograph.invalid");
  if (url.origin !== "https://budograph.invalid" || url.hash) return "/";
  const parts = url.pathname.split("/");
  const legacy = [
    "/",
    "/tasks",
    "/team",
    "/changes",
    "/templates",
    "/events/new",
  ].includes(url.pathname);
  const scoped =
    parts[1] === "events" &&
    uuidPattern.test(parts[2] ?? "") &&
    ((parts.length === 4 &&
      ["dashboard", "tasks", "team", "changes", "templates", "edit"].includes(
        parts[3] ?? "",
      )) ||
      (parts.length === 5 &&
        parts[3] === "changes" &&
        uuidPattern.test(parts[4] ?? "")));
  if (!legacy && !scoped) return "/";
  if (
    url.search &&
    (!url.pathname.endsWith("/tasks") ||
      url.searchParams.size !== 1 ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(url.searchParams.get("task") ?? ""))
  )
    return "/";
  return url.pathname + url.search;
}
export function verificationCallback(
  origin: string,
  returnTo: unknown,
  locale?: "bg" | "en",
) {
  const url = new URL("/verify-email", origin);
  url.searchParams.set("status", "verified");
  const path = safeEmailReturnTo(returnTo);
  if (path !== "/") url.searchParams.set("returnTo", path);
  if (locale) url.searchParams.set("lang", locale);
  return url.href;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  { auth, baseURL, publicAppUrl = baseURL, emailEnabled }: AuthIntegration,
) {
  const origin = new URL(baseURL).origin;
  const throttle = createEmailThrottle();
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    bodyLimit: 4096,
    async handler(request, reply) {
      reply.header("cache-control", "no-store");
      reply.header("referrer-policy", "no-referrer");
      const url = new URL(request.url, origin);
      if (url.origin !== origin) {
        return reply.code(400).send({ status: "error" });
      }
      const headers = fromNodeHeaders(request.headers);
      headers.set(
        "x-budograph-locale",
        emailLocale(request.headers["x-budograph-locale"]),
      );
      const mailRequest =
        request.method === "POST" &&
        [
          "/api/auth/request-password-reset",
          "/api/auth/send-verification-email",
        ].includes(url.pathname.replace(/\/$/, ""));
      let body = request.body;
      if (mailRequest) {
        const fields = body as Record<string, unknown> | undefined;
        if (
          !fields ||
          typeof fields.email !== "string" ||
          fields.email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)
        )
          return reply.code(400).send({ status: "error" });
        // Throttle before identity lookup: existence and provider outcome do not affect it.
        if (!throttle(request.ip, fields.email))
          return reply
            .code(429)
            .send({ status: "error", code: "RATE_LIMITED" });
        if (emailEnabled === false)
          return reply.code(503).send({ status: "error" });
        body = url.pathname.includes("request-password-reset")
          ? {
              email: fields.email.trim().toLowerCase(),
              redirectTo: new URL("/reset-password", publicAppUrl).href,
            }
          : {
              email: fields.email.trim().toLowerCase(),
              callbackURL: verificationCallback(publicAppUrl, fields.returnTo),
            };
      }
      if (
        request.method === "GET" &&
        url.pathname === "/api/auth/verify-email"
      ) {
        const callback = url.searchParams.get("callbackURL");
        let returnTo = "/";
        try {
          returnTo = safeEmailReturnTo(
            new URL(callback ?? "", publicAppUrl).searchParams.get("returnTo"),
          );
        } catch {
          /* Safe default. */
        }
        url.searchParams.set(
          "callbackURL",
          verificationCallback(publicAppUrl, returnTo),
        );
      }
      if (
        request.method === "GET" &&
        url.pathname.startsWith("/api/auth/reset-password/")
      )
        url.searchParams.set(
          "callbackURL",
          new URL("/reset-password", publicAppUrl).href,
        );
      // Fastify's default trustProxy=false resolves the direct peer address.
      // Clients cannot supply the IP header consumed by Better Auth.
      headers.set("x-budograph-client-ip", request.ip);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          ...(body !== undefined && request.method !== "GET"
            ? { body: JSON.stringify(body) }
            : {}),
        }),
      );
      if (
        mailRequest &&
        response.status !== 403 &&
        response.status !== 429 &&
        response.status < 500
      )
        return reply.code(200).send({ status: true });
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
