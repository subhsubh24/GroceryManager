"use server";

import { appendPreferenceSignal, getDb, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Developer/preview stand-in for the real Stripe webhook: grants the premium entitlement by writing
 * an `entitlement=premium` preference signal for the current user. Best-effort — never throws.
 * Replace with a Stripe checkout + webhook when billing is wired for real.
 */
export async function grantPremiumPreviewAction(): Promise<{ ok: boolean }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false };
    await withTenant(getDb(), userId, (tx) =>
      appendPreferenceSignal(tx, {
        userId,
        topic: "entitlement",
        value: "premium",
        polarity: "neutral",
        source: "rating",
        confidence: 1,
      }),
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
