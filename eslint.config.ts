// ESLint 9 flat config. TS config files require the `jiti` loader (in devDependencies).
// ESLint auto-detects eslint.config.ts when jiti is installed.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Vue 3 essential rules + correct parser for <script lang="ts"> in SFCs.
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Browser globals for app source; Node globals for config/tooling files.
  {
    files: ["apps/**/src/**/*.{ts,tsx,vue}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ["**/*.config.{ts,js,mjs,cjs}", "**/*.{test,spec}.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // projectService enables type-aware rules below without a per-package parserOptions.project.
  {
    files: ["apps/**/src/**/*.{ts,vue}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "warn",
      "vue/multi-word-component-names": "off",
    },
  },

  // Test files may use `any` and non-null assertions more freely.
  {
    files: ["**/*.{test,spec}.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Must be last: turns off stylistic rules that conflict with Prettier.
  prettierConfig,
]);
