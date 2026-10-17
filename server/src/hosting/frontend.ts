import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, isAbsolute, join } from "node:path";
import type { FastifyInstance } from "fastify";
import { EnvironmentError } from "../config/env.ts";

// Only immutable build output is served. No repository or runtime-secret root.
export function registerFrontend(app: FastifyInstance, root: string) {
  let html: string;
  try {
    if (!isAbsolute(root) || !lstatSync(root).isDirectory()) throw Error();
    const index = join(root, "index.html");
    const stat = lstatSync(index);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 5 * 1024 * 1024)
      throw Error();
    html = readFileSync(index, "utf8");
    if (!html.includes('id="root"') || html.includes("/src/main.tsx"))
      throw Error();
  } catch {
    throw new EnvironmentError(
      "Production frontend assets are missing or invalid; run production:build.",
    );
  }
  const hashes = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter((match) => match[1]?.trim())
    .map(
      (match) =>
        `'sha256-${createHash("sha256").update(match[1]!).digest("base64")}'`,
    );
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("content-security-policy", csp);
    return payload;
  });
  // Read the bounded immutable artifact once. Request input never enters a
  // filesystem/glob operation; Fastify registers exact paths on every OS.
  const mime: Readonly<Record<string, string>> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
  };
  let bytes = 0,
    count = 0;
  function registerDirectory(directory: string, prefix: string, depth = 0) {
    if (depth > 8)
      throw new EnvironmentError(
        "Production asset tree exceeds its depth limit.",
      );
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink())
        throw new EnvironmentError(
          "Production assets must not contain symlinks.",
        );
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,150}$/.test(entry.name)) continue;
      const name = prefix + entry.name;
      if (/^api(?:\/|$)/i.test(name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        registerDirectory(path, name + "/", depth + 1);
        continue;
      }
      const type = mime[extname(name)];
      if (
        !entry.isFile() ||
        !type ||
        (type.startsWith("text/html") && name !== "index.html")
      )
        continue;
      const stat = lstatSync(path);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size > 5 * 1024 * 1024
      )
        throw new EnvironmentError(
          "Production asset is invalid or exceeds 5 MiB.",
        );
      const data = readFileSync(path);
      bytes += data.length;
      if (++count > 1024 || bytes > 32 * 1024 * 1024)
        throw new EnvironmentError(
          "Production assets exceed the 1024 file / 32 MiB budget.",
        );
      const immutable = /^assets\/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(name);
      app.get("/" + name, async (_request, reply) =>
        reply
          .type(type)
          .header(
            "cache-control",
            immutable ? "public, max-age=31536000, immutable" : "no-store",
          )
          .send(data),
      );
    }
  }
  registerDirectory(root, "");
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split("?")[0] ?? "";
    // API namespace, files, dot segments, encoded paths and backslashes fail
    // closed. Real History API routes use ordinary, extensionless path segments.
    const spa =
      ["GET", "HEAD"].includes(request.method) &&
      (request.headers.accept ?? "")
        .split(",")
        .some((v) => /^\s*text\/html(?:\s*;|\s*$)/i.test(v)) &&
      !/^\/api(?:\/|$)/i.test(path) &&
      /^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(path);
    reply.header("cache-control", "no-store");
    if (spa)
      return reply
        .type("text/html; charset=utf-8")
        .header("content-length", Buffer.byteLength(html))
        .send(request.method === "HEAD" ? null : html);
    return reply.code(404).send({ status: "not_found" });
  });
}
