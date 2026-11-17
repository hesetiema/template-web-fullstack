import { desc, eq } from "drizzle-orm";
import type { Db } from "./client";
import { tasks, type NewTask, type Task } from "./schema";

// Repository interface: routes depend on this, not on Drizzle directly.
// Tests inject a fake implementation without a database.
export interface TaskRepository {
  list(): Promise<Task[]>;
  create(input: NewTask): Promise<Task>;
  update(id: number, patch: { title?: string; completed?: boolean }): Promise<Task | undefined>;
  remove(id: number): Promise<boolean>;
}

export function createTaskRepository(db: Db): TaskRepository {
  return {
    list: () => db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(100),
    create: async (input) => {
      const [row] = await db.insert(tasks).values(input).returning();
      return row;
    },
    update: async (id, patch) => {
      const [row] = await db
        .update(tasks)
        .set(patch)
        .where(eq(tasks.id, id))
        .returning();
      return row;
    },
    remove: async (id) => {
      const deleted = await db.delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id });
      return deleted.length > 0;
    },
  };
}
