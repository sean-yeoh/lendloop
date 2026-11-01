import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import oxlint from "eslint-plugin-oxlint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Last: turns off the ESLint rules that oxlint already checks (.oxlintrc.json). ESLint keeps
  // the Next.js and React Hooks rules that oxlint does not cover.
  ...oxlint.buildFromOxlintConfigFile("./.oxlintrc.json"),
]);

export default eslintConfig;
