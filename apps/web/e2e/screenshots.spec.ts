import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * VISUAL-VERIFICATION ARTIFACTS (ROADMAP F6) — captures REAL, committed, non-zero screenshots of the
 * core product surfaces + the core-product OUTPUT (a POPULATED pantry, the activation dashboard, the
 * paywall with real pricing, the marketing home), at BOTH mobile and desktop widths, BY the functional
 * journey suite (FACTORY_STANDARD §6/§7/§10).
 *
 * These are deliberately driven through the REAL app flow — a fresh account signs up, then SEEDS its
 * pantry through the keyless `addPantryItemAction` form (no LLM key required) so the pantry/dashboard
 * screenshots show the genuine produced artifact, not an empty placeholder. The committed images are
 * then opened on a vision-capable model and given a per-screenshot DUAL-AXIS verdict (FUNCTIONAL +
 * DESIGN) recorded in docs/autonomous-loop/LOOP_MEMORY.md (deep audit) and the readiness-issue evidence
 * — capture-and-forget does NOT satisfy F6.
 *
 * Requires a running server + a migrated DB (same harness as journeys.spec.ts):
 *   DATABASE_URL=... pnpm --filter web start   (or dev)
 *   BASE_URL=http://localhost:3000 pnpm --filter @gm/web e2e screenshots
 */

const SHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "__screenshots__");
const ERROR_SCREEN = /Couldn.t load your dashboard|Something went wrong|not available/i;

// Real, on-brand widths: a phone (iPhone-class) and a laptop. Captured in separate, isolated runs so
// each surface is shot at both — never a single width passed off as "responsive".
const WIDTHS = [
  { tag: "mobile", width: 390, height: 844 },
  { tag: "desktop", width: 1366, height: 900 },
] as const;

/** Full-page PNG into __screenshots__/<name>-<tag>.png — fails loud if the page errored first. */
async function shoot(page: Page, name: string, tag: string, info: TestInfo) {
  await expect(page.locator("body"), `'${name}' must not be the error boundary`).not.toContainText(
    ERROR_SCREEN,
  );
  // Let fonts/layout settle so the artifact is not a half-painted frame.
  await page.waitForLoadState("networkidle").catch(() => {});
  const path = join(SHOT_DIR, `${name}-${tag}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(`${name}-${tag}`, { path, contentType: "image/png" });
}

/** Create a brand-new account through the real UI; returns its username. */
async function signUp(page: Page): Promise<string> {
  const username = `shot${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', "e2e-passw0rd");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
  return username;
}

/** Seed a few pantry items through the REAL keyless add-item form so the pantry renders populated. */
async function seedPantry(page: Page) {
  const items: [string, string][] = [
    ["olive oil", "1"],
    ["eggs", "12"],
    ["spaghetti", "2"],
    ["canned tomatoes", "3"],
    ["parmesan", "1"],
  ];
  for (const [name, qty] of items) {
    await page.goto("/pantry", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="name"]').fill(name);
    const qtyInput = page.locator('input[name="qty"]');
    if (await qtyInput.count()) await qtyInput.first().fill(qty);
    await page.getByRole("button", { name: /^add$/i }).first().click();
    // The server action writes + revalidates; reloading guarantees the new row is materialized.
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  // Confirm the pantry is genuinely populated before we shoot it (no empty-state false positive).
  await page.goto("/pantry", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/olive|egg|spaghetti|tomato|parmesan/i).first()).toBeVisible({
    timeout: 10_000,
  });
}

for (const { tag, width, height } of WIDTHS) {
  test.describe(`visual artifacts — ${tag}`, () => {
    test.use({ viewport: { width, height } });

    test(`core surfaces render their real screen (${tag})`, async ({ page }, info) => {
      mkdirSync(SHOT_DIR, { recursive: true });

      // 1) Logged-out marketing home — the public acquisition surface.
      await page.context().clearCookies();
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await shoot(page, "01-marketing-home", tag, info);

      await page.goto("/signup", { waitUntil: "domcontentloaded" });
      await shoot(page, "02-signup", tag, info);

      // 2) Sign up → onboarding (the real first-run flow).
      await signUp(page);
      await shoot(page, "03-onboarding-profile", tag, info);

      // 3) Seed the pantry through the real keyless flow → POPULATED core-product output.
      await seedPantry(page);
      await shoot(page, "04-pantry-populated", tag, info);

      // 4) The activation dashboard (now with real pantry context).
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/sign out/i).first()).toBeVisible();
      await shoot(page, "05-dashboard", tag, info);

      // 5) The rest of the core daily-habit surfaces — each its real screen.
      const surfaces: [string, string][] = [
        ["06-list", "/list"],
        ["07-recipes", "/recipes"],
        ["08-plan", "/plan"],
        ["09-discover", "/discover"],
        ["10-profile", "/profile"],
      ];
      for (const [name, path] of surfaces) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await shoot(page, name, tag, info);
      }

      // 6) The paywall — the monetization surface, real pricing.
      await page.goto("/upgrade", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/\$\d/).first()).toBeVisible();
      await shoot(page, "11-upgrade-paywall", tag, info);
    });
  });
}
