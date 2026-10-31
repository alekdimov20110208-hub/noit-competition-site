import type { Pool, PoolClient } from "pg";
import { EnvironmentError } from "../config/env.ts";
import { assertStagingIdentity } from "../staging/target.ts";

export interface ProductionDatabaseIdentity {
  readonly databaseId: string;
  readonly projectRef: string;
  // NODE_ENV remains production for both deployed environments.
  readonly environment?: "production" | "staging";
  readonly databaseHost?: string;
}

const productionProjectRef = "bdcjascqqvzmmlvabhgv";

export function validateRuntimeConnection(
  databaseUrl: string,
  expected: ProductionDatabaseIdentity,
) {
  const url = new URL(databaseUrl);
  if (
    !["budograph_runtime", `budograph_runtime.${expected.projectRef}`].includes(
      decodeURIComponent(url.username),
    ) ||
    !url.password ||
    url.port === "6543"
  )
    throw new EnvironmentError(
      "Production requires budograph_runtime credentials and a direct or session-mode database connection.",
    );
  if (expected.environment === "staging") {
    assertStagingIdentity(expected.projectRef, expected.databaseId);
    const direct = url.hostname === `db.${expected.projectRef}.supabase.co`;
    const session =
      /^aws-\d+-[a-z\d-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
      decodeURIComponent(url.username) ===
        `budograph_runtime.${expected.projectRef}`;
    if (
      expected.projectRef === productionProjectRef ||
      url.hostname !== expected.databaseHost ||
      (!direct && !session) ||
      (url.port !== "" && url.port !== "5432") ||
      url.pathname !== "/postgres" ||
      url.search ||
      url.hash
    )
      throw new EnvironmentError(
        "Staging requires its separately verified non-Production database host, project and direct/session target.",
      );
  }
}

export function readProductionDatabaseIdentity(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ProductionDatabaseIdentity {
  const environment = env.BUDOGRAPH_DEPLOYMENT_ENV ?? "production";
  if (environment !== "production" && environment !== "staging")
    throw new EnvironmentError(
      "BUDOGRAPH_DEPLOYMENT_ENV must be production or staging.",
    );
  if (
    !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(
      env.EXPECTED_DATABASE_ID ?? "",
    ) ||
    !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(env.EXPECTED_SUPABASE_PROJECT_REF ?? "")
  )
    throw new EnvironmentError(
      "Production requires valid EXPECTED_DATABASE_ID and EXPECTED_SUPABASE_PROJECT_REF.",
    );
  const databaseHost = env.EXPECTED_DATABASE_HOST;
  if (environment === "staging")
    assertStagingIdentity(
      env.EXPECTED_SUPABASE_PROJECT_REF!,
      env.EXPECTED_DATABASE_ID!.toLowerCase(),
    );
  if (
    environment === "staging" &&
    (env.NODE_ENV !== "production" ||
      !/^[a-z\d]{20}$/.test(env.EXPECTED_SUPABASE_PROJECT_REF!) ||
      env.EXPECTED_SUPABASE_PROJECT_REF === productionProjectRef ||
      !databaseHost ||
      databaseHost.includes(productionProjectRef) ||
      (databaseHost !== `db.${env.EXPECTED_SUPABASE_PROJECT_REF}.supabase.co` &&
        !/^aws-\d+-[a-z\d-]+\.pooler\.supabase\.com$/.test(databaseHost)))
  )
    throw new EnvironmentError(
      "Staging requires NODE_ENV=production, a separate EXPECTED_SUPABASE_PROJECT_REF and verified EXPECTED_DATABASE_HOST.",
    );
  return Object.freeze({
    databaseId: env.EXPECTED_DATABASE_ID!.toLowerCase(),
    projectRef: env.EXPECTED_SUPABASE_PROJECT_REF!,
    environment,
    ...(environment === "staging" ? { databaseHost } : {}),
  });
}

// Use this same checked-out connection: verification never acquires a second
// pool slot, and also runs when a warm pool reconnects to a changed target.
export async function verifyProductionDatabaseIdentity(
  client: Pick<PoolClient, "query">,
  expected: ProductionDatabaseIdentity,
): Promise<void> {
  try {
    if (expected.environment === "staging")
      assertStagingIdentity(expected.projectRef, expected.databaseId);
    const query = {
      text: `SELECT i.database_id::text, i.project_ref, i.environment,
        current_user AS runtime_role,
        NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
        AND r.rolcanlogin
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid)
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE relowner=r.oid)
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner=r.oid)
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE proowner=r.oid)
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datdba=r.oid)
        AND NOT has_database_privilege(r.oid,current_database(),'CREATE')
        -- R2 explicitly preserves inherited PUBLIC TEMP. Deny direct TEMP
        -- grants and any effective privilege beyond that approved baseline.
        AND has_database_privilege(r.oid,current_database(),'TEMPORARY') =
          EXISTS (SELECT 1 FROM pg_catalog.pg_database d,
            LATERAL pg_catalog.aclexplode(coalesce(d.datacl,pg_catalog.acldefault('d',d.datdba))) a
            WHERE d.datname=current_database() AND a.grantee=0 AND a.privilege_type='TEMPORARY')
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_database d,
          LATERAL pg_catalog.aclexplode(coalesce(d.datacl,pg_catalog.acldefault('d',d.datdba))) a
          WHERE d.datname=current_database() AND a.grantee=r.oid AND a.privilege_type='TEMPORARY')
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n WHERE has_schema_privilege(r.oid,n.oid,'CREATE'))
        AS safe_role
        FROM budograph_private.environment_identity i
        JOIN pg_catalog.pg_roles r ON r.rolname=current_user
        WHERE i.singleton`,
      query_timeout: 5000,
    };
    const result = await client.query(query);
    const row = result.rows[0];
    if (
      result.rows.length !== 1 ||
      row.database_id !== expected.databaseId ||
      row.project_ref !== expected.projectRef ||
      row.environment !== (expected.environment ?? "production") ||
      row.runtime_role !== "budograph_runtime" ||
      row.safe_role !== true
    )
      throw new Error("Identity mismatch");
  } catch {
    throw new EnvironmentError(
      "Production database identity verification failed.",
    );
  }
}

export function guardProductionDatabasePool(
  pool: Pool,
  expected: ProductionDatabaseIdentity,
): void {
  const connect = pool.connect.bind(pool);
  type Callback = (
    error: Error | undefined,
    client?: PoolClient,
    release?: (error?: Error | boolean) => void,
  ) => void;
  const checkedConnect = async () => {
    let client: PoolClient | undefined;
    let failed = false;
    const onError = () => {
      failed = true;
    };
    try {
      client = await connect();
      // pg-pool removes its idle listener during checkout. Cover this read-only
      // preflight before the business transaction installs its own listener.
      client.on("error", onError);
      await verifyProductionDatabaseIdentity(client, expected);
      if (failed) throw new Error("Connection failed");
      return client;
    } catch {
      client?.release(true);
      throw new EnvironmentError(
        "Production database identity verification failed.",
      );
    } finally {
      client?.removeListener("error", onError);
    }
  };
  pool.connect = ((callback?: Callback) => {
    const pending = checkedConnect();
    if (!callback) return pending;
    void pending.then(
      (client) => callback(undefined, client, client.release.bind(client)),
      () =>
        callback(
          new EnvironmentError(
            "Production database identity verification failed.",
          ),
        ),
    );
  }) as Pool["connect"];
}
