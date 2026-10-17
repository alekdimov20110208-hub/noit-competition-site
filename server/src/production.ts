// Explicit release entry point. Never loads development environment files.
if (process.env.NODE_ENV !== "production") {
  process.stderr.write("production:start requires NODE_ENV=production.\n");
  process.exitCode = 1;
} else {
  await import("./main.ts");
}
