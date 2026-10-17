import { isIP } from "node:net";
import { EnvironmentError } from "./env.ts";

export interface DeploymentConfig {
  readonly production: boolean;
  readonly serveFrontend: boolean;
  readonly trustedProxyIps: readonly string[];
  readonly reminderWorkerEnabled: boolean;
}

// Separate from DB/CLI configuration: deployment settings never load .env files.
export function readDeploymentEnv(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DeploymentConfig {
  const production = environment.NODE_ENV === "production";
  function boolean(name: string, fallback: boolean) {
    const value = environment[name];
    if (value === undefined) return fallback;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new EnvironmentError(`${name} must be true or false.`);
  }
  const serveFrontend = boolean("SERVE_FRONTEND", production);
  if (production && !serveFrontend)
    throw new EnvironmentError("Production requires SERVE_FRONTEND=true.");
  const raw = environment.TRUSTED_PROXY_IPS;
  const trustedProxyIps = raw === undefined || raw === "" ? [] : raw.split(",");
  if (
    trustedProxyIps.length > 16 ||
    trustedProxyIps.some((ip) => !isIP(ip) || ["0.0.0.0", "::"].includes(ip))
  )
    throw new EnvironmentError(
      "TRUSTED_PROXY_IPS must contain at most 16 exact proxy IP addresses, comma-separated without spaces; wildcard trust is forbidden.",
    );
  if (
    production &&
    environment.WEB_CONCURRENCY !== undefined &&
    environment.WEB_CONCURRENCY !== "1"
  )
    throw new EnvironmentError("Production supports WEB_CONCURRENCY=1 only.");
  return Object.freeze({
    production,
    serveFrontend,
    trustedProxyIps: Object.freeze(trustedProxyIps),
    reminderWorkerEnabled: boolean("REMINDER_WORKER_ENABLED", true),
  });
}
