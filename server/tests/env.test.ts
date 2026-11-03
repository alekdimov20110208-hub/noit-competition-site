import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { syntheticOperationalEnvironment } from "./helpers/operational-secrets.ts";
import {
  EnvironmentError,
  readDatabaseEnv,
  readServerEnv,
} from "../src/config/env.ts";

// Reserved .invalid host and unmistakable synthetic test markers; no real credentials.
const databaseUrl =
  "postgresql://SYNTHETIC_USER:SYNTHETIC_SECRET@database.invalid/SYNTHETIC_DATABASE";
const databaseTls = {
  mode: "verify-full" as const,
  caFile: "SYNTHETIC_CA_FILE.pem",
};

test("environment uses safe local defaults and returns only typed configuration", () => {
  const config = readDatabaseEnv({
    DATABASE_URL: databaseUrl,
    DATABASE_TLS_CA_FILE: databaseTls.caFile,
    UNRELATED_SECRET: "OMIT_ME",
  });
  assert.deepEqual(config, {
    nodeEnv: "development",
    host: "127.0.0.1",
    port: 3001,
    databaseUrl,
    databaseTls,
  });
  assert.ok(Object.isFrozen(config));
});

test("environment accepts explicit supported runtime values", () => {
  for (const nodeEnv of ["development", "test", "production"]) {
    for (const host of ["localhost", "0.0.0.0", "::1", "api.example.invalid"]) {
      assert.deepEqual(
        readDatabaseEnv({
          NODE_ENV: nodeEnv,
          HOST: host,
          PORT: "65535",
          DATABASE_URL: databaseUrl,
          DATABASE_TLS_CA_FILE: databaseTls.caFile,
        }),
        {
          nodeEnv,
          host,
          port: 65535,
          databaseUrl,
          databaseTls,
        },
      );
    }
  }
  assert.equal(
    readDatabaseEnv({
      PORT: "1",
      DATABASE_URL: "postgres://database.invalid/example",
      DATABASE_TLS_CA_FILE: databaseTls.caFile,
    }).port,
    1,
  );
});

test("database configuration is required even in test mode for database commands", () => {
  for (const NODE_ENV of ["test", "development", "production"]) {
    assert.throws(
      () => readDatabaseEnv({ NODE_ENV }),
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
      () => readDatabaseEnv({ DATABASE_URL: databaseUrl, ...invalid }),
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

test("auth-capable runtime requires its secret and explicit URL", () => {
  const secret = randomBytes(32).toString("hex");
  const config = readServerEnv({
    DATABASE_URL: databaseUrl,
    DATABASE_TLS_CA_FILE: databaseTls.caFile,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: "http://127.0.0.1:3001/",
    UNRELATED_SECRET: "OMIT_ME",
  });
  assert.deepEqual(config, {
    nodeEnv: "development",
    host: "127.0.0.1",
    port: 3001,
    databaseUrl,
    databaseTls,
    betterAuthSecret: secret,
    betterAuthUrl: "http://127.0.0.1:3001",
    publicAppUrl: "http://127.0.0.1:3001",
    publicSignupEnabled: false,
    emailMode: "disabled",
  });
  assert.ok(Object.isFrozen(config));
  assert.equal(
    readServerEnv({
      NODE_ENV: "production",
      ...syntheticOperationalEnvironment(),
      DATABASE_URL: databaseUrl,
      DATABASE_TLS_CA_FILE: databaseTls.caFile,
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: "https://auth.example.invalid",
      EMAIL_FROM: "BudoGraph <no-reply@example.invalid>",
      RESEND_API_KEY: `re_${randomBytes(20).toString("hex")}`,
    }).betterAuthUrl,
    "https://auth.example.invalid",
  );
});

test("auth configuration failures never print rejected secrets or URL values", () => {
  const secret = randomBytes(32).toString("hex");
  const invalid = [
    ...[
      undefined,
      "",
      "SHORT_SECRET",
      "x".repeat(64),
      "REPLACE_AUTH_SECRET",
    ].map((BETTER_AUTH_SECRET) => ({ BETTER_AUTH_SECRET })),
    ...[
      undefined,
      "",
      "https://name:SYNTHETIC_SECRET@auth.example.invalid",
      "ftp://auth.example.invalid",
      "https://auth.example.invalid/path",
      "https://auth.example.invalid?secret=SYNTHETIC_SECRET",
      "https://auth.example.invalid#SYNTHETIC_SECRET",
      "http://REPLACE_HOST",
    ].map((BETTER_AUTH_URL) => ({ BETTER_AUTH_URL })),
    { NODE_ENV: "production", BETTER_AUTH_URL: "http://auth.example.invalid" },
  ];
  for (const fields of invalid) {
    assert.throws(
      () =>
        readServerEnv({
          DATABASE_URL: databaseUrl,
          DATABASE_TLS_CA_FILE: databaseTls.caFile,
          BETTER_AUTH_SECRET: secret,
          BETTER_AUTH_URL: "http://127.0.0.1:3001",
          ...fields,
        }),
      (error: unknown) => {
        assert.ok(error instanceof EnvironmentError);
        assert.doesNotMatch(
          error.message,
          /SYNTHETIC_SECRET|SHORT_SECRET|name:|auth\.example|https:\/\//,
        );
        assert.equal(error.message.includes(secret), false);
        return true;
      },
    );
  }
});
