"use server";

import { getDb, recordSwipeSignals, withTenant } from "@gm/db";
import { swipeToSignals } from "@gm/core/recipe";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Record one Discover swipe — append its signals (a `recipe_seen` marker, plus a `cuisine:<x>`
 * affinity signal when the cuisine is known) to the preference ledger so the swipe trains the taste
 * model. Session-scoped (no session → no-op) and best-effort: it never throws to the client. The UI
 * fires this and advances immediately regardless of the result, so a hiccup never blocks swiping.
 */
export async function recordSwipeAction(input: {
  recipeId: string;
  cuisine?: string;
  dir: "like" | "skip";
}): Promise<{ ok: boolean }> {
  try {
    if (!input.recipeId) return { ok: false };
    const userId = await currentUserId();
    if (!userId) return { ok: false };

    await withTenant(getDb(), userId, (tx) =>
      recordSwipeSignals(tx, userId, swipeToSignals(input, input.dir)),
    );
    return { ok: true };
  } catch {
    // DB/auth hiccup — swipes are best-effort; the client already advanced.
    return { ok: false };
  }
}
