import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { UserRepository } from "../db/repository";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
});

export async function registerUserRoutes(app: FastifyInstance, repo: UserRepository) {
  app.get("/api/users", async () => ({ data: await repo.list() }));

  app.post("/api/users", async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", issues: parsed.error.issues });
    }
    try {
      const user = await repo.create(parsed.data);
      return reply.code(201).send({ data: user });
    } catch (error) {
      // Unique constraint violation (Postgres 23505) => 409 Conflict.
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return reply.code(409).send({ error: "Email already exists" });
      }
      request.log.error(error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
