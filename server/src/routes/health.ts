import type { FastifyInstance } from "fastify";

export type CheckDatabase = () => Promise<void>;

export function registerHealthRoutes(
  app: FastifyInstance,
  checkDatabase: CheckDatabase,
) {
  app.get("/api/health/live", async () => ({ status: "ok" }));

  app.get("/api/health/ready", async (request, reply) => {
    try {
      await checkDatabase();
      return { status: "ok" };
    } catch {
      request.log.warn(
        { dependency: "postgresql" },
        "Database readiness check failed",
      );
      return reply.code(503).send({ status: "unavailable" });
    }
  });
}
