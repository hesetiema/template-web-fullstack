import { desc } from "drizzle-orm";
import type { Db } from "./client";
import { users, type NewUser, type User } from "./schema";

// Repository interface: routes depend on this, not on Drizzle directly.
// Tests can inject a fake implementation without a database.
export interface UserRepository {
  list(): Promise<User[]>;
  create(input: NewUser): Promise<User>;
}

export function createUserRepository(db: Db): UserRepository {
  return {
    list: () => db.select().from(users).orderBy(desc(users.createdAt)).limit(100),
    create: async (input) => {
      const [row] = await db.insert(users).values(input).returning();
      return row;
    },
  };
}
