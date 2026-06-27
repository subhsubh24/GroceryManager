"use server";

import { getAdminDb, insertWaitlistEmail } from "@gm/db";
import { verifyTurnstile } from "@/app/api/_lib/captcha";

export async function submitWaitlistEmail(email: string, captchaToken?: string): Promise<void> {
  if (typeof email !== "string" || email.length > 254 || !email.includes("@")) return;

  // G5: Verify captcha — fail-open in dev (when key absent), enforce in prod
  const captcha = await verifyTurnstile(captchaToken ?? null);
  if (!captcha.success) {
    console.warn("[waitlist] captcha verification failed");
    return; // Silent fail — don't leak captcha status to the caller
  }

  // Persist to DB (requires migration 0012 — see PENDING_OPS.md). Falls back to console
  // logging if the table doesn't exist yet (safe on first deploy before migration is applied).
  try {
    // waitlist_submissions has no RLS; getAdminDb() is intentional (tenant-free table).
    await insertWaitlistEmail(getAdminDb(), email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const tableMissing = msg.includes("waitlist_submissions") && msg.includes("does not exist");
    console.warn(`[waitlist] insert failed table_missing=${tableMissing} ts=${new Date().toISOString()}`);
  }
}
