import type { Config } from "prettier";

const config: Config = {
  semi: true,
  singleQuote: false,
  printWidth: 100,
  tabWidth: 2,
  trailingComma: "all",
  endOfLine: "lf",
  overrides: [
    {
      files: "*.vue",
      options: {
        singleAttributePerLine: true,
      },
    },
  ],
};

export default config;
