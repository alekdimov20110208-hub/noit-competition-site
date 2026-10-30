// Local Git/index inspection only. No .env loading, database, deploy or push.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

function git(args, binary = false) {
  const result = spawnSync("git", args, {
    encoding: binary ? undefined : "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `Git inspection failed: ${args[0]}`);
  return result.stdout;
}
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(
  git(["branch", "--show-current"]).trim(),
  "staging/render-free-d2-2",
);
assert.equal(
  git(["rev-parse", "refs/heads/main"]).trim(),
  "77816198512cbaba2cd53dab3bb40b65c62a9554",
);
assert.equal(
  git(["config", "--get", "remote.origin.url"]).trim(),
  "https://github.com/alekdimov20110208-hub/noit-competition-site.git",
);
const manifestPath = "server/migrations/production-manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.pins.length, 16);
for (const pin of manifest.pins)
  assert.equal(
    hash(readFileSync(`server/migrations/${pin.name}`)),
    pin.checksum,
    pin.name,
  );

// The original D2/D2.1 records are immutable historical results.
const evidence = JSON.parse(
  readFileSync("docs/evidence/D2_2_SAFE_STAGING_RESULT.json", "utf8"),
);
for (const [file, digest] of Object.entries(evidence.preservedSha256))
  assert.equal(
    hash(readFileSync(file)),
    digest,
    `Preservation failed: ${file}`,
  );
const changedSinceSnapshot = new Set([
  "README.md",
  "docs/AI_ASSISTANCE_LOG.md",
  "render.yaml",
  "scripts/verify-render-free.mjs",
  "server/.env.example",
  "server/src/db/identity.ts",
]);
let unchanged = null;
if (existsSync("tmp/d2-2-before.json")) {
  const before = JSON.parse(readFileSync("tmp/d2-2-before.json", "utf8"));
  unchanged = 0;
  for (const [file, digest] of Object.entries(before.files)) {
    if (changedSinceSnapshot.has(file)) continue;
    assert.equal(
      hash(readFileSync(file)),
      digest,
      `Unexpected modification: ${file}`,
    );
    unchanged++;
  }
}
// No deployment configuration or workflow is introduced for Vercel.
assert.equal(
  git([
    "diff",
    "--name-only",
    "refs/heads/main",
    "--",
    "vercel.json",
    "vercel.ts",
    ".github",
    ".vercel",
  ]).trim(),
  "",
);
const entry = readFileSync("server/src/main.ts", "utf8");
assert.ok(
  entry.indexOf("validateRuntimeConnection(config.databaseUrl, identity)") <
    entry.indexOf("pool = createDatabasePool"),
);
for (const file of [
  "scripts/production-build.mjs",
  "server/src/production.ts",
  "server/src/main.ts",
])
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /production:migrate|scripts\/migrate|runMigrations|--env-file/,
  );

let scanned = 0;
if (process.argv.includes("--staged")) {
  const paths = git(["diff", "--cached", "--name-only", "-z"])
    .split("\0")
    .filter(Boolean);
  assert.ok(paths.length > 0, "Expected an explicitly staged release");
  assert.deepEqual(
    [...paths].sort(),
    [...evidence.releaseFiles].sort(),
    "Index must contain exactly the reviewed release allowlist",
  );
  const findings = [];
  for (const file of paths) {
    assert.doesNotMatch(
      file,
      /(?:^|\/)\.env(?!\.example$)(?:\.|$)|\.(?:lnk|pem|key|pfx|p12|dump|backup|dpapi)$|(?:^|\/)(?:\.vercel|\.supabase|secrets)(?:\/|$)/i,
    );
    const bytes = git(["show", `:${file}`], true);
    assert.equal(bytes.includes(0), false, `Unexpected binary staged: ${file}`);
    const body = bytes.toString("utf8");
    const patterns = [
      /-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----/g,
      /\b(?:gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|sb_secret_[a-zA-Z0-9_-]{20,}|sbp_[a-f0-9]{30,})/g,
      /\beyJ[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
      /\bre_[a-zA-Z0-9_-]{16,}/g,
      /postgres(?:ql)?:\/\/[^\s"'`<>]+:[^\s"'`<>]+@/g,
      /(?:BETTER_AUTH_SECRET|RATE_LIMIT_HMAC_KEY|RESEND_API_KEY|PASSWORD)\s*[:=]\s*["'][^"'\r\n]{20,}["']/gi,
    ];
    for (const pattern of patterns)
      for (const match of body.matchAll(pattern)) {
        // Explicit source placeholders, generated expressions and named synthetic
        // test fixtures are reviewed examples, never usable deployment inputs.
        if (
          /REPLACE_|\$\{|synthetic|example|randomBytes|\.repeat\(/i.test(
            match[0],
          )
        )
          continue;
        findings.push({
          file,
          line: body.slice(0, match.index).split("\n").length,
        });
      }
    scanned++;
  }
  if (findings.length) {
    console.error(
      JSON.stringify({ status: "BLOCKED", locationsOnly: findings }),
    );
    process.exit(1);
  }
  // SQL index bytes must retain the approved checksums too.
  for (const pin of manifest.pins)
    assert.equal(
      hash(git(["show", `:server/migrations/${pin.name}`], true)),
      pin.checksum,
    );
}
console.log(
  JSON.stringify(
    {
      status: "PASS",
      branch: "staging/render-free-d2-2",
      mainUnchanged: true,
      migrationPins: 16,
      preservedHistoricalFiles: Object.keys(evidence.preservedSha256).length,
      unchangedSnapshotFiles: unchanged,
      stagedFilesScanned: scanned,
      secretPatternFindings: 0,
      startupMigrations: 0,
      vercelConfigChanges: 0,
      limits:
        "Pattern scan plus reviewed staged diff; not a whole-history secret certification or live deployment test",
    },
    null,
    2,
  ),
);
