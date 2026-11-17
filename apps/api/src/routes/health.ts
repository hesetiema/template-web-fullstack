import type { FastifyInstance } from "fastify";

interface HealthOptions {
  version: string;
  /** Readiness check — e.g. database reachability. Liveness must NOT depend on this. */
  checkReady: () => Promise<boolean>;
}

export async function registerHealthRoutes(app: FastifyInstance, options: HealthOptions) {
  // Liveness: only answers "is the process alive?". Must never check dependencies,
  // otherwise a DB outage would cause needless container restarts.
  app.get("/health", async () => ({
    status: "ok",
    version: options.version,
    uptime: process.uptime(),
  }));

  // Readiness: dependencies are up — safe to route traffic here.
  app.get("/ready", async (_request, reply) => {
    const ready = await options.checkReady();
    if (!ready) {
      return reply.code(503).send({ status: "degraded", ready: false });
    }
    return { status: "ok", ready: true };
  });
}
