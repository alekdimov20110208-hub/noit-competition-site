import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";

// This generates review output only. The repository runner owns all application.
// npm_execpath is supplied by pnpm, so no passwords or shell interpolation enter argv.
const pnpmPath = process.env.npm_execpath;
if (!pnpmPath || !/pnpm\.(?:[cm]?js)$/i.test(pnpmPath)) {
  console.error("Run the schema generator through pnpm server:auth-schema.");
  process.exitCode = 1;
} else {
  await mkdir("tmp", { recursive: true });
  // The CLI exits successfully without writing when the DB is up to date.
  // A unique path ensures an earlier output can never be reported as new SQL.
  const outputPath = `tmp/better-auth-1.7.7-${randomUUID()}.sql`;
  const child = spawn(
    process.execPath,
    [
      pnpmPath,
      "dlx",
      "auth@1.7.7",
      "generate",
      "--config",
      "./server/scripts/auth-schema-config.ts",
      "--output",
      outputPath,
      "--yes",
    ],
    { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  // Do not forward generator errors that may include connection details.
  child.stdout.resume();
  child.stderr.resume();
  child.on("error", () => {
    console.error(
      "Pinned auth schema generator could not start; details omitted.",
    );
    process.exitCode = 1;
  });
  const code = await new Promise<number | null>((resolve) => {
    child.once("close", resolve);
  });
  if (code !== 0) {
    console.error(
      "Pinned auth schema generation failed; database details omitted.",
    );
    process.exitCode = 1;
  } else {
    try {
      const output = await stat(outputPath);
      if (!output.isFile() || output.size === 0)
        throw new Error("Invalid output.");
      console.info(
        `Auth 1.7.7 SQL generated: ${outputPath}; review before repository migration. No migrations applied.`,
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        console.info(
          "Auth 1.7.7 schema is up to date; no SQL file generated. No migrations applied.",
        );
      } else {
        console.error(
          "Auth schema generation output could not be verified; details omitted.",
        );
        process.exitCode = 1;
      }
    }
  }
}
