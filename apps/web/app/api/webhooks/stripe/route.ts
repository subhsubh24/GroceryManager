/**
 * Stripe webhook handler — subscription lifecycle → entitlement sync.
 *
 * Translates Stripe subscription events into PreferenceSignal ledger entries so the rest of the
 * app can read `isPremium(signals)` without knowing about Stripe at all.
 *
 * Setup checklist (all values go into Vercel env vars — never committed):
 *   1. STRIPE_SECRET_KEY      — sk_live_… or sk_test_…
 *   2. STRIPE_WEBHOOK_SECRET  — whsec_… from Stripe Dashboard → Webhooks → signing secret
 *   3. STRIPE_PRICE_MONTHLY   — price_… for the $4.99/mo product
 *   4. STRIPE_PRICE_ANNUAL    — price_… for the $39.99/yr product
 *   5. On the Checkout Session, include metadata: { userId: "<db user id>" }
 *      so this handler can map Stripe events back to app users.
 *
 * Stripe retries on non-2xx. We always return 200 and log internally so retry storms never
 * hammer the database.
 */

import { getAdminDb, appendPreferenceSignal } from "@gm/db";
import { loadEnv } from "@gm/config/env";

export const runtime = "nodejs"; // needs raw body for signature verification

export async function POST(req: Request) {
  const env = loadEnv();
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  // ---------------------------------------------------------------------------
  // Signature verification (when STRIPE_WEBHOOK_SECRET is configured)
  // ---------------------------------------------------------------------------
  // When STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET are set, replace the JSON.parse block below
  // with Stripe SDK verification:
  //
  //   import Stripe from "stripe";
  //   const stripe = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
  //   let event: Stripe.Event;
  //   try {
  //     event = stripe.webhooks.constructEvent(rawBody, sig!, env.STRIPE_WEBHOOK_SECRET!);
  //   } catch (err) {
  //     return new Response(`Webhook signature verification failed: ${String(err)}`, { status: 400 });
  //   }
  //
  // Until then (no Stripe SDK installed), fail-closed when the secret is configured.
  if (env.STRIPE_WEBHOOK_SECRET) {
    // Fail-closed: when a webhook secret is configured, reject ALL requests until the Stripe SDK
    // is installed and `constructEvent` is wired (see the commented block above). Prevents an
    // accidental production deploy from accepting unauthenticated entitlement writes.
    // To enable: install `stripe` in apps/web, then uncomment constructEvent above.
    return new Response("Webhook signature verification not yet wired — add Stripe SDK first.", { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Parse payload
  // ---------------------------------------------------------------------------
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Handle subscription events
  // ---------------------------------------------------------------------------
  try {
    const obj = event.data.object as {
      status?: string;
      metadata?: { userId?: string };
      items?: { data?: Array<{ price?: { id?: string } }> };
    };

    const userId = obj.metadata?.userId;
    if (!userId) {
      // Without userId in metadata we can't sync. Checkout must include metadata: { userId }.
      // Return 200 so Stripe doesn't retry — this is a configuration issue, not a transient error.
      console.warn("[stripe-webhook] No userId in event metadata — skipping entitlement sync", { type: event.type });
      return new Response(null, { status: 200 });
    }

    const adminDb = getAdminDb();

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const isActive = obj.status === "active" || obj.status === "trialing";

      // Determine annual vs monthly from the price ID on the first subscription item
      const priceId = obj.items?.data?.[0]?.price?.id;
      let tier: "premium_annual" | "premium_monthly" | null = null;
      if (isActive) {
        if (env.STRIPE_PRICE_ANNUAL && priceId === env.STRIPE_PRICE_ANNUAL) {
          tier = "premium_annual";
        } else {
          tier = "premium_monthly";
        }
      }

      // Write the coarse entitlement signal (used by isPremium())
      await appendPreferenceSignal(adminDb, {
        userId,
        topic: "entitlement",
        value: isActive ? "premium" : null,
        polarity: isActive ? "positive" : "negative",
        source: "correction", // system-authoritative; correction is the closest available source
        confidence: 1.0,
      });

      // Write the fine-grained tier signal (used by getCurrentSubscriptionTier())
      if (tier) {
        await appendPreferenceSignal(adminDb, {
          userId,
          topic: "subscription_tier",
          value: tier,
          polarity: "positive",
          source: "correction",
          confidence: 1.0,
        });
      }

      // Mark that this user has held a subscription (disqualifies from future free trial)
      if (isActive && obj.status !== "trialing") {
        await appendPreferenceSignal(adminDb, {
          userId,
          topic: "subscription_renewal_at",
          value: new Date().toISOString(),
          polarity: "positive",
          source: "correction",
          confidence: 1.0,
        });
      }

      console.info("[stripe-webhook] Synced entitlement", { userId, type: event.type, status: obj.status, tier });
    } else if (event.type === "customer.subscription.deleted") {
      // Subscription cancelled / lapsed — revoke premium
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
      console.info("[stripe-webhook] Revoked entitlement", { userId, type: event.type });
    }
    // Other event types (invoice.paid, checkout.session.completed, etc.) are acknowledged but
    // not processed — the subscription.created/updated/deleted lifecycle covers entitlement state.
  } catch (e) {
    // Log but always return 200 — Stripe retries on non-200, which could cause duplicate signals
    // or hammer the DB if there's a persistent error. Log + Stripe dashboard alerts are the safety net.
    console.error("[stripe-webhook] Error processing event", e);
  }

  return new Response(null, { status: 200 });
}
