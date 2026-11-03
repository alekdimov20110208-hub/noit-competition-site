// Diagnostics contain closed vocabularies and observed facts, never Error text.
export const phases = [
  "arguments",
  "approval",
  "environment",
  "identity",
  "target",
  "ca_pin",
  "report_open",
  "pool_create",
  "connect",
  "client_tls",
  "package_verification",
  "transaction_begin",
  "server_witness",
  "catalog",
  "rollback",
  "operation",
  "snapshot_fingerprint",
  "activation_lock",
  "bootstrap",
  "bootstrap_runtime_role",
  "bootstrap_runtime_permissions",
  "migrations",
  "original_verification",
  "identity_overlay",
  "staging_verification",
  "runtime_password",
  "activation_cleanup",
  "connection_close",
  "report_write",
  "complete",
] as const;
export const errorCodes = [
  "NONE",
  "UNKNOWN",
  "PREFLIGHT_REFUSED",
  "TARGET_REFUSED",
  "CA_PIN_REFUSED",
  "PACKAGE_VERIFICATION_FAILED",
  "TLS_FAILURE",
  "AUTHENTICATION_FAILED",
  "CONNECTION_FAILED",
  "DATABASE_PERMISSION_DENIED",
  "SERVER_IDENTITY_MISMATCH",
  "CATALOG_VERIFICATION_FAILED",
  "ROLLBACK_FAILED",
  "CONNECTION_CLOSE_FAILED",
  "CONNECTION_CLOSE_UNCONFIRMED",
  "REPORT_IO_FAILED",
] as const;
export type DiagnosticPhase = (typeof phases)[number];
export type SafeErrorCode = (typeof errorCodes)[number];
export type Acknowledgement = "confirmed" | "failed" | "unknown";
export type PredicateStatus = "passed" | "failed" | "unknown";

// Fixed source identifiers, never SQL text or caller-supplied labels.
export const catalogOperations = [
  "server_witness",
  "search_path_read",
  "search_path_set",
  "application_tables",
  "application_columns",
  "application_constraints",
  "application_indexes",
  "application_policies",
  "application_functions",
  "application_triggers",
  "application_defaults",
  "search_path_restore",
  "application_empty_check",
  "budograph_roles",
  "public_types",
  "schemas",
  "migration_history_relation",
  "migration_history_count",
  "extensions",
  "provider_relations",
  "provider_functions",
  "role_memberships",
  "provider_columns",
  "provider_constraints",
  "provider_policies",
  "provider_roles",
  "database_acl",
] as const;
export type CatalogOperation = (typeof catalogOperations)[number];

export class StagingDiagnosticError extends Error {
  readonly safeCode: SafeErrorCode;
  constructor(
    code: SafeErrorCode,
    fixedMessage = "Staging operation refused.",
  ) {
    super(fixedMessage);
    this.safeCode = code;
  }
}

const tlsCodes = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_SSL_WRONG_VERSION_NUMBER",
  "ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION",
]);
const connectionCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
]);
export function safeErrorCode(error: unknown): SafeErrorCode {
  if (error instanceof StagingDiagnosticError) return error.safeCode;
  // No message/stack/cause access, substring matching, or arbitrary code output.
  let code: unknown;
  try {
    code = (error as { code?: unknown } | null)?.code;
  } catch {
    return "UNKNOWN";
  }
  if (typeof code !== "string") return "UNKNOWN";
  if (tlsCodes.has(code)) return "TLS_FAILURE";
  if (code === "28P01" || code === "28000") return "AUTHENTICATION_FAILED";
  if (connectionCodes.has(code)) return "CONNECTION_FAILED";
  if (code === "42501") return "DATABASE_PERMISSION_DENIED";
  return "UNKNOWN";
}

type ConnectionReason =
  | "dns"
  | "network_unreachable"
  | "refused"
  | "reset"
  | "timeout"
  | "tls"
  | "authentication"
  | "permission"
  | "protocol"
  | "unclassified";
export interface ConnectionFailure {
  errorCode: SafeErrorCode;
  reason: ConnectionReason;
  classification: "driver_code" | "exact_driver_timeout" | "unclassified";
}

// Used only at the pool.connect rejection boundary. Never return an Error field.
// Own data properties avoid invoking hostile message/code getters. No stack,
// cause, server detail, URL, password or arbitrary driver code is inspected/copied.
function ownString(error: unknown, key: "code" | "message" | "severity") {
  try {
    if (typeof error !== "object" || error === null) return undefined;
    const field = Object.getOwnPropertyDescriptor(error, key);
    return typeof field?.value === "string" ? field.value : undefined;
  } catch {
    return undefined;
  }
}

const sqlstateClasses = new Set(
  "00 01 02 03 08 09 0A 0B 0F 0L 0P 0Z 20 21 22 23 24 25 26 27 28 2B 2D 2F 34 38 39 3B 3D 3F 40 42 44 53 54 55 57 58 72 F0 HV P0 XX".split(
    " ",
  ),
);
export function safeSqlstate(error: unknown): string | null {
  const code = ownString(error, "code");
  if (!code || code.length !== 5 || !/^[0-9A-Z]{5}$/.test(code)) return null;
  // Do not mislabel five-character Node codes such as EPIPE as SQLSTATE.
  // A PostgreSQL severity also permits a custom server-defined SQLSTATE class.
  return sqlstateClasses.has(code.slice(0, 2)) ||
    ["ERROR", "FATAL", "PANIC", "WARNING"].includes(
      ownString(error, "severity") ?? "",
    )
    ? code
    : null;
}

export function classifyConnectionFailure(error: unknown): ConnectionFailure {
  const code = ownString(error, "code");
  const reasons: Readonly<Record<string, ConnectionReason>> = {
    ENOTFOUND: "dns",
    EAI_AGAIN: "dns",
    EHOSTUNREACH: "network_unreachable",
    ENETUNREACH: "network_unreachable",
    ECONNREFUSED: "refused",
    ECONNRESET: "reset",
    ECONNABORTED: "reset",
    EPIPE: "reset",
    ETIMEDOUT: "timeout",
  };
  if (code && Object.hasOwn(reasons, code))
    return {
      errorCode: "CONNECTION_FAILED",
      reason: reasons[code]!,
      classification: "driver_code",
    };
  if (code && tlsCodes.has(code))
    return {
      errorCode: "TLS_FAILURE",
      reason: "tls",
      classification: "driver_code",
    };
  if (code === "28P01" || code === "28000")
    return {
      errorCode: "AUTHENTICATION_FAILED",
      reason: "authentication",
      classification: "driver_code",
    };
  if (code === "42501")
    return {
      errorCode: "DATABASE_PERMISSION_DENIED",
      reason: "permission",
      classification: "driver_code",
    };
  if (code && connectionCodes.has(code))
    return {
      errorCode: "CONNECTION_FAILED",
      reason: "protocol",
      classification: "driver_code",
    };
  // pg 8.23.1 / pg-pool 3.14.0 emit these complete, code-less literals.
  // Exact equality only, never substring/regex matching on untrusted error text.
  if (
    code === undefined &&
    new Set([
      "Connection terminated due to connection timeout",
      "timeout exceeded when trying to connect",
      "timeout expired",
    ]).has(ownString(error, "message") ?? "")
  )
    return {
      errorCode: "CONNECTION_FAILED",
      reason: "timeout",
      classification: "exact_driver_timeout",
    };
  return {
    errorCode: "UNKNOWN",
    reason: "unclassified",
    classification: "unclassified",
  };
}

export function createDiagnostics(inspect: boolean) {
  return {
    schemaVersion: 1 as const,
    status: "FAILED_OR_UNKNOWN" as "PASS" | "STOP" | "FAILED_OR_UNKNOWN",
    phase: "arguments" as DiagnosticPhase,
    failurePhase: null as DiagnosticPhase | null,
    errorCode: "NONE" as SafeErrorCode,
    sqlstate: null as string | null,
    catalogOperation: null as CatalogOperation | null,
    failureOperation: null as CatalogOperation | null,
    searchPathRestorationStatus: "not_attempted" as
      Acknowledgement | "not_attempted",
    searchPathRestorationErrorCode: "NONE" as SafeErrorCode,
    searchPathRestorationSqlstate: null as string | null,
    rollbackStatus: (inspect ? "not_attempted" : "unknown") as
      Acknowledgement | "not_attempted",
    rollbackErrorCode: "NONE" as SafeErrorCode,
    rollbackSqlstate: null as string | null,
    activationCleanup: {
      resetRole: {
        status: "not_attempted" as Acknowledgement | "not_attempted",
        errorCode: "NONE" as SafeErrorCode,
        sqlstate: null as string | null,
      },
      advisoryUnlock: {
        status: "not_attempted" as Acknowledgement | "not_attempted",
        errorCode: "NONE" as SafeErrorCode,
        sqlstate: null as string | null,
      },
    },
    connectionCloseStatus: "unknown" as Acknowledgement,
    connectionCloseErrorCode: "NONE" as SafeErrorCode,
    connectionEstablished: false as boolean | "unknown",
    connectionFailure: null as ConnectionFailure | null,
    serverWitness: {
      connectionMode: "unknown" as "direct" | "session_pooler" | "unknown",
      clientTls: "unknown" as "verified" | "failed" | "unknown",
      backendTls: "unknown" as "encrypted" | "not_encrypted" | "unknown",
      checks: {
        clientTls: "unknown" as PredicateStatus,
        database: "unknown" as PredicateStatus,
        sessionUser: "unknown" as PredicateStatus,
        currentUser: "unknown" as PredicateStatus,
        postgresVersion: "unknown" as PredicateStatus,
        systemIdentifier: "unknown" as PredicateStatus,
        backendTlsPolicy: "unknown" as PredicateStatus,
      },
    },
    observations: {
      transactionStarted: false as boolean | "unknown",
      serverWitnessVerified: false,
      initialCatalogVerified: false,
      clientEndObserved: false,
      poolEndResolved: false,
    },
  };
}
export type StagingDiagnostics = ReturnType<typeof createDiagnostics>;
export function recordFailure(
  diagnostics: StagingDiagnostics,
  error: unknown,
  forcedCode?: SafeErrorCode,
  operation?: CatalogOperation,
) {
  if (diagnostics.failurePhase !== null) return;
  diagnostics.failurePhase = diagnostics.phase;
  diagnostics.errorCode = forcedCode ?? safeErrorCode(error);
  diagnostics.sqlstate = safeSqlstate(error);
  diagnostics.failureOperation = operation ?? null;
  diagnostics.status =
    diagnostics.errorCode === "UNKNOWN" ? "FAILED_OR_UNKNOWN" : "STOP";
}
