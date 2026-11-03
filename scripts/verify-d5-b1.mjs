// D5-B1 plus unchanged D5-B0 regression: NEW loopback-only cluster, synthetic credentials, no .env/cloud
// URL input. Reproduces the unchanged accepted schema/permissions as a fixture.
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
  openSync,
  closeSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { join, resolve, basename } from "node:path";
import pg from "pg";
import { runMigrations } from "../server/src/db/migrations.ts";

assert.equal(
  process.argv.length,
  2,
  "This runner accepts no database target or operation flags.",
);
const bin = resolve(
  process.env.BUDOGRAPH_TEST_POSTGRES_BIN ?? "D:/BudoGraph-PG17-Test/pgsql/bin",
);
assert.ok(
  existsSync(join(bin, "initdb.exe")),
  "Local PostgreSQL binaries required.",
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
  `BudoGraph-D5B0-PostgreSQL17-${nonce}`,
);
const data = join(root, "data");
assert.ok(!existsSync(root));
mkdirSync(root);
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const ownerFile = join(root, "OWNER.json");
writeFileSync(
  ownerFile,
  JSON.stringify({
    purpose: "D5-B0 synthetic local cluster",
    nonce,
    root,
    port,
  }),
);
function run(name, args) {
  const fd = openSync(join(root, "tools.log"), "w");
  let result;
  try {
    result = spawnSync(join(bin, name), args, {
      env: clean,
      stdio: ["ignore", fd, fd],
      windowsHide: true,
      timeout: 60000,
    });
  } finally {
    closeSync(fd);
  }
  assert.equal(result.status, 0, `Isolated local tool failed: ${name}`);
}
const password = randomBytes(32).toString("hex");
const runtimePassword = randomBytes(32).toString("hex");
writeFileSync(join(root, "password"), password);
run("initdb.exe", [
  "-D",
  data,
  "-U",
  "postgres",
  "--pwfile",
  join(root, "password"),
  "--auth",
  "scram-sha-256",
  "--encoding",
  "UTF8",
  "--locale",
  "C",
]);
appendFileSync(
  join(data, "postgresql.conf"),
  `\nlisten_addresses='127.0.0.1'\nport=${port}\nssl=off\nmax_connections=24\nlog_min_error_statement=panic\n`,
);
let started = false;
const pools = [];
let exitCode = 1;
try {
  run("pg_ctl.exe", [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-w",
    "start",
  ]);
  started = true;
  const config = {
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database: "postgres",
    ssl: false,
    max: 2,
    connectionTimeoutMillis: 4000,
  };
  const admin = new pg.Pool(config);
  pools.push(admin);
  const witness = (
    await admin.query(
      "SELECT current_setting('data_directory') AS directory, current_setting('listen_addresses') AS listen, inet_server_port() AS port",
    )
  ).rows[0];
  assert.equal(resolve(witness.directory), resolve(data));
  assert.equal(witness.listen, "127.0.0.1");
  assert.equal(witness.port, port);
  // Same bootstrap capabilities as the accepted disposable runtime fixture.
  await admin.query(`CREATE ROLE budograph_migrator NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
    CREATE ROLE budograph_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${runtimePassword}';
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    GRANT budograph_migrator TO postgres WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;
    GRANT CONNECT,CREATE ON DATABASE postgres TO budograph_migrator;
    GRANT USAGE,CREATE ON SCHEMA public TO budograph_migrator;
    GRANT CONNECT ON DATABASE postgres TO budograph_runtime;
    GRANT USAGE ON SCHEMA public TO budograph_runtime;
    ALTER DEFAULT PRIVILEGES FOR ROLE budograph_migrator REVOKE ALL ON TABLES FROM PUBLIC,budograph_runtime,anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE budograph_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,budograph_runtime,anon,authenticated,service_role;`);
  const migrator = new pg.Pool({
    ...config,
    options: "-c role=budograph_migrator",
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
  assert.deepEqual(
    await runMigrations(migrator, resolve("server/migrations")),
    { applied: 16, alreadyApplied: 0 },
  );
  const url = (user, value) =>
    `postgresql://${user}:${value}@127.0.0.1:${port}/postgres`;
  exitCode = await new Promise((done, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--test",
        "--test-concurrency=1",
        "server/tests/auth-security.integration.test.ts",
        "server/tests/public-signup.integration.test.ts",
      ],
      {
        env: {
          ...clean,
          NODE_ENV: "test",
          ...(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
            ? {
                BUDOGRAPH_PLAYWRIGHT_MODULE:
                  process.env.BUDOGRAPH_PLAYWRIGHT_MODULE,
              }
            : {}),
          ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
            ? {
                BUDOGRAPH_BROWSER_EXECUTABLE:
                  process.env.BUDOGRAPH_BROWSER_EXECUTABLE,
              }
            : {}),
          D5_B0_OWNER_FILE: ownerFile,
          D5_B0_NONCE: nonce,
          D5_B0_RUNTIME_URL: url("budograph_runtime", runtimePassword),
          D5_B0_MIGRATOR_URL: url("postgres", password),
        },
        stdio: ["ignore", "inherit", "inherit"],
        windowsHide: true,
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => done(code ?? 1));
  });
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  if (started) run("pg_ctl.exe", ["-D", data, "-m", "fast", "-w", "stop"]);
  // Recursive removal is permitted only for this exact fresh, stopped fixture.
  const owner = JSON.parse(readFileSync(ownerFile, "utf8"));
  assert.equal(owner.nonce, nonce);
  assert.equal(owner.purpose, "D5-B0 synthetic local cluster");
  assert.equal(basename(root), `BudoGraph-D5B0-PostgreSQL17-${nonce}`);
  assert.equal(resolve(realpathSync(root)), resolve(root));
  assert.equal(
    resolve(root),
    resolve(process.env.LOCALAPPDATA, `BudoGraph-D5B0-PostgreSQL17-${nonce}`),
  );
  rmSync(root, { recursive: true });
}
console.log(
  `D5-B1 + D5-B0 isolated PostgreSQL: ${exitCode === 0 ? "PASS" : "FAIL"}; cluster stopped and removed; 16 baseline migrations unchanged.`,
);
process.exitCode = exitCode;
