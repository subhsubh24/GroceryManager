"use server";

import { getAdminDb, insertWaitlistEmail, upsertWaitlistUtm, type UtmData } from "@gm/db";
import { verifyTurnstile } from "@/app/api/_lib/captcha";

export async function submitWaitlistEmail(
  email: string,
  captchaToken?: string,
  utmData?: UtmData,
): Promise<void> {
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
    const db = getAdminDb();
    await insertWaitlistEmail(db, email);
    // Persist UTM data if provided (requires migration 0013). Best-effort — never blocks sign-up.
    if (utmData) {
      await upsertWaitlistUtm(db, email, utmData);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const tableMissing = msg.includes("waitlist_submissions") && msg.includes("does not exist");
    console.warn(`[waitlist] insert failed table_missing=${tableMissing} ts=${new Date().toISOString()}`);
  }
}
