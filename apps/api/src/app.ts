import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { Env } from "./env";
import type { TaskRepository } from "./db/repository";
import { registerHealthRoutes } from "./routes/health";
import { registerTaskRoutes } from "./routes/tasks";

interface BuildAppOptions {
  env: Env;
  tasks: TaskRepository;
  checkReady: () => Promise<boolean>;
}

// App factory — no listen(), no side effects. Tests call app.inject() on this.
export async function buildApp({ env, tasks, checkReady }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: true,
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN });

  await registerHealthRoutes(app, { version: env.APP_VERSION, checkReady });
  await registerTaskRoutes(app, tasks);

  return app;
}
