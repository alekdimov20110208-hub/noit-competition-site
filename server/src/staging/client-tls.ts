import { TLSSocket, checkServerIdentity } from "node:tls";
import type { PoolClient } from "pg";
import { stagingOwnerTarget, STAGING } from "./target.ts";
import {
  StagingDiagnosticError,
  type StagingDiagnostics,
} from "./diagnostics.ts";

type Mode = "direct" | "session_pooler";
// Only a successful socket/config check can register a mode. No env flag or
// caller-supplied boolean can mark an unverified pooler connection as trusted.
const verified = new WeakMap<object, { mode: Mode; stream: TLSSocket }>();

export function verifyStagingClientTls(
  db: PoolClient,
  target: URL,
  diagnostics?: StagingDiagnostics,
) {
  verified.delete(db);
  try {
    stagingOwnerTarget(target.href, target.hostname);
    const mode =
      target.hostname === STAGING.directHost ? "direct" : "session_pooler";
    if (diagnostics) diagnostics.serverWitness.connectionMode = mode;
    const ssl = db.ssl as unknown as {
      rejectUnauthorized?: unknown;
      ca?: unknown;
      checkServerIdentity?: unknown;
      minVersion?: unknown;
    } | null;
    const stream = db.connection.stream;
    if (
      db.host !== target.hostname ||
      db.port !== 5432 ||
      db.database !== "postgres" ||
      db.user !== decodeURIComponent(target.username) ||
      !ssl ||
      ssl.rejectUnauthorized !== true ||
      !Array.isArray(ssl.ca) ||
      ssl.ca.length === 0 ||
      !ssl.ca.every((c) => typeof c === "string" && c.length > 0) ||
      ssl.checkServerIdentity !== checkServerIdentity ||
      ssl.minVersion !== "TLSv1.2" ||
      !(stream instanceof TLSSocket) ||
      stream.encrypted !== true ||
      stream.authorized !== true ||
      stream.authorizationError != null ||
      !["TLSv1.2", "TLSv1.3"].includes(stream.getProtocol() ?? "") ||
      checkServerIdentity(target.hostname, stream.getPeerCertificate()) !==
        undefined
    )
      throw new StagingDiagnosticError("TLS_FAILURE");
    verified.set(db, { mode, stream });
    if (diagnostics) {
      diagnostics.serverWitness.clientTls = "verified";
      diagnostics.serverWitness.checks.clientTls = "passed";
    }
  } catch {
    if (diagnostics) {
      diagnostics.serverWitness.clientTls = "failed";
      diagnostics.serverWitness.checks.clientTls = "failed";
    }
    throw new StagingDiagnosticError("TLS_FAILURE");
  }
}

export function verifiedStagingMode(db: object): Mode | "unknown" {
  const proof = verified.get(db);
  if (!proof) return "unknown";
  // Never fall back to the legacy path after a verified lease changes socket.
  const stream = (db as PoolClient).connection.stream;
  if (stream !== proof.stream || proof.stream.authorized !== true)
    throw new StagingDiagnosticError("TLS_FAILURE");
  return proof.mode;
}
