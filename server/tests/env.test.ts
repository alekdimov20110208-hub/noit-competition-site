import assert from "node:assert/strict";
import test from "node:test";
import { EnvironmentError, readServerEnv } from "../src/config/env.ts";

// Reserved .invalid host and unmistakable synthetic test markers; no real credentials.
const databaseUrl =
  "postgresql://SYNTHETIC_USER:SYNTHETIC_SECRET@database.invalid/SYNTHETIC_DATABASE";

test("environment uses safe local defaults and returns only typed configuration", () => {
  const config = readServerEnv({
    DATABASE_URL: databaseUrl,
    UNRELATED_SECRET: "OMIT_ME",
  });
  assert.deepEqual(config, {
    nodeEnv: "development",
    host: "127.0.0.1",
    port: 3001,
    databaseUrl,
  });
  assert.ok(Object.isFrozen(config));
});

test("environment accepts explicit supported runtime values", () => {
  for (const nodeEnv of ["development", "test", "production"]) {
    for (const host of ["localhost", "0.0.0.0", "::1", "api.example.invalid"]) {
      assert.deepEqual(
        readServerEnv({
          NODE_ENV: nodeEnv,
          HOST: host,
          PORT: "65535",
          DATABASE_URL: databaseUrl,
        }),
        {
          nodeEnv,
          host,
          port: 65535,
          databaseUrl,
        },
      );
    }
  }
  assert.equal(
    readServerEnv({
      PORT: "1",
      DATABASE_URL: "postgres://database.invalid/example",
    }).port,
    1,
  );
});

test("database configuration is required even in test mode for database commands", () => {
  for (const NODE_ENV of ["test", "development", "production"]) {
    assert.throws(
      () => readServerEnv({ NODE_ENV }),
      /DATABASE_URL is required/,
    );
  }
});

test("environment rejects invalid ports, environments, hosts, and database URLs safely", () => {
  const invalidEnvironments = [
    ...[
      "0",
      "65536",
      "1.5",
      "NaN",
      "-1",
      "",
      " 3001",
      "1e3",
      "SYNTHETIC_SECRET",
    ].map((PORT) => ({ PORT })),
    ...["staging", "", "SYNTHETIC_SECRET"].map((NODE_ENV) => ({ NODE_ENV })),
    ...[
      "",
      "http://localhost",
      "SYNTHETIC_USER:SYNTHETIC_SECRET@host",
      "-invalid",
      "a".repeat(64),
    ].map((HOST) => ({ HOST })),
    ...[
      "",
      "SYNTHETIC_SECRET",
      "https://SYNTHETIC_USER:SYNTHETIC_SECRET@database.invalid/example",
      "postgresql://database.invalid",
      "postgresql:///example",
      databaseUrl + "#SYNTHETIC_SECRET",
      databaseUrl + " ",
      "postgresql://REPLACE_USER:REPLACE_PASSWORD@REPLACE_HOST/REPLACE_DATABASE",
    ].map((DATABASE_URL) => ({ DATABASE_URL })),
  ];
  for (const invalid of invalidEnvironments) {
    assert.throws(
      () => readServerEnv({ DATABASE_URL: databaseUrl, ...invalid }),
      (error: unknown) => {
        assert.ok(error instanceof EnvironmentError);
        assert.doesNotMatch(
          error.message,
          /SYNTHETIC_SECRET|SYNTHETIC_USER|postgresql:\/\/|https:\/\/|REPLACE_PASSWORD/,
        );
        return true;
      },
    );
  }
});
