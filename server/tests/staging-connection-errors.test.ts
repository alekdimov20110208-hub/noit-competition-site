// Offline only: no staging entrypoint, database query, socket or real credential.
import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkServerIdentity } from "node:tls";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import pg from "pg";
import { createDatabasePool } from "../src/db/pool.ts";
import { stagingOwnerTarget } from "../src/staging/target.ts";
import {
  classifyConnectionFailure,
  createDiagnostics,
  recordFailure,
  safeErrorCode,
} from "../src/staging/diagnostics.ts";

const secret = "SYNTHETIC_CONNECTION_TEST_ONLY";
mkdirSync("tmp", { recursive: true });
const originals = {
  connect: net.Socket.prototype.connect,
  tls: tls.connect,
  dns: dns.lookup,
  fetch: globalThis.fetch,
};
const blocked = () => {
  throw Error("Unexpected network call in offline test.");
};
test.before(() => {
  net.Socket.prototype.connect = blocked as typeof net.Socket.prototype.connect;
  tls.connect = blocked as typeof tls.connect;
  dns.lookup = blocked as unknown as typeof dns.lookup;
  globalThis.fetch = blocked as typeof globalThis.fetch;
});
test.after(() => {
  net.Socket.prototype.connect = originals.connect;
  tls.connect = originals.tls;
  dns.lookup = originals.dns;
  globalThis.fetch = originals.fetch;
});
const ca =
  "C:/Users/Lenovo/.codex/codex-remote-attachments/01a18be2-4c1d-77e2-9fd0-04105fa33ac9/EF5EA47E-78B7-408E-A264-964A198AEC9A/1-prod-ca-2021-1-.crt";

test("Connection codes produce closed reasons without exposing Error fields", () => {
  for (const [code, reason, safe] of [
    ["ENOTFOUND", "dns", "CONNECTION_FAILED"],
    ["EAI_AGAIN", "dns", "CONNECTION_FAILED"],
    ["EHOSTUNREACH", "network_unreachable", "CONNECTION_FAILED"],
    ["ECONNREFUSED", "refused", "CONNECTION_FAILED"],
    ["ECONNRESET", "reset", "CONNECTION_FAILED"],
    ["ETIMEDOUT", "timeout", "CONNECTION_FAILED"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "tls", "TLS_FAILURE"],
    ["28P01", "authentication", "AUTHENTICATION_FAILED"],
    ["42501", "permission", "DATABASE_PERMISSION_DENIED"],
    ["08006", "protocol", "CONNECTION_FAILED"],
  ]) {
    const error = Object.assign(new Error(secret), {
      code,
      detail: secret,
      cause: secret,
    });
    const result = classifyConnectionFailure(error);
    assert.deepEqual(result, {
      errorCode: safe,
      reason,
      classification: "driver_code",
    });
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});

test("Only exact code-less driver timeout literals are classified; ambiguity stays unknown", () => {
  for (const literal of [
    "Connection terminated due to connection timeout",
    "timeout exceeded when trying to connect",
    "timeout expired",
  ]) {
    assert.deepEqual(classifyConnectionFailure(new Error(literal)), {
      errorCode: "CONNECTION_FAILED",
      reason: "timeout",
      classification: "exact_driver_timeout",
    });
    assert.equal(
      classifyConnectionFailure(new Error(literal + " " + secret)).reason,
      "unclassified",
    );
  }
  const unknown = {
    errorCode: "UNKNOWN",
    reason: "unclassified",
    classification: "unclassified",
  };
  for (const error of [
    null,
    secret,
    new Error(secret),
    { code: secret },
    { code: "toString" },
  ])
    assert.deepEqual(classifyConnectionFailure(error), unknown);
  assert.deepEqual(
    classifyConnectionFailure(
      Object.assign(new Error("timeout expired"), { code: secret }),
    ),
    unknown,
  );
  // The general non-connection classifier retains its original no-message behavior.
  assert.equal(safeErrorCode(new Error("timeout expired")), "UNKNOWN");
});

test("Classifier does not execute getters or inspect stack/cause", () => {
  let reads = 0;
  const hostile = Object.defineProperties(
    {},
    Object.fromEntries(
      ["code", "message", "stack", "cause", "detail"].map((key) => [
        key,
        {
          get() {
            reads++;
            throw Error(secret);
          },
        },
      ]),
    ),
  );
  assert.equal(classifyConnectionFailure(hostile).reason, "unclassified");
  assert.equal(reads, 0);
  assert.equal(
    classifyConnectionFailure(
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            throw Error(secret);
          },
        },
      ),
    ).reason,
    "unclassified",
  );
});

test("Installed pg-pool timeout without a socket reproduces the diagnostic gap", async () => {
  let syntheticConnectCalls = 0;
  class OfflineClient extends EventEmitter {
    callback: ((error: Error) => void) | undefined;
    connection = {
      stream: {
        destroy: () => queueMicrotask(() => this.callback!(new Error(secret))),
      },
    };
    connect(callback: (error: Error) => void) {
      syntheticConnectCalls++;
      this.callback = callback;
    }
    end() {}
  }
  // Injected Client has no network/SQL implementation. No actual pg Client connects.
  const pool = new pg.Pool({
    Client: OfflineClient as unknown as typeof pg.Client,
    max: 1,
    connectionTimeoutMillis: 10,
  });
  try {
    const error = await pool.connect().then(
      () => assert.fail("Unexpected success"),
      (error) => error,
    );
    assert.equal(syntheticConnectCalls, 1);
    assert.equal(error.code, undefined);
    assert.equal(safeErrorCode(error), "UNKNOWN");
    assert.deepEqual(classifyConnectionFailure(error), {
      errorCode: "CONNECTION_FAILED",
      reason: "timeout",
      classification: "exact_driver_timeout",
    });
    assert.ok(
      !JSON.stringify(classifyConnectionFailure(error)).includes(secret),
    );
  } finally {
    await pool.end();
  }
});

test("The actual CLI connect catch preserves phase and emits sanitized classification without running CLI", async () => {
  const source = readFileSync("server/scripts/staging-database.ts", "utf8");
  const block = source.match(
    /  try \{\n    db = await pool\.connect\(\);[\s\S]*?\n  \}\n  diagnostics\.connectionEstablished = true;/,
  )![0];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const boundary = new AsyncFunction(
    "pool",
    "diagnostics",
    "classifyConnectionFailure",
    "recordFailure",
    "let db;\n" + block + "\nreturn db;",
  );
  const d = createDiagnostics(false);
  d.phase = "connect";
  d.connectionEstablished = "unknown";
  const error = Object.assign(
    new Error("Connection terminated due to connection timeout"),
    { detail: secret },
  );
  await assert.rejects(
    boundary(
      {
        connect: async () => {
          throw error;
        },
      },
      d,
      classifyConnectionFailure,
      recordFailure,
    ),
    (e) => e === error,
  );
  assert.equal(d.failurePhase, "connect");
  assert.equal(d.errorCode, "CONNECTION_FAILED");
  assert.equal(d.connectionFailure?.reason, "timeout");
  assert.equal(d.connectionEstablished, "unknown");
  assert.equal(d.observations.transactionStarted, false);
  assert.doesNotMatch(
    JSON.stringify(d),
    /SYNTHETIC|terminated due to|detail|stack|postgresql:\/\//,
  );
});

test("Inspect/apply use identical unconnected pg targets, SSL policy and five-second timeout", async () => {
  const host = "aws-1-eu-central-1.pooler.supabase.com";
  const target = stagingOwnerTarget(
    `postgresql://postgres.jlladwdqdillryyfvndo:${secret}@${host}:5432/postgres`,
    host,
  );
  const options: unknown[] = [];
  for (const mode of ["inspect", "apply"]) {
    const pool = createDatabasePool(
      {
        nodeEnv: "production",
        databaseUrl: target.href,
        databaseTls: { mode: "verify-full", caFile: ca },
      },
      () => {},
      { max: 1 },
    );
    try {
      const ssl = pool.options.ssl as {
        ca: string[];
        rejectUnauthorized: boolean;
        minVersion: string;
        checkServerIdentity: unknown;
      };
      assert.equal(ssl.rejectUnauthorized, true);
      assert.equal(ssl.minVersion, "TLSv1.2");
      assert.equal(ssl.checkServerIdentity, checkServerIdentity);
      assert.equal(pool.options.connectionTimeoutMillis, 5000);
      const client = new pg.Client(pool.options);
      options.push({
        target: (client as unknown as { connectionParameters: unknown })
          .connectionParameters,
        ssl: { ...ssl, checkServerIdentity: undefined },
      });
      assert.ok(["inspect", "apply"].includes(mode));
    } finally {
      await pool.end();
    }
  }
  assert.deepEqual(options[0], options[1]);
});

test("Extracted PowerShell URL/clean-environment code preserves synthetic passwords; no launcher runs", () => {
  const dir = mkdtempSync(resolve("tmp/d2-5-connection-offline-"));
  const file = join(dir, "compare.ps1");
  const child = join(dir, "environment-only.cjs");
  writeFileSync(
    child,
    `
const u=new URL(process.env.STAGING_MIGRATOR_URL);
if(u.password!=='SYNTHETIC_CHILD_CREDENTIAL'||process.env.STAGING_RUNTIME_PASSWORD!=='a'.repeat(64)||process.env.DATABASE_TLS_MODE!=='verify-full')throw Error('Synthetic child environment changed.');
process.stdout.write('CHILD_ENV_PRESERVED');
`,
  );
  writeFileSync(
    file,
    String.raw`$ErrorActionPreference='Stop'
$repo='C:\NOIT\noit-competition-site'
$files=@((Join-Path $repo 'scripts/windows/Invoke-StagingInspect-D2.4.3.ps1'),(Join-Path $repo 'scripts/windows/Invoke-StagingApply-D2.5.ps1'))
$scripts=@($files | ForEach-Object {[IO.File]::ReadAllText($_)})
$urls=@();$environments=@()
$dbUser='postgres.jlladwdqdillryyfvndo';$dbHost='aws-1-eu-central-1.pooler.supabase.com'
foreach($sample in @('SYNTHETIC:with/@?#% &+=','SYNTHETIC''quote"slash\',('SYNTHETIC-'+[char]0x0436+[char]0x00a0))) {
  $secure=ConvertTo-SecureString -String $sample -AsPlainText -Force
  $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);$ownerPlain=$plain
    $encoded=[Uri]::EscapeDataString($plain)
    $pair=@()
    foreach($source in $scripts){$line=@($source -split '\r?\n' | Where-Object {$_ -match '^\s*\$url = ''postgresql://'' \+'});if($line.Count -ne 1){throw 'URL statement not unique'};. ([ScriptBlock]::Create($line[0]));$pair+=,$url}
    if($pair[0] -cne $pair[1]){throw 'Encoded URL differs'}
    $u=[Uri]::new($pair[0]);$encodedPassword=$u.UserInfo.Substring($u.UserInfo.IndexOf(':')+1)
    if([Uri]::UnescapeDataString($encodedPassword) -cne $sample){throw 'Password round-trip failed'}
  } finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$secure.Dispose()}
}
foreach($file in $files){
  $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)
  $function=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'CleanProcess'},$true))
  if($errors.Count -or $function.Count -ne 1){throw 'Function extraction failed'}
  . ([ScriptBlock]::Create($function[0].Extent.Text))
  $info=CleanProcess 'SYNTHETIC-NOT-EXECUTED.exe' 'SYNTHETIC'
  foreach($key in @('DATABASE_URL','PGPASSWORD','PGHOST','NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','STAGING_MIGRATOR_URL','STAGING_RUNTIME_PASSWORD')){if($info.EnvironmentVariables.ContainsKey($key)){throw 'Ambient credential forwarded'}}
  $environments+=,@($info.EnvironmentVariables.Keys | Sort-Object)
  $info.EnvironmentVariables.Clear()
}
if(Compare-Object $environments[0] $environments[1]){throw 'Environment allowlists differ'}
$info=CleanProcess '${process.execPath.replaceAll("'", "''")}' '"${child.replaceAll("'", "''")}"'
$info.EnvironmentVariables['STAGING_MIGRATOR_URL']='postgresql://postgres.jlladwdqdillryyfvndo:SYNTHETIC_CHILD_CREDENTIAL@aws-1-eu-central-1.pooler.supabase.com:5432/postgres'
$info.EnvironmentVariables['STAGING_RUNTIME_PASSWORD']=('a'*64)
$info.EnvironmentVariables['DATABASE_TLS_MODE']='verify-full'
$p=[Diagnostics.Process]::new();$p.StartInfo=$info
try {
  if(-not $p.Start()){throw 'Synthetic child did not start'}
  $info.EnvironmentVariables.Clear()
  $outputTask=$p.StandardOutput.ReadToEndAsync();$errorTask=$p.StandardError.ReadToEndAsync()
  $p.WaitForExit();$output=$outputTask.GetAwaiter().GetResult();$errorOutput=$errorTask.GetAwaiter().GetResult()
  if($p.ExitCode -ne 0 -or $output -cne 'CHILD_ENV_PRESERVED' -or $errorOutput){throw 'Synthetic child environment test failed'}
} finally {$info.EnvironmentVariables.Clear();$p.Dispose()}
Write-Output 'LOCAL_SETUP_EQUIVALENT'
`,
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
        key,
      ),
    ),
  );
  Object.assign(env, {
    DATABASE_URL: secret,
    PGPASSWORD: secret,
    NODE_OPTIONS: secret,
    STAGING_RUNTIME_PASSWORD: secret,
  });
  const result = spawnSync(
    join(
      process.env.SystemRoot!,
      "System32/WindowsPowerShell/v1.0/powershell.exe",
    ),
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "RemoteSigned",
      "-File",
      file,
    ],
    { env, windowsHide: true, encoding: "utf8", timeout: 15000 },
  );
  assert.equal(result.status, 0, "Extracted local setup comparison failed.");
  assert.equal(result.stdout.trim(), "LOCAL_SETUP_EQUIVALENT");
  assert.ok(!result.stderr.includes(secret));
});
