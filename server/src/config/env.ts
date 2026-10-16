import { isIP } from "node:net";

export type DatabaseTls =
  | { readonly mode: "disable" }
  | { readonly mode: "verify-full"; readonly caFile: string };

export interface DatabaseConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly databaseTls: DatabaseTls;
}

export interface ServerConfig extends DatabaseConfig {
  readonly betterAuthSecret: string;
  readonly betterAuthUrl: string;
  readonly emailMode: "disabled" | "resend";
  readonly publicAppUrl: string;
  readonly emailFrom?: string;
  readonly resendApiKey?: string;
}

export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

// Messages name the invalid field, never its potentially secret value.
export function readDatabaseEnv(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DatabaseConfig {
  const nodeEnv = environment.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new EnvironmentError(
      "NODE_ENV must be development, test, or production.",
    );
  }

  const host = environment.HOST ?? "127.0.0.1";
  const validHostname =
    host.length <= 253 &&
    host
      .split(".")
      .every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
  if (!isIP(host) && !validHostname) {
    throw new EnvironmentError("HOST must be an IP address or hostname.");
  }

  const rawPort = environment.PORT ?? "3001";
  const port = Number(rawPort);
  if (
    !/^\d+$/.test(rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new EnvironmentError("PORT must be an integer between 1 and 65535.");
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) {
    throw new EnvironmentError(
      "DATABASE_URL is required for server and database commands.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
    if (
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.pathname.length <= 1 ||
      parsed.hash ||
      /\s/.test(databaseUrl) ||
      /REPLACE_/i.test(databaseUrl)
    ) {
      throw new Error("Invalid PostgreSQL URL");
    }
  } catch {
    throw new EnvironmentError(
      "DATABASE_URL must be a PostgreSQL URL with a host and database; replace example placeholders.",
    );
  }

  // pg parses URL query options after Pool options, potentially replacing ssl
  // or even the host. Keep one configuration authority and reject all overrides
  // before pg can parse them or read sslrootcert/sslkey files.
  if (parsed.search) {
    throw new EnvironmentError(
      "DATABASE_URL must not contain query options; configure TLS with DATABASE_TLS_MODE and DATABASE_TLS_CA_FILE.",
    );
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    parsed.hostname.toLowerCase(),
  );
  const mode =
    environment.DATABASE_TLS_MODE ??
    (nodeEnv !== "production" && loopback ? "disable" : "verify-full");
  const caFile = environment.DATABASE_TLS_CA_FILE;
  let databaseTls: DatabaseTls;
  if (mode === "disable") {
    if (nodeEnv === "production" || !loopback || caFile !== undefined) {
      throw new EnvironmentError(
        "DATABASE_TLS_MODE=disable requires a non-production loopback database and no DATABASE_TLS_CA_FILE.",
      );
    }
    databaseTls = Object.freeze({ mode });
  } else if (mode === "verify-full") {
    if (
      !caFile ||
      !caFile.trim() ||
      caFile !== caFile.trim() ||
      caFile.length > 4096 ||
      caFile.includes("\0") ||
      /REPLACE_/i.test(caFile)
    ) {
      throw new EnvironmentError(
        "DATABASE_TLS_CA_FILE must name a trusted PEM CA file for verify-full TLS.",
      );
    }
    if (environment.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
      throw new EnvironmentError(
        "NODE_TLS_REJECT_UNAUTHORIZED must not disable certificate verification.",
      );
    }
    databaseTls = Object.freeze({ mode, caFile });
  } else {
    throw new EnvironmentError(
      "DATABASE_TLS_MODE must be verify-full or disable.",
    );
  }

  return Object.freeze({
    nodeEnv: nodeEnv as DatabaseConfig["nodeEnv"],
    host,
    port,
    databaseUrl,
    databaseTls,
  });
}

export function readServerEnv(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ServerConfig {
  const database = readDatabaseEnv(environment);
  const betterAuthSecret = environment.BETTER_AUTH_SECRET;
  if (
    !betterAuthSecret ||
    betterAuthSecret.length < 32 ||
    betterAuthSecret.length > 512 ||
    /\s|REPLACE_|SYNTHETIC_|CHANGE_ME/i.test(betterAuthSecret) ||
    new Set(betterAuthSecret).size < 12
  ) {
    throw new EnvironmentError(
      "BETTER_AUTH_SECRET must be a high-entropy secret of at least 32 characters; replace example placeholders.",
    );
  }

  const betterAuthUrl = environment.BETTER_AUTH_URL;
  try {
    if (!betterAuthUrl) throw new Error("Missing auth URL");
    const url = new URL(betterAuthUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      /\s|REPLACE_/i.test(betterAuthUrl) ||
      (database.nodeEnv === "production" && url.protocol !== "https:")
    ) {
      throw new Error("Invalid auth URL");
    }
    const publicAppUrl = environment.PUBLIC_APP_URL ?? url.origin;
    const app = new URL(publicAppUrl);
    if (
      app.origin !== publicAppUrl.replace(/\/$/, "") ||
      app.username ||
      app.password ||
      (database.nodeEnv === "production" &&
        (app.protocol !== "https:" ||
          /(?:^|\.)localhost\.?$/i.test(app.hostname) ||
          isIP(app.hostname.replace(/^\[|\]$/g, "")) !== 0))
    )
      throw new EnvironmentError(
        "PUBLIC_APP_URL must be a trusted HTTP(S) origin; production requires a public HTTPS origin.",
      );
    if (
      !["http:", "https:"].includes(app.protocol) ||
      (database.nodeEnv === "production" && app.origin !== url.origin)
    )
      throw new EnvironmentError(
        "Production PUBLIC_APP_URL must match BETTER_AUTH_URL (same-origin deployment).",
      );
    const emailMode =
      environment.EMAIL_MODE ??
      (database.nodeEnv === "production" ? "resend" : "disabled");
    if (
      !["disabled", "resend"].includes(emailMode) ||
      (database.nodeEnv === "production" && emailMode !== "resend")
    )
      throw new EnvironmentError(
        "EMAIL_MODE must be disabled or resend; production requires resend.",
      );
    const emailFrom = environment.EMAIL_FROM;
    const resendApiKey = environment.RESEND_API_KEY;
    if (
      emailMode === "resend" &&
      (!emailFrom ||
        !/^(?:BudoGraph <[a-z\d._+-]+@[a-z\d.-]+\.[a-z]{2,}>|[a-z\d._+-]+@[a-z\d.-]+\.[a-z]{2,})$/i.test(
          emailFrom,
        ) ||
        /[\r\n]|REPLACE_|resend\.dev/i.test(emailFrom) ||
        !resendApiKey ||
        !/^re_[a-z\d_-]{10,}$/i.test(resendApiKey) ||
        /REPLACE_/i.test(resendApiKey))
    )
      throw new EnvironmentError(
        "Resend mode requires valid EMAIL_FROM and RESEND_API_KEY; replace placeholders and verify the sending domain.",
      );
    return Object.freeze({
      ...database,
      betterAuthSecret,
      betterAuthUrl: url.origin,
      publicAppUrl: app.origin,
      emailMode: emailMode as ServerConfig["emailMode"],
      ...(emailMode === "resend" ? { emailFrom, resendApiKey } : {}),
    });
  } catch (error) {
    if (error instanceof EnvironmentError) throw error;
    throw new EnvironmentError(
      "BETTER_AUTH_URL must be an explicit HTTP(S) origin without credentials, query, fragment or path; production requires HTTPS.",
    );
  }
}
