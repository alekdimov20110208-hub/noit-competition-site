// C1-B uses a new local cluster, the real application routes and Better Auth.
// No existing database URL, dotenv file, or email provider is used.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { createApp } from "../server/src/app.ts";
import { createAuth } from "../server/src/auth/auth.ts";
import { provisionDevelopmentAccounts } from "../server/src/auth/development-accounts.ts";
import { readServerEnv } from "../server/src/config/env.ts";
import { runMigrations } from "../server/src/db/migrations.ts";
import { createDatabasePool } from "../server/src/db/pool.ts";
import { createEmailTasks } from "../server/src/email/service.ts";
import { createApplicationServices } from "../server/src/runtime.ts";

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--serve"));
const serve = args.length === 1;
const project = fileURLToPath(new URL("../", import.meta.url));
assert.equal(
  resolve(process.cwd()),
  resolve(project),
  "Run from the C1-A worktree.",
);
assert.ok(
  !Object.keys(process.env).some((name) => /^(PG|VITE_)/i.test(name)),
  "Use a terminal without ambient PG or VITE_ overrides.",
);
const bin = resolve(
  process.env.BUDOGRAPH_TEST_POSTGRES_BIN ?? "D:/BudoGraph-PG17-Test/pgsql/bin",
);
assert.ok(
  existsSync(join(bin, "initdb.exe")),
  "Local PostgreSQL 17 binaries required.",
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
    .filter((name) => process.env[name])
    .map((name) => [name, process.env[name]]),
);
const host = "127.0.0.1";
async function freePort() {
  const socket = createServer();
  await new Promise((done, reject) =>
    socket.once("error", reject).listen(0, host, done),
  );
  const { port } = socket.address();
  await new Promise((done, reject) =>
    socket.close((error) => (error ? reject(error) : done())),
  );
  return port;
}

const root = mkdtempSync(
  join(realpathSync(process.env.LOCALAPPDATA), "BudoGraph-Calendar-C1B-"),
);
const data = join(root, "data");
const passwordFile = join(root, "init-password");
const databasePort = await freePort();
const port = await freePort();
const origin = `http://${host}:${port}`;
const password = () => randomBytes(24).toString("hex");
const adminPassword = password();
const runtimePassword = password();
const credentials = ["organizer", "member"].map((label) => ({
  label,
  email: `calendar-${label}@example.invalid`,
  name: `Calendar ${label}`,
  password: password(),
}));
const pools = [];
let started = false;
let app;
let stage = "cluster";
function run(binary, args) {
  const fd = openSync(join(root, "tools.log"), "a");
  try {
    const result = spawnSync(join(bin, binary), args, {
      env: clean,
      stdio: ["ignore", fd, fd],
      windowsHide: true,
      timeout: 60000,
    });
    assert.equal(
      result.status,
      0,
      `Local ${binary} failed. See tools.log in the fixture directory.`,
    );
  } finally {
    closeSync(fd);
  }
}

const month = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Sofia",
  year: "numeric",
  month: "2-digit",
}).format(new Date());
const day = (n) => `${month}-${String(n).padStart(2, "0")}`;

async function seed(admin) {
  const { rows: users } = await admin.query(
    'SELECT id,email FROM public."user"',
  );
  const [organizer, member] = credentials.map(
    ({ email }) => users.find((row) => row.email === email).id,
  );
  async function event(name, archived, shared) {
    const id = randomUUID();
    const owner = randomUUID();
    const assigned = randomUUID();
    await admin.query(
      "INSERT INTO public.event (id,name,start_date,end_date,timezone,owner_user_id,archived_at) VALUES ($1,$2,$3,$4,'Europe/Sofia',$5,CASE WHEN $6 THEN CURRENT_TIMESTAMP END)",
      [id, name, day(8), day(12), organizer, archived],
    );
    await admin.query(
      "INSERT INTO public.event_member (id,event_id,user_id,access_role,operational_role) VALUES ($1,$2,$3,'ORGANIZER','Organizer')",
      [owner, id, organizer],
    );
    if (shared) {
      await admin.query(
        "INSERT INTO public.event_member (id,event_id,user_id,access_role,operational_role) VALUES ($1,$2,$3,'MEMBER','Member')",
        [assigned, id, member],
      );
    }
    return { id, owner, assigned, name };
  }
  async function task(event, title, date, time, status, assignee = null) {
    const id = randomUUID();
    await admin.query(
      "INSERT INTO public.task (id,event_id,title,deadline,deadline_time,status,assigned_member_id,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)",
      [id, event.id, title, date, time, status, assignee, event.owner],
    );
    return { id, title, date, time, status };
  }
  const shared = await event("Calendar C1-B", false, true);
  const privateEvent = await event("Organizer-only calendar", false, false);
  const archived = await event("Archived calendar C1-B", true, true);
  const timed = await task(
    shared,
    "Confirm venue",
    day(9),
    "00:15",
    "not-started",
    shared.assigned,
  );
  const dateOnly = await task(shared, "Print agenda", day(10), null, "blocked");
  const privateTask = await task(
    privateEvent,
    "Private event deadline",
    day(9),
    null,
    "not-started",
  );
  const archivedTask = await task(
    archived,
    "Archived deadline",
    day(9),
    "17:45",
    "completed",
    archived.assigned,
  );
  return {
    shared,
    privateEvent,
    archived,
    timed,
    dateOnly,
    privateTask,
    archivedTask,
  };
}

try {
  writeFileSync(passwordFile, adminPassword);
  try {
    run("initdb.exe", [
      "-D",
      data,
      "-U",
      "postgres",
      "--pwfile",
      passwordFile,
      "--auth",
      "scram-sha-256",
      "--encoding",
      "UTF8",
      "--locale",
      "C",
    ]);
  } finally {
    unlinkSync(passwordFile);
  }
  appendFileSync(
    data + "/postgresql.conf",
    `\nlisten_addresses='127.0.0.1'\nport=${databasePort}\nssl=off\nmax_connections=24\nlog_min_error_statement=panic\n`,
  );
  run("pg_ctl.exe", [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-w",
    "start",
  ]);
  started = true;
  const adminOptions = {
    host,
    port: databasePort,
    database: "postgres",
    user: "postgres",
    password: adminPassword,
    ssl: false,
    max: 2,
    connectionTimeoutMillis: 4000,
  };
  const admin = new pg.Pool(adminOptions);
  pools.push(admin);
  const {
    rows: [identity],
  } = await admin.query(
    "SELECT current_setting('data_directory') AS directory, current_setting('listen_addresses') AS host, inet_server_port() AS port",
  );
  assert.equal(resolve(identity.directory), resolve(data));
  assert.equal(identity.host, host);
  assert.equal(identity.port, databasePort);

  stage = "migrations";
  // The same roles as the existing local D5-B1 migration fixture.
  await admin.query(`CREATE ROLE budograph_migrator NOLOGIN NOINHERIT;
    CREATE ROLE budograph_runtime LOGIN NOINHERIT PASSWORD '${runtimePassword}';
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    GRANT budograph_migrator TO postgres WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;
    GRANT CONNECT,CREATE ON DATABASE postgres TO budograph_migrator;
    GRANT USAGE,CREATE ON SCHEMA public TO budograph_migrator;
    GRANT CONNECT ON DATABASE postgres TO budograph_runtime;
    GRANT USAGE ON SCHEMA public TO budograph_runtime;`);
  const migrator = new pg.Pool({
    ...adminOptions,
    options: "-c role=budograph_migrator",
  });
  pools.push(migrator);
  assert.deepEqual(
    await runMigrations(migrator, join(project, "server/migrations")),
    { applied: 16, alreadyApplied: 0 },
  );

  stage = "accounts and records";
  const config = readServerEnv({
    NODE_ENV: "development",
    HOST: host,
    PORT: String(port),
    DATABASE_URL: `postgresql://budograph_runtime:${runtimePassword}@${host}:${databasePort}/postgres`,
    DATABASE_TLS_MODE: "disable",
    BETTER_AUTH_SECRET: password(),
    BETTER_AUTH_URL: origin,
    PUBLIC_APP_URL: origin,
    EMAIL_MODE: "disabled",
    BUDOGRAPH_PUBLIC_SIGNUP_ENABLED: "false",
  });
  const runtime = createDatabasePool(config, () => {});
  pools.push(runtime);
  await provisionDevelopmentAccounts(
    runtime,
    createAuth(runtime, config, {
      developmentProvisioning: true,
    }),
    credentials,
  );
  const fixture = await seed(admin);

  stage = "frontend build";
  const frontendRoot = join(root, "frontend");
  await build({
    configFile: false,
    envFile: false,
    root: project,
    plugins: [react()],
    build: { outDir: frontendRoot, emptyOutDir: false },
    logLevel: "warn",
  });
  stage = "Fastify startup";
  const emailTasks = createEmailTasks();
  const services = createApplicationServices(
    runtime,
    config,
    emailTasks,
    () => {},
  );
  assert.equal(services.email.enabled, false);
  assert.equal(services.emailOperations, undefined);
  app = createApp({ ...services, frontendRoot, logger: false });
  await app.listen({ host, port });

  stage = serve ? "owner acceptance" : "browser verification";
  if (serve) {
    const loginFile = join(root, "disposable-accounts.json");
    writeFileSync(
      loginFile,
      JSON.stringify({ credentials, origin, ...fixture, month }, null, 2),
    );
    console.log(
      JSON.stringify({
        url: origin + `/events/${fixture.shared.id}/calendar`,
        loginFile,
        tasks: origin + `/events/${fixture.shared.id}/tasks`,
        archived: origin + `/events/${fixture.archived.id}/calendar`,
        privateEvent: origin + `/events/${fixture.privateEvent.id}/calendar`,
        month,
        pid: process.pid,
        pgData: data,
      }),
    );
    await new Promise((done) => {
      process.once("SIGINT", done);
      process.once("SIGTERM", done);
    });
  } else {
    const { verifyCalendarReal } =
      await import("./verify-calendar-c1b-browser.mjs");
    await verifyCalendarReal({
      origin,
      credentials,
      fixture,
      month,
      day,
      admin,
    });
  }
} catch (error) {
  console.error(`C1-B failed at ${stage}. Fixture: ${root}`);
  // Test assertions contain fixture fields only. Avoid raw DB/config error output.
  if (stage === "browser verification") console.error(error);
  else
    console.error(
      error instanceof assert.AssertionError
        ? error.message
        : (error.code ?? error.name),
    );
  process.exitCode = 1;
} finally {
  try {
    await app?.close();
  } finally {
    try {
      await Promise.all(pools.map((pool) => pool.end()));
    } finally {
      if (started) run("pg_ctl.exe", ["-D", data, "-m", "fast", "-w", "stop"]);
    }
  }
}
