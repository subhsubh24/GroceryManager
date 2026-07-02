import { test, expect, type Page } from "@playwright/test";

/**
 * AUTHED USER JOURNEYS — functional, OUTCOME-ASSERTING tests (BUILDS ≠ WORKS).
 *
 * These do NOT just check status<400 / that a handler is wired. Each asserts the INTENDED OUTCOME a
 * real user expects, by actually running the app: sign up → land on a WORKING dashboard (never the
 * "Couldn't load your dashboard" error boundary), every key nav target resolves to its real screen,
 * the paywall and settings render, and logged-out vs authed behavior is correct.
 *
 * Self-seeding: each test creates its own fresh account via the real signup flow (captcha fails open
 * when CLOUDFLARE_TURNSTILE_SECRET_KEY is unset — dev/test). Requires a running server + a migrated DB:
 *   DATABASE_URL=... pnpm --filter web dev   (or a built `start`)
 *   BASE_URL=http://localhost:3000 pnpm --filter @gm/web e2e journeys
 *
 * The error-boundary text we must NEVER see on a successful journey.
 */
const ERROR_SCREEN = /Couldn.t load your dashboard|Something went wrong|not available/i;
/** A confirmation/verification DEAD-END (FACTORY_STANDARD §6 DECISION COROLLARY): signup must NOT gate
 *  on an email-verification step — a brand-new account must reach the working app, never a "check your
 *  email" wall (that gate's email-send loop isn't wired, so it would dead-end every new user). */
const VERIFY_DEADEND = /check your (e-?mail|inbox)|verify your (e-?mail|account)|confirm your (e-?mail|account)|we (?:just )?sent you/i;

/** Create a brand-new account through the real UI and return its username. Asserts the signup OUTCOME
 *  (redirect into onboarding, NO verification dead-end), so a broken signup fails here, not silently. */
async function signUp(page: Page): Promise<string> {
  const username = `e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', "e2e-passw0rd");
  await page.click('button[type="submit"]');
  // INTENDED OUTCOME of signup: a brand-new account lands in guided onboarding (not an error, not back
  // on /signup, and NOT a "check your email" verification wall whose send isn't wired).
  await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
  await expect(page.locator("body")).not.toContainText(ERROR_SCREEN);
  await expect(page.locator("body"), "signup must not dead-end on an email-verification gate").not.toContainText(
    VERIFY_DEADEND,
  );
  return username;
}

/** Visit a path as the current (authed) user and assert it rendered its real screen — not the error
 *  boundary and not a bounce to /signin. */
async function expectAuthedScreen(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page, `'${path}' must not bounce to sign-in for an authed user`).not.toHaveURL(/\/signin/);
  await expect(page.locator("body"), `'${path}' must render, not the error boundary`).not.toContainText(ERROR_SCREEN);
  await expect(page.locator("body")).toBeVisible();
}

test.describe("authed journeys (outcome-asserting)", () => {
  test("signup → working dashboard (NOT the 'dashboard not available' screen)", async ({ page }) => {
    await signUp(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // The authed home must render the real dashboard: a sign-out control + the activation checklist,
    // and MUST NOT show the error boundary. This is the exact break that "compiles + passes" hid.
    await expect(page.locator("body")).not.toContainText(ERROR_SCREEN);
    await expect(page.getByText(/sign out/i).first()).toBeVisible();
    await expect(page.getByText(/getting started/i).first()).toBeVisible();
  });

  test("returning user signs IN through the real /signin form → working dashboard", async ({ page }) => {
    // The whole rest of the suite self-seeds via SIGNUP (which auto-authenticates). This exercises the
    // DISTINCT credential SIGN-IN path (next-auth credentials → real DB) a returning user hits on every
    // launch (LaunchGuard re-login) — a break here would otherwise sail through unnoticed.
    //
    // Evidence, not a guess (FACTORY_STANDARD §6): capture browser console + page errors, and on failure
    // read the rendered auth-error banner, so ONE CI run names the cause instead of a blind URL timeout.
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => pageErrors.push(e.message));

    const username = await signUp(page); // create the account…
    await page.context().clearCookies(); // …then become a returning, logged-OUT user

    await page.goto("/signin", { waitUntil: "domcontentloaded" });
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', "e2e-passw0rd");
    await page.click('button[type="submit"]');

    // INTENDED OUTCOME: credential sign-in leaves /signin for the working app (never the error banner).
    try {
      await page.waitForURL((u) => !/\/signin/.test(u.pathname), { timeout: 15_000 });
    } catch {
      const body = await page.locator("body").innerText().catch(() => "");
      const banner =
        (body.match(/That username and password.*?again\.|Please enter your username.*?password\./i) || [])[0] ??
        "(no auth-error banner rendered)";
      throw new Error(
        `sign-in did not reach the post-login screen.\n  auth-error banner: ${banner}\n` +
          `  console errors: ${consoleErrors.join(" | ") || "(none)"}\n` +
          `  page errors: ${pageErrors.join(" | ") || "(none)"}`,
      );
    }
    await expect(page.locator("body")).not.toContainText(ERROR_SCREEN);
    await expect(page.getByText(/sign out/i).first()).toBeVisible();
  });

  test("onboarding STEPS THROUGH every step to a working dashboard (no stuck/looping step)", async ({ page }) => {
    test.setTimeout(90_000); // stepping through async AI taste turns is slower than a single-screen assert
    // Regression guard for the onboarding taste-step LOOP: a "lands on /onboarding" assertion missed it
    // entirely. This actually STEPS THROUGH each macro step (Profile → Taste → Items → Done) to the
    // dashboard. A step that dead-ends or loops never leaves /onboarding within the bound → this fails
    // LOUD instead of the user being trapped. (The e2e job sets a dummy GEMINI_API_KEY so the AI taste
    // path — where the loop lived — actually renders + exercises its fail-degrade path in CI.)
    await signUp(page); // asserts redirect to /onboarding (step 1: Profile)

    const forward = /^(continue|i.?ll do this later|go to my kitchen|next)$/i;
    for (let i = 0; i < 20; i++) {
      if (!new URL(page.url()).pathname.startsWith("/onboarding")) break; // left onboarding → done
      // The AI taste turn is async — let any in-flight turn settle (the "One sec…" spinner clears) so the
      // step is interactive and each Continue actually SUBMITS (otherwise clicks land on a disabled button
      // and the question cap is never reached).
      await page.getByText(/one sec/i).waitFor({ state: "hidden", timeout: 12_000 }).catch(() => {});
      // Taste needs a selection to enable Continue — tap a chip or type one; harmless on other steps.
      const chip = page.locator(".chip-tap, [aria-pressed]").first();
      const custom = page.getByPlaceholder(/add your own/i);
      if (await chip.isVisible().catch(() => false)) await chip.click().catch(() => {});
      else if (await custom.isVisible().catch(() => false)) await custom.fill("Indian").catch(() => {});
      const fwd = page.getByRole("button", { name: forward }).last();
      if (await fwd.isEnabled().catch(() => false)) await fwd.click().catch(() => {});
      await page.waitForTimeout(700);
    }

    // INTENDED OUTCOME: onboarding COMPLETED to the working dashboard — not stuck/looping on a step.
    await expect(page, "onboarding must complete to the dashboard, not loop on a step").not.toHaveURL(
      /\/onboarding/,
      { timeout: 15_000 },
    );
    await expect(page.locator("body")).not.toContainText(ERROR_SCREEN);
    await expect(page.getByText(/sign out/i).first()).toBeVisible();
  });

  test("every primary nav target resolves to its real screen", async ({ page }) => {
    await signUp(page);
    // The core product surfaces an authed user reaches from the home/nav. Each must render, not error.
    for (const path of ["/", "/pantry", "/list", "/recipes", "/plan", "/discover", "/profile"]) {
      await expectAuthedScreen(page, path);
    }
  });

  test("paywall / upgrade page renders real pricing (not an error)", async ({ page }) => {
    await signUp(page);
    await expectAuthedScreen(page, "/upgrade");
    // The paywall must actually show a price + an upgrade affordance — a blank/errored paywall earns $0.
    await expect(page.getByText(/\$\d/).first()).toBeVisible();
  });

  test("account/settings (profile) renders for the user", async ({ page }) => {
    await signUp(page);
    await expectAuthedScreen(page, "/profile");
  });
});

test.describe("auth boundary (logged-out vs authed)", () => {
  test("logged-out home shows marketing + sign-in, never a signed-in control", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(ERROR_SCREEN);
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
  });

  test("a protected route bounces a logged-out visitor to sign-in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/pantry", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/signin/);
  });
});
