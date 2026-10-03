import { betterAuth } from "better-auth";
import type { Pool } from "pg";
import type { ServerConfig } from "../config/env.ts";

export type AuthConfig = Pick<
  ServerConfig,
  "nodeEnv" | "betterAuthSecret" | "betterAuthUrl"
>;

export interface AuthOptions {
  developmentProvisioning?: true;
}

// The provisioning instance is created only by an explicit local CLI command.
// The HTTP server always uses the default instance with registration disabled.
export function createAuth(
  pool: Pool,
  config: AuthConfig,
  { developmentProvisioning }: AuthOptions = {},
) {
  if (developmentProvisioning && config.nodeEnv !== "development") {
    throw new Error("Account provisioning requires NODE_ENV=development.");
  }
  const secureCookies =
    config.nodeEnv === "production" ||
    new URL(config.betterAuthUrl).protocol === "https:";

  return betterAuth({
    appName: "BudoGraph",
    database: pool,
    secret: config.betterAuthSecret,
    baseURL: config.betterAuthUrl,
    basePath: "/api/auth",
    trustedOrigins: [
      new URL(config.betterAuthUrl).origin,
      ...(config.nodeEnv === "development" ? ["http://127.0.0.1:5173"] : []),
    ],
    disabledPaths: ["/sign-up/email"],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !developmentProvisioning,
      autoSignIn: false,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        active: {
          type: "boolean",
          required: true,
          defaultValue: true,
          input: false,
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const result = await pool.query<{ active: boolean }>(
              'SELECT active FROM public."user" WHERE id = $1',
              [session.userId],
            );
            if (result.rows[0]?.active !== true) return false;
          },
        },
      },
    },
    session: {
      cookieCache: { enabled: false },
    },
    advanced: {
      // Tests without PostgreSQL exercise HTTP/session boundaries separately;
      // real runtime instances validate the migrated schema read-only.
      database: { validateSchema: config.nodeEnv !== "test" },
      useSecureCookies: secureCookies,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookies,
      },
      // The HTTP adapter overwrites this header with the direct peer IP.
      ipAddress: { ipAddressHeaders: ["x-budograph-client-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "memory",
    },
    // Library diagnostics can include DB errors, cookies or request bodies.
    // Fastify records static safe messages at the surrounding boundary.
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
