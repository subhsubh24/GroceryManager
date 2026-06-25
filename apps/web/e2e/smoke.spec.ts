import { test, expect } from "@playwright/test";

/**
 * Smoke tests for public GroceryManager routes.
 * All routes here are in the PUBLIC allowlist in middleware.ts and require no auth.
 * Run against a live server: BASE_URL=https://... pnpm --filter @gm/web e2e
 */

test.describe("public routes load without auth", () => {
  test("home page / loads with hero", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/GroceryManager|Grocery/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("sign-in page /signin loads", async ({ page }) => {
    await page.goto("/signin");
    // Auth form has a username/password field
    await expect(page.locator('input[name="username"], input[name="email"], input[type="email"]').first()).toBeVisible();
  });

  test("sign-up page /signup loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("body")).toBeVisible();
    // Should have a form, not redirect to signin
    await expect(page).not.toHaveURL(/signin/);
  });

  test("blog index /blog loads", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).not.toHaveURL(/signin/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("help page /help loads", async ({ page }) => {
    await page.goto("/help");
    await expect(page).not.toHaveURL(/signin/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("privacy policy /privacy loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).not.toHaveURL(/signin/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("terms of service /terms loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).not.toHaveURL(/signin/);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("landing A/B variants load", () => {
  for (const variant of ["a", "b", "c"]) {
    test(`home page /?v=${variant} loads`, async ({ page }) => {
      await page.goto(`/?v=${variant}`);
      await expect(page).not.toHaveURL(/signin/);
      await expect(page.locator("body")).toBeVisible();
    });
  }
});

test.describe("share routes handle unknown tokens gracefully", () => {
  test("/share/cookbook/invalid-token shows not-found or empty", async ({ page }) => {
    const response = await page.goto("/share/cookbook/invalid-token-that-does-not-exist");
    // Should not redirect to signin (it's public) and should not 500
    expect(response?.status()).not.toBe(500);
    expect(page.url()).not.toMatch(/signin/);
  });
});
