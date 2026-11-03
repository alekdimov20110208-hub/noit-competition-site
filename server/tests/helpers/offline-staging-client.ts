// In-memory TLS/socket metadata only. No handshake, listener, DNS or connection.
// authorized=true below is synthetic fixture data, never live TLS evidence.
import { EventEmitter } from "node:events";
import { Socket } from "node:net";
import { TLSSocket, checkServerIdentity, type PeerCertificate } from "node:tls";
import type { PoolClient } from "pg";
import { STAGING } from "../../src/staging/target.ts";

export function offlineStagingClient(
  mode: "direct" | "session_pooler" = "session_pooler",
) {
  const host =
    mode === "direct"
      ? STAGING.directHost
      : "aws-1-eu-central-1.pooler.supabase.com";
  const user =
    mode === "direct" ? "postgres" : `postgres.${STAGING.projectRef}`;
  const stream = new TLSSocket(new Socket());
  stream.authorized = true;
  Object.defineProperty(stream, "getProtocol", {
    value: () => "TLSv1.3",
    configurable: true,
  });
  Object.defineProperty(stream, "getPeerCertificate", {
    value: () =>
      ({
        subjectaltname: `DNS:${host}`,
        subject: { CN: host },
      }) as PeerCertificate,
    configurable: true,
  });
  const calls: string[] = [];
  const row: Record<string, unknown> = {
    database: "postgres",
    session_user: "postgres",
    current_user: "postgres",
    version: "170011",
    cluster: "offline",
    system_id: "1234567890",
    ssl: true,
    tls_protocol: "TLSv1.3",
    tls_cipher: "offline",
  };
  const db = Object.assign(new EventEmitter(), {
    host,
    user,
    database: "postgres",
    port: 5432,
    ssl: {
      ca: ["SYNTHETIC_PUBLIC_CA"],
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      checkServerIdentity,
    },
    connection: { stream },
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.includes("pg_control_system")) return { rows: [row] };
      if (sql.startsWith("BEGIN")) return { command: "BEGIN", rows: [] };
      if (sql === "ROLLBACK") return { command: "ROLLBACK", rows: [] };
      if (sql.includes("current_setting('search_path')"))
        return { rows: [{ path: "public" }] };
      if (sql.includes("SELECT to_regclass("))
        return { rows: [{ history: null }] };
      return { rows: [] };
    },
    release: () => {
      stream.destroy();
    },
  }) as unknown as PoolClient;
  const target = new URL(
    `postgresql://${user}:SYNTHETIC_ONLY@${host}:5432/postgres`,
  );
  return { db, stream, target, row, calls };
}
