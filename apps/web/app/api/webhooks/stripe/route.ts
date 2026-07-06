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
 *   5. STRIPE_PRICE_FAMILY    — price_… for the $9.99/mo Family plan (up to 5 members)
 *   5. On the Checkout Session, include metadata: { userId: "<db user id>" }
 *      so this handler can map Stripe events back to app users.
 *
 * Stripe retries on non-2xx. We always return 200 and log internally so retry storms never
 * hammer the database.
 */

import Stripe from "stripe";
import { getAdminDb, appendPreferenceSignal } from "@gm/db";
import { loadEnv } from "@gm/config/env";

export const runtime = "nodejs"; // needs raw body for signature verification

export async function POST(req: Request) {
  const env = loadEnv();
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  // ---------------------------------------------------------------------------
  // Require both keys — fail closed without them
  // ---------------------------------------------------------------------------
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe not configured.", { status: 400 });
  }

  // Require signature header
  if (!sig) {
    return new Response("Missing stripe-signature header.", { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Signature verification via Stripe SDK
  // ---------------------------------------------------------------------------
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Webhook signature verification failed.", { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Handle subscription events
  // ---------------------------------------------------------------------------
  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;

      if (!userId) {
        // Without userId in metadata we can't sync. Checkout must include metadata: { userId }.
        // Return 200 so Stripe doesn't retry — this is a configuration issue, not a transient error.
        console.warn("[stripe-webhook] No userId in event metadata — skipping entitlement sync", {
          type: event.type,
        });
        return new Response(null, { status: 200 });
      }

      const adminDb = getAdminDb();

      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated"
      ) {
        const isActive = sub.status === "active" || sub.status === "trialing";

        // Determine tier from the price ID on the first subscription item, matching against ALL three
        // configured price IDs. An ACTIVE subscription whose price matches NONE of them means the
        // STRIPE_PRICE_* envs are misconfigured (e.g. STRIPE_PRICE_ANNUAL unset) or the sub was created
        // out-of-band against an unknown price. Previously that case SILENTLY recorded the customer as
        // premium_monthly — so an annual/family buyer could be mislabeled with the misconfiguration hidden.
        // Now we fail LOUD (§28: swallow the block, not the signal): still grant BASE premium (they paid —
        // never deny access, §32) but log the anomaly explicitly and default to the LOWEST tier so no tier
        // is ever over-granted. The loud log makes the env gap visible in prod instead of invisible.
        const priceId = sub.items?.data?.[0]?.price?.id;
        let tier: "premium_annual" | "premium_monthly" | "premium_family" | null = null;
        if (isActive) {
          if (env.STRIPE_PRICE_FAMILY && priceId === env.STRIPE_PRICE_FAMILY) {
            tier = "premium_family";
          } else if (env.STRIPE_PRICE_ANNUAL && priceId === env.STRIPE_PRICE_ANNUAL) {
            tier = "premium_annual";
          } else if (env.STRIPE_PRICE_MONTHLY && priceId === env.STRIPE_PRICE_MONTHLY) {
            tier = "premium_monthly";
          } else {
            tier = "premium_monthly"; // safest (lowest) premium tier — never over-grant an unknown price
            console.error(
              "[stripe-webhook] Active subscription price matched no configured STRIPE_PRICE_* — " +
                "recording base premium tier; verify STRIPE_PRICE_MONTHLY/ANNUAL/FAMILY are set correctly",
              {
                userId,
                priceId,
                configured: {
                  monthly: Boolean(env.STRIPE_PRICE_MONTHLY),
                  annual: Boolean(env.STRIPE_PRICE_ANNUAL),
                  family: Boolean(env.STRIPE_PRICE_FAMILY),
                },
              },
            );
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

        // Store the Stripe customer ID so the portal can look it up later
        await appendPreferenceSignal(adminDb, {
          userId,
          topic: "stripe_customer_id",
          value: sub.customer as string,
          polarity: "positive",
          source: "correction",
          confidence: 1.0,
        });

        // Mark that this user has STARTED a subscription (disqualifies from future free trial).
        // Includes the `trialing` status on purpose: the 7-day trial is one-per-user for life, so the
        // moment a trial begins the user must become trial-ineligible. Writing this only on the paid
        // transition (status "active") let a user who cancelled before the trial converted come back
        // and claim a fresh trial indefinitely — a repeat-free-trial leak. `isActive` covers both
        // `active` and `trialing`, so the marker lands as soon as the subscription is created.
        if (isActive) {
          await appendPreferenceSignal(adminDb, {
            userId,
            topic: "subscription_renewal_at",
            value: new Date().toISOString(),
            polarity: "positive",
            source: "correction",
            confidence: 1.0,
          });
        }

        console.info("[stripe-webhook] Synced entitlement", {
          userId,
          type: event.type,
          status: sub.status,
          tier,
        });
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
