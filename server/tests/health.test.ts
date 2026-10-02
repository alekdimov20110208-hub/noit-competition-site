import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";

test("liveness is available without a database or TCP listener", async (t) => {
  let checks = 0;
  const app = createApp({
    checkDatabase: async () => {
      checks += 1;
      throw new Error("database is unavailable");
    },
  });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/health/live" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  assert.equal(checks, 0);
  assert.equal(app.server.listening, false);
});

test("readiness checks the injected database dependency", async (t) => {
  let checks = 0;
  const app = createApp({
    checkDatabase: async () => {
      checks += 1;
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/health/ready",
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  assert.equal(checks, 1);
});

test("readiness failures do not expose database details in responses or logs", async (t) => {
  const sensitive = "SYNTHETIC_SECRET_SENTINEL";
  const logs: string[] = [];
  const app = createApp({
    checkDatabase: async () => {
      throw new Error(
        `Cannot connect to postgresql://user:${sensitive}@db/test`,
      );
    },
    logger: { stream: { write: (line) => logs.push(line) } },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/api/health/ready?password=${sensitive}`,
    headers: {
      authorization: `Bearer ${sensitive}`,
      cookie: `session=${sensitive}`,
      "x-request-id": sensitive,
      host: `${sensitive}.example`,
    },
  });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { status: "unavailable" });
  assert.equal(response.body.includes(sensitive), false);
  assert.equal(logs.join("").includes(sensitive), false);
  assert.ok(
    logs.some((line) => line.includes("Database readiness check failed")),
  );
});

test("unknown URLs and request failures use safe responses and logs", async (t) => {
  const sensitive = "SYNTHETIC_ERROR_SENTINEL";
  const logs: string[] = [];
  const app = createApp({
    checkDatabase: async () => {},
    logger: { stream: { write: (line) => logs.push(line) } },
  });
  app.get("/test-failure", async () => {
    throw new Error(`raw error containing ${sensitive}`);
  });
  t.after(() => app.close());

  const missing = await app.inject({
    method: "GET",
    url: `/unknown/${sensitive}?token=${sensitive}`,
  });
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.json(), { status: "not_found" });

  const failed = await app.inject({ method: "GET", url: "/test-failure" });
  assert.equal(failed.statusCode, 500);
  assert.deepEqual(failed.json(), { status: "error" });
  assert.equal(
    `${missing.body}${failed.body}${logs.join("")}`.includes(sensitive),
    false,
  );
});

test("app creation does not register process signal handlers", async (t) => {
  const signals = ["SIGINT", "SIGTERM"] as const;
  const before = signals.map((signal) => process.listenerCount(signal));
  const app = createApp({ checkDatabase: async () => {} });
  t.after(() => app.close());
  assert.deepEqual(
    signals.map((signal) => process.listenerCount(signal)),
    before,
  );
});

test("malformed URL framework errors do not echo raw URL components", async (t) => {
  const sensitive = "SYNTHETIC_MALFORMED_URL_SENTINEL";
  const logs: string[] = [];
  const app = createApp({
    checkDatabase: async () => {},
    logger: { stream: { write: (line) => logs.push(line) } },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/broken%FF/${sensitive}`,
  });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { status: "error" });
  assert.equal(`${response.body}${logs.join("")}`.includes(sensitive), false);
});
