/**
 * Password hashing for credentials login (PLAN §8.7). Uses the built-in `node:crypto` scrypt KDF —
 * no new dependency. Stored format is `salt:derivedHex` (both hex). Verification is constant-time
 * via `timingSafeEqual`, and length-mismatches short-circuit safely. Never log plaintext.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LEN = 16; // bytes
const KEY_LEN = 64; // derived key bytes

/** Hash a plaintext password → `salt:derivedHex` (a fresh random salt each call). */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const derived = scryptSync(plain, salt, KEY_LEN);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time verify of a plaintext password against a stored `salt:derivedHex`. */
export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = scryptSync(plain, salt, expected.length);
  // Lengths match by construction, but guard anyway — timingSafeEqual throws on a mismatch.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// A throwaway hash used to keep credential verification constant-COST when no account (or no
// password hash) exists for a username. Lazily derived once per process from random bytes, so it
// never matches any real password and doesn't tax module import. See verifyPasswordConstantTime.
let dummyHash: string | null = null;
function getDummyHash(): string {
  if (dummyHash === null) dummyHash = hashPassword(randomBytes(32).toString("hex"));
  return dummyHash;
}

/**
 * Constant-work credential check for authentication entry points. Runs the full scrypt KDF whether
 * or not `stored` is a real hash, so an "unknown username / Google-only account (no password set)"
 * pays the SAME cost as a "wrong password" — closing the timing side-channel that would otherwise
 * let an attacker enumerate valid usernames by response latency (a per-IP rate-limit and a generic
 * error message do NOT close a timing oracle; distributed IPs and precise client-side latency
 * measurement defeat both). ALWAYS use this at login endpoints instead of a
 * `!user?.passwordHash || verifyPassword(...)` short-circuit, which skips scrypt on the no-user
 * path and leaks account existence. Returns false on any absent/malformed `stored`.
 */
export function verifyPasswordConstantTime(
  plain: string,
  stored: string | null | undefined,
): boolean {
  if (!stored) {
    // Do equivalent scrypt work against the throwaway hash, then fail — no early-out timing tell.
    verifyPassword(plain, getDummyHash());
    return false;
  }
  return verifyPassword(plain, stored);
}
