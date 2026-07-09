/**
 * Beta INVITE CODES (ROADMAP §34 Part B) — pure, framework-agnostic code logic.
 *
 * The gated-beta funnel is: waitlist → the owner issues each invited person a code → the person
 * enters it at `/join` → a valid code lets them past the pre-launch site gate to `/signup` and the
 * real app. A code is a per-person BETA KEY, not a one-shot token: re-entry (a cleared cookie, a
 * second device) must keep working, so redemption is idempotent (see `redeemWaitlistInvite` in
 * `@gm/db`). The FIRST redemption is stamped for cohort metrics.
 *
 * Only the alphabet + shape + normalization live here so they are unit-tested keyless in CI (the
 * self-validation `invite-code-redeem` capability). Generation injects its randomness so it stays
 * pure/testable; the DB layer supplies `node:crypto` `randomBytes` and handles uniqueness. Codes are
 * NEVER derived from the email (that would be guessable) — they are high-entropy random.
 */

/**
 * Crockford-style base32 minus the ambiguous glyphs (no I, L, O, U) so a code is safe to read aloud,
 * type on a phone, and paste from an email without transcription errors. 30 symbols.
 */
export const INVITE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Code length in symbols. 10 × log2(32) ≈ 50 bits of entropy — with the redeem route's per-IP rate
 *  limit, brute-forcing a valid code is infeasible, and the valid set is only the invited cohort. */
export const INVITE_CODE_LENGTH = 10;

const ALPHABET_SET = new Set(INVITE_CODE_ALPHABET.split(""));
const CODE_RE = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/**
 * Normalize user-entered input to the canonical code: uppercase, and drop everything that isn't an
 * alphabet symbol (spaces, hyphens the display format adds, and common look-alikes O→0, I/L→1). This
 * makes entry forgiving without ever accepting a genuinely different code. Bounded scan (callers cap
 * input length before this, but we also hard-cap here so a pathological paste can't spin).
 */
export function normalizeInviteCode(raw: string): string {
  let out = "";
  const upper = raw.toUpperCase();
  for (let i = 0; i < upper.length && out.length < INVITE_CODE_LENGTH; i++) {
    let c = upper[i]!;
    // Fold the ambiguous glyphs the alphabet deliberately omits onto their intended symbol.
    if (c === "O") c = "0";
    else if (c === "I" || c === "L") c = "1";
    else if (c === "U") c = "V";
    if (ALPHABET_SET.has(c)) out += c;
  }
  return out;
}

/** True when `code` is already exactly a canonical code (used on the already-normalized value). */
export function isValidInviteCodeFormat(code: string): boolean {
  return CODE_RE.test(code);
}

/** Normalize then validate — the single check a route/DB call should use on untrusted input. */
export function normalizeAndValidate(raw: string): string | null {
  const norm = normalizeInviteCode(raw);
  return isValidInviteCodeFormat(norm) ? norm : null;
}

/**
 * Render a canonical code for display/email as `XXXXX-XXXXX` (two groups of five) — easier to read
 * and type. `normalizeInviteCode` strips the hyphen back out, so display and entry round-trip.
 */
export function formatInviteCodeForDisplay(code: string): string {
  const norm = normalizeInviteCode(code);
  if (norm.length !== INVITE_CODE_LENGTH) return norm;
  return `${norm.slice(0, 5)}-${norm.slice(5)}`;
}

/**
 * Generate a canonical code from an injected random-byte source (the DB layer passes
 * `node:crypto`'s `randomBytes`). Rejection-samples so every symbol is uniform over the 32-symbol
 * alphabet (no modulo bias). Pure given the source, so it is unit-tested with a deterministic stub.
 */
export function generateInviteCode(randomBytes: (n: number) => Uint8Array): string {
  let out = "";
  while (out.length < INVITE_CODE_LENGTH) {
    // Draw a batch; keep only the low 5 bits when they land in [0,32) — a no-op here since the
    // alphabet is exactly 32 symbols, so every 5-bit value maps 1:1 with zero rejection.
    const batch = randomBytes(INVITE_CODE_LENGTH);
    for (let i = 0; i < batch.length && out.length < INVITE_CODE_LENGTH; i++) {
      out += INVITE_CODE_ALPHABET[batch[i]! & 31]!;
    }
  }
  return out;
}
