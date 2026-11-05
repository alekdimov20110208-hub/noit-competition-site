import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createApp } from "../server/src/app.ts";

// Local review only. This serves the built frontend with read-only fixtures.
// It never loads runtime configuration or connects to an identity provider.
export function createLandingPreview({ signedIn = false } = {}) {
  const app = createApp({ frontendRoot: resolve("dist") });
  app.get("/api/me", async (_request, reply) =>
    signedIn
      ? {
          user: {
            id: "landing-local-review",
            name: "Local preview fixture",
            email: "landing@example.invalid",
          },
        }
      : reply.code(401).send({ status: "unauthenticated" }),
  );
  app.get("/api/registration", async () => ({ enabled: false }));
  if (signedIn) app.get("/api/events", async () => ({ events: [] }));
  return app;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const signedIn = process.argv.includes("--signed-in-fixture");
  const app = createLandingPreview({ signedIn });
  const url = await app.listen({
    host: "127.0.0.1",
    port: signedIn ? 5192 : 5191,
  });
  console.log(`${signedIn ? "Signed-in fixture" : "Guest"}: ${url}/`);
  process.once("SIGINT", () => void app.close());
}
