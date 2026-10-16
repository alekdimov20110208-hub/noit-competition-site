import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import {
  checkServerIdentity,
  rootCertificates,
  type ConnectionOptions,
} from "node:tls";
import { after, test } from "node:test";
import pg from "pg";
import {
  EnvironmentError,
  readDatabaseEnv,
  type DatabaseConfig,
} from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";

// Public certificates already shipped with Node, not downloaded test assets.
// No database connections, certificate private keys, or application sessions.
const now = Date.now();
const validRoots = rootCertificates.filter((pem) => {
  const cert = new X509Certificate(pem);
  return (
    cert.ca &&
    Date.parse(cert.validFrom) < now &&
    now < Date.parse(cert.validTo)
  );
});
assert.ok(validRoots.length >= 2);
const directory = mkdtempSync(join(tmpdir(), "budograph-db-tls-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const caFile = join(directory, "trusted-ca.pem");
writeFileSync(caFile, validRoots[0]!);
const remoteUrl =
  "postgresql://SYNTHETIC_USER:SYNTHETIC_SECRET@database.invalid/SYNTHETIC_DATABASE";
const remote = (fields: Record<string, string | undefined> = {}) =>
  readDatabaseEnv({
    DATABASE_URL: remoteUrl,
    DATABASE_TLS_CA_FILE: caFile,
    ...fields,
  });

function options(pool: pg.Pool): pg.PoolConfig {
  // Inspect the real pg Pool's options without connecting; pg's public types
  // omit this runtime field. Subsequent Client construction checks its parser.
  return (pool as unknown as { options: pg.PoolConfig }).options;
}
function ssl(pool: pg.Pool): ConnectionOptions {
  const value = options(pool).ssl;
  assert.ok(value && typeof value === "object");
  return value;
}
function clientSsl(client: pg.Client): unknown {
  // @types/pg describes Client.ssl as boolean, but pg 8.23.1 retains the
  // supplied ConnectionOptions object here. Keep that discrepancy test-local.
  return (client as unknown as { ssl: unknown }).ssl;
}
function safeFailure(run: () => unknown, expected?: RegExp) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof EnvironmentError);
    assert.doesNotMatch(
      error.message,
      /SYNTHETIC_SECRET|SYNTHETIC_USER|SYNTHETIC_CERTIFICATE|postgresql:\/\/|BEGIN CERTIFICATE/,
    );
    assert.equal(error.message.includes(directory), false);
    assert.equal(error.cause, undefined);
    if (expected) assert.match(error.message, expected);
    return true;
  });
}

test("remote defaults to verified TLS and freezes its typed transport configuration", () => {
  for (const NODE_ENV of ["development", "test", "production"]) {
    const config = remote({ NODE_ENV });
    assert.deepEqual(config.databaseTls, { mode: "verify-full", caFile });
    assert.ok(Object.isFrozen(config.databaseTls));
  }
});

test("non-production loopback keeps explicit plaintext compatibility, including IPv6", async () => {
  for (const NODE_ENV of ["development", "test"]) {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const config = readDatabaseEnv({
        NODE_ENV,
        DATABASE_URL: `postgresql://${host}/synthetic`,
      });
      assert.deepEqual(config.databaseTls, { mode: "disable" });
      const pool = createDatabasePool(config, () => {});
      try {
        assert.equal(options(pool).ssl, false);
        assert.equal(pool.totalCount, 0);
      } finally {
        await pool.end();
      }
    }
  }
});

test("production and non-loopback targets cannot opt into plaintext", () => {
  for (const NODE_ENV of ["development", "test", "production"])
    safeFailure(() =>
      remote({
        NODE_ENV,
        DATABASE_TLS_MODE: "disable",
        DATABASE_TLS_CA_FILE: undefined,
      }),
    );
  for (const host of ["localhost", "127.0.0.1", "[::1]"])
    safeFailure(() =>
      readDatabaseEnv({
        NODE_ENV: "production",
        DATABASE_URL: `postgresql://${host}/synthetic`,
        DATABASE_TLS_MODE: "disable",
      }),
    );
  for (const host of ["localhost.invalid", "127.0.0.1.invalid", "192.168.0.1"])
    safeFailure(() =>
      readDatabaseEnv({
        DATABASE_URL: `postgresql://${host}/synthetic`,
        DATABASE_TLS_MODE: "disable",
      }),
    );
});

test("missing or invalid TLS settings fail without exposing rejected values", () => {
  for (const DATABASE_TLS_MODE of [
    "",
    "prefer",
    "require",
    "no-verify",
    "SYNTHETIC_SECRET",
  ])
    safeFailure(() => remote({ DATABASE_TLS_MODE }));
  for (const DATABASE_TLS_CA_FILE of [
    undefined,
    "",
    " ",
    " leading",
    "trailing ",
    "bad\u0000SYNTHETIC_SECRET",
    "REPLACE_CA.pem",
    "x".repeat(4097),
  ])
    safeFailure(() => remote({ DATABASE_TLS_CA_FILE }));
  safeFailure(() => remote({ NODE_TLS_REJECT_UNAUTHORIZED: "0" }));
  safeFailure(() =>
    readDatabaseEnv({
      DATABASE_URL: "postgresql://localhost/synthetic",
      DATABASE_TLS_MODE: "disable",
      DATABASE_TLS_CA_FILE: caFile,
    }),
  );
});

test("verify-full also works for deliberately secured loopback development", async () => {
  const pool = createDatabasePool(
    remote({
      DATABASE_URL: "postgresql://localhost/synthetic",
      DATABASE_TLS_MODE: "verify-full",
    }),
    () => {},
  );
  try {
    assert.equal(ssl(pool).rejectUnauthorized, true);
  } finally {
    await pool.end();
  }
});

test("real pg options retain CA validation, normal hostname verification and pool limits", async () => {
  const pool = createDatabasePool(remote({ NODE_ENV: "production" }), () => {});
  try {
    const tls = ssl(pool);
    assert.equal(
      Array.isArray(tls.ca) &&
        tls.ca.length === 1 &&
        tls.ca[0] === validRoots[0]!.trim(),
      true,
    );
    assert.equal(tls.rejectUnauthorized, true);
    assert.equal(tls.minVersion, "TLSv1.2");
    assert.equal(tls.checkServerIdentity, checkServerIdentity);
    assert.equal(tls.key, undefined);
    assert.equal(tls.cert, undefined);
    assert.equal(options(pool).max, 10);
    assert.equal(options(pool).connectionTimeoutMillis, 5000);
    assert.equal(options(pool).idleTimeoutMillis, 30000);
    // Construct the installed pg Client to exercise its actual URL merge.
    const client = new pg.Client(options(pool));
    assert.equal(clientSsl(client) === tls, true);
    assert.equal(pool.totalCount, 0);
  } finally {
    await pool.end();
  }
});

test("Node's hostname verifier accepts the intended DNS name and rejects wrong DNS/IP identities", async () => {
  const pool = createDatabasePool(remote(), () => {});
  try {
    const verify = ssl(pool).checkServerIdentity!;
    const cert = {
      ...new X509Certificate(validRoots[0]!).toLegacyObject(),
      subjectaltname: "DNS:pooler.example.invalid",
    };
    assert.equal(verify("pooler.example.invalid", cert), undefined);
    assert.equal(
      (
        verify("other.example.invalid", cert) as
          NodeJS.ErrnoException | undefined
      )?.code,
      "ERR_TLS_CERT_ALTNAME_INVALID",
    );
    assert.equal(
      (verify("127.0.0.1", cert) as NodeJS.ErrnoException | undefined)?.code,
      "ERR_TLS_CERT_ALTNAME_INVALID",
    );
  } finally {
    await pool.end();
  }
});

test("a trusted bundle loads every certificate, including CRLF and surrounding whitespace", async () => {
  const bundleFile = join(directory, "bundle.pem");
  writeFileSync(
    bundleFile,
    `\n${validRoots[0]}\r\n${validRoots[1]}\n`.replace(/\r?\n/g, "\r\n"),
  );
  const pool = createDatabasePool(
    remote({ DATABASE_TLS_CA_FILE: bundleFile }),
    () => {},
  );
  try {
    assert.equal((ssl(pool).ca as string[]).length, 2);
  } finally {
    await pool.end();
  }
});

test("missing, directory, empty, oversized, malformed and mixed-content CA files fail before any connection", () => {
  safeFailure(() =>
    createDatabasePool(
      remote({
        DATABASE_TLS_CA_FILE: join(directory, "SYNTHETIC_SECRET-missing.pem"),
      }),
      () => {},
    ),
  );
  safeFailure(() =>
    createDatabasePool(remote({ DATABASE_TLS_CA_FILE: directory }), () => {}),
  );
  for (const [name, content] of [
    ["empty.pem", ""],
    [
      "malformed.pem",
      "-----BEGIN CERTIFICATE-----\nSYNTHETIC_CERTIFICATE\n-----END CERTIFICATE-----",
    ],
    ["mixed.pem", validRoots[0]! + "\nSYNTHETIC_SECRET"],
    ["oversized.pem", "x".repeat(1024 * 1024 + 1)],
  ]) {
    const file = join(directory, name!);
    writeFileSync(file, content!);
    safeFailure(() =>
      createDatabasePool(remote({ DATABASE_TLS_CA_FILE: file }), () => {}),
    );
  }
});

test("not-yet-valid and expired CA certificates are rejected", (t) => {
  const certificate = new X509Certificate(validRoots[0]!);
  const clock = t.mock.method(Date, "now");
  for (const now of [
    Date.parse(certificate.validFrom) - 1,
    Date.parse(certificate.validTo) + 1,
  ]) {
    clock.mock.mockImplementation(() => now);
    safeFailure(() => createDatabasePool(remote(), () => {}));
  }
});

test("URL SSL/target overrides are rejected before pg can load a path or replace ssl", () => {
  for (const query of [
    "sslmode=disable",
    "sslmode=require",
    "sslmode=verify-ca",
    "sslmode=no-verify",
    "ssl=false",
    "ssl=true",
    "sslrootcert=SYNTHETIC_SECRET",
    "sslcert=SYNTHETIC_SECRET",
    "sslkey=SYNTHETIC_SECRET",
    "uselibpqcompat=true",
    "%73slmode=disable",
    "SSLMODE=disable",
    "sslmode=verify-full&sslmode=disable",
    "host=database.invalid",
    "application_name=synthetic",
  ]) {
    const unsafe = remoteUrl + "?" + query;
    safeFailure(
      () => remote({ DATABASE_URL: unsafe }),
      /must not contain query options/,
    );
    // Policy also applies if a caller bypasses readDatabaseEnv's returned DTO.
    safeFailure(
      () => createDatabasePool({ ...remote(), databaseUrl: unsafe }, () => {}),
      /must not contain query options/,
    );
  }
  safeFailure(() =>
    readDatabaseEnv({
      DATABASE_URL: "postgresql://localhost/synthetic?host=database.invalid",
    }),
  );
});

test("hand-constructed production config cannot bypass the shared pool's TLS policy", () => {
  const config: DatabaseConfig = {
    ...remote({ NODE_ENV: "production" }),
    databaseTls: { mode: "disable" },
  };
  safeFailure(() => createDatabasePool(config, () => {}));
});

test("ambient PGSSLMODE cannot downgrade explicit verified TLS or alter loopback policy", async () => {
  const previous = process.env.PGSSLMODE;
  try {
    process.env.PGSSLMODE = "no-verify";
    const pool = createDatabasePool(remote(), () => {});
    try {
      assert.equal(ssl(pool).rejectUnauthorized, true);
      assert.equal(clientSsl(new pg.Client(options(pool))) === ssl(pool), true);
    } finally {
      await pool.end();
    }
    const local = createDatabasePool(
      readDatabaseEnv({ DATABASE_URL: "postgresql://localhost/synthetic" }),
      () => {},
    );
    try {
      assert.equal(clientSsl(new pg.Client(options(local))), false);
    } finally {
      await local.end();
    }
  } finally {
    if (previous === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = previous;
  }
});

test(
  "a real pg connection sends only SSLRequest and fails if the endpoint refuses TLS",
  { timeout: 5000 },
  async () => {
    const packets: Buffer[] = [];
    const server = createServer((socket) => {
      socket.once("data", (packet) => {
        packets.push(packet);
        socket.end("N");
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const pool = createDatabasePool(
      remote({
        DATABASE_URL: `postgresql://SYNTHETIC_USER:SYNTHETIC_SECRET@127.0.0.1:${address.port}/synthetic`,
        DATABASE_TLS_MODE: "verify-full",
      }),
      () => {},
    );
    try {
      await assert.rejects(
        pool.connect(),
        /server does not support SSL connections/,
      );
      assert.equal(packets.length, 1);
      // PostgreSQL's eight-byte SSLRequest, before credentials or startup/SQL.
      assert.equal(packets[0]!.length, 8);
      assert.equal(packets[0]!.readInt32BE(0), 8);
      assert.equal(packets[0]!.readInt32BE(4), 80877103);
      assert.equal(pool.totalCount, 0);
    } finally {
      await pool.end();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
