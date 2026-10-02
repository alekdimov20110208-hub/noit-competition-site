import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface SessionAuth {
  api: {
    getSession(options: {
      headers: Headers;
      query?: { disableCookieCache?: boolean };
    }): Promise<{
      user: { id: string; name: string; email: string; active: boolean };
    } | null>;
  };
}

export class UnauthorizedError extends Error {
  readonly statusCode = 401;

  constructor() {
    super("Authentication required.");
    this.name = "UnauthorizedError";
  }
}

export async function getAuthenticatedUser(
  auth: SessionAuth,
  request: Pick<FastifyRequest, "headers">,
): Promise<AuthenticatedUser | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
    query: { disableCookieCache: true },
  });
  if (!session || session.user.active !== true) return null;
  const { id, name, email } = session.user;
  return Object.freeze({ id, name, email });
}

export async function requireAuthenticatedUser(
  auth: SessionAuth,
  request: Pick<FastifyRequest, "headers">,
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(auth, request);
  if (!user) throw new UnauthorizedError();
  return user;
}
