"use server";

import { appendPreferenceSignal, getDb, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Permanently dismiss the home page's first-run "Getting started" checklist by appending a
 * `dismissed_getting_started` marker to the preference ledger (best-effort, never throws). The topic
 * is intentionally unprefixed so `projectUserModel` ignores it — it's a UI flag, not a taste signal.
 * The home page's `loadFirstRun` reads this marker and hides the card once it's present.
 */
export async function dismissGettingStartedAction(): Promise<{ ok: boolean }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false };
    await withTenant(getDb(), userId, (tx) =>
      appendPreferenceSignal(tx, {
        userId,
        topic: "dismissed_getting_started",
        value: "1",
        polarity: "neutral",
        source: "correction",
        confidence: 1,
      }),
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
