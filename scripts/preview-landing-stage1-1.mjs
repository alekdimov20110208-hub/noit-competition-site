// Loopback-only review of the genuine built application. Synthetic GET records;
// no runtime configuration, credentials, database, or mutation transport.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { syntheticData } from "./landing-stage1-1-data.mjs";
import { curatedCatalogResponse } from "../server/src/templates/curated.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".json": "application/json",
};
export function createShowcasePreview({ frontendRoot = "dist" } = {}) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const cookies = req.headers.cookie ?? "";
    const data = syntheticData(
      cookies.includes("showcase-language=en") ? "en" : "bg",
    );
    const json = (value, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    if (url.pathname.startsWith("/api/")) {
      if (req.method !== "GET")
        return json({ error: "LOCAL_READ_ONLY_FIXTURE" }, 405);
      if (url.pathname === "/api/registration") return json({ enabled: false });
      const demo = cookies.includes("showcase-demo=1");
      if (url.pathname === "/api/me")
        return demo
          ? json({ user: data.user })
          : json({ error: "unauthenticated" }, 401);
      if (!demo) return json({ error: "unauthenticated" }, 401);
      if (url.pathname === "/api/events") return json({ events: [data.event] });
      if (url.pathname.endsWith("/tasks"))
        return json({ tasks: data.tasks, members: data.members });
      if (url.pathname.endsWith("/members"))
        return json({ members: data.members });
      if (url.pathname.endsWith("/changes"))
        return json({ changes: data.changes });
      if (url.pathname.includes("/changes/"))
        return json({ change: data.changes[0] });
      if (url.pathname.endsWith("/notifications"))
        return json({ notifications: [], unreadCount: 0 });
      if (url.pathname === "/api/templates/curated")
        return json(curatedCatalogResponse());
      if (url.pathname === "/api/templates/mine")
        return json({ templates: [], nextCursor: null });
      return json({ error: "fixture-not-found", path: url.pathname }, 404);
    }
    let requestPath;
    try {
      requestPath = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    const review = requestPath.startsWith("/__review/");
    const baseline = requestPath.startsWith("/baseline/");
    const base = path.join(
      root,
      review
        ? "tmp/stage1-1"
        : baseline
          ? "tmp/stage1-1/baseline-dist"
          : frontendRoot,
    );
    const relativePath = review
      ? requestPath.slice("/__review".length)
      : baseline
        ? requestPath.slice("/baseline".length)
        : requestPath;
    let file = path.resolve(base, "." + relativePath);
    if (path.relative(base, file).startsWith("..")) {
      res.writeHead(403);
      return res.end();
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      // Missing assets must fail instead of returning the SPA as an image.
      if (path.extname(relativePath)) {
        res.writeHead(404);
        return res.end();
      }
      file = path.join(base, "index.html");
    }
    if (!fs.existsSync(file)) {
      res.writeHead(503);
      return res.end("Build the frontend first.");
    }
    let body = fs.readFileSync(file);
    if (baseline && path.extname(file) === ".html")
      body = body.toString().replaceAll('"/assets/', '"/baseline/assets/');
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  createShowcasePreview().listen(5193, "127.0.0.1", () =>
    console.log(
      "LOCAL showcase: http://127.0.0.1:5193/ (synthetic read-only review, no database)",
    ),
  );
}
