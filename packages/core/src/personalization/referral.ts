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

/** Injected I/O for {@link attributeReferralBestEffort} — the DB reads/writes live in @gm/db, but the
 *  §32 best-effort CONTRACT stays pure + unit-testable by taking them as dependencies. Either may throw
 *  / reject; the helper swallows it (that's the whole point of the guarantee). */
export interface ReferralAttributionDeps {
  /** Resolve a referral code to the referrer's user id (`null` if unknown). */
  resolveReferrer: (code: string) => Promise<string | null>;
  /** Credit the referrer for the new signup. Idempotent + best-effort in @gm/db. */
  recordReferral: (referrerUserId: string, newUserId: string) => Promise<void>;
}

/** Why attribution did / didn't happen — a total (never-throwing) result the signup path can ignore. */
export type ReferralAttributionResult =
  | { attributed: true; referrerUserId: string }
  | { attributed: false; reason: "no-code" | "invalid-code" | "unknown-referrer" | "error" };

/**
 * Best-effort referral attribution for the signup path (FACTORY_STANDARD §32). Crediting the referrer
 * is a NON-ESSENTIAL side-effect: the account already exists and is about to be signed in, so this must
 * NEVER hard-block or throw out of account creation. This helper centralizes that contract — validate
 * the code, resolve the referrer, record the credit — and CATCHES EVERYTHING, so a bad/unknown code or a
 * DB hiccup can never abort signup. It NEVER throws; the worst case is `{ attributed: false, reason:
 * "error" }`. DB I/O is injected so the guarantee is provable by a unit test that forces every dep to
 * throw (see `referral.test.ts`) — the regression guard the §32 audit (issue #370) called for.
 */
export async function attributeReferralBestEffort(
  code: string | null | undefined,
  newUserId: string,
  deps: ReferralAttributionDeps,
): Promise<ReferralAttributionResult> {
  const ref = (code ?? "").trim();
  if (!ref) return { attributed: false, reason: "no-code" };
  if (!isValidReferralCode(ref)) return { attributed: false, reason: "invalid-code" };
  try {
    const referrerUserId = await deps.resolveReferrer(ref);
    if (!referrerUserId) return { attributed: false, reason: "unknown-referrer" };
    await deps.recordReferral(referrerUserId, newUserId);
    return { attributed: true, referrerUserId };
  } catch {
    // Swallow the BLOCK (§32) — attribution failing must not surface to the user or break signup.
    return { attributed: false, reason: "error" };
  }
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
