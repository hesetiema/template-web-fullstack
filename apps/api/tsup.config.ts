import { defineConfig } from "tsup";

export default defineConfig({
  // Object form fixes output names to dist/server.js and dist/migrate.js.
  // (Array form would preserve the src/db/ subdirectory for the migration entry.)
  entry: {
    server: "src/server.ts",
    migrate: "src/db/migrate.ts",
  },
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  splitting: false,
});
