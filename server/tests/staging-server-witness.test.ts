import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import pg from "pg";
import { readFileSync } from "node:fs";
import { serverWitness } from "../src/staging/catalog.ts";
import {
  verifyStagingClientTls,
  verifiedStagingMode,
} from "../src/staging/client-tls.ts";
import {
  createDiagnostics,
  safeErrorCode,
} from "../src/staging/diagnostics.ts";
import { inspectStaging } from "../src/staging/activation.ts";
import { offlineStagingClient } from "./helpers/offline-staging-client.ts";

const original = {
  connect: net.Socket.prototype.connect,
  tls: tls.connect,
  dns: dns.lookup,
  fetch: globalThis.fetch,
};
before(() => {
  const blocked = () => {
    throw new Error("NETWORK_FORBIDDEN");
  };
  net.Socket.prototype.connect = blocked as typeof net.Socket.prototype.connect;
  tls.connect = blocked as typeof tls.connect;
  dns.lookup = blocked as unknown as typeof dns.lookup;
  globalThis.fetch = blocked;
});
after(() => {
  net.Socket.prototype.connect = original.connect;
  tls.connect = original.tls;
  dns.lookup = original.dns;
  globalThis.fetch = original.fetch;
});

for (const mode of ["session_pooler", "direct"] as const) {
  test(`${mode}: real installed pg metadata is compatible (unconnected client, synthetic TLS stream)`, () => {
    const f = offlineStagingClient(mode),
      d = createDiagnostics(true);
    try {
      const client = new pg.Client({
        connectionString: f.target.href,
        ssl: f.db.ssl as unknown as tls.ConnectionOptions,
      });
      Object.defineProperty(client.connection, "stream", { value: f.stream });
      verifyStagingClientTls(client as pg.PoolClient, f.target, d);
      assert.equal(verifiedStagingMode(client), mode);
      assert.equal(d.serverWitness.clientTls, "verified");
    } finally {
      f.stream.destroy();
    }
  });
}

for (const mode of ["session_pooler", "direct"] as const) {
  test(`${mode}: authorized TLS and matching PostgreSQL witness`, async () => {
    const f = offlineStagingClient(mode),
      d = createDiagnostics(true);
    try {
      verifyStagingClientTls(f.db, f.target, d);
      await serverWitness(f.db, d);
      assert.equal(d.serverWitness.connectionMode, mode);
      assert.equal(d.serverWitness.clientTls, "verified");
      assert.ok(
        Object.values(d.serverWitness.checks).every((v) => v === "passed"),
      );
    } finally {
      f.stream.destroy();
    }
  });
}
test("Session Pooler: pg_stat_ssl=false is recorded as upstream plaintext, not failed client TLS", async () => {
  const f = offlineStagingClient(),
    d = createDiagnostics(true);
  try {
    Object.assign(f.row, { ssl: false, tls_protocol: null, tls_cipher: null });
    verifyStagingClientTls(f.db, f.target, d);
    await serverWitness(f.db, d);
    assert.equal(d.serverWitness.backendTls, "not_encrypted");
    assert.equal(d.serverWitness.clientTls, "verified");
    assert.equal(d.serverWitness.checks.backendTlsPolicy, "passed");
    assert.equal(f.calls.length, 1);
  } finally {
    f.stream.destroy();
  }
});
test("Direct: pg_stat_ssl=false remains a hard rejection", async () => {
  const f = offlineStagingClient("direct"),
    d = createDiagnostics(true);
  try {
    f.row.ssl = false;
    verifyStagingClientTls(f.db, f.target, d);
    await assert.rejects(
      serverWitness(f.db, d),
      (e) => safeErrorCode(e) === "SERVER_IDENTITY_MISMATCH",
    );
    assert.equal(d.serverWitness.checks.backendTlsPolicy, "failed");
  } finally {
    f.stream.destroy();
  }
});
test("No registered socket proof cannot authorize a plaintext pooler backend", async () => {
  const f = offlineStagingClient(),
    d = createDiagnostics(true);
  try {
    f.row.ssl = false;
    await assert.rejects(serverWitness(f.db, d));
    assert.equal(d.serverWitness.connectionMode, "unknown");
  } finally {
    f.stream.destroy();
  }
});
for (const [field, key, value] of [
  ["database", "database", "wrong"],
  ["session_user", "sessionUser", "supabase_admin"],
  ["current_user", "currentUser", "other_role"],
  ["version", "postgresVersion", "180001"],
  ["system_id", "systemIdentifier", "SYNTHETIC_SECRET"],
] as const) {
  test(`Pooler retains ${key} guard and reports only predicate status`, async () => {
    const f = offlineStagingClient(),
      d = createDiagnostics(true);
    try {
      f.row[field] = value;
      f.row.ssl = false;
      verifyStagingClientTls(f.db, f.target, d);
      await assert.rejects(
        serverWitness(f.db, d),
        (e) => safeErrorCode(e) === "SERVER_IDENTITY_MISMATCH",
      );
      assert.equal(d.serverWitness.checks[key], "failed");
      assert.doesNotMatch(
        JSON.stringify(d),
        /wrong|supabase_admin|other_role|180001|SYNTHETIC_SECRET|postgresql:\/\//,
      );
    } finally {
      f.stream.destroy();
    }
  });
}
for (const ssl of [null, undefined, "true", 1]) {
  test(`Pooler rejects missing or malformed backend SSL evidence (${String(ssl)})`, async () => {
    const f = offlineStagingClient(),
      d = createDiagnostics(true);
    try {
      f.row.ssl = ssl;
      verifyStagingClientTls(f.db, f.target, d);
      await assert.rejects(serverWitness(f.db, d));
      assert.equal(d.serverWitness.checks.backendTlsPolicy, "unknown");
    } finally {
      f.stream.destroy();
    }
  });
}
for (const mode of ["session_pooler", "direct"] as const) {
  for (const failure of [
    "unauthorized",
    "wrong-host",
    "missing-ca",
    "insecure-options",
    "old-protocol",
    "hostname-bypass",
  ] as const) {
    test(`${mode}: ${failure} TLS proof fails before SQL`, () => {
      const f = offlineStagingClient(mode),
        d = createDiagnostics(true);
      try {
        const options = f.db.ssl as unknown as Record<string, unknown>;
        if (failure === "unauthorized") f.stream.authorized = false;
        if (failure === "wrong-host")
          Object.defineProperty(f.stream, "getPeerCertificate", {
            value: () => ({ subjectaltname: "DNS:wrong.invalid" }),
          });
        if (failure === "missing-ca") options.ca = [];
        if (failure === "insecure-options") options.rejectUnauthorized = false;
        if (failure === "old-protocol")
          Object.defineProperty(f.stream, "getProtocol", {
            value: () => "TLSv1",
          });
        if (failure === "hostname-bypass")
          options.checkServerIdentity = () => undefined;
        assert.throws(
          () => verifyStagingClientTls(f.db, f.target, d),
          (e) => safeErrorCode(e) === "TLS_FAILURE",
        );
        assert.equal(d.serverWitness.clientTls, "failed");
        assert.equal(f.calls.length, 0);
        assert.equal(verifiedStagingMode(f.db), "unknown");
      } finally {
        f.stream.destroy();
      }
    });
  }
}
test("A registered lease cannot change socket or lose authorization", async () => {
  const f = offlineStagingClient(),
    d = createDiagnostics(true);
  try {
    verifyStagingClientTls(f.db, f.target, d);
    f.stream.authorized = false;
    await assert.rejects(
      serverWitness(f.db, d),
      (e) => safeErrorCode(e) === "TLS_FAILURE",
    );
    assert.equal(d.serverWitness.clientTls, "failed");
    assert.equal(f.calls.length, 0);
  } finally {
    f.stream.destroy();
  }
});
test("Missing witness values are UNKNOWN and every predicate is independently evaluated", async () => {
  const f = offlineStagingClient(),
    d = createDiagnostics(true);
  try {
    Object.assign(f.row, {
      database: null,
      session_user: "wrong",
      current_user: null,
      version: null,
      system_id: null,
    });
    verifyStagingClientTls(f.db, f.target, d);
    await assert.rejects(serverWitness(f.db, d));
    assert.equal(d.serverWitness.checks.database, "unknown");
    assert.equal(d.serverWitness.checks.sessionUser, "failed");
    assert.equal(d.serverWitness.checks.currentUser, "unknown");
    assert.equal(d.serverWitness.checks.postgresVersion, "unknown");
    assert.equal(d.serverWitness.checks.systemIdentifier, "unknown");
  } finally {
    f.stream.destroy();
  }
});
test("Pooler simulation runs the real inspect core, confirms ROLLBACK and does no writes", async () => {
  const f = offlineStagingClient(),
    d = createDiagnostics(true);
  try {
    f.row.ssl = false;
    verifyStagingClientTls(f.db, f.target, d);
    const result = await inspectStaging(f.db, d);
    assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(d.rollbackStatus, "confirmed");
    assert.equal(d.observations.serverWitnessVerified, true);
    assert.equal(d.observations.initialCatalogVerified, true);
    assert.equal(f.calls.at(-1), "ROLLBACK");
    assert.equal(f.calls.filter((q) => q.startsWith("BEGIN")).length, 1);
    assert.ok(f.calls.every((q) => /^(SELECT|BEGIN|ROLLBACK)/.test(q)));
  } finally {
    f.stream.destroy();
  }
});
test("Witness mismatch confirms rollback and never reaches catalog", async () => {
  const f = offlineStagingClient(),
    d = createDiagnostics(true);
  try {
    f.row.current_user = "wrong";
    verifyStagingClientTls(f.db, f.target, d);
    await assert.rejects(inspectStaging(f.db, d));
    assert.equal(d.errorCode, "SERVER_IDENTITY_MISMATCH");
    assert.equal(d.failurePhase, "server_witness");
    assert.equal(d.rollbackStatus, "confirmed");
    assert.equal(d.observations.initialCatalogVerified, false);
    assert.equal(f.calls.length, 3);
  } finally {
    f.stream.destroy();
  }
});
test("Permission errors do not invent a failed identity predicate or log driver details", async () => {
  const f = offlineStagingClient(),
    d = createDiagnostics(true);
  const originalQuery = f.db.query.bind(f.db);
  f.db.query = (async (sql: string) => {
    if (sql.includes("pg_control_system"))
      throw Object.assign(new Error("SYNTHETIC_SECRET"), { code: "42501" });
    return originalQuery(sql);
  }) as typeof f.db.query;
  try {
    verifyStagingClientTls(f.db, f.target, d);
    await assert.rejects(inspectStaging(f.db, d));
    assert.equal(d.errorCode, "DATABASE_PERMISSION_DENIED");
    assert.equal(d.serverWitness.checks.database, "unknown");
    assert.doesNotMatch(JSON.stringify(d), /SYNTHETIC_SECRET/);
    assert.equal(d.rollbackStatus, "confirmed");
  } finally {
    f.stream.destroy();
  }
});
test("CLI retains CA pinning and registers verified transport before dispatch (static only)", () => {
  const source = readFileSync("server/scripts/staging-database.ts", "utf8");
  assert.ok(
    source.indexOf("update(await readFile(caFile))") <
      source.indexOf("pool = createDatabasePool"),
  );
  assert.ok(
    source.indexOf("verifyStagingClientTls(db, target, diagnostics)") <
      source.indexOf("? await inspectStaging(db, diagnostics)"),
  );
  assert.match(source, /mode: "verify-full"/);
  assert.match(source, /await open\(output, "wx"\)/);
});

test("Production ref and a mismatching pooler username cannot register TLS proof", () => {
  for (const value of [
    "postgresql://postgres.bdcjascqqvzmmlvabhgv:SYNTHETIC_ONLY@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
    "postgresql://other:SYNTHETIC_ONLY@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
  ]) {
    const f = offlineStagingClient();
    try {
      assert.throws(() => verifyStagingClientTls(f.db, new URL(value)));
      assert.equal(f.calls.length, 0);
      assert.equal(verifiedStagingMode(f.db), "unknown");
    } finally {
      f.stream.destroy();
    }
  }
});
test("A caller-supplied boolean cannot authorize the pooler backend exception", async () => {
  const f = offlineStagingClient();
  try {
    Object.assign(f.db, {
      clientTlsVerified: true,
      connectionMode: "session_pooler",
    });
    f.row.ssl = false;
    await assert.rejects(serverWitness(f.db));
  } finally {
    f.stream.destroy();
  }
});
test("A swapped socket is rejected even if the replacement claims authorization", async () => {
  const f = offlineStagingClient(),
    other = offlineStagingClient(),
    d = createDiagnostics(true);
  try {
    verifyStagingClientTls(f.db, f.target, d);
    Object.defineProperty(f.db.connection, "stream", { value: other.stream });
    await assert.rejects(
      serverWitness(f.db, d),
      (e) => safeErrorCode(e) === "TLS_FAILURE",
    );
    assert.equal(d.serverWitness.clientTls, "failed");
    assert.equal(f.calls.length, 0);
  } finally {
    f.stream.destroy();
    other.stream.destroy();
  }
});
test("Hostile certificate errors are reduced to TLS_FAILURE without leaking details", () => {
  const f = offlineStagingClient(),
    d = createDiagnostics(true);
  try {
    Object.defineProperty(f.stream, "getPeerCertificate", {
      value: () => {
        throw Error("SYNTHETIC_SECRET");
      },
    });
    assert.throws(
      () => verifyStagingClientTls(f.db, f.target, d),
      (e) => safeErrorCode(e) === "TLS_FAILURE",
    );
    assert.doesNotMatch(JSON.stringify(d), /SYNTHETIC_SECRET|postgresql:\/\//);
  } finally {
    f.stream.destroy();
  }
});
