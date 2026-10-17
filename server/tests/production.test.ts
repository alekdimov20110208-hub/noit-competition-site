import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.ts";
import { readDeploymentEnv } from "../src/config/deployment.ts";
import { readServerEnv, EnvironmentError } from "../src/config/env.ts";

const html =
  '<!doctype html><div id="root"></div><script>window.example = true;</script>';
function frontend(t: { after(fn: () => void): void }) {
  const root = mkdtempSync(join(tmpdir(), "budograph-d1-static-"));
  mkdirSync(join(root, "assets"));
  mkdirSync(join(root, "api"));
  writeFileSync(join(root, "index.html"), html);
  writeFileSync(join(root, "assets/index-abc12345.js"), "/* build fixture */");
  writeFileSync(join(root, "assets/index-abc12345.js.map"), "DO_NOT_SERVE");
  writeFileSync(join(root, ".env"), "DO_NOT_SERVE");
  writeFileSync(join(root, "api/private.txt"), "DO_NOT_SERVE");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("production serves HTML deep links and immutable assets; API never falls back", async (t) => {
  const app = createApp({
    frontendRoot: frontend(t),
    production: true,
    checkDatabase: async () => {},
  });
  t.after(() => app.close());
  for (const url of [
    "/",
    "/login",
    "/invite/" + "a".repeat(43),
    "/events/00000000-0000-4000-8000-000000000001/templates",
    "/reset-password?token=synthetic",
    "/index.html",
  ]) {
    const result = await app.inject({ url, headers: { accept: "text/html" } });
    assert.equal(result.statusCode, 200, url);
    assert.equal(result.body, html);
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(result.headers["referrer-policy"], "no-referrer");
    assert.equal(result.headers["x-content-type-options"], "nosniff");
    assert.equal(result.headers["x-frame-options"], "DENY");
    assert.equal(
      result.headers["strict-transport-security"],
      "max-age=31536000",
    );
    const hash = createHash("sha256")
      .update("window.example = true;")
      .digest("base64");
    assert.ok(
      String(result.headers["content-security-policy"]).includes(
        `'sha256-${hash}'`,
      ),
    );
    assert.doesNotMatch(
      String(result.headers["content-security-policy"]),
      /unsafe-eval/,
    );
  }
  const asset = await app.inject("/assets/index-abc12345.js");
  assert.equal(asset.statusCode, 200);
  assert.match(String(asset.headers["content-type"]), /javascript/);
  assert.equal(
    asset.headers["cache-control"],
    "public, max-age=31536000, immutable",
  );
  for (const url of [
    "/api",
    "/api/unknown",
    "/API/unknown",
    "/api/private.txt",
    "/api/auth/unknown",
    "/assets/missing.js",
    "/assets/index-abc12345.js.map",
    "/.env",
    "/server/.env",
    "/package.json",
    "/%61pi/unknown",
    "/%2e%2e/server/.env",
    "/events%5csecret",
  ]) {
    const result = await app.inject({ url, headers: { accept: "text/html" } });
    assert.ok(result.statusCode >= 400, url);
    assert.notEqual(result.body, html, url);
    assert.doesNotMatch(result.body, /DO_NOT_SERVE/);
    assert.equal(result.headers["cache-control"], "no-store");
  }
  assert.equal(
    (await app.inject({ method: "POST", url: "/events/new", payload: {} }))
      .statusCode,
    404,
  );
  assert.equal((await app.inject("/events/new")).statusCode, 404);
  assert.equal(
    (
      await app.inject({
        method: "HEAD",
        url: "/login",
        headers: { accept: "text/html" },
      })
    ).body,
    "",
  );
});

test("production health is uncached and unavailable DB does not leak diagnostics", async (t) => {
  const app = createApp({
    frontendRoot: frontend(t),
    checkDatabase: async () => {
      throw Error("SYNTHETIC_HIDDEN_SECRET");
    },
  });
  t.after(() => app.close());
  const live = await app.inject("/api/health/live"),
    ready = await app.inject("/api/health/ready");
  assert.equal(live.statusCode, 200);
  assert.equal(ready.statusCode, 503);
  assert.deepEqual(ready.json(), { status: "unavailable" });
  assert.equal(ready.headers["cache-control"], "no-store");
  assert.equal(live.headers["strict-transport-security"], undefined);
});

test("forwarded identity requires an exact trusted socket peer and auth strips forwarding", async (t) => {
  for (const trusted of [false, true]) {
    let actual = "";
    const app = createApp({
      checkDatabase: async () => {},
      trustedProxyIps: trusted ? ["10.0.0.8"] : [],
      authentication: {
        baseURL: "https://budograph.example.invalid",
        auth: {
          api: { getSession: async () => null },
          handler: async (request) => {
            actual = request.headers.get("x-budograph-client-ip")!;
            for (const key of [
              "forwarded",
              "x-forwarded-for",
              "x-forwarded-host",
              "x-forwarded-proto",
              "x-real-ip",
            ])
              assert.equal(request.headers.has(key), false, key);
            assert.equal(
              request.headers.get("host"),
              "budograph.example.invalid",
            );
            assert.equal(
              new URL(request.url).origin,
              "https://budograph.example.invalid",
            );
            return Response.json(
              { status: true },
              { headers: { "cache-control": "public, max-age=3600" } },
            );
          },
        },
      },
    });
    t.after(() => app.close());
    const response = await app.inject({
      url: "/api/auth/get-session",
      remoteAddress: "10.0.0.8",
      headers: {
        host: "attacker.invalid",
        forwarded: "for=198.51.100.1",
        "x-forwarded-for": "198.51.100.1, 203.0.113.2",
        "x-forwarded-host": "attacker.invalid",
        "x-forwarded-proto": "http",
        "x-real-ip": "198.51.100.1",
        "x-budograph-client-ip": "198.51.100.1",
      },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    // Only the nearest untrusted hop is used, never the forged leftmost entry.
    assert.equal(actual, trusted ? "203.0.113.2" : "10.0.0.8");
  }
});

test("request body bounds also apply to error responses outside auth", async (t) => {
  const app = createApp({ checkDatabase: async () => {} });
  app.post("/api/synthetic", async (request) => request.body);
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/synthetic",
    payload: { data: "x".repeat(65_536) },
  });
  assert.equal(response.statusCode, 413);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(response.json(), { status: "error" });
});

test("deployment config refuses permissive proxy trust and ambiguous runtime flags", () => {
  assert.deepEqual(readDeploymentEnv({}), {
    production: false,
    serveFrontend: false,
    trustedProxyIps: [],
    reminderWorkerEnabled: true,
  });
  assert.equal(
    readDeploymentEnv({ NODE_ENV: "production" }).serveFrontend,
    true,
  );
  assert.deepEqual(
    readDeploymentEnv({ TRUSTED_PROXY_IPS: "127.0.0.1,::1" }).trustedProxyIps,
    ["127.0.0.1", "::1"],
  );
  for (const fields of [
    ...[
      "true",
      "1",
      "*",
      "0.0.0.0/0",
      "::/0",
      "0.0.0.0",
      "::",
      "127.0.0.1,",
      "127.0.0.1, 10.0.0.1",
      "REPLACE_SECRET",
    ].map((TRUSTED_PROXY_IPS) => ({ TRUSTED_PROXY_IPS })),
    { SERVE_FRONTEND: "1" },
    { REMINDER_WORKER_ENABLED: "yes" },
    { NODE_ENV: "production", SERVE_FRONTEND: "false" },
    { NODE_ENV: "production", WEB_CONCURRENCY: "2" },
  ])
    assert.throws(() => readDeploymentEnv(fields), EnvironmentError);
});

test("production rejects HTTP, mismatched origins, disabled email and TLS downgrades", () => {
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://database.invalid/synthetic",
    DATABASE_TLS_CA_FILE: "SYNTHETIC_CA.pem",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: "https://budograph.example.invalid",
    PUBLIC_APP_URL: "https://budograph.example.invalid",
    EMAIL_MODE: "resend",
    EMAIL_FROM: "no-reply@example.invalid",
    RESEND_API_KEY: "re_" + randomBytes(20).toString("hex"),
  };
  assert.equal(readServerEnv(base).nodeEnv, "production");
  for (const fields of [
    { BETTER_AUTH_URL: "http://budograph.example.invalid" },
    { PUBLIC_APP_URL: "https://foreign.example.invalid" },
    { EMAIL_MODE: "disabled" },
    { DATABASE_TLS_MODE: "disable" },
    {
      DATABASE_URL: "postgresql://database.invalid/synthetic?sslmode=no-verify",
    },
    { NODE_TLS_REJECT_UNAUTHORIZED: "0" },
    { BETTER_AUTH_SECRET: "" },
    { RESEND_API_KEY: "" },
  ])
    assert.throws(
      () => readServerEnv({ ...base, ...fields }),
      EnvironmentError,
    );
});

test("release entry point and missing configuration fail before any database connection", () => {
  for (const NODE_ENV of [undefined, "production"]) {
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
    };
    if (NODE_ENV) env.NODE_ENV = NODE_ENV;
    const result = spawnSync(process.execPath, ["server/src/production.ts"], {
      env,
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      NODE_ENV ? /DATABASE_URL is required/ : /requires NODE_ENV=production/,
    );
    assert.doesNotMatch(result.stderr, /postgresql:\/\/|password|stack/i);
  }
});
