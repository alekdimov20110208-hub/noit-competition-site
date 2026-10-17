// Local-only production artifact rehearsal. No .env loading, migrations, fixtures
// or outgoing HTTP. Provision an OWNED disposable DB separately, never Supabase.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { fork } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";

const databaseUrl = process.env.BUDOGRAPH_D1_REHEARSAL_DATABASE_URL;
const url = new URL(databaseUrl ?? "postgresql://invalid.invalid/invalid");
const database = decodeURIComponent(url.pathname.slice(1));
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  url.hostname !== "127.0.0.1" ||
  !/^budograph_t2_isolated_d1_[a-z0-9_]+$/.test(database) ||
  process.env.BUDOGRAPH_D1_REHEARSAL_CONFIRM !== `${database}:DISPOSABLE` ||
  url.search ||
  url.hash
)
  throw new Error(
    "Rehearsal requires an explicitly confirmed D1 disposable loopback DB.",
  );
const caFile = process.env.BUDOGRAPH_D1_REHEARSAL_CA_FILE;
if (!caFile) throw new Error("Rehearsal requires a verified local CA file.");
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { ca: readFileSync(caFile, "utf8"), rejectUnauthorized: true },
  connectionTimeoutMillis: 5000,
});
try {
  const {
    rows: [identity],
  } = await pool.query(
    "SELECT current_database() AS name,pg_catalog.host(inet_server_addr()) AS host,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl",
  );
  assert.equal(identity.name, database);
  assert.equal(identity.host, "127.0.0.1");
  assert.equal(identity.ssl, true);
} finally {
  await pool.end();
}

const temporary = mkdtempSync(join(tmpdir(), "budograph-d1-rehearsal-"));
const preload = join(temporary, "local-control.mjs");
writeFileSync(
  preload,
  `globalThis.fetch = async () => { throw new Error("Rehearsal outgoing HTTP is blocked"); };
process.on("message", (message) => { if (message === "D1_STOP") { process.emit("SIGTERM"); process.disconnect(); } });
`,
);
const environment = {};
for (const [key, value] of Object.entries(process.env))
  if (
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
      key,
    )
  )
    environment[key] = value;
Object.assign(environment, {
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  PORT: "13301",
  DATABASE_URL: databaseUrl,
  DATABASE_TLS_MODE: "verify-full",
  DATABASE_TLS_CA_FILE: caFile,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  BETTER_AUTH_URL: "https://budograph-rehearsal.invalid",
  PUBLIC_APP_URL: "https://budograph-rehearsal.invalid",
  EMAIL_MODE: "resend",
  EMAIL_FROM: "no-reply@example.invalid",
  RESEND_API_KEY: "re_" + randomBytes(24).toString("hex"),
  SERVE_FRONTEND: "true",
  WEB_CONCURRENCY: "1",
  REMINDER_WORKER_ENABLED: "true",
});
const child = fork("server/dist/src/production.js", [], {
  env: environment,
  execArgv: ["--import", pathToFileURL(preload).href],
  stdio: ["ignore", "pipe", "pipe", "ipc"],
  windowsHide: true,
});
let output = "";
child.stdout.on("data", (data) => {
  output += data;
});
child.stderr.on("data", (data) => {
  output += data;
});
const exited = new Promise((resolve) =>
  child.once("exit", (code) => resolve(code)),
);
const origin = "http://127.0.0.1:13301";
let successful = false;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) break;
    try {
      ready =
        (
          await fetch(origin + "/api/health/ready", {
            signal: AbortSignal.timeout(1000),
          })
        ).status === 200;
    } catch {
      /* Startup polling on owned loopback only. */
    }
    if (ready) break;
    await delay(100);
  }
  assert.equal(
    ready,
    true,
    "Compiled production process did not become ready.",
  );
  for (const path of [
    "/",
    "/login",
    "/invite/" + "a".repeat(43),
    "/events/00000000-0000-4000-8000-000000000001/templates",
  ]) {
    const response = await fetch(origin + path, {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const html = await response.text();
    assert.ok(html.includes('id="root"'));
    assert.ok(!html.includes("/src/main.tsx"));
    const asset = /src="(\/assets\/[^\"]+\.js)"/.exec(html)?.[1];
    assert.ok(asset);
    const bundle = await fetch(origin + asset);
    assert.equal(bundle.status, 200);
    assert.equal(
      bundle.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
    const text = await bundle.text();
    for (const key of ["BETTER_AUTH_SECRET", "RESEND_API_KEY", "DATABASE_URL"])
      assert.ok(!text.includes(environment[key]));
  }
  for (const path of ["/api/unknown", "/api", "/.env", "/server/.env"]) {
    const response = await fetch(origin + path, {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await fetch(origin + "/api/me")).status, 401);
  assert.equal(
    (
      await fetch(origin + "/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: environment.PUBLIC_APP_URL,
        },
        body: "{}",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await fetch(origin + "/api/auth/sign-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.invalid",
          cookie: "better-auth.session_token=INVALID_SYNTHETIC_COOKIE",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  if (process.argv.includes("--hold")) {
    console.log(
      "D1 loopback production rehearsal ready on 127.0.0.1:13301; outgoing HTTP blocked.",
    );
    // Parent runner may request orderly shutdown after independent browser checks.
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("message", (message) => {
        if (message === "D1_RELEASE") resolve();
      });
    });
  }
  child.send("D1_STOP");
  assert.equal(
    await Promise.race([
      exited,
      delay(15_000, undefined, { ref: false }).then(() => "timeout"),
    ]),
    0,
    "Production shutdown must drain cleanly.",
  );
  for (const key of ["BETTER_AUTH_SECRET", "RESEND_API_KEY", "DATABASE_URL"])
    assert.ok(!output.includes(environment[key]));
  successful = true;
  console.log(
    "PASS: compiled production startup, verified DB TLS, built assets, SPA/API/cache boundaries, auth denial, secret-safe logs and graceful SIGTERM handler.",
  );
} finally {
  if (child.exitCode === null) child.kill();
  rmSync(temporary, { recursive: true, force: true });
  if (!successful)
    process.stderr.write(
      "D1 rehearsal failed; child diagnostics withheld to protect runtime secrets.\n",
    );
}
