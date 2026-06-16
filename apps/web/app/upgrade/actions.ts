"use server";

import { revalidatePath } from "next/cache";
import { appendPreferenceSignal, getDb, withTenant } from "@gm/db";
import { ENTITLEMENT_TOPIC, PREMIUM_VALUE } from "@gm/core/billing";
import { currentUserId } from "@/app/lib/tenant";

/**
 * PREVIEW-ONLY stand-in for the real Stripe webhook. Once billing is wired, a verified
 * `checkout.session.completed` webhook would write this exact entitlement signal server-side; until
 * then this lets us flip the current user to premium for testing the gate. It grants entitlement to
 * WHOEVER is signed in (no payment, no verification) — never call it from a real purchase path.
 *
 * Writes an `entitlement = "premium"` signal onto the append-only preference ledger via `withTenant`
 * (so the INSERT satisfies RLS), then revalidates /upgrade so the page reflects the new state.
 * Best-effort: any failure (auth/DB) is swallowed and reported as `{ ok: false }`.
 */
export async function grantPremiumPreviewAction(): Promise<{ ok: boolean }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false };

    await withTenant(getDb(), userId, (tx) =>
      appendPreferenceSignal(tx, {
        userId,
        topic: ENTITLEMENT_TOPIC,
        value: PREMIUM_VALUE,
        polarity: "neutral",
        source: "rating", // a valid ledger source; the unprefixed topic is ignored by projectUserModel
        confidence: 1,
      }),
    );
    revalidatePath("/upgrade");
    return { ok: true };
  } catch {
    // Preview helper — a DB/auth hiccup must never surface to the user.
    return { ok: false };
  }
}
