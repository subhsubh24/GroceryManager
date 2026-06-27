import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E functional tests for GroceryManager — public smoke + authed user JOURNEYS (outcome-asserting).
 *
 * Usage:
 *   BASE_URL=https://staging.example.com pnpm --filter @gm/web e2e
 *   pnpm --filter @gm/web e2e  # against localhost:3000 (server must already be running, with a DB)
 *
 * Chromium: the pre-installed CI path when present, else Playwright's managed browser so the suite
 * is runnable LOCALLY too. A hardcoded CI-only path makes the functional suite "build but not run"
 * off-CI — exactly the BUILDS≠WORKS failure mode these tests exist to catch.
 */
const CI_CHROMIUM = "/opt/pw-browsers/chromium";
const launchOptions = existsSync(CI_CHROMIUM)
  ? { executablePath: CI_CHROMIUM, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
  : { args: ["--no-sandbox", "--disable-setuid-sandbox"] };

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
        launchOptions,
      },
    },
  ],
});
