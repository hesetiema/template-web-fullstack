import { buildApp } from "./app";
import { createDb } from "./db/client";
import { createUserRepository } from "./db/repository";
import { parseEnv } from "./env";

async function main() {
  const env = parseEnv();
  const { db, ping, close } = createDb(env.DATABASE_URL);
  const app = await buildApp({
    env,
    users: createUserRepository(db),
    checkReady: ping,
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error(error);
    await close();
    process.exit(1);
  }
}

void main();
