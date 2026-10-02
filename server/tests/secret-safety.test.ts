import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repository = fileURLToPath(new URL("../../", import.meta.url));

function isIgnored(path: string): boolean {
  // Path probes do not create environment files or write synthetic secrets.
  const result = spawnSync(
    "git",
    ["check-ignore", "--no-index", "--quiet", "--", path],
    {
      cwd: repository,
      encoding: "utf8",
    },
  );
  assert.ifError(result.error);
  assert.ok(
    result.status === 0 || result.status === 1,
    "git check-ignore must complete normally",
  );
  return result.status === 0;
}

test("real environment filenames are ignored throughout the repository", () => {
  for (const directory of ["", "server/", "server/nested/"]) {
    for (const filename of [
      ".env",
      ".env.local",
      ".env.development",
      ".env.production",
      ".env.test",
      ".env.staging",
      ".env.example.local",
    ]) {
      assert.equal(isIgnored(directory + filename), true, directory + filename);
    }
  }
});

test("only placeholder examples are allowed and generated backend builds are ignored", () => {
  for (const path of [
    ".env.example",
    "server/.env.example",
    "server/nested/.env.example",
  ]) {
    assert.equal(isIgnored(path), false, path);
  }
  assert.equal(isIgnored("server/dist/src/main.js"), true);
});
