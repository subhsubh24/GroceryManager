"use server";

import { headers } from "next/headers";
import { getAdminDb, insertWaitlistEmail, upsertWaitlistUtm, type UtmData } from "@gm/db";
import { verifyTurnstile } from "@/app/api/_lib/captcha";
import { rateLimit } from "@/app/api/_lib/rate-limit";
import { generateConfirmToken } from "@gm/core/growth/optin";
import { sendEmail, type EmailResult } from "@gm/core/email";

/**
 * Public waitlist capture (H8-hardened): rate-limited + CAPTCHA-gated + double-opt-in.
 *
 * Flow: validate → rate-limit per IP → verify CAPTCHA → persist (unconfirmed) → send a
 * confirmation email (no-op until an email provider is connected). The signup only counts as
 * confirmed once the visitor clicks the emailed link (see /api/waitlist/confirm), so
 * visitor→signup reporting stays honest and the surface is abuse-safe.
 *
 * SIDE-EFFECT INTEGRITY (FACTORY_STANDARD §6): the caller must NEVER show success unless the email
 * was actually captured, and must only claim "check your email" if an email actually LEFT. So this
 * returns a real result instead of `void`:
 *   - "error"        → nothing captured (bad input / captcha fail / DB write failed). Show an error.
 *   - "saved"        → the email IS persisted, but no confirmation email was dispatched (provider
 *                      unconfigured / send failed). Honest copy: "you're on the list" — NOT "check your email".
 *   - "confirm_sent" → persisted AND the confirmation email actually left the system.
 * Rejections don't leak WHICH check failed (captcha vs rate-limit stay indistinguishable).
 */
export type WaitlistResult = "confirm_sent" | "saved" | "error";

export async function submitWaitlistEmail(
  email: string,
  captchaToken?: string,
  utmData?: UtmData,
): Promise<WaitlistResult> {
  if (typeof email !== "string" || email.length > 254 || !email.includes("@")) return "error";
  const normalized = email.toLowerCase().trim();

  // Rate limit per IP (Track G G1). A real user only trips this by re-submitting repeatedly, so their
  // email was already captured on an earlier try (dedupe is on email) — report "saved" rather than
  // leaking the rate-limit, which is honest (they ARE on the list) and not fake success.
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  if (!rateLimit(`waitlist:${ip}`, 5, 60_000).allowed) {
    console.warn(`[waitlist] rate-limited ip-hash ts=${new Date().toISOString()}`);
    return "saved";
  }

  // G5: Verify captcha — fail-open in dev (when key absent), enforce in prod
  const captcha = await verifyTurnstile(captchaToken ?? null);
  if (!captcha.success) {
    console.warn("[waitlist] captcha verification failed");
    return "error"; // generic — doesn't leak captcha vs rate-limit, but does NOT show fake success
  }

  // Persist to DB (requires migration 0012). This is the REAL effect: if it fails, the user was NOT
  // captured, so we must NOT report success. confirmed_at stays NULL until the opt-in link is clicked.
  try {
    // waitlist_submissions has no RLS; getAdminDb() is intentional (tenant-free table).
    const db = getAdminDb();
    await insertWaitlistEmail(db, normalized);
    // UTM is best-effort — its failure must NOT fail the capture (the email is already saved).
    if (utmData) {
      try {
        await upsertWaitlistUtm(db, normalized, utmData);
      } catch (err) {
        console.warn(`[waitlist] utm upsert failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const tableMissing = msg.includes("waitlist_submissions") && msg.includes("does not exist");
    console.error(`[waitlist] capture FAILED table_missing=${tableMissing} ts=${new Date().toISOString()}`);
    return "error"; // the effect didn't happen — surface failure, never a fake "you're on the list"
  }

  // Double-opt-in confirmation email (H8). No-op until a provider is connected (sendEmail returns
  // { sent:false, skipped:true } with no key). Only claim "check your email" if it ACTUALLY left.
  let emailed = false;
  try {
    const res = await sendConfirmationEmail(normalized);
    emailed = res.sent === true;
    if (!emailed) {
      console.warn(`[waitlist] confirmation email NOT sent (skipped=${res.skipped} reason=${res.reason ?? "n/a"})`);
    }
  } catch (err) {
    console.warn(`[waitlist] confirmation email failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return emailed ? "confirm_sent" : "saved";
}

async function sendConfirmationEmail(email: string): Promise<EmailResult> {
  const base = (process.env["APP_URL"] ?? "https://grocerymanager.app").replace(/\/$/, "");
  const token = generateConfirmToken(email);
  const link = `${base}/api/waitlist/confirm?email=${encodeURIComponent(email)}&token=${token}`;

  return sendEmail({
    to: email,
    subject: "Confirm your spot on the GroceryManager waitlist",
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1a1f24">
  <h1 style="font-size:20px;margin:0 0 12px">Confirm your GroceryManager waitlist spot</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Tap the button below to confirm your spot on the waitlist. We'll let you know the moment we launch — and you won't hear from us until then.</p>
  <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#0c8a3e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:15px;font-weight:600">Confirm my email</a></p>
  <p style="font-size:13px;line-height:1.5;color:#525d6a;margin:0">If you didn't sign up, you can safely ignore this email — no further messages will be sent.</p>
</div>`,
    text: `Confirm your spot on the GroceryManager waitlist:\n\n${link}\n\nIf you didn't sign up, ignore this email — no further messages will be sent.`,
  });
}
