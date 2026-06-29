/**
 * RevenueCat webhook handler — mobile in-app-purchase lifecycle → entitlement sync.
 *
 * The native app (apps/mobile) calls `Purchases.logIn(<db user id>)`, so RevenueCat's `app_user_id`
 * IS our user id. This handler translates RevenueCat subscription events into the SAME PreferenceSignal
 * ledger entries the Stripe webhook writes, so the rest of the app reads `isPremium(signals)` /
 * `getCurrentSubscriptionTier(signals)` without knowing whether the purchase came from web (Stripe) or
 * device (App Store / Play via RevenueCat).
 *
 * Auth: RevenueCat lets you set a custom Authorization header value per webhook
 * (Project → Webhooks → "Authorization header value"). We verify it (timing-safe) against
 * REVENUECAT_WEBHOOK_AUTH and FAIL CLOSED when the env var is unset (prod misconfig must not accept
 * unauthenticated entitlement writes — same posture as the Stripe handler).
 *
 * Setup (all values go into env vars — never committed): see PENDING_OPS.md / docs/LAUNCH.md.
 *   - REVENUECAT_WEBHOOK_AUTH         the shared Authorization value (this route verifies it)
 *   - EXPO_PUBLIC_REVENUECAT_IOS_KEY  / _ANDROID_KEY  the PUBLIC SDK keys (mobile app)
 *   - In RevenueCat: a "premium" entitlement attached to the monthly/annual products, and product
 *     ids whose names contain "annual"/"family" so the tier maps correctly below.
 *
 * RevenueCat retries on non-2xx, so we always return 200 after auth and log internally.
 */
import { createHash, timingSafeEqual } from "crypto";
import { getAdminDb, appendPreferenceSignal } from "@gm/db";
import { loadEnv } from "@gm/config/env";

export const runtime = "nodejs";

type RcTier = "premium_annual" | "premium_monthly" | "premium_family";

/** Events that mean the user currently HAS access. CANCELLATION/BILLING_ISSUE keep access until EXPIRATION. */
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "TRANSFER",
]);
/** Events that mean access has ended. */
const REVOKE_EVENTS = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED"]);

function tierFromProduct(productId: string | undefined | null): RcTier {
  const p = (productId ?? "").toLowerCase();
  if (p.includes("family")) return "premium_family";
  if (p.includes("annual") || p.includes("year")) return "premium_annual";
  return "premium_monthly";
}

function authorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  // Compare SHA-256 digests so the buffers are always equal-length (no length-leak / UTF-8 length
  // mismatch) and the comparison is constant-time.
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(digest(header), digest(secret));
}

export async function POST(req: Request) {
  const env = loadEnv();

  // Fail closed: never accept unauthenticated entitlement writes. Return the SAME 401 whether the
  // secret is unset or the token is wrong, so the response can't be used to probe configuration state.
  if (
    !env.REVENUECAT_WEBHOOK_AUTH ||
    !authorized(req.headers.get("authorization"), env.REVENUECAT_WEBHOOK_AUTH)
  ) {
    return new Response("Unauthorized.", { status: 401 });
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = (await req.json()) as { event?: Record<string, unknown> };
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }

  const event = body.event ?? {};
  const type = typeof event.type === "string" ? event.type : "";
  const userId = typeof event.app_user_id === "string" ? event.app_user_id : null;

  // TEST events (and anything without a real user) are acknowledged, not processed.
  if (type === "TEST" || !userId) {
    return new Response(null, { status: 200 });
  }

  try {
    const adminDb = getAdminDb();

    if (GRANT_EVENTS.has(type)) {
      const tier = tierFromProduct(event.product_id as string | undefined);
      await appendPreferenceSignal(adminDb, {
        userId,
        topic: "entitlement",
        value: "premium",
        polarity: "positive",
        source: "correction", // system-authoritative
        confidence: 1.0,
      });
      await appendPreferenceSignal(adminDb, {
        userId,
        topic: "subscription_tier",
        value: tier,
        polarity: "positive",
        source: "correction",
        confidence: 1.0,
      });
      // A non-trial purchase disqualifies from a future free trial (mirrors the Stripe handler).
      if (event.period_type !== "TRIAL") {
        await appendPreferenceSignal(adminDb, {
          userId,
          topic: "subscription_renewal_at",
          value: new Date().toISOString(),
          polarity: "positive",
          source: "correction",
          confidence: 1.0,
        });
      }
      console.info("[revenuecat-webhook] Synced entitlement", { userId, type, tier });
    } else if (REVOKE_EVENTS.has(type)) {
      await appendPreferenceSignal(adminDb, {
        userId,
        topic: "entitlement",
        value: null,
        polarity: "negative",
        source: "correction",
        confidence: 1.0,
      });
      await appendPreferenceSignal(adminDb, {
        userId,
        topic: "subscription_tier",
        value: null,
        polarity: "negative",
        source: "correction",
        confidence: 1.0,
      });
      console.info("[revenuecat-webhook] Revoked entitlement", { userId, type });
    }
    // CANCELLATION / BILLING_ISSUE / SUBSCRIBER_ALIAS etc. — access persists until EXPIRATION; no-op.
  } catch (e) {
    // Log but always 200 — RevenueCat retries on non-200, which could hammer the DB on a persistent error.
    console.error("[revenuecat-webhook] Error processing event", e);
  }

  return new Response(null, { status: 200 });
}
