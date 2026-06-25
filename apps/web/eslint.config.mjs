// @ts-check
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "*.config.mjs",
      "*.config.ts",
      "postcss.config.mjs",
    ],
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
    },
    rules: {
      // React Hooks — catches the conditional-hook bugs that cause runtime crashes.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // TypeScript safety — catch unused vars (tsc only checks types, not unused identifiers).
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],

      // No explicit any — surfaces unsafe casts that type-checker can't see.
      "@typescript-eslint/no-explicit-any": "warn",

      // Next.js — use <Image> for optimised loading; raw <img> is only disabled per-instance.
      "@next/next/no-img-element": "warn",

      // Basic JS hygiene.
      "no-debugger": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
];
