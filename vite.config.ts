import { createLogger, defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite proxy errors can include request URLs. Keep bearer credentials out of
// development diagnostics without removing the useful error itself.
const logger = createLogger();
for (const level of ["error", "warn", "info"] as const) {
  const write = logger[level].bind(logger);
  logger[level] = (message, options) =>
    write(
      message
        .replace(
          /(\/(?:api\/auth\/reset-password)\/)[A-Za-z0-9_-]+/g,
          "$1[redacted]",
        )
        .replace(/([?&]token=)[^&\s]+/gi, "$1[redacted]")
        .replace(/(\/api\/auth\/[^\s?'"`]+)\?[^\s]*/g, "$1?[redacted]")
        .replace(
          /(\/(?:api\/invitations|invite)\/)[A-Za-z0-9_-]{43}/g,
          "$1[redacted]",
        ),
      options,
    );
}

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: true } },
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: true } },
  },
});
