import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { parseEnv } from "../env";

// Minimal, dependency-free migration runner.
// Applies *.sql files in order and records them in schema_migrations.
// For complex projects, swap for Drizzle Kit / Prisma migrations.
const { Pool } = pg;

async function main() {
  const env = parseEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  // Resolved from cwd so it works both under `tsx` (src) and the bundled `dist/migrate.js`.
  // Override with MIGRATIONS_DIR in containers if needed.
  const dir = process.env.MIGRATIONS_DIR ?? join(process.cwd(), "migrations");

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(dir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (applied.rowCount) {
        console.log(`skip ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(join(dir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("migration failed", error);
  process.exit(1);
});
