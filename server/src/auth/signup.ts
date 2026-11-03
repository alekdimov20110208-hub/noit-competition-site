import type { ServerConfig } from "../config/env.ts";
import type { TransactionDatabase } from "../db/transaction.ts";
import { OperationalError } from "../operations/limits.ts";
import { profileName } from "./profile.ts";

export interface SignupFields {
  name: string;
  email: string;
  password: string;
}

// Authority, callbacks, images and extra Better Auth fields never cross this boundary.
export function signupFields(body: unknown): SignupFields | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const fields = body as Record<string, unknown>;
  if (
    Object.keys(fields).some(
      (k) =>
        !["name", "email", "password", "confirmPassword", "returnTo"].includes(
          k,
        ),
    )
  )
    return null;
  const name = profileName({ name: fields.name });
  const email =
    typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
  const [local, domain, extra] = email.split("@");
  if (
    !name ||
    email.length > 254 ||
    !local ||
    local.length > 64 ||
    !domain ||
    extra !== undefined ||
    !/^(?!\.)(?!.*\.\.)[a-z0-9_'+.-]*[a-z0-9_+-]$/.test(local) ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      domain,
    ) ||
    domain.split(".").some((label) => label.length > 63) ||
    !/^[a-z]{2,}$/.test(domain.split(".").at(-1)!) ||
    typeof fields.password !== "string" ||
    fields.password.length < 8 ||
    fields.password.length > 128 ||
    fields.password !== fields.confirmPassword ||
    (fields.returnTo !== undefined && typeof fields.returnTo !== "string")
  )
    return null;
  return { name, email, password: fields.password };
}

// B1 authorizes only a local implementation. A hosted activation requires a
// separate reviewed change, even if someone accidentally sets the environment flag.
export function localSignupIdentity(config: ServerConfig) {
  if (config.publicSignupEnabled !== true) return;
  const url = new URL(config.databaseUrl);
  if (
    config.nodeEnv === "production" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username !== "budograph_runtime" ||
    url.search ||
    url.hash
  )
    throw new OperationalError();
  const database = decodeURIComponent(url.pathname.slice(1));
  return async (tx: TransactionDatabase) => {
    const result =
      await tx.query(`SELECT current_database() AS database, current_user AS role,
      host(inet_server_addr()) AS address, inet_server_port() AS port,
      NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
      AND rolcanlogin AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid)
      AND NOT has_database_privilege(r.oid,current_database(),'CREATE')
      AND NOT has_schema_privilege(r.oid,'public','CREATE') AS safe
      FROM pg_catalog.pg_roles r WHERE rolname=current_user`);
    const row = result.rows[0] as
      | {
          database: string;
          role: string;
          address: string;
          port: number;
          safe: boolean;
        }
      | undefined;
    if (
      result.rows.length !== 1 ||
      row?.database !== database ||
      row.role !== "budograph_runtime" ||
      !["127.0.0.1", "::1"].includes(row.address) ||
      row.port !== Number(url.port || 5432) ||
      row.safe !== true
    )
      throw new OperationalError();
  };
}
