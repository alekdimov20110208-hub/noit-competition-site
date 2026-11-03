// Creates a NEW cluster. Never reads .env or accepts a target connection URL.
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  appendFileSync,
  existsSync,
  readdirSync,
  openSync,
  closeSync,
} from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";
import { runMigrations } from "../server/src/db/migrations.ts";

const staging = process.argv.includes("--staging");
const stagingD25 = process.argv.includes("--staging-d2-5");
const stagingReference = process.argv.includes("--staging-reference");
const bin = resolve(process.env.BUDOGRAPH_TEST_POSTGRES_BIN ?? "MISSING");
const python = process.env.BUDOGRAPH_TEST_PYTHON;
assert.ok(
  python && existsSync(join(bin, "initdb.exe")),
  "Explicit local PostgreSQL binaries and Python are required.",
);
const clean = Object.fromEntries(
  [
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "PATH",
    "PATHEXT",
    "TEMP",
    "TMP",
    "LOCALAPPDATA",
    "APPDATA",
    "USERPROFILE",
  ]
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
const nonce = randomUUID();
const root = join(
  process.env.LOCALAPPDATA,
  `BudoGraph-V1C-PostgreSQL17-${nonce}`,
);
const data = join(root, "data");
assert.ok(!existsSync(root));
mkdirSync(root);
mkdirSync("tmp/v1c5", { recursive: true });
const evidence = {
  nonce,
  root,
  database: "postgres",
  host: "127.0.0.1",
  started: new Date().toISOString(),
};
const portServer = createServer();
await new Promise((r) => portServer.listen(0, "127.0.0.1", r));
evidence.port = portServer.address().port;
await new Promise((r) => portServer.close(r));
const ownerFile = join(root, "OWNER.json");
writeFileSync(
  ownerFile,
  JSON.stringify({ purpose: "V1-C2 disposable local cluster", ...evidence }),
);
function run(binary, args) {
  // Windows postmaster inherits handles from pg_ctl: never give it a pipe
  // whose EOF spawnSync would wait for until the server shuts down.
  const logPath = join(root, "tool-output.log");
  const fd = openSync(logPath, "w");
  let r;
  try {
    r = spawnSync(binary, args, {
      env: clean,
      stdio: ["ignore", fd, fd],
      windowsHide: true,
    });
  } finally {
    closeSync(fd);
  }
  if (r.status !== 0)
    throw new Error(
      `Local tool failed: ${binary.endsWith("python.exe") ? "certificate generation" : binary.split(/[\\/]/).at(-1)} (details kept local).`,
    );
  return readFileSync(logPath, "utf8");
}
const adminPassword = randomBytes(32).toString("hex");
writeFileSync(join(root, "init-password"), adminPassword);
run(join(bin, "initdb.exe"), [
  "-D",
  data,
  "-U",
  "postgres",
  "--pwfile",
  join(root, "init-password"),
  "--auth",
  "scram-sha-256",
  "--encoding",
  "UTF8",
  "--locale",
  "C",
]);
const certScript = `from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from datetime import datetime, timedelta, timezone
from pathlib import Path
import ipaddress, sys
p=Path(sys.argv[1]); now=datetime.now(timezone.utc)
ca=rsa.generate_private_key(public_exponent=65537,key_size=2048)
name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'BudoGraph V1C disposable CA')])
cert=x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(ca.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(minutes=5)).not_valid_after(now+timedelta(days=2)).add_extension(x509.BasicConstraints(ca=True,path_length=0),critical=True).sign(ca,hashes.SHA256())
key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
leaf=x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'localhost')])).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(minutes=5)).not_valid_after(now+timedelta(days=1)).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),x509.DNSName('db.jlladwdqdillryyfvndo.supabase.co'),x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]),critical=False).sign(ca,hashes.SHA256())
(p/'ca.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
(p/'server.crt').write_bytes(leaf.public_bytes(serialization.Encoding.PEM))
(p/'server.key').write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.TraditionalOpenSSL,serialization.NoEncryption()))
`;
writeFileSync(join(root, "certificate.py"), certScript);
run(python, [join(root, "certificate.py"), root]);
const pgPath = (p) => p.replaceAll("\\", "/").replaceAll("'", "''");
appendFileSync(
  join(data, "postgresql.conf"),
  `\nlisten_addresses='127.0.0.1'\nport=${evidence.port}\nssl=on\nssl_cert_file='${pgPath(join(root, "server.crt"))}'\nssl_key_file='${pgPath(join(root, "server.key"))}'\nmax_connections=40\nlog_min_error_statement=panic\n`,
);
let started = false;
const pools = [];
const ssl = {
  ca: readFileSync(join(root, "ca.pem"), "utf8"),
  rejectUnauthorized: true,
};
function pool(user, password, database) {
  // No user-controlled host, URL options or ambient pg environment.
  const p = new pg.Pool({
    host: "127.0.0.1",
    port: evidence.port,
    user,
    password,
    database,
    ssl,
    max: 2,
    connectionTimeoutMillis: 4000,
  });
  pools.push(p);
  return p;
}
try {
  run(join(bin, "pg_ctl.exe"), [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-w",
    "start",
  ]);
  started = true;
  const admin = pool("postgres", adminPassword, "postgres");
  const witness = (
    await admin.query(
      "SELECT current_setting('data_directory') AS directory, current_setting('listen_addresses') AS listen, inet_server_port() AS port, (pg_control_system()).system_identifier::text AS system_id, version() AS version",
    )
  ).rows[0];
  assert.equal(resolve(witness.directory), resolve(data));
  assert.equal(witness.listen, "127.0.0.1");
  assert.equal(witness.port, evidence.port);
  const control = run(join(bin, "pg_controldata.exe"), [data]);
  assert.ok(control.includes(witness.system_id));
  Object.assign(evidence, {
    systemId: witness.system_id,
    engine: witness.version,
  });
  const passwords = Object.fromEntries(
    [
      "postgres",
      "budograph_runtime",
      "anon",
      "authenticated",
      "public_probe",
    ].map((r) => [
      r,
      r === "postgres" ? adminPassword : randomBytes(32).toString("hex"),
    ]),
  );
  for (const role of ["anon", "authenticated", "public_probe"])
    await admin.query(
      `CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${passwords[role]}'`,
    );
  await admin.query(
    "CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION",
  );
  if (stagingD25) {
    evidence.mode = "staging-d2-5";
    evidence.checks = await (
      await import("../server/tests/helpers/staging-d2-5-rehearsal.ts")
    ).runD25Rehearsal({ admin, root, port: evidence.port, clean });
    evidence.testExitCode = 0;
  } else if (staging) {
    evidence.mode = "staging";
    evidence.checks = await (
      await import("../server/tests/helpers/staging-rehearsal.ts")
    ).runStagingRehearsal({
      admin,
      root,
      port: evidence.port,
      passwords,
      clean,
    });
    evidence.testExitCode = 0;
  } else {
    await admin.query(`CREATE ROLE budograph_migrator NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
    CREATE ROLE budograph_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${passwords.budograph_runtime}';
    GRANT budograph_migrator TO postgres WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;
    GRANT CONNECT,CREATE ON DATABASE postgres TO budograph_migrator;
    GRANT USAGE,CREATE ON SCHEMA public TO budograph_migrator;
    GRANT CONNECT ON DATABASE postgres TO budograph_runtime;
    GRANT USAGE ON SCHEMA public TO budograph_runtime;
    ALTER DEFAULT PRIVILEGES FOR ROLE budograph_migrator REVOKE ALL ON TABLES FROM PUBLIC,budograph_runtime,anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE budograph_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,budograph_runtime,anon,authenticated,service_role;`);
    const migrator = new pg.Pool({
      host: "127.0.0.1",
      port: evidence.port,
      user: "postgres",
      password: adminPassword,
      database: "postgres",
      ssl,
      max: 2,
      options: "-c role=budograph_migrator",
      connectionTimeoutMillis: 4000,
    });
    pools.push(migrator);
    const pins = JSON.parse(
      readFileSync("server/migrations/production-manifest.json", "utf8"),
    ).pins;
    assert.equal(pins.length, 16);
    for (const pin of pins)
      assert.equal(
        createHash("sha256")
          .update(readFileSync(join("server/migrations", pin.name)))
          .digest("hex"),
        pin.checksum,
      );
    evidence.freshBaseline = await runMigrations(
      migrator,
      resolve("server/migrations"),
    );
    assert.deepEqual(evidence.freshBaseline, {
      applied: 16,
      alreadyApplied: 0,
    });
    evidence.allMigrationChecksums = (
      await migrator.query(
        "SELECT version,name,checksum FROM public.schema_migrations ORDER BY version",
      )
    ).rows;
    if (stagingReference) {
      evidence.mode = "staging-reference";
      const { applicationCatalog } =
        await import("../server/src/staging/catalog.ts");
      const original = await applicationCatalog(migrator);
      const c = await migrator.connect();
      try {
        await c.query("BEGIN");
        await c.query(
          "SELECT set_config('budograph.verified_project_ref','jlladwdqdillryyfvndo',true),set_config('budograph.staging_database_id','bce50118-4829-42e0-86cd-1cb41de8b1ba',true)",
        );
        await c.query(
          readFileSync("server/staging/identity-overlay.sql", "utf8"),
        );
        await c.query("COMMIT");
      } finally {
        c.release();
      }
      const stagingCatalog = await applicationCatalog(migrator);
      writeFileSync(
        "server/staging/catalog-reference.json",
        JSON.stringify({ original, staging: stagingCatalog }, null, 2) + "\n",
      );
      evidence.testExitCode = 0;
      console.log(
        "Disposable original/staging catalog reference generated from 16 pinned migrations.",
      );
    } else {
      const databaseId = randomUUID(),
        projectRef = `local-v1c-${nonce.slice(0, 8)}`;
      await migrator.query(
        "INSERT INTO budograph_private.environment_identity(database_id,environment,project_ref) VALUES($1,'production',$2)",
        [databaseId, projectRef],
      );
      writeFileSync(
        ownerFile,
        JSON.stringify({
          purpose: "V1-C2 disposable local cluster",
          ...evidence,
          databaseId,
          projectRef,
        }),
      );
      const url = (role) =>
        `postgresql://${role}:${passwords[role]}@127.0.0.1:${evidence.port}/${evidence.database}`;
      const env = {
        ...clean,
        NODE_ENV: "test",
        V1C_OWNER_FILE: ownerFile,
        V1C_NONCE: nonce,
        V1C_CA_FILE: join(root, "ca.pem"),
        V1C_RUNTIME_URL: url("budograph_runtime"),
        V1C_MIGRATOR_URL: url("postgres"),
        V1C_ANON_URL: url("anon"),
        V1C_AUTHENTICATED_URL: url("authenticated"),
        V1C_PUBLIC_URL: url("public_probe"),
        EXPECTED_DATABASE_ID: databaseId,
        EXPECTED_SUPABASE_PROJECT_REF: projectRef,
      };
      const mode = process.argv.includes("--all")
        ? "all"
        : process.argv.includes("--operations")
          ? "operations"
          : process.argv.includes("--startup")
            ? "startup"
            : "runtime";
      const files =
        mode === "all"
          ? [
              "server/tests/d2-startup.integration.test.ts",
              "server/tests/operational-controls.integration.test.ts",
              "server/tests/runtime-access.integration.test.ts",
            ]
          : [
              mode === "operations"
                ? "server/tests/operational-controls.integration.test.ts"
                : mode === "startup"
                  ? "server/tests/d2-startup.integration.test.ts"
                  : "server/tests/runtime-access.integration.test.ts",
            ];
      console.log(
        `Verified NEW disposable PostgreSQL ${witness.version.split(" ")[1]} cluster; loopback, independent system identifier, non-owner runtime, TLS verification. Running ${mode} tests.`,
      );
      const child = spawn(
        process.execPath,
        ["--test", "--test-concurrency=1", ...files],
        { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      const log = [];
      for (const stream of [child.stdout, child.stderr])
        stream.on("data", (bytes) => {
          let text = bytes.toString();
          for (const secret of Object.values(passwords))
            text = text.replaceAll(secret, "[synthetic credential redacted]");
          // Even a failing assertion must not persist token-bearing URLs/bodies.
          text = text
            .replace(/https?:\/\/[^\s<>"']+/g, "[URL redacted]")
            .replace(
              /\/invite\/[A-Za-z0-9_-]{43}/g,
              "[invitation path redacted]",
            )
            .replace(
              /(?:token|password)\s*[:=]\s*[^\s,"'}]+/gi,
              "[sensitive field redacted]",
            );
          log.push(text);
          process.stdout.write(text);
        });
      const code = await new Promise((r) => child.on("exit", r));
      writeFileSync(`tmp/v1c5/${mode}-sql-tests.log`, log.join(""));
      evidence.mode = mode;
      evidence.testExitCode = code;
      assert.equal(code, 0, "Disposable SQL suite failed.");
      evidence.policies = (
        await migrator.query(
          "SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','budograph_private') ORDER BY schemaname,tablename,policyname",
        )
      ).rows;
      assert.equal(evidence.policies.length, 54);
      evidence.columnGrants = (
        await migrator.query(
          "SELECT table_schema,table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges WHERE grantee IN ('budograph_runtime','anon','authenticated','PUBLIC') AND table_schema IN ('public','budograph_private') ORDER BY table_schema,table_name,column_name,grantee,privilege_type",
        )
      ).rows;
      assert.ok(
        evidence.columnGrants.every((r) => r.grantee === "budograph_runtime"),
      );
      evidence.roles = (
        await migrator.query(
          "SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolcanlogin FROM pg_roles WHERE rolname IN ('v1c_migrator','budograph_runtime','anon','authenticated','public_probe') ORDER BY rolname",
        )
      ).rows;
      evidence.operationalFunctions = (
        await migrator.query(`SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS security_definer,p.proconfig AS settings,pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,
    has_function_privilege('budograph_runtime',p.oid,'EXECUTE') AS runtime,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
    has_function_privilege('public_probe',p.oid,'EXECUTE') AS public
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='budograph_private' ORDER BY p.proname`)
      ).rows;
      assert.equal(evidence.operationalFunctions.length, 8);
      assert.ok(
        evidence.operationalFunctions.every(
          (f) =>
            f.security_definer &&
            f.runtime &&
            !f.anon &&
            !f.authenticated &&
            !f.public &&
            f.settings.includes("search_path=pg_catalog, pg_temp"),
        ),
      );
      evidence.operationalTables = (
        await migrator.query(`SELECT c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) AS owner,
    has_table_privilege('budograph_runtime',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS runtime_direct,
    pg_total_relation_size(c.oid)::text AS total_bytes
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='budograph_private' AND c.relname IN ('email_outbox','rate_counter') ORDER BY c.relname`)
      ).rows;
      assert.equal(evidence.operationalTables.length, 2);
      assert.ok(
        evidence.operationalTables.every(
          (table) => table.relrowsecurity && !table.runtime_direct,
        ),
      );
    }
  }
} finally {
  await Promise.allSettled(pools.map((p) => p.end()));
  if (started) {
    assert.equal(JSON.parse(readFileSync(ownerFile)).nonce, nonce);
    assert.ok(resolve(data).startsWith(resolve(root) + "\\"));
    run(join(bin, "pg_ctl.exe"), ["-D", data, "-m", "fast", "-w", "stop"]);
    evidence.stopped = true;
  }
  writeFileSync(
    `tmp/v1c5/${evidence.mode ?? "setup"}-sql-evidence.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    "Only this task's newly created cluster was stopped. No databases or pre-existing resources were dropped.",
  );
}
