/**
 * H10 — Deterministic, stable variant assignment for A/B experiments.
 *
 * Uses HMAC-SHA256 over `${userId}:${experimentId}` so the same user always
 * lands in the same bucket for the same experiment. Pure, no I/O.
 */
import { createHmac } from "node:crypto";

/**
 * Assign a user to one of the provided `variants` for an experiment.
 *
 * Deterministic: same `userId` + `experimentId` + `variants` array → same result every call.
 * Uniform: maps the first 4 bytes of the HMAC digest to an index across variants.
 *
 * @param userId       The user's UUID (or any stable string id).
 * @param experimentId A stable experiment identifier (e.g. "landing_hero").
 * @param variants     Ordered list of variant names (e.g. ["a","b","c"]).
 * @param secret       HMAC key — should come from env (EXPERIMENT_SECRET / WAITLIST_OPTIN_SECRET).
 * @returns The assigned variant name.
 */
export function assignVariant(
  userId: string,
  experimentId: string,
  variants: string[],
  secret: string,
): string {
  if (variants.length === 0) throw new Error("variants must be non-empty");
  const digest = createHmac("sha256", secret)
    .update(`${userId}:${experimentId}`)
    .digest();
  // Read first 4 bytes as an unsigned 32-bit integer.
  const bucket = digest.readUInt32BE(0);
  return variants[bucket % variants.length]!;
}
