import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // The Tauri desktop shell's build outputs -- a bundled copy of this
    // app's own compiled JS (server.js, .next/static, node_modules) that
    // scripts/prepare-tauri-server.mjs assembles under src-tauri/resources,
    // plus Cargo's own target/ -- neither is source, both are already
    // gitignored, but ESLint has no other reason to know that.
    "src-tauri/**",
  ]),
]);

export default eslintConfig;
