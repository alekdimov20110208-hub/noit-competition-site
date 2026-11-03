// New probe tests only. All network APIs blocked; no remote entrypoint is run.
import assert from "node:assert/strict";
import test from "node:test";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  existsSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import {
  PROBE,
  probeTarget,
  connectOnly,
  reserveProbeFiles,
} from "../scripts/staging-connection-probe.ts";
import { offlineStagingClient } from "./helpers/offline-staging-client.ts";

const originals = {
  net: net.Socket.prototype.connect,
  tls: tls.connect,
  dns: dns.lookup,
  fetch: globalThis.fetch,
};
const blocked = () => {
  throw Error("Unexpected network in probe offline test.");
};
test.before(() => {
  net.Socket.prototype.connect = blocked as typeof net.Socket.prototype.connect;
  tls.connect = blocked as typeof tls.connect;
  dns.lookup = blocked as unknown as typeof dns.lookup;
  globalThis.fetch = blocked as typeof globalThis.fetch;
});
test.after(() => {
  net.Socket.prototype.connect = originals.net;
  tls.connect = originals.tls;
  dns.lookup = originals.dns;
  globalThis.fetch = originals.fetch;
});
mkdirSync("tmp", { recursive: true });
const root = mkdtempSync(resolve("tmp/d2-5-probe-tests-"));
const secret = "SYNTHETIC_PROBE_ONLY:@/% &+=?";
const env = {
  STAGING_OWNER_APPROVAL: `connect-only:${PROBE.projectRef}`,
  EXPECTED_SUPABASE_PROJECT_REF: PROBE.projectRef,
  EXPECTED_DATABASE_HOST: PROBE.host,
  DATABASE_TLS_MODE: "verify-full",
  DATABASE_TLS_CA_FILE: PROBE.caFile,
  STAGING_CA_SHA256: PROBE.caSha256,
  STAGING_MIGRATOR_URL: `postgresql://${PROBE.username}:${encodeURIComponent(secret)}@${PROBE.host}:5432/postgres`,
};

test("Exact staging target/CA/TLS guards refuse Production and overrides before a pool exists", () => {
  const target = probeTarget(env);
  assert.equal(target.hostname, PROBE.host);
  for (const override of [
    { EXPECTED_SUPABASE_PROJECT_REF: "bdcjascqqvzmmlvabhgv" },
    { EXPECTED_DATABASE_HOST: "aws-0-eu-central-1.pooler.supabase.com" },
    { DATABASE_TLS_MODE: "disable" },
    { STAGING_CA_SHA256: "0".repeat(64) },
    {
      STAGING_MIGRATOR_URL: `postgresql://postgres.bdcjascqqvzmmlvabhgv:x@${PROBE.host}:5432/postgres`,
    },
    { STAGING_MIGRATOR_URL: env.STAGING_MIGRATOR_URL + "?sslmode=disable" },
    { PGPASSWORD: secret },
  ])
    assert.throws(() => probeTarget({ ...env, ...override }));
});

test("Success performs exactly one connect, zero SQL, verified socket and acknowledged close", async () => {
  const { db, stream, target } = offlineStagingClient();
  let connects = 0,
    queries = 0,
    releases = 0,
    ends = 0;
  db.query = (() => {
    queries++;
    throw Error("SQL is forbidden.");
  }) as typeof db.query;
  db.release = (destroy) => {
    assert.equal(destroy, true);
    releases++;
    stream.destroy();
    queueMicrotask(() => db.emit("end"));
  };
  const pool = {
    connect: async () => {
      connects++;
      return db;
    },
    end: async () => {
      ends++;
    },
  };
  const result = await connectOnly(
    pool as unknown as Parameters<typeof connectOnly>[0],
    target,
  );
  assert.deepEqual(
    { connects, queries, releases, ends },
    { connects: 1, queries: 0, releases: 1, ends: 1 },
  );
  assert.equal(result.connectionOutcome, "CONNECTED");
  assert.equal(result.clientTls, "verified");
  assert.equal(result.errorCode, "NONE");
  assert.equal(result.closeStatus, "CONFIRMED");
  assert.ok(
    Number.isInteger(result.elapsedMilliseconds) &&
      result.elapsedMilliseconds >= 0,
  );
});

test("Failures map to six safe categories, close the pool and never retry or expose errors", async () => {
  for (const [code, category] of [
    ["ETIMEDOUT", "TIMEOUT"],
    ["CERT_HAS_EXPIRED", "TLS"],
    ["28P01", "AUTH"],
    ["ECONNREFUSED", "NETWORK"],
    ["ENOTFOUND", "DNS"],
    ["UNRECOGNIZED", "UNKNOWN"],
  ]) {
    let calls = 0,
      ends = 0;
    const error = Object.assign(new Error(secret), { code, detail: secret });
    const pool = {
      connect: async () => {
        calls++;
        throw error;
      },
      end: async () => {
        ends++;
      },
    };
    const result = await connectOnly(
      pool as unknown as Parameters<typeof connectOnly>[0],
      probeTarget(env),
    );
    assert.equal(calls, 1);
    assert.equal(ends, 1);
    assert.equal(result.errorCode, category);
    assert.equal(result.closeStatus, "POOL_CLOSED_NO_CLIENT");
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});

test("Post-connect TLS rejection still closes the client without any query", async () => {
  const { db, stream, target } = offlineStagingClient();
  stream.authorized = false;
  db.query = (() => assert.fail("SQL is forbidden.")) as typeof db.query;
  db.release = () => {
    stream.destroy();
    queueMicrotask(() => db.emit("end"));
  };
  const pool = { connect: async () => db, end: async () => {} };
  const result = await connectOnly(
    pool as unknown as Parameters<typeof connectOnly>[0],
    target,
  );
  assert.equal(result.errorCode, "TLS");
  assert.equal(result.clientTls, "failed");
  assert.equal(result.closeStatus, "CONFIRMED");
});

test("CreateNew claim/report permit one reservation and preserve files on replay", async () => {
  const claim = join(root, "probe.claim"),
    report = join(root, "probe.json");
  const handle = await reserveProbeFiles(claim, report);
  await handle.writeFile("PRESERVE");
  await handle.close();
  const before = readFileSync(claim, "utf8");
  await assert.rejects(reserveProbeFiles(claim, report));
  assert.equal(readFileSync(report, "utf8"), "PRESERVE");
  assert.equal(readFileSync(claim, "utf8"), before);
  const otherClaim = join(root, "other.claim");
  await assert.rejects(reserveProbeFiles(otherClaim, report));
  assert.equal(existsSync(otherClaim), false);
});

test("Probe source uses the shared pool and 5000ms; no SQL/migration/activation entrypoint", () => {
  const source = readFileSync(
    "server/scripts/staging-connection-probe.ts",
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /\.query\s*\(|from ["'][^"']*(?:activation|catalog|migrations)\.ts/,
  );
  assert.equal((source.match(/await pool\.connect\(\)/g) ?? []).length, 1);
  assert.match(source, /connectionTimeoutMillis !== 5000/);
  assert.match(source, /verifyStagingClientTls\(db, target\)/);
});

test("Full PowerShell launcher with fake child isolates secrets and blocks replay; no probe runs", () => {
  const source = readFileSync(
    "scripts/windows/Invoke-StagingConnectionProbe-D2.5.ps1",
    "utf8",
  );
  const repo = join(root, "repo"),
    privateDir = join(root, "private");
  const put = (p: string, bytes: string | Buffer) => {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, bytes);
  };
  const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
  const pins = [...source.matchAll(/^    '([^']+)' = '[a-f0-9]{64}'$/gm)];
  assert.equal(pins.length, 11);
  for (const [, file] of pins) put(join(repo, file!), readFileSync(file!));
  put(join(repo, ".gitignore"), readFileSync(".gitignore"));
  put(
    join(repo, "node_modules/pg/package.json"),
    readFileSync("node_modules/pg/package.json"),
  );
  mkdirSync(join(repo, "tmp/d2-3"), { recursive: true });
  assert.equal(
    spawnSync(
      "git.exe",
      ["-C", repo, "init", "--initial-branch=staging/render-free-d2-2"],
      { windowsHide: true },
    ).status,
    0,
  );
  const fake = join(root, "fake-child.cjs"),
    calls = join(root, "fake-calls.txt");
  const report = join(repo, "tmp/d2-3/D2_5_CONNECTION_PROBE.json");
  put(
    fake,
    `const fs=require('fs');const e=process.env,u=new URL(e.STAGING_MIGRATOR_URL);if(decodeURIComponent(u.password)!==${JSON.stringify(secret)}||e.DATABASE_URL||e.PGPASSWORD||e.NODE_OPTIONS)throw Error('Synthetic isolation failed');fs.appendFileSync(${JSON.stringify(calls)},'1');fs.writeFileSync(${JSON.stringify(join(privateDir, "D2.5-connection-probe.claim"))},'ONE');fs.writeFileSync(${JSON.stringify(report)},JSON.stringify({mode:'connection-only',projectRef:e.EXPECTED_SUPABASE_PROJECT_REF,host:e.EXPECTED_DATABASE_HOST,caSha256:e.STAGING_CA_SHA256,status:'PASS',connectionOutcome:'CONNECTED',errorCode:'NONE',closeStatus:'CONFIRMED',elapsedMilliseconds:3,connectionAttempts:1,sqlStatementsExecuted:0,automaticRetry:false}));process.stdout.write(e.STAGING_MIGRATOR_URL);process.stderr.write(e.STAGING_MIGRATOR_URL);`,
  );
  const launcher = join(
    repo,
    "scripts/windows/Invoke-StagingConnectionProbe-D2.5.ps1",
  );
  put(
    launcher,
    source
      .replace("'C:\\NOIT\\noit-competition-site'", quote(repo))
      .replace(
        "'C:\\Users\\Lenovo\\AppData\\Local\\BudoGraph\\D2.5-ConnectionProbe'",
        quote(privateDir),
      )
      .replace(
        "$info.Arguments = 'server/scripts/staging-connection-probe.ts'",
        "$info.Arguments = " + quote('"' + fake + '"'),
      ),
  );
  const harness = join(root, "run-fixture.ps1");
  put(
    harness,
    `function Read-Host {param([string]$Prompt,[switch]$AsSecureString);if(-not $AsSecureString){throw 'Unmasked input'};ConvertTo-SecureString -String ${quote(secret)} -AsPlainText -Force}\n& ${quote(launcher)}\nexit $LASTEXITCODE\n`,
  );
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([k]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
        k,
      ),
    ),
  );
  const ps = join(
    process.env.SystemRoot!,
    "System32/WindowsPowerShell/v1.0/powershell.exe",
  );
  const run = () =>
    spawnSync(
      ps,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "RemoteSigned",
        "-File",
        harness,
      ],
      {
        env: {
          ...clean,
          DATABASE_URL: secret,
          PGPASSWORD: secret,
          NODE_OPTIONS: secret,
        },
        windowsHide: true,
        encoding: "utf8",
        timeout: 15000,
      },
    );
  const first = run();
  assert.equal(first.status, 0, "Fake-child launcher fixture failed.");
  assert.doesNotMatch(first.stdout + first.stderr, /postgresql:\/\//);
  assert.ok(!(first.stdout + first.stderr).includes(secret));
  const before = createHash("sha256")
    .update(readFileSync(report))
    .digest("hex");
  assert.equal(run().status, 1);
  assert.equal(readFileSync(calls, "utf8"), "1");
  assert.equal(
    createHash("sha256").update(readFileSync(report)).digest("hex"),
    before,
  );
});
