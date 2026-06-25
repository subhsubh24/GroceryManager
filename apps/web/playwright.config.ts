import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke tests for GroceryManager public routes.
 *
 * Usage:
 *   BASE_URL=https://staging.example.com pnpm --filter @gm/web e2e
 *   pnpm --filter @gm/web e2e  # against localhost:3000 (server must already be running)
 *
 * Chromium path: /opt/pw-browsers/chromium (pre-installed on the CI runner).
 * PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 prevents postinstall from re-fetching.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium",
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
  ],
});
