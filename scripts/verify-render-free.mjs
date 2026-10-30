// D2.1 local-only checks. Never loads .env, connects to a database, sends email,
// provisions hosting, or invokes the D2 disposable/Production verifier.
// Run after pnpm production:build: node scripts/verify-render-free.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

// Reuse the installed ESLint/Fastify toolchain; no new project dependency.
const eslint = createRequire(
  join(realpathSync("node_modules/eslint"), "package.json"),
);
const fastify = createRequire(
  join(realpathSync("node_modules/fastify"), "package.json"),
);
const compiler = createRequire(fastify.resolve("@fastify/ajv-compiler"));
const Ajv = compiler("ajv/dist/2020.js").default;
const addFormats = compiler("ajv-formats");
const blueprint = eslint("js-yaml").load(readFileSync("render.yaml", "utf8"));
const schemaUrl = "https://render.com/schema/render.yaml.json";
const response = await fetch(schemaUrl, {
  signal: AbortSignal.timeout(30_000),
});
assert.equal(response.ok, true, "Could not fetch the official Render schema");
const schemaBytes = await response.text();
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(schemaBytes));
assert.equal(validate(blueprint), true, JSON.stringify(validate.errors));

// A strict allowlist also refuses future accidental paid resources/hooks.
assert.deepEqual(Object.keys(blueprint), ["services"]);
assert.equal(blueprint.services.length, 1);
const service = blueprint.services[0];
assert.deepEqual(
  Object.keys(service).sort(),
  [
    "type",
    "name",
    "runtime",
    "plan",
    "region",
    "numInstances",
    "branch",
    "maxShutdownDelaySeconds",
    "autoDeployTrigger",
    "buildCommand",
    "startCommand",
    "healthCheckPath",
    "envVars",
  ].sort(),
);
assert.equal(service.type, "web");
assert.equal(service.name, "budograph-staging");
assert.equal(service.runtime, "node");
assert.equal(service.plan, "free");
assert.equal(service.region, "frankfurt");
assert.equal(service.numInstances, 1);
assert.equal(service.branch, "staging/render-free-d2-2");
assert.equal(service.autoDeployTrigger, "off");
assert.equal(service.maxShutdownDelaySeconds, 120);
assert.equal(service.healthCheckPath, "/api/health/ready");
assert.equal(
  service.buildCommand,
  "pnpm install --frozen-lockfile --prod=false && pnpm production:build",
);
assert.equal(service.startCommand, "pnpm production:start");
const fixed = {
  NODE_VERSION: "24.16.0",
  NODE_ENV: "production",
  BUDOGRAPH_DEPLOYMENT_ENV: "staging",
  HOST: "0.0.0.0",
  PORT: "10000",
  WEB_CONCURRENCY: "1",
  SERVE_FRONTEND: "true",
  REMINDER_WORKER_ENABLED: "false",
  DATABASE_TLS_MODE: "verify-full",
  DATABASE_TLS_CA_FILE: "/etc/secrets/database-ca.pem",
  EMAIL_MODE: "resend",
};
const manual = [
  "DATABASE_URL",
  "EXPECTED_DATABASE_ID",
  "EXPECTED_SUPABASE_PROJECT_REF",
  "EXPECTED_DATABASE_HOST",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "PUBLIC_APP_URL",
  "EMAIL_FROM",
  "RESEND_API_KEY",
  "RATE_LIMIT_HMAC_KEY",
  "EMAIL_OUTBOX_KEY_ID",
  "EMAIL_OUTBOX_KEYS",
];
const byKey = Object.fromEntries(
  service.envVars.map((entry) => [entry.key, entry]),
);
assert.equal(
  Object.keys(byKey).length,
  service.envVars.length,
  "Duplicate environment key",
);
assert.deepEqual(
  Object.keys(byKey).sort(),
  [...Object.keys(fixed), ...manual].sort(),
);
for (const [key, value] of Object.entries(fixed))
  assert.deepEqual(byKey[key], { key, value });
for (const key of manual) assert.deepEqual(byKey[key], { key, sync: false });
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.packageManager, "pnpm@11.9.0");
assert.equal(
  pkg.scripts["production:build"],
  "node scripts/production-build.mjs",
);
assert.equal(
  pkg.scripts["production:start"],
  "node server/dist/src/production.js",
);
for (const file of [
  "scripts/production-build.mjs",
  "server/src/production.ts",
  "server/src/main.ts",
]) {
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /production:migrate|scripts\/migrate|runMigrations|--env-file/,
  );
}

const inherited = {};
if (process.argv.includes("--config-only")) {
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        scope: "D2.2 configuration only; no runtime suites repeated",
        officialSchemaSha256: createHash("sha256")
          .update(schemaBytes)
          .digest("hex"),
        singleFreeManualService: true,
        isolatedStagingInputs: true,
        migrationHooks: 0,
        paidResources: 0,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
for (const [key, value] of Object.entries(process.env))
  if (
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
      key,
    )
  )
    inherited[key] = value;
const synthetic = {
  ...fixed,
  DATABASE_URL:
    "postgresql://budograph_runtime:synthetic@db.abcdefghijklmnopqrst.supabase.co:5432/postgres",
  DATABASE_TLS_CA_FILE: resolve("tmp/d2-1-ca-intentionally-absent.pem"),
  EXPECTED_DATABASE_ID: "00000000-0000-4000-8000-000000000001",
  EXPECTED_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  EXPECTED_DATABASE_HOST: "db.abcdefghijklmnopqrst.supabase.co",
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  BETTER_AUTH_URL: "https://budograph-staging.example.invalid",
  PUBLIC_APP_URL: "https://budograph-staging.example.invalid",
  EMAIL_FROM: "no-reply@example.invalid",
  RESEND_API_KEY: "re_" + randomBytes(20).toString("hex"),
  RATE_LIMIT_HMAC_KEY: randomBytes(32).toString("base64"),
  EMAIL_OUTBOX_KEY_ID: "local-test",
  EMAIL_OUTBOX_KEYS: JSON.stringify({
    "local-test": randomBytes(32).toString("base64"),
  }),
};
const { readServerEnv } = await import("../server/dist/src/config/env.js");
const { readDeploymentEnv } =
  await import("../server/dist/src/config/deployment.js");
assert.equal(readServerEnv(synthetic).nodeEnv, "production");
assert.equal(readDeploymentEnv(synthetic).reminderWorkerEnabled, false);
// Every negative-startup child aborts immediately if it tries any network I/O.
const offline =
  "data:text/javascript," +
  encodeURIComponent(`
  import {Socket} from 'node:net';
  Socket.prototype.connect=function(){process.stderr.write('NETWORK_ATTEMPT_FORBIDDEN');process.exit(98);};
  globalThis.fetch=async()=>{process.stderr.write('NETWORK_ATTEMPT_FORBIDDEN');process.exit(98);};
`);
function rejects(environment, message) {
  const result = spawnSync(
    process.execPath,
    ["--import", offline, "server/dist/src/production.js"],
    {
      env: { ...inherited, ...environment },
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, message);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /NETWORK_ATTEMPT_FORBIDDEN|postgresql:\/\/|\bat .*\.js:\d/,
  );
  for (const key of [
    "BETTER_AUTH_SECRET",
    "RESEND_API_KEY",
    "RATE_LIMIT_HMAC_KEY",
    "EMAIL_OUTBOX_KEYS",
  ])
    assert.equal(
      (result.stdout + result.stderr).includes(synthetic[key]),
      false,
    );
}
let negativeStartupCases = 0;
for (const key of [
  "DATABASE_URL",
  "DATABASE_TLS_CA_FILE",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "EMAIL_FROM",
  "RESEND_API_KEY",
  "RATE_LIMIT_HMAC_KEY",
  "EMAIL_OUTBOX_KEY_ID",
  "EMAIL_OUTBOX_KEYS",
  "EXPECTED_DATABASE_ID",
  "EXPECTED_SUPABASE_PROJECT_REF",
  "EXPECTED_DATABASE_HOST",
]) {
  const environment = { ...synthetic };
  delete environment[key];
  rejects(environment, new RegExp(key));
  negativeStartupCases++;
}
rejects(synthetic, /DATABASE_TLS_CA_FILE must be a readable PEM CA bundle/);
negativeStartupCases++;
rejects({}, /requires NODE_ENV=production/);
negativeStartupCases++;

// Real compiled Fastify + built Vite assets, with explicit offline auth/DB stubs.
// This is routing verification, not a live database or login acceptance test.
const { createApp } = await import("../server/dist/src/app.js");
const app = createApp({
  production: true,
  frontendRoot: resolve("dist"),
  checkDatabase: async () => {},
  authentication: {
    baseURL: synthetic.BETTER_AUTH_URL,
    auth: {
      api: { getSession: async () => null },
      handler: async (request) =>
        new URL(request.url).pathname === "/api/auth/get-session"
          ? Response.json(null)
          : Response.json({ status: "not_found" }, { status: 404 }),
    },
  },
});
let routingCases = 0;
try {
  for (const url of ["/", "/login", "/invite/" + "a".repeat(43)]) {
    const result = await app.inject({ url, headers: { accept: "text/html" } });
    assert.equal(result.statusCode, 200);
    assert.match(result.body, /id="root"/);
    const asset = /src="(\/assets\/[^\"]+\.js)"/.exec(result.body)?.[1];
    assert.ok(asset);
    assert.equal((await app.inject(asset)).statusCode, 200);
    routingCases += 2;
  }
  for (const [url, expected] of [
    ["/api/health/ready", 200],
    ["/api/me", 401],
    ["/api/auth/get-session", 200],
    ["/api/unknown", 404],
    ["/api/auth/unknown", 404],
    ["/.env", 404],
    ["/server/.env", 404],
  ]) {
    const result = await app.inject({ url, headers: { accept: "text/html" } });
    assert.equal(result.statusCode, expected, url);
    assert.doesNotMatch(result.body, /id="root"/);
    routingCases++;
  }
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload: {},
      })
    ).statusCode,
    404,
  );
  routingCases++;
} finally {
  await app.close();
}
console.log(
  JSON.stringify(
    {
      schema: {
        url: schemaUrl,
        sha256: createHash("sha256").update(schemaBytes).digest("hex"),
        pass: true,
      },
      freeManualSingleService: true,
      noPaidResourcesOrMigrationHooks: true,
      negativeStartupCases,
      routingCases,
      databaseConnections: 0,
      realEmails: 0,
      rssMiB: Math.ceil(process.memoryUsage().rss / 1024 / 1024),
      hostedPerformanceVerified: false,
    },
    null,
    2,
  ),
);
