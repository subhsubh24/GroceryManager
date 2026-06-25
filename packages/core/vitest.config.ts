import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.eval.test.ts"],
      thresholds: {
        lines: 70,
        branches: 84,
        functions: 76,
        statements: 70,
      },
    },
  },
});
