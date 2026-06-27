/**
 * H10 — Server-side experiment helpers for apps/web.
 *
 * Wires bucketing (pure, from @gm/core) + DB logging (from @gm/db) together with the session.
 * Both operations are fully BEST-EFFORT: a DB write failure, missing env var, or missing session
 * never throws out to the caller — this must never block the user's request.
 *
 * Do NOT import drizzle-orm here; only @gm/db and @gm/core.
 */
import { assignVariant } from "@gm/core/growth/experiments";
import { getDb, withTenant, logExposure, logConversion } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";
import { getExperiment } from "@gm/core/growth/experiments";

/** Reads the HMAC secret for experiment bucketing (reuses the optin secret pattern). */
function getExperimentSecret(): string {
  // Prefer a dedicated EXPERIMENT_SECRET; fall back through other configured secrets and finally to
  // AUTH_SECRET/NEXTAUTH_SECRET, which are ALWAYS present in any real deployment (next-auth requires
  // one). No hardcoded literal: bucketing is a UI-variant boundary (not auth), but a known constant
  // would let an outsider predict assignments, so we key off a per-deploy secret instead. If none is
  // set (only possible in a bare local run), the empty string degrades gracefully — assignVariant is
  // wrapped in try/catch by the caller and falls back to the ?v= / "a" control.
  return (
    process.env["EXPERIMENT_SECRET"] ??
    process.env["WAITLIST_OPTIN_SECRET"] ??
    process.env["EMAIL_UNSUBSCRIBE_SECRET"] ??
    process.env["AUTH_SECRET"] ??
    process.env["NEXTAUTH_SECRET"] ??
    ""
  );
}

/**
 * Deterministically assign a signed-in user to a variant for the given experiment,
 * then log the exposure best-effort in the DB.
 *
 * Returns null when:
 *   - the user is not signed in (logged-out visitors keep the existing ?v= / "a" fallback)
 *   - the experiment is not found in the registry
 *   - any error occurs (always degrades gracefully)
 */
export async function assignAndLogVariant(experimentId: string): Promise<string | null> {
  try {
    const userId = await currentUserId();
    if (!userId) return null;

    const exp = getExperiment(experimentId);
    if (!exp) return null;

    const secret = getExperimentSecret();
    const variant = assignVariant(userId, experimentId, exp.variants, secret);

    // Log exposure best-effort — swallow all errors so this never blocks the request.
    try {
      await withTenant(getDb(), userId, async (tx) => {
        await logExposure(tx, userId, experimentId, variant);
      });
    } catch {
      // Intentionally swallowed — exposure logging is best-effort.
    }

    return variant;
  } catch {
    return null;
  }
}

/**
 * Record a conversion event for the given experiment, best-effort.
 * Call after a successful action (e.g. waitlist signup) from a client component via a
 * server action — or call directly from a Server Component if the action is server-side.
 *
 * Does nothing (silently) when the user is not signed in or the experiment isn't found.
 */
export async function trackExperimentConversion(
  experimentId: string,
  eventName: string,
): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;

    const exp = getExperiment(experimentId);
    if (!exp) return;

    try {
      await withTenant(getDb(), userId, async (tx) => {
        await logConversion(tx, userId, experimentId, eventName);
      });
    } catch {
      // Intentionally swallowed — conversion logging is best-effort.
    }
  } catch {
    // Never propagate.
  }
}
