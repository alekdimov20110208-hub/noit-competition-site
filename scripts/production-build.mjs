import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// A build never needs runtime credentials. Vite's implicit .env loading is also
// excluded: release worktrees must have no root .env files or VITE_* variables.
if (
  Object.keys(process.env).some((key) => key.startsWith("VITE_")) ||
  readdirSync(".").some(
    (name) => /^\.env(?:\.|$)/.test(name) && name !== ".env.example",
  )
)
  throw new Error(
    "Release builds require no VITE_* variables or root .env files.",
  );
const environment = {};
for (const [key, value] of Object.entries(process.env))
  if (
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
      key,
    )
  )
    environment[key] = value;
environment.NODE_ENV = "production";
function run(args) {
  const result = spawnSync(process.execPath, args, {
    env: environment,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error("Production build failed.");
}
run(["node_modules/typescript/bin/tsc", "-b"]);
run(["node_modules/vite/bin/vite.js", "build"]);
run(["node_modules/typescript/bin/tsc", "-p", "server/tsconfig.build.json"]);

const hash = createHash("sha256");
function fingerprint(path) {
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const name = join(path, entry.name).replaceAll("\\", "/");
    if (entry.isSymbolicLink())
      throw new Error("Release inputs must not be symlinks.");
    if (entry.isDirectory()) fingerprint(name);
    else {
      hash.update(name);
      hash.update("\0");
      hash.update(readFileSync(name));
      hash.update("\0");
    }
  }
}
for (const path of [
  "src",
  "public",
  "server/src",
  "server/scripts",
  "server/migrations",
])
  fingerprint(path);
for (const path of [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "server/tsconfig.json",
  "server/tsconfig.build.json",
  "scripts/production-build.mjs",
]) {
  hash.update(path);
  hash.update("\0");
  hash.update(readFileSync(path));
  hash.update("\0");
}
const git = (args) =>
  spawnSync("git", args, { encoding: "utf8", windowsHide: true });
const head = git(["rev-parse", "HEAD"]);
const commit = head.stdout?.trim();
if (head.status !== 0 || !/^[a-f0-9]{40}$/.test(commit))
  throw new Error("Release requires an identifiable Git checkout.");
const state = git(["status", "--porcelain", "--untracked-files=normal"]);
if (state.status !== 0) throw new Error("Could not inspect release checkout.");
const manifest = {
  baseCommit: commit,
  // D1 is deliberately uncommitted; never label its artifact as the accepted base.
  workingTreeModified: Boolean(state.stdout.trim()),
  sourceSha256: hash.digest("hex"),
  node: process.version,
  packageManager: JSON.parse(readFileSync("package.json", "utf8"))
    .packageManager,
};
writeFileSync(
  "server/dist/release.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Production frontend/backend built; provenance: server/dist/release.json",
);
