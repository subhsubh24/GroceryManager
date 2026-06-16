/**
 * Discover — a swipeable "for you" recipe feed (PLAN §10 growth). Pure helpers only: the deck
 * selection and the swipe→signal mapping live here so they stay testable with no key and no I/O.
 *
 * The taste flywheel: every swipe appends to the same append-only PreferenceSignal ledger the rest
 * of the app reads. A swipe ALWAYS records a `recipe_seen` marker (unprefixed topic → ignored by
 * projectUserModel; used only to drop already-seen cards from future decks). When the recipe's
 * cuisine is known a swipe ALSO records a `cuisine:<x>` signal — the EXACT topic/polarity
 * projectUserModel reads for `cuisineAffinity` (see personalization/user-model.ts: `case "cuisine"`
 * sums sign(polarity)*confidence and takes Math.tanh) — positive for a like, negative for a skip.
 * So liking Thai dishes nudges Thai up; skipping them nudges it down, exactly like the cook/skip
 * loops and the cookbook-save flywheel.
 */

/** Topic for the "I've shown the user this recipe" marker. Unprefixed so projectUserModel ignores it. */
export const RECIPE_SEEN_TOPIC = "recipe_seen";

export type SwipeDirection = "like" | "skip";

// Mirror the ledger enums (@gm/db appendPreferenceSignal / schema prefPolarityEnum + prefSourceEnum)
// so a SwipeSignalInput drops straight into recordSwipeSignals without a cast.
type SignalPolarity = "positive" | "negative" | "neutral";
type SignalSource =
  | "onboarding_q"
  | "meal_log"
  | "skip"
  | "reorder"
  | "waste"
  | "rating"
  | "chat"
  | "correction";

export type SwipeSignalInput = {
  topic: string;
  value: string | null;
  polarity: SignalPolarity;
  source: SignalSource;
  confidence: number;
};

/**
 * The next deck for Discover: drop candidates the user has already seen, dedupe by id (first wins),
 * preserve input order, and cap to `limit`. Pure — the caller passes ranked candidates (from the
 * pantry→provider→rank loader) and the user's seen ids.
 */
export function nextDiscoveryBatch<T extends { id: string }>(
  candidates: T[],
  seenIds: string[],
  limit = 12,
): T[] {
  const seen = new Set(seenIds);
  const picked = new Set<string>();
  const out: T[] = [];
  for (const c of candidates) {
    if (seen.has(c.id) || picked.has(c.id)) continue;
    picked.add(c.id);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Map one swipe to the ledger signals it should append. ALWAYS emits the `recipe_seen` marker (so the
 * card never resurfaces). When `cuisine` is present, ALSO emits a `cuisine:<x>` affinity signal —
 * positive for "like", negative for "skip", at a modest 0.5 confidence — which is exactly what
 * projectUserModel folds into `cuisineAffinity` (and, past ±0.3, loves/dislikes).
 */
export function swipeToSignals(
  input: { recipeId: string; cuisine?: string },
  dir: SwipeDirection,
): SwipeSignalInput[] {
  const signals: SwipeSignalInput[] = [
    {
      topic: RECIPE_SEEN_TOPIC,
      value: input.recipeId,
      polarity: "neutral",
      source: "rating",
      confidence: 1,
    },
  ];

  const cuisine = input.cuisine?.trim().toLowerCase();
  if (cuisine) {
    signals.push({
      topic: `cuisine:${cuisine}`,
      value: input.cuisine!.trim(),
      polarity: dir === "like" ? "positive" : "negative",
      source: "rating",
      confidence: 0.5,
    });
  }

  return signals;
}
