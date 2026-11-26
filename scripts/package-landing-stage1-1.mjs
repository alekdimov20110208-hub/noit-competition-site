// Local RC1 packaging only. No commit, push, merge, network or deployment.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = fs.realpathSync(".");
const baseline = "1199382616a34ee978b713e4393590e91eb62b22";
const out = path.join(root, "tmp/stage1-1-rc1");
const previous = path.join(root, "tmp/stage1-1");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    typeof value === "string" || Buffer.isBuffer(value)
      ? value
      : JSON.stringify(value, null, 2) + "\n",
  );
}
function git(args, { binary = false, env, cwd = root } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: binary ? undefined : "utf8",
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", ...env },
  });
  assert.equal(
    result.status,
    0,
    `${args.join(" ")}: ${result.stderr?.toString()}`,
  );
  return result.stdout;
}
function filesIn(directory, prefix = "") {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      assert.ok(!entry.isSymbolicLink(), "Release inputs must not be symlinks");
      const name = prefix + entry.name;
      return entry.isDirectory()
        ? filesIn(path.join(directory, entry.name), name + "/")
        : [name];
    })
    .sort();
}
const python = (code, args) => {
  const result = spawnSync("python", ["-X", "utf8", "-c", code, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};

assert.equal(git(["rev-parse", "HEAD"]).trim(), baseline);
const indexPath = path.resolve(
  root,
  git(["rev-parse", "--git-path", "index"]).trim(),
);
const realIndexBefore = sha(fs.readFileSync(indexPath));
const refsBefore = git(["for-each-ref", "--format=%(refname) %(objectname)"]);
const freeze = json(path.join(out, "accepted-freeze.json"));
assert.equal(freeze.baseline, baseline);
assert.equal(freeze.humanVisualAcceptance.result, "PASS");
assert.equal(freeze.humanVisualAcceptance.passed, 10);
assert.equal(freeze.humanVisualAcceptance.total, 10);
assert.equal(freeze.files.length, 79);
for (const file of freeze.files)
  assert.equal(
    sha(fs.readFileSync(file.file)),
    file.sha256,
    `Accepted bytes changed: ${file.file}`,
  );
assert.equal(
  sha(
    Buffer.from(
      freeze.files
        .map((file) => file.file + "\0" + file.sha256 + "\n")
        .join(""),
    ),
  ),
  freeze.implementationSha256,
);

const browser = json(path.join(previous, "evidence/browser/report.json"));
assert.equal(browser.baseline, baseline);
assert.equal(browser.selections.length, 96);
assert.equal(
  browser.preservation.filter((entry) => entry.identical).length,
  128,
);
assert.equal(browser.checks.length, 6);
for (const key of ["errors", "consoleErrors", "unexpectedResponses"])
  assert.deepEqual(browser[key], []);
const provenance = json(
  path.join(previous, "evidence/screenshot-provenance.json"),
);
assert.equal(provenance.cases.length, 24);
assert.equal(
  new Set(provenance.cases.map((entry) => entry.originalSha256)).size,
  24,
);
for (const entry of provenance.cases) {
  assert.equal(sha(fs.readFileSync(entry.original)), entry.originalSha256);
  for (const asset of entry.assets)
    assert.equal(sha(fs.readFileSync(asset.file)), asset.sha256);
}

const inventoryPath = "docs/BUDOGRAPH_LANDING_STAGE_1_1_FILES.md";
write(inventoryPath, "# Landing Stage 1.1 final RC1 publication inventory\n");
const modified = git(["diff", "--name-only", "-z", baseline])
  .split("\0")
  .filter(Boolean)
  .sort();
const added = git(["ls-files", "--others", "--exclude-standard", "-z"])
  .split("\0")
  .filter(Boolean)
  .sort();
const files = [...new Set([...modified, ...added])].sort();
const allowed = (file) =>
  file.startsWith("public/landing/product/") ||
  [
    "src/pages/landing/ProductShowcase.tsx",
    "src/pages/landing/product-showcase.css",
    "src/i18n/landingMessages.ts",
    "scripts/capture-landing-stage1-1.mjs",
    "scripts/landing-stage1-1-data.mjs",
    "scripts/preview-landing-stage1-1.mjs",
    "scripts/verify-landing-stage1-1.mjs",
    "scripts/package-landing-stage1-1.mjs",
    "docs/BUDOGRAPH_LANDING_STAGE_1_1.md",
    inventoryPath,
    "docs/AI_ASSISTANCE_LOG.md",
    "docs/THIRD_PARTY_NOTICES.md",
  ].includes(file);
assert.ok(
  files.every(allowed),
  "A file outside the allowed landing/release scope changed",
);
assert.equal(files.length, 84);
assert.equal(modified.length, 11);
assert.equal(added.length, 73);
const runtimeFiles = files.filter(
  (file) => file.startsWith("src/") || file.startsWith("public/"),
);
assert.equal(runtimeFiles.length, 75);
write(
  inventoryPath,
  `# Landing Stage 1.1 final RC1 publication inventory\n\nHuman Visual Acceptance: **PASS — 10/10**, explicitly reported by the owner on 2026-11-26. Implementation and composition A frozen. Publication authorization pending.\n\nBaseline: \`${baseline}\`. No commit, push, merge or deployment.\n\n${files.length} publication paths: ${modified.length} modified, ${added.length} added, 0 deleted. These comprise 75 runtime paths (3 source/localization + 72 WebP assets), 5 local review/packaging scripts and 4 documentation files. The full patch includes all 84 paths.\n\nRaw per-file SHA-256 values (including this inventory), canonical patch hashes and baseline hashes are in \`tmp/stage1-1-rc1/publication/manifest.json\`; \`publication/SHA256SUMS.txt\` verifies the complete raw payload. Hashes are external to this file to avoid a self-referential checksum. Accepted implementation aggregate: \`${freeze.implementationSha256}\`.\n\n| File | Change |\n| --- | --- |\n${files.map((file) => `| \`${file}\` | ${modified.includes(file) ? "Modified" : "Added"} |`).join("\n")}\n`,
);

// A separate index includes new files without staging in the actual worktree.
const validationRoot = path.join(out, "validation");
fs.mkdirSync(validationRoot, { recursive: true });
const indexEnv = {
  GIT_INDEX_FILE: path.join(
    validationRoot,
    `index-${process.pid}-${Date.now()}`,
  ),
};
git(["read-tree", baseline], { env: indexEnv });
git(["add", "--all", "--", ...files], { env: indexEnv });
const publicationPatch = git(
  ["diff", "--cached", "--binary", "--full-index", "--no-ext-diff", baseline],
  { binary: true, env: indexEnv },
);
const rollbackPatch = git(
  [
    "diff",
    "--cached",
    "--binary",
    "--full-index",
    "--no-ext-diff",
    "-R",
    baseline,
  ],
  { binary: true, env: indexEnv },
);
assert.deepEqual(
  git(["diff", "--cached", "--name-only", "-z", baseline], { env: indexEnv })
    .split("\0")
    .filter(Boolean)
    .sort(),
  files,
);
assert.equal(
  (publicationPatch.toString().match(/^GIT binary patch$/gm) ?? []).length,
  72,
);
write(path.join(out, "publication/publication.patch"), publicationPatch);
write(path.join(out, "rollback/rollback.patch"), rollbackPatch);
const manifest = {
  release: "BudoGraph Landing Stage 1.1 RC1",
  status: "OWNER_VISUALLY_ACCEPTED_FROZEN_LOCAL_RC_PUBLICATION_NOT_AUTHORIZED",
  baseline,
  liveDeploy: "dep-dc3v1ht9el5s739o8meg",
  stagingService: "srv-dbj45tg473hc73b4ecog",
  humanVisualAcceptance: freeze.humanVisualAcceptance,
  implementationSha256: freeze.implementationSha256,
  publicationPatchSha256: sha(publicationPatch),
  rollbackPatchSha256: sha(rollbackPatch),
  textHashConvention:
    "sha256 hashes raw payload bytes; patchSha256 hashes Git-normalized content reconstructed by the patch. Binary hashes are identical. Accepted implementation bytes remain frozen.",
  files: [],
  newFiles: added,
  runtimeFiles,
};
for (const file of files) {
  const body = fs.readFileSync(file),
    canonical = git(["show", `:${file}`], { binary: true, env: indexEnv });
  const entry = {
    file,
    change: modified.includes(file) ? "modified" : "added",
    bytes: body.length,
    sha256: sha(body),
    patchSha256: sha(canonical),
  };
  write(path.join(out, "publication/payload", file), body);
  if (modified.includes(file)) {
    const original = git(["cat-file", "--filters", `${baseline}:${file}`], {
      binary: true,
    });
    entry.baselineSha256 = sha(original);
    entry.baselinePatchSha256 = sha(
      git(["show", `${baseline}:${file}`], { binary: true }),
    );
    write(path.join(out, "rollback/baseline-files", file), original);
  }
  manifest.files.push(entry);
}
write(path.join(out, "publication/manifest.json"), manifest);
write(
  path.join(out, "publication/SHA256SUMS.txt"),
  manifest.files
    .map((entry) => `${entry.sha256}  payload/${entry.file}\n`)
    .join(""),
);

// Test in a confined export. Git discovery stops before the real repository.
const scratch = fs.mkdtempSync(path.join(validationRoot, "roundtrip-"));
assert.ok(
  fs
    .realpathSync(scratch)
    .startsWith(fs.realpathSync(validationRoot) + path.sep),
);
const baselineTar = path.join(validationRoot, "baseline.tar");
write(
  baselineTar,
  git(
    [
      "-c",
      "core.autocrlf=false",
      "-c",
      "core.eol=lf",
      "archive",
      "--format=tar",
      baseline,
    ],
    { binary: true },
  ),
);
python(
  `import pathlib,sys,tarfile\nroot=pathlib.Path(sys.argv[2]).resolve()\nwith tarfile.open(sys.argv[1]) as t:\n for m in t.getmembers():\n  assert (root/m.name).resolve().is_relative_to(root) and (m.isfile() or m.isdir())\n t.extractall(root,filter='data')`,
  [baselineTar, scratch],
);
const scratchEnv = { GIT_CEILING_DIRECTORIES: validationRoot };
const discovery = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: scratch,
  env: { ...process.env, ...scratchEnv },
  encoding: "utf8",
  windowsHide: true,
});
assert.notEqual(
  discovery.status,
  0,
  "Validation export must not discover the real repository",
);
const beforeHashes = new Map(
  filesIn(scratch).map((file) => [
    file,
    sha(fs.readFileSync(path.join(scratch, file))),
  ]),
);
const forward = path.join(out, "publication/publication.patch"),
  inverse = path.join(out, "rollback/rollback.patch");
const apply = [
  "-c",
  "core.autocrlf=false",
  "-c",
  "core.eol=lf",
  "apply",
  "--no-index",
];
git([...apply, "--check", "--binary", forward], {
  cwd: scratch,
  env: scratchEnv,
});
git([...apply, "--binary", forward], {
  cwd: scratch,
  env: scratchEnv,
});
const reconstructed = manifest.files.map((entry) => {
  const actual = sha(fs.readFileSync(path.join(scratch, entry.file)));
  assert.equal(
    actual,
    entry.patchSha256,
    `Publication reconstruction: ${entry.file}`,
  );
  return { file: entry.file, sha256: actual, matches: true };
});
for (const [file, hash] of beforeHashes)
  if (!modified.includes(file))
    assert.equal(
      sha(fs.readFileSync(path.join(scratch, file))),
      hash,
      `Forward patch touched protected path: ${file}`,
    );
git([...apply, "--check", "--binary", inverse], {
  cwd: scratch,
  env: scratchEnv,
});
git([...apply, "--binary", inverse], {
  cwd: scratch,
  env: scratchEnv,
});
for (const [file, hash] of beforeHashes)
  assert.equal(
    sha(fs.readFileSync(path.join(scratch, file))),
    hash,
    `Rollback restoration: ${file}`,
  );
for (const file of added)
  assert.ok(
    !fs.existsSync(path.join(scratch, file)),
    `Rollback must remove new path: ${file}`,
  );
assert.deepEqual(filesIn(scratch), [...beforeHashes.keys()].sort());
assert.equal(sha(fs.readFileSync(indexPath)), realIndexBefore);
assert.equal(git(["rev-parse", "HEAD"]).trim(), baseline);
assert.equal(
  git(["for-each-ref", "--format=%(refname) %(objectname)"]),
  refsBefore,
);
write(path.join(out, "evidence/patch-roundtrip.json"), {
  status: "PASS",
  baseline,
  isolatedExport: true,
  actualRepositoryDiscoveryBlocked: true,
  lineEndings: {
    baseline: "git archive canonical bytes",
    coreAutocrlf: false,
    coreEol: "lf",
    rawPayloadHashesSeparate: true,
  },
  publicationCheck: "PASS",
  publicationApplication: "PASS",
  reconstructed,
  binaryPaths: 72,
  rollbackCheck: "PASS",
  rollbackApplication: "PASS",
  restoredBaselineFiles: beforeHashes.size,
  newFilesRemoved: added.length,
  extraFilesAfterRollback: 0,
  realIndexUnchanged: true,
  headAndRefsUnchanged: true,
  commitPushMergeDeployPerformed: false,
});
console.log(
  "Forward/inverse patch verification passed:",
  files.length,
  "paths;",
  beforeHashes.size,
  "baseline files restored.",
);

const protectedFiles = git(["ls-files", "-z"])
  .split("\0")
  .filter(Boolean)
  .filter((file) => !modified.includes(file));
const protectedHashes = [];
for (const file of protectedFiles) {
  const expected = git(["cat-file", "--filters", `${baseline}:${file}`], {
      binary: true,
    }),
    actual = fs.readFileSync(file);
  assert.ok(expected.equals(actual), `Protected bytes changed: ${file}`);
  protectedHashes.push({ file, sha256: sha(actual) });
}
for (const file of freeze.files)
  assert.equal(sha(fs.readFileSync(file.file)), file.sha256);
write(path.join(out, "evidence/preservation.json"), {
  baseline,
  acceptedImplementationFiles: freeze.files.length,
  implementationSha256: freeze.implementationSha256,
  acceptedBytesUnchanged: true,
  protectedTrackedFiles: protectedFiles.length,
  protectedHashes,
  changedProtected: [],
  visualComparisons: browser.preservation,
  dependenciesAdded: false,
  backendChanged: false,
  applicationChanged: false,
  phase14Integrated: false,
  promotionalVideoIntegrated: false,
  productionTouched: false,
  commitPushMergeDeployPerformed: false,
});

// Existing final browser/build evidence is tied to identical accepted bytes.
fs.cpSync(path.join(previous, "originals"), path.join(out, "originals"), {
  recursive: true,
});
fs.cpSync(path.join(previous, "evidence"), path.join(out, "evidence"), {
  recursive: true,
  filter: (file) =>
    !file.split(path.sep).includes("recording") &&
    !path.basename(file).startsWith("mismatch-"),
});
const lint = (file) =>
  json(path.join(out, "evidence", file)).flatMap((entry) =>
    entry.messages.map((message) => ({
      file: path.relative(root, entry.filePath).replaceAll("\\", "/"),
      line: message.line,
      rule: message.ruleId,
      message: message.message,
      severity: message.severity,
    })),
  );
const inherited = lint("repository-lint.json"),
  baselineLint = lint("baseline-repository-lint.json");
assert.deepEqual(inherited, baselineLint);
assert.equal(inherited.length, 11);
assert.deepEqual(lint("frontend-lint.json"), []);
write(path.join(out, "evidence/inherited-lint.json"), {
  status: "INHERITED_UNCHANGED",
  errors: inherited.length,
  files: new Set(inherited.map((entry) => entry.file)).size,
  baselineMatchesCandidate: true,
  details: inherited,
});
assert.match(
  fs.readFileSync(path.join(out, "evidence/frontend-tests.log"), "utf8"),
  /pass 334/,
);
assert.match(
  fs.readFileSync(path.join(out, "evidence/production-build.log"), "utf8"),
  /Production frontend\/backend built/,
);
const visibility = json(
  path.join(out, "evidence/desktop-visibility/report.json"),
);
assert.equal(visibility.originalFalseRecords.length, 6);
assert.deepEqual(visibility.errors, []);
assert.equal(visibility.recovery.length, 6);
assert.equal(
  visibility.conclusion.classification,
  "HARMLESS_VIEWPORT_CLIPPING_NO_BLOCKING_USABILITY_ISSUE_DETECTED",
);
assert.equal(visibility.conclusion.designChanged, false);
const promotional = json(
  path.join(out, "evidence/promotional-originals-zip.json"),
);
assert.equal(promotional.status, "PASS");
assert.equal(promotional.originalPngCount, 24);
assert.equal(sha(fs.readFileSync(promotional.zip)), promotional.sha256);
write(path.join(out, "evidence/final-test-summary.json"), {
  humanVisualAcceptance: freeze.humanVisualAcceptance,
  frozenImplementationSha256: freeze.implementationSha256,
  frontendTests: { passed: 334, failed: 0, log: "frontend-tests.log" },
  browser: {
    selections: 96,
    unchangedSectionComparisons: 128,
    pageErrors: 0,
    unexpectedConsoleErrors: 0,
    checks: browser.checks,
  },
  implementationEvidence:
    "Retained final passing Stage 1.1 browser/build run; implementation files byte-identical. RC1 changes only documentation and packaging.",
  patchAndRollback:
    "PASS — actual isolated forward/inverse applications and SHA-256 restoration",
  inheritedRepositoryLintErrors: 11,
  targetedDesktopVisibility: visibility.conclusion,
  promotionalOriginalsArchive: promotional,
  publicationAuthorized: false,
});
write(
  path.join(out, "README.md"),
  `# BudoGraph Landing Stage 1.1 — final local RC1\n\nHuman Visual Acceptance: PASS — 10/10, explicitly reported by the owner on 2026-11-26. Accepted implementation and composition A frozen. Publication authorization remains separate.\n\nBaseline: ${baseline}\nLive Stage 1 deploy: dep-dc3v1ht9el5s739o8meg\nSTAGING service: srv-dbj45tg473hc73b4ecog\nAccepted implementation SHA-256: ${freeze.implementationSha256}\n\nPublication: 84 paths, 11 modified and 73 new, including all 72 WebP assets. publication/publication.patch includes every path and binary data. publication/manifest.json distinguishes raw payload hashes from Git-normalized text patch hashes. publication/SHA256SUMS.txt verifies raw files. SHA256SUMS.txt covers all packaged artifacts.\n\nForward and rollback patches were actually applied and verified in an isolated baseline export; see evidence/patch-roundtrip.json. All ${beforeHashes.size} baseline files restored, ${added.length} new paths removed, and ${protectedFiles.length} protected worktree files byte-identical. The real Git index, HEAD and refs are unchanged.\n\nThe rollback procedure is in publication/payload/docs/BUDOGRAPH_LANDING_STAGE_1_1.md. rollback/rollback.patch is the complete inverse; rollback/baseline-files holds original modified-file bytes. This validates local source restoration only, not a live Render rollback or database/external restoration. Keep Stage 1 live.\n\nBefore a later authorized publication, re-confirm the exact live baseline and verify checksums, payload and patch in a separate clean candidate. If STAGING advanced, reconcile first. No commit, push, merge, deployment, backend change, Phase 14 or promotional video integration occurred.\n`,
);
write(
  path.join(out, "index.html"),
  fs
    .readFileSync(path.join(previous, "index.html"), "utf8")
    .replace(
      "Local review only · owner visual acceptance pending.",
      "Final local RC1 · Human Visual Acceptance: PASS — 10/10 · implementation frozen · publication not authorized.",
    )
    .replaceAll("publication-draft/candidate-files/", "publication/payload/")
    .replaceAll("publication-draft/manifest.json", "publication/manifest.json")
    .replace(
      "Publication/rollback draft",
      "Final publication inventory and hashes",
    ),
);
const members = filesIn(out).filter(
  (file) => file !== "SHA256SUMS.txt" && !file.startsWith("validation/"),
);
write(
  path.join(out, "SHA256SUMS.txt"),
  members
    .map((file) => `${sha(fs.readFileSync(path.join(out, file)))}  ${file}\n`)
    .join(""),
);
const memberFile = path.join(validationRoot, "archive-members.json");
write(memberFile, [...members, "SHA256SUMS.txt"]);
const zip = path.resolve(
  root,
  "../BudoGraph-Landing-Stage1.1-RC1-2026-11-26.zip",
);
const archiveVerification = jsonFromPythonArchive();
function jsonFromPythonArchive() {
  return JSON.parse(
    python(
      `import pathlib,sys,json,zipfile,hashlib\nroot=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2]); names=json.loads(pathlib.Path(sys.argv[3]).read_text())\nassert not any(pathlib.PurePosixPath(n).name.startswith('.env') for n in names)\nwith zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:\n for n in names: z.write(root/n,n)\nwith zipfile.ZipFile(target) as z:\n assert z.testzip() is None\n for line in z.read('SHA256SUMS.txt').decode().splitlines():\n  digest,name=line.split('  ',1); assert hashlib.sha256(z.read(name)).hexdigest()==digest,name\n m=json.loads(z.read('publication/manifest.json'))\n for f in m['files']: assert hashlib.sha256(z.read('publication/payload/'+f['file'])).hexdigest()==f['sha256']\n assert len([n for n in names if n.startswith('originals/') and n.endswith('.png')])==24\nprint(json.dumps({'crc':'PASS','artifactChecksums':'PASS','payloadChecksums':'PASS','members':len(names),'candidateFiles':len(m['files']),'originals':24}))`,
      [out, zip, memberFile],
    ),
  );
}
const zipSha256 = sha(fs.readFileSync(zip));
write(zip + ".sha256", `${zipSha256}  ${path.basename(zip)}\n`);
const result = {
  status: "FINAL_LOCAL_RC1_OWNER_VISUALLY_ACCEPTED_FROZEN",
  publicationAuthorized: false,
  baseline,
  zip,
  zipSha256,
  bytes: fs.statSync(zip).size,
  changedFiles: files.length,
  modified: modified.length,
  added: added.length,
  frozenFiles: freeze.files.length,
  protectedUnchanged: protectedFiles.length,
  restoredBaselineFiles: beforeHashes.size,
  archiveVerification,
};
write(zip + ".verification.json", result);
console.log(JSON.stringify(result, null, 2));
