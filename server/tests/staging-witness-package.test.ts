// Only static source checks and isolated pure PowerShell validator functions.
// Neither launcher main, installer main, nor staging CLI is ever invoked.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const file = resolve("scripts/windows/Invoke-StagingInspect-D2.4.3.ps1");
const launcher = readFileSync(file, "utf8");
test("Windows package: all 18 exact source pins match", () => {
  const pins = [...launcher.matchAll(/^    '([^']+)' = '([a-f0-9]{64})'$/gm)];
  assert.equal(pins.length, 18);
  for (const [, path, expected] of pins)
    assert.equal(
      createHash("sha256").update(readFileSync(path!)).digest("hex"),
      expected,
    );
});
test("Windows package: third attempt is gated and all five historical artifacts are pinned", () => {
  assert.ok(
    launcher.indexOf("Require ([bool]$OwnerApprovedThirdInspect)") <
      launcher.indexOf("$secure = Read-Host"),
  );
  assert.doesNotMatch(launcher, /OwnerApprovedSecondInspect/);
  for (const hash of [
    "ac4fb8994ef26e041f1ba8a33d5d7a2540ac7ad751284fe09d42941ac736ac9c",
    "8b89902e314e54cdca0d970456b858244a21f4e90a3f7ac37261769b08a0a2ae",
    "7a12e4168f7fb595749b9841666ab0c6bbe24e020dc85dfe0543cee8928a2140",
    "5cfcdd01b2838385218b23bfec19fdd3281d5ebbfe506f334a95f4667ad30199",
    "90a868f956a8f0d95241626554c71ce257dae231a4aff78be50300183b439294",
  ])
    assert.ok(launcher.includes(hash));
  assert.match(launcher, /D2\.4\.3-inspect-started\.claim/);
  assert.match(launcher, /D2_4_3_STAGING_INSPECT\.json/);
  assert.match(launcher, /FileMode\]::CreateNew/);
  assert.match(launcher, /staging:db inspect/);
  const installer = readFileSync(
    "scripts/windows/Install-StagingInspect-D2.4.3.ps1",
    "utf8",
  );
  assert.ok(
    installer.includes(
      createHash("sha256").update(readFileSync(file)).digest("hex"),
    ),
  );
  assert.doesNotMatch(installer, /Read-Host|staging:db inspect|Process\]::/);
});

test(
  "Isolated PowerShell validators retain predicates, reject invalid types, and suppress untrusted fields; launcher NOT executed",
  { skip: process.platform !== "win32" },
  () => {
    const root = resolve("tmp/d2-4-3");
    mkdirSync(root, { recursive: true });
    const dir = mkdtempSync(join(root, "validator-"));
    const script = join(dir, "test-pure-validator.ps1");
    const base = {
      schemaVersion: 1,
      mode: "inspect",
      projectRef: "jlladwdqdillryyfvndo",
      host: "aws-1-eu-central-1.pooler.supabase.com",
      caSha256:
        "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7",
      status: "PASS",
      phase: "report_write",
      failurePhase: null,
      errorCode: "NONE",
      rollbackStatus: "confirmed",
      rollbackErrorCode: "NONE",
      connectionCloseStatus: "confirmed",
      connectionCloseErrorCode: "NONE",
      connectionEstablished: true,
      observations: {
        transactionStarted: true,
        serverWitnessVerified: true,
        initialCatalogVerified: true,
        clientEndObserved: true,
        poolEndResolved: true,
      },
      serverWitness: {
        connectionMode: "session_pooler",
        clientTls: "verified",
        backendTls: "not_encrypted",
        checks: {
          clientTls: "passed",
          database: "passed",
          sessionUser: "passed",
          currentUser: "passed",
          postgresVersion: "passed",
          systemIdentifier: "passed",
          backendTlsPolicy: "passed",
        },
      },
      report: {
        projectRef: "jlladwdqdillryyfvndo",
        databaseId: "bce50118-4829-42e0-86cd-1cb41de8b1ba",
        fingerprint: "a".repeat(64),
      },
    };
    writeFileSync(
      script,
      `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile('${file.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
if(@($errors).Count -ne 0){throw 'Parse failure'}
$defs=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and @('Require','SafeDiagnostic') -contains $node.Name},$true))
if($defs.Count -ne 2){throw 'Unexpected definitions'}
$text=($defs | ForEach-Object {$_.Extent.Text}) -join [Environment]::NewLine
if($text -match 'Diagnostics\.Process|Read-Host|Start-Process|Invoke-Expression|FileStream|pnpm'){throw 'Unsafe validator dependency'}
. ([ScriptBlock]::Create($text))
$project='jlladwdqdillryyfvndo';$databaseId='bce50118-4829-42e0-86cd-1cb41de8b1ba';$dbHost='aws-1-eu-central-1.pooler.supabase.com';$caHash='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'
$base='${JSON.stringify(base)}'
function Fresh { $base | ConvertFrom-Json }
function Rejected($value){$rejected=$false;try{$null=SafeDiagnostic $value}catch{$rejected=$true};if(-not $rejected){throw 'Expected rejection'}}
$r=Fresh;$safe=SafeDiagnostic $r;if($safe.serverWitness.backendTls -cne 'not_encrypted'){throw 'Lost upstream status'}
$r=Fresh;$r.status='STOP';$r.failurePhase='server_witness';$r.errorCode='SERVER_IDENTITY_MISMATCH';$r.serverWitness.checks.currentUser='failed';$r | Add-Member rawSecret 'SYNTHETIC_UNTRUSTED';$safe=SafeDiagnostic $r;if($safe.serverWitness.checks.currentUser -cne 'failed'){throw 'Lost predicate'};if(($safe|ConvertTo-Json -Depth 8)-match 'SYNTHETIC_UNTRUSTED'){throw 'Unsafe field copy'}
$r=Fresh;$r.status='STOP';$r.serverWitness.checks.currentUser='unknown';$safe=SafeDiagnostic $r;if($safe.serverWitness.checks.currentUser -cne 'unknown'){throw 'Lost unknown'}
$r=Fresh;$r.status='STOP';$r.serverWitness.checks.currentUser=@('failed','SYNTHETIC_UNTRUSTED');Rejected $r
$r=Fresh;$r.serverWitness.clientTls='unknown';Rejected $r
$r=Fresh;$r.serverWitness.backendTls='unknown';Rejected $r
$r=Fresh;$r.serverWitness.connectionMode='unknown';Rejected $r
$r=Fresh;$r.connectionEstablished=@('unknown','SYNTHETIC_UNTRUSTED');Rejected $r
Write-Output 'PURE_VALIDATORS_PASS_8'
`,
    );
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) =>
        /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
          key,
        ),
      ),
    );
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
        script,
      ],
      { env, encoding: "utf8", windowsHide: true, timeout: 15000 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stdout.trim(), "PURE_VALIDATORS_PASS_8");
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /SYNTHETIC_UNTRUSTED|postgresql:\/\//,
    );
  },
);
