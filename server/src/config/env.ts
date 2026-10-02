import { isIP } from "node:net";

export interface ServerConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
}

export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

// Messages name the invalid field, never its potentially secret value.
export function readServerEnv(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ServerConfig {
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
  try {
    const parsed = new URL(databaseUrl);
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

  return Object.freeze({
    nodeEnv: nodeEnv as ServerConfig["nodeEnv"],
    host,
    port,
    databaseUrl,
  });
}
