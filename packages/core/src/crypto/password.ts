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
