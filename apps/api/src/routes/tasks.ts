import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { TaskRepository } from "../db/repository";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    completed: z.boolean().optional(),
  })
  .refine((value) => value.title !== undefined || value.completed !== undefined, {
    message: "At least one field is required",
  });

const idSchema = z.coerce.number().int().positive();

export async function registerTaskRoutes(app: FastifyInstance, repo: TaskRepository) {
  // GET /api/tasks — newest first, capped at 100 by the repository.
  app.get("/api/tasks", async () => ({ data: await repo.list() }));

  // POST /api/tasks — create a new task.
  app.post("/api/tasks", async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", issues: parsed.error.issues });
    }
    try {
      const task = await repo.create(parsed.data);
      return reply.code(201).send({ data: task });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // PATCH /api/tasks/:id — toggle completion or rename.
  app.patch("/api/tasks/:id", async (request, reply) => {
    const id = idSchema.safeParse((request.params as { id: string }).id);
    const parsed = updateTaskSchema.safeParse(request.body);
    if (!id.success || !parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    try {
      const task = await repo.update(id.data, parsed.data);
      if (!task) {
        return reply.code(404).send({ error: "Task not found" });
      }
      return reply.code(200).send({ data: task });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // DELETE /api/tasks/:id — remove a task.
  app.delete("/api/tasks/:id", async (request, reply) => {
    const id = idSchema.safeParse((request.params as { id: string }).id);
    if (!id.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    try {
      const removed = await repo.remove(id.data);
      if (!removed) {
        return reply.code(404).send({ error: "Task not found" });
      }
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
