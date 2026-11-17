import type { UserConfig } from "@commitlint/types";

// Conventional Commits. `feat!` / `BREAKING CHANGE:` => MAJOR, feat => MINOR, fix => PATCH.
const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["app", "ui", "build", "ci", "deps", "docs", "test", "chore"],
    ],
    "header-max-length": [2, "always", 100],
  },
};

export default config;
