import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import {
  StagingDiagnosticError,
  recordFailure,
  safeErrorCode,
  safeSqlstate,
  type CatalogOperation,
  type StagingDiagnostics,
  type PredicateStatus,
} from "./diagnostics.ts";
import { verifiedStagingMode } from "./client-tls.ts";

export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export type SqlReader = Pick<PoolClient, "query">;

function catalogReader(db: SqlReader, diagnostics?: StagingDiagnostics) {
  return async (
    operation: CatalogOperation,
    sql: string,
    values?: unknown[],
  ) => {
    if (diagnostics) diagnostics.catalogOperation = operation;
    try {
      return await (values === undefined
        ? db.query(sql)
        : db.query(sql, values));
    } catch (error) {
      if (diagnostics) recordFailure(diagnostics, error, undefined, operation);
      throw error;
    }
  };
}

// Stable names/definitions, no OIDs, data, passwords or provider internals.
// Extension-owned objects in public belong to the provider snapshot instead.
export async function applicationCatalog(
  db: SqlReader,
  diagnostics?: StagingDiagnostics,
) {
  const query = catalogReader(db, diagnostics);
  if (diagnostics) {
    diagnostics.searchPathRestorationStatus = "not_attempted";
    diagnostics.searchPathRestorationErrorCode = "NONE";
    diagnostics.searchPathRestorationSqlstate = null;
  }
  const previous = (
    await query(
      "search_path_read",
      "SELECT current_setting('search_path') path",
    )
  ).rows[0].path;
  await query(
    "search_path_set",
    "SELECT set_config('search_path','pg_catalog',false)",
  );
  let operationFailed = false;
  try {
    const queries = {
      tables: `SELECT n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner,c.relacl::text acl
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public','budograph_private') AND c.relkind IN ('r','p','v','m','S','f')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e') ORDER BY 1,2`,
      columns: `SELECT n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,pg_get_expr(ad.adbin,ad.adrelid) default_value,a.attacl::text acl
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum
      WHERE n.nspname IN ('public','budograph_private') AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e') ORDER BY 1,2,a.attnum`,
      constraints: `SELECT n.nspname,c.relname,k.conname,k.convalidated,pg_get_constraintdef(k.oid) definition FROM pg_constraint k
      JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','budograph_private')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e') ORDER BY 1,2,3`,
      indexes: `SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes i WHERE schemaname IN ('public','budograph_private')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=format('%I.%I',i.schemaname,i.tablename)::regclass AND d.deptype='e') ORDER BY 1,2,3`,
      policies: `SELECT schemaname,tablename,policyname,permissive,roles::text,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','budograph_private') ORDER BY 1,2,3`,
      functions: `SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition,pg_get_userbyid(p.proowner) owner,p.proacl::text acl
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','budograph_private')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY 1,2,3`,
      triggers: `SELECT n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','budograph_private') AND NOT t.tgisinternal ORDER BY 1,2,3`,
      defaults: `SELECT pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'') schema,d.defaclobjtype,d.defaclacl::text acl
      FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE pg_get_userbyid(d.defaclrole)='budograph_migrator' ORDER BY 1,2,3`,
    };
    const result: Record<string, unknown[]> = {};
    // One session and deterministic order; never pool queries in parallel.
    const operations = {
      tables: "application_tables",
      columns: "application_columns",
      constraints: "application_constraints",
      indexes: "application_indexes",
      policies: "application_policies",
      functions: "application_functions",
      triggers: "application_triggers",
      defaults: "application_defaults",
    } as const;
    for (const key of Object.keys(queries) as (keyof typeof queries)[])
      result[key] = (await query(operations[key], queries[key])).rows;
    return result;
  } catch (error) {
    operationFailed = true;
    if (diagnostics)
      recordFailure(
        diagnostics,
        error,
        undefined,
        diagnostics.catalogOperation ?? undefined,
      );
    throw error;
  } finally {
    if (diagnostics) diagnostics.searchPathRestorationStatus = "unknown";
    try {
      await query(
        "search_path_restore",
        "SELECT set_config('search_path',$1,false)",
        [previous],
      );
      if (diagnostics) diagnostics.searchPathRestorationStatus = "confirmed";
    } catch (error) {
      if (diagnostics) {
        diagnostics.searchPathRestorationStatus = "failed";
        diagnostics.searchPathRestorationErrorCode = safeErrorCode(error);
        diagnostics.searchPathRestorationSqlstate = safeSqlstate(error);
      }
      if (!operationFailed) throw error;
    }
  }
}

export async function initialSnapshot(
  db: SqlReader,
  diagnostics?: StagingDiagnostics,
) {
  const query = catalogReader(db, diagnostics);
  const app = await applicationCatalog(db, diagnostics);
  if (diagnostics) diagnostics.catalogOperation = "application_empty_check";
  if (Object.values(app).some((rows) => rows.length))
    throw new StagingDiagnosticError(
      "CATALOG_VERIFICATION_FAILED",
      "Initial application catalog is not empty; STOP.",
    );
  const roles = (
    await query(
      "budograph_roles",
      "SELECT rolname FROM pg_roles WHERE rolname LIKE 'budograph%'",
    )
  ).rows;
  if (roles.length)
    throw new StagingDiagnosticError(
      "CATALOG_VERIFICATION_FAILED",
      "Existing BudoGraph roles; STOP.",
    );
  const types = (
    await query(
      "public_types",
      `SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typtype IN ('e','d','c','r','m')
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')
    AND NOT EXISTS(SELECT 1 FROM pg_type base JOIN pg_depend d ON d.objid=base.oid AND d.classid='pg_type'::regclass AND d.deptype='e' WHERE base.typarray=t.oid)
    AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_depend d ON d.objid=c.oid AND d.classid='pg_class'::regclass AND d.deptype='e' WHERE c.oid=t.typrelid)`,
    )
  ).rows;
  if (types.length)
    throw new StagingDiagnosticError(
      "CATALOG_VERIFICATION_FAILED",
      "Unknown public type; STOP.",
    );
  const schemas = (
    await query(
      "schemas",
      "SELECT nspname,pg_get_userbyid(nspowner) owner,nspacl::text acl FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema' ORDER BY 1",
    )
  ).rows;
  const known = new Set([
    "public",
    "auth",
    "extensions",
    "graphql",
    "graphql_public",
    "net",
    "pgbouncer",
    "realtime",
    "storage",
    "supabase_functions",
    "supabase_migrations",
    "vault",
    "pgsodium",
    "pgsodium_masks",
    "_realtime",
    "_analytics",
  ]);
  if (schemas.some((r) => !known.has(r.nspname)))
    throw new StagingDiagnosticError(
      "CATALOG_VERIFICATION_FAILED",
      "Unknown provider/application schema; STOP.",
    );
  const history = (
    await query(
      "migration_history_relation",
      "SELECT to_regclass('supabase_migrations.schema_migrations')::text history",
    )
  ).rows[0];
  if (history.history) {
    if (
      (
        await query(
          "migration_history_count",
          "SELECT count(*)::int n FROM supabase_migrations.schema_migrations",
        )
      ).rows[0].n !== 0
    )
      throw new StagingDiagnosticError(
        "CATALOG_VERIFICATION_FAILED",
        "Unexpected Supabase migration metadata; STOP.",
      );
  }
  const extensions = (
    await query(
      "extensions",
      "SELECT extname,extversion,nspname FROM pg_extension JOIN pg_namespace ON pg_namespace.oid=extnamespace ORDER BY 1",
    )
  ).rows;
  const providerRelations = (
    await query(
      "provider_relations",
      `SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) owner,c.relacl::text acl,c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' ORDER BY 1,2`,
    )
  ).rows;
  const providerFunctions = (
    await query(
      "provider_functions",
      `SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosrc,p.proacl::text acl,p.prosecdef,p.proconfig,p.prokind,format_type(p.prorettype,NULL) return_type
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' ORDER BY 1,2,3`,
    )
  ).rows;
  const memberships = (
    await query(
      "role_memberships",
      `SELECT pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY 1,2`,
    )
  ).rows;
  const providerColumns = (
    await query(
      "provider_columns",
      `SELECT n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,a.attacl::text acl,pg_get_expr(d.adbin,d.adrelid) default_value
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,a.attnum`,
    )
  ).rows;
  const providerConstraints = (
    await query(
      "provider_constraints",
      `SELECT n.nspname,k.conname,k.conrelid::regclass::text relation,pg_get_constraintdef(k.oid) definition,k.convalidated
    FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' ORDER BY 1,2,3`,
    )
  ).rows;
  const providerPolicies = (
    await query(
      "provider_policies",
      "SELECT schemaname,tablename,policyname,roles::text,cmd,qual,with_check FROM pg_policies WHERE schemaname !~ '^pg_' ORDER BY 1,2,3",
    )
  ).rows;
  const providerRoles = (
    await query(
      "provider_roles",
      "SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolcanlogin,rolinherit,rolconnlimit,rolconfig FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY 1",
    )
  ).rows;
  const databaseAcl = (
    await query(
      "database_acl",
      "SELECT datname,pg_get_userbyid(datdba) owner,datacl::text acl FROM pg_database WHERE datname=current_database()",
    )
  ).rows;
  return {
    schemas,
    extensions,
    providerRelations,
    providerFunctions,
    providerColumns,
    providerConstraints,
    providerPolicies,
    providerRoles,
    databaseAcl,
    memberships,
    history,
  };
}

export async function serverWitness(
  db: SqlReader,
  diagnostics?: StagingDiagnostics,
) {
  const query = catalogReader(db, diagnostics);
  let mode: ReturnType<typeof verifiedStagingMode>;
  try {
    mode = verifiedStagingMode(db);
  } catch (error) {
    if (diagnostics) {
      diagnostics.serverWitness.clientTls = "failed";
      diagnostics.serverWitness.checks.clientTls = "failed";
    }
    throw error;
  }
  if (diagnostics) {
    diagnostics.serverWitness.connectionMode = mode;
    if (mode !== "unknown") {
      diagnostics.serverWitness.clientTls = "verified";
      diagnostics.serverWitness.checks.clientTls = "passed";
    }
  }
  const row = (
    await query(
      "server_witness",
      `SELECT current_database() database,session_user,current_user,current_setting('server_version_num') version,
    current_setting('cluster_name') cluster,(pg_control_system()).system_identifier::text system_id,
    (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) ssl,
    (SELECT version FROM pg_stat_ssl WHERE pid=pg_backend_pid()) tls_protocol,
    (SELECT cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()) tls_cipher`,
    )
  ).rows[0];
  const check = (
    value: unknown,
    predicate: (v: string) => boolean,
  ): PredicateStatus =>
    typeof value === "string"
      ? predicate(value)
        ? "passed"
        : "failed"
      : "unknown";
  const checks = {
    database: check(row?.database, (v) => v === "postgres"),
    sessionUser: check(row?.session_user, (v) => v === "postgres"),
    currentUser: check(row?.current_user, (v) => v === "postgres"),
    postgresVersion: check(row?.version, (v) => /^17\d{4}$/.test(v)),
    systemIdentifier: check(row?.system_id, (v) => /^\d+$/.test(v)),
    // pg_stat_ssl describes the backend leg. Only a socket-verified Session
    // Pooler may report a plaintext upstream leg without mislabelling client TLS.
    // Direct and unregistered/local legacy callers retain the ssl=true gate.
    backendTlsPolicy: (typeof row?.ssl !== "boolean"
      ? "unknown"
      : mode === "session_pooler" || row.ssl === true
        ? "passed"
        : "failed") as PredicateStatus,
  };
  if (diagnostics) {
    diagnostics.serverWitness.connectionMode = mode;
    diagnostics.serverWitness.backendTls =
      row?.ssl === true
        ? "encrypted"
        : row?.ssl === false
          ? "not_encrypted"
          : "unknown";
    Object.assign(diagnostics.serverWitness.checks, checks);
  }
  if (Object.values(checks).some((value) => value !== "passed"))
    throw new StagingDiagnosticError(
      "SERVER_IDENTITY_MISMATCH",
      "PostgreSQL 17/TLS/server identity mismatch; STOP.",
    );
  return row;
}
