"use server";

import { headers } from "next/headers";
import { getAdminDb, insertWaitlistEmail, upsertWaitlistUtm, type UtmData } from "@gm/db";
import { verifyTurnstile } from "@/app/api/_lib/captcha";
import { rateLimit } from "@/app/api/_lib/rate-limit";
import { generateConfirmToken } from "@gm/core/growth/optin";
import { sendEmail } from "@gm/core/email";

/**
 * Public waitlist capture (H8-hardened): rate-limited + CAPTCHA-gated + double-opt-in.
 *
 * Flow: validate → rate-limit per IP → verify CAPTCHA → persist (unconfirmed) → send a
 * confirmation email (best-effort; no-op until an email provider is connected). The signup
 * only counts as confirmed once the visitor clicks the emailed link (see
 * /api/waitlist/confirm), so visitor→signup reporting stays honest and the surface is abuse-safe.
 *
 * Returns silently on every rejection path — never leaks captcha/rate-limit/DB status to the caller.
 */
export async function submitWaitlistEmail(
  email: string,
  captchaToken?: string,
  utmData?: UtmData,
): Promise<void> {
  if (typeof email !== "string" || email.length > 254 || !email.includes("@")) return;
  const normalized = email.toLowerCase().trim();

  // Rate limit per IP (Track G G1) — generous but blocks scripted floods.
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  if (!rateLimit(`waitlist:${ip}`, 5, 60_000).allowed) {
    console.warn(`[waitlist] rate-limited ip-hash ts=${new Date().toISOString()}`);
    return;
  }

  // G5: Verify captcha — fail-open in dev (when key absent), enforce in prod
  const captcha = await verifyTurnstile(captchaToken ?? null);
  if (!captcha.success) {
    console.warn("[waitlist] captcha verification failed");
    return; // Silent fail — don't leak captcha status to the caller
  }

  // Persist to DB (requires migration 0012 — see PENDING_OPS.md). Falls back to console
  // logging if the table doesn't exist yet (safe on first deploy before migration is applied).
  // confirmed_at stays NULL until the double-opt-in link is clicked (migration 0015).
  try {
    // waitlist_submissions has no RLS; getAdminDb() is intentional (tenant-free table).
    const db = getAdminDb();
    await insertWaitlistEmail(db, normalized);
    // Persist UTM data if provided (requires migration 0013). Best-effort — never blocks sign-up.
    if (utmData) {
      await upsertWaitlistUtm(db, normalized, utmData);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const tableMissing = msg.includes("waitlist_submissions") && msg.includes("does not exist");
    console.warn(`[waitlist] insert failed table_missing=${tableMissing} ts=${new Date().toISOString()}`);
  }

  // Double-opt-in confirmation email (H8). Best-effort + no-op until an email provider is
  // connected (sendEmail returns { skipped: true } with no key) — never blocks the signup.
  try {
    await sendConfirmationEmail(normalized);
  } catch (err) {
    console.warn(`[waitlist] confirmation email failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function sendConfirmationEmail(email: string): Promise<void> {
  const base = (process.env["APP_URL"] ?? "https://grocerymanager.app").replace(/\/$/, "");
  const token = generateConfirmToken(email);
  const link = `${base}/api/waitlist/confirm?email=${encodeURIComponent(email)}&token=${token}`;

  await sendEmail({
    to: email,
    subject: "Confirm your spot on the GroceryManager waitlist",
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1a1f24">
  <h1 style="font-size:20px;margin:0 0 12px">You're almost in 🥗</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Tap the button below to confirm your spot on the GroceryManager waitlist. We'll let you know the moment we launch.</p>
  <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#0c8a3e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:15px;font-weight:600">Confirm my email</a></p>
  <p style="font-size:13px;line-height:1.5;color:#525d6a;margin:0">If you didn't sign up, you can safely ignore this email — no further messages will be sent.</p>
</div>`,
    text: `You're almost in! Confirm your spot on the GroceryManager waitlist:\n\n${link}\n\nIf you didn't sign up, ignore this email — no further messages will be sent.`,
  });
}
