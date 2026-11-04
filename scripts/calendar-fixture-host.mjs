// Dedicated fixture-only frontend. No database, env file or API proxy.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

export async function calendarFixtureHost({
  port: requestedPort,
  apiHandler,
  plugins = [],
} = {}) {
  const port = Number(
    requestedPort ?? process.env.BUDOGRAPH_CALENDAR_PORT ?? 5183,
  );
  if (!Number.isInteger(port) || port < 1024 || [5173, 3001].includes(port))
    throw Error("Calendar fixture host requires a separate unprivileged port");
  const server = await createServer({
    configFile: false,
    envFile: false,
    // Separate preview/test hosts must not race over Vite's optimized modules.
    cacheDir: `node_modules/.vite-calendar-fixture-${port}`,
    plugins: [
      {
        name: "calendar-fixture-api-isolation",
        configureServer(server) {
          // Install before Vite's SPA fallback, so no API can reach a proxy or
          // accidentally receive app HTML.
          server.middlewares.use((req, res, next) => {
            const path = new URL(req.url, "http://127.0.0.1").pathname;
            if (path !== "/api" && !path.startsWith("/api/")) return next();
            if (apiHandler) return apiHandler(req, res);
            res.statusCode = 503;
            res.end("Fixture transport required. No backend is connected.");
          });
        },
      },
      ...plugins,
      react(),
    ],
    server: { host: "127.0.0.1", port, strictPort: true, proxy: {} },
    logLevel: "error",
  });
  await server.listen();
  return { server, origin: `http://127.0.0.1:${port}` };
}
