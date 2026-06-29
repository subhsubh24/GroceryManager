import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";

/**
 * SIDE-EFFECT ROUND-TRIP (ROADMAP F4.1 / FACTORY_STANDARD §6 SIDE-EFFECT INTEGRITY).
 *
 * A "we sent you an email" message is a LIE unless an email actually LEFT the system and completes
 * its flow. This proves the waitlist double-opt-in as a GENUINE round-trip — NOT that a toast
 * appeared:
 *   submit the form → a real confirmation email is DISPATCHED to the right recipient → RETRIEVE it
 *   from the capture sink → follow the confirm link → the signup is CONFIRMED (server redirect proves
 *   the DB write happened). It also proves the UI never shows the "check your email" success state
 *   unless the email truly left, and that a tampered token does NOT confirm (no fake success).
 *
 * Capture sink: the app's email transport writes each outgoing email to EMAIL_CAPTURE_DIR as JSON
 * when that env var is set (TEST/CI only — it fails closed in any production runtime; see
 * `resolveEmailCaptureDir` in @gm/core/email). Both the running server AND this test must see the
 * SAME directory — the loop's preflight exports EMAIL_CAPTURE_DIR for both before starting the app.
 *
 * If EMAIL_CAPTURE_DIR is unset the round-trip can't be observed, so the spec SKIPS loudly rather
 * than passing vacuously (wiring it into the CI e2e job's server env is a `.github/` owner step —
 * tracked in PENDING_OPS; the loop runs this green locally at the readiness gate).
 */
const CAPTURE_DIR = process.env["EMAIL_CAPTURE_DIR"]?.trim();

/** The confirm URL the email embeds — host-agnostic so it works whether APP_URL points at localhost
 *  or the production domain (we only ever follow the path+query against the test's baseURL). */
const CONFIRM_PATH_RE = /\/api\/waitlist\/confirm\?[^\s"'<>)]+/;

/** Pull the captured email for a specific recipient from the sink (the filename embeds the recipient,
 *  so concurrent runs don't collide). Returns null until it appears (the send is async). */
function readCapturedFor(recipient: string): { html: string; text: string; to: string } | null {
  if (!CAPTURE_DIR) return null;
  const slug = recipient.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 80);
  let files: string[];
  try {
    files = readdirSync(CAPTURE_DIR).filter((f) => f.includes(slug) && f.endsWith(".json"));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  return JSON.parse(readFileSync(`${CAPTURE_DIR}/${files[0]}`, "utf8"));
}

test.describe("waitlist double-opt-in — real email round-trip", () => {
  test.skip(!CAPTURE_DIR, "EMAIL_CAPTURE_DIR not set — email capture sink unavailable (see PENDING_OPS)");

  test("submit → email dispatched → follow confirm link → confirmed (no fake success)", async ({
    page,
  }) => {
    const recipient = `e2e-roundtrip-${Date.now().toString(36)}@example.com`;

    // 1) Submit the waitlist form on the landing page.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill(recipient);
    await emailInput.press("Enter");

    // 2) SIDE-EFFECT INTEGRITY: the "check your email" success state appears ONLY because a real
    //    confirmation email left the system (capture sink ⇒ submitWaitlistEmail returns confirm_sent).
    //    A fake/optimistic success would be a release-blocking bug.
    await expect(page.locator("body")).toContainText(/check your email/i, { timeout: 15_000 });

    // 3) RETRIEVE the dispatched email from the sink (the send is async — poll briefly).
    let captured: ReturnType<typeof readCapturedFor> = null;
    await expect
      .poll(() => (captured = readCapturedFor(recipient)) !== null, {
        timeout: 10_000,
        message: "confirmation email was never dispatched to the capture sink",
      })
      .toBe(true);
    expect(captured!.to.toLowerCase()).toBe(recipient.toLowerCase());

    // 4) Extract the confirm link the email actually contains.
    const match = captured!.text.match(CONFIRM_PATH_RE) ?? captured!.html.match(CONFIRM_PATH_RE);
    expect(match, "the confirmation email must contain a /api/waitlist/confirm link").not.toBeNull();
    const confirmPath = match![0].replace(/&amp;/g, "&");

    // 5) A TAMPERED token must NOT confirm (proves confirmation isn't fake — bad signature ⇒ confirmed=0).
    await page.goto(confirmPath.replace(/token=[^&]+/, "token=deadbeef"), {
      waitUntil: "domcontentloaded",
    });
    expect(new URL(page.url()).searchParams.get("confirmed")).toBe("0");

    // 6) The REAL link confirms the signup — the redirect to ?confirmed=1 proves the DB write ran.
    await page.goto(confirmPath, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).searchParams.get("confirmed")).toBe("1");
  });
});
