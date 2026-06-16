/**
 * Referrals (PLAN §10 growth) — pure, testable helpers for the "invite a friend" loop. A user shares
 * a personal link (`/signup?ref=<code>`); when a friend signs up through it, both are credited.
 *
 * Pure + no I/O: the code is minted/stored and credited on the PreferenceSignal ledger by @gm/db
 * (mirroring the cookbook share-token pattern). These helpers just guard the code's shape and count
 * distinct joins — they stay here so they're cheap to unit-test and reused on both invite + signup.
 */

/**
 * Shape check for a referral code (the `?ref=` query param): 8–64 chars of the url-safe base64url
 * alphabet (`A–Z a–z 0–9 _ -`). Validated BEFORE any DB lookup so junk, empty, or injection-flavored
 * input ("/", spaces, "%", quotes) is rejected up front — never a substitute for the parameterized
 * `eq` lookup, just a cheap gate. Codes are minted with `randomBytes(9).toString("base64url")`
 * (~12 chars), so this range fits comfortably.
 */
export function isValidReferralCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(code);
}

/**
 * Count of DISTINCT, non-empty joined user ids — the "N friends joined" number for the invite page.
 * The ledger is append-only and attribution is idempotent, but de-duping here keeps the count honest
 * even if the same id ever appears twice (and drops any empty/whitespace ids defensively).
 */
export function countJoined(joinedUserIds: string[]): number {
  const distinct = new Set<string>();
  for (const id of joinedUserIds) {
    if (typeof id === "string" && id.trim().length > 0) distinct.add(id);
  }
  return distinct.size;
}
