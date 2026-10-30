import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import {
  readProductionDatabaseIdentity,
  validateRuntimeConnection,
  verifyProductionDatabaseIdentity,
} from "../src/db/identity.ts";

// Synthetic identity only. These tests never connect to PostgreSQL or Resend.
const projectRef = "abcdefghijklmnopqrst";
const productionRef = "bdcjascqqvzmmlvabhgv";
const host = `db.${projectRef}.supabase.co`;
const sessionHost = "aws-0-eu-central-1.pooler.supabase.com";
const env = {
  NODE_ENV: "production",
  BUDOGRAPH_DEPLOYMENT_ENV: "staging",
  EXPECTED_DATABASE_ID: "00000000-0000-4000-8000-000000000002",
  EXPECTED_SUPABASE_PROJECT_REF: projectRef,
  EXPECTED_DATABASE_HOST: host,
};
const url = (hostname = host, username = "budograph_runtime", port = "5432") =>
  `postgresql://${username}:synthetic@${hostname}:${port}/postgres`;

test("staging retains production security and accepts only its pinned direct/session target", () => {
  const expected = readProductionDatabaseIdentity(env);
  assert.equal(expected.environment, "staging");
  validateRuntimeConnection(url(), expected);
  validateRuntimeConnection(
    url(sessionHost, `budograph_runtime.${projectRef}`),
    readProductionDatabaseIdentity({
      ...env,
      EXPECTED_DATABASE_HOST: sessionHost,
    }),
  );
  assert.equal(
    readProductionDatabaseIdentity({
      EXPECTED_DATABASE_ID: env.EXPECTED_DATABASE_ID,
      EXPECTED_SUPABASE_PROJECT_REF: productionRef,
    }).environment,
    "production",
  );
});

for (const [name, change] of Object.entries({
  "Production project": { EXPECTED_SUPABASE_PROJECT_REF: productionRef },
  "Production host": {
    EXPECTED_DATABASE_HOST: `db.${productionRef}.supabase.co`,
  },
  "missing host": { EXPECTED_DATABASE_HOST: undefined },
  "unverified host": { EXPECTED_DATABASE_HOST: "database.invalid" },
  "unknown deployment environment": { BUDOGRAPH_DEPLOYMENT_ENV: "preview" },
  "development security mode": { NODE_ENV: "development" },
})) {
  test(`staging rejects ${name} before database I/O`, () => {
    assert.throws(() => readProductionDatabaseIdentity({ ...env, ...change }));
  });
}

for (const [name, target] of Object.entries({
  "Production direct URL": url(`db.${productionRef}.supabase.co`),
  "Production pooler username": url(
    sessionHost,
    `budograph_runtime.${productionRef}`,
  ),
  "encoded Production username": url(
    sessionHost,
    `budograph_runtime%2E${productionRef}`,
  ),
  "owner role": url(host, "postgres"),
  "migrator role": url(host, "budograph_migrator"),
  "different host": url(`db.ponmlkjihgfedcbatsrq.supabase.co`),
  "transaction pooler": url(host, "budograph_runtime", "6543"),
  "different port": url(host, "budograph_runtime", "5433"),
  "different database": url().replace("/postgres", "/other"),
  "URL override": url() + "?host=database.invalid",
  "URL fragment": url() + "#hidden",
  "absent password": url().replace(":synthetic@", "@"),
})) {
  test(`staging rejects ${name} without disclosing connection credentials`, () => {
    assert.throws(
      () =>
        validateRuntimeConnection(target, readProductionDatabaseIdentity(env)),
      (error: Error) => !error.message.includes("synthetic"),
    );
  });
}

test("staging session pooler requires the project-qualified runtime username", () => {
  const expected = readProductionDatabaseIdentity({
    ...env,
    EXPECTED_DATABASE_HOST: sessionHost,
  });
  assert.throws(() => validateRuntimeConnection(url(sessionHost), expected));
});

test("each identity SELECT requires staging, its UUID/project and the existing least-privilege role", async () => {
  const expected = readProductionDatabaseIdentity(env);
  const row = {
    database_id: expected.databaseId,
    project_ref: projectRef,
    environment: "staging",
    runtime_role: "budograph_runtime",
    safe_role: true,
  };
  const verify = (rows: unknown[]) =>
    verifyProductionDatabaseIdentity(
      {
        query: async (query: { text: string }) => {
          assert.match(query.text, /^SELECT /);
          return { rows };
        },
      } as Parameters<typeof verifyProductionDatabaseIdentity>[0],
      expected,
    );
  await verify([row]);
  for (const rows of [
    [],
    [row, row],
    [{ ...row, environment: "production" }],
    [{ ...row, database_id: "00000000-0000-4000-8000-000000000001" }],
    [{ ...row, project_ref: productionRef }],
    [{ ...row, runtime_role: "postgres" }],
    [{ ...row, safe_role: false }],
  ])
    await assert.rejects(verify(rows), /identity verification failed/);
});

test(
  "compiled startup rejects Production target and missing email inputs before any network attempt",
  {
    skip: process.env.BUDOGRAPH_TEST_COMPILED_STAGING !== "1",
  },
  () => {
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter(([key]) =>
        /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
          key,
        ),
      ),
    );
    const offline =
      "data:text/javascript," +
      encodeURIComponent(`
    import net from 'node:net'; import tls from 'node:tls'; import {syncBuiltinESMExports} from 'node:module';
    const blocked=()=>{process.stderr.write('NETWORK_ATTEMPT_BLOCKED'); process.exit(91);};
    net.Socket.prototype.connect=blocked; net.connect=blocked; net.createConnection=blocked;
    tls.connect=blocked; globalThis.fetch=blocked; syncBuiltinESMExports();
  `);
    const valid = {
      ...inherited,
      ...env,
      DATABASE_URL: url(),
      DATABASE_TLS_MODE: "verify-full",
      DATABASE_TLS_CA_FILE: resolve("tmp/d2-2-intentionally-absent-ca.pem"),
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      BETTER_AUTH_URL: "https://staging.example.invalid",
      PUBLIC_APP_URL: "https://staging.example.invalid",
      EMAIL_MODE: "resend",
      EMAIL_FROM: "sender@example.invalid",
      RESEND_API_KEY: "re_" + randomBytes(20).toString("hex"),
      RATE_LIMIT_HMAC_KEY: randomBytes(32).toString("base64"),
      EMAIL_OUTBOX_KEY_ID: "test",
      EMAIL_OUTBOX_KEYS: JSON.stringify({
        test: randomBytes(32).toString("base64"),
      }),
    };
    const cases: [Record<string, string | undefined>, RegExp][] = [
      [{ EXPECTED_SUPABASE_PROJECT_REF: productionRef }, /Staging requires/],
      [
        { DATABASE_URL: url(`db.${productionRef}.supabase.co`) },
        /Staging requires/,
      ],
      [{ EXPECTED_DATABASE_HOST: undefined }, /EXPECTED_DATABASE_HOST/],
      [{ EMAIL_MODE: "disabled" }, /production requires resend/],
      [{ EMAIL_FROM: undefined }, /EMAIL_FROM/],
      [{ RESEND_API_KEY: undefined }, /RESEND_API_KEY/],
    ];
    for (const [change, message] of cases) {
      const result = spawnSync(
        process.execPath,
        ["--import", offline, "server/dist/src/production.js"],
        {
          env: { ...valid, ...change },
          encoding: "utf8",
          timeout: 15000,
          windowsHide: true,
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1);
      const output = result.stdout + result.stderr;
      assert.match(output, message);
      assert.doesNotMatch(output, /NETWORK_ATTEMPT_BLOCKED/);
      for (const secret of [
        valid.BETTER_AUTH_SECRET,
        valid.RESEND_API_KEY,
        valid.RATE_LIMIT_HMAC_KEY,
      ])
        assert.equal(output.includes(secret), false);
    }
  },
);
