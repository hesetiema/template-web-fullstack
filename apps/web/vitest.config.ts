import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    define: {
      __APP_TITLE__: JSON.stringify(env.VITE_APP_TITLE ?? "template-web-fullstack"),
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["node_modules", "dist", "e2e"],
      clearMocks: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        reportsDirectory: "./coverage",
        include: ["src/**/*.{ts,vue}"],
        exclude: ["src/test/**", "src/main.ts", "src/**/*.d.ts"],
      },
    },
  };
});
