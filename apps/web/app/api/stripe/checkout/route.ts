/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for a given plan (monthly | annual).
 * Returns { url } on success — the client should redirect to that URL.
 * Returns 503 when STRIPE_SECRET_KEY is not configured (graceful degradation).
 */

import Stripe from "stripe";
import { getDb, loadPreferenceSignals, withTenant } from "@gm/db";
import { isTrialEligible } from "@gm/core/billing";
import { currentUserId } from "@/app/lib/tenant";
import { rateLimit, tooManyRequests } from "../_lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Auth check
  let userId: string;
  try {
    const id = await currentUserId();
    if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    userId = id;
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`stripe-checkout:${userId}`, 5, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // Require Stripe secret key
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ error: "Billing not configured" }, { status: 503 });
  }

  // Parse request body
  let plan: "monthly" | "annual" | "family";
  try {
    const body = (await req.json()) as { plan?: unknown };
    if (body.plan !== "monthly" && body.plan !== "annual" && body.plan !== "family") {
      return Response.json({ error: "plan must be 'monthly', 'annual', or 'family'" }, { status: 400 });
    }
    plan = body.plan;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Resolve price ID
  const priceId =
    plan === "annual"
      ? process.env.STRIPE_PRICE_ANNUAL
      : plan === "family"
        ? process.env.STRIPE_PRICE_FAMILY
        : process.env.STRIPE_PRICE_MONTHLY;

  if (!priceId) {
    const envKey = plan === "annual" ? "STRIPE_PRICE_ANNUAL" : plan === "family" ? "STRIPE_PRICE_FAMILY" : "STRIPE_PRICE_MONTHLY";
    return Response.json(
      { error: `No price configured for plan "${plan}" — set ${envKey}` },
      { status: 503 },
    );
  }

  // Load preference signals to determine trial eligibility
  let trialEligible = false;
  try {
    const signals = await withTenant(getDb(), userId, (tx) =>
      loadPreferenceSignals(tx, userId),
    );
    trialEligible = isTrialEligible(signals);
  } catch {
    // Degrade gracefully — no trial if signals can't be loaded
    trialEligible = false;
  }

  // Derive origin for success/cancel URLs
  const origin = new URL(req.url).origin;

  try {
    const stripe = new Stripe(secretKey);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(trialEligible ? { trial_period_days: 7 } : {}),
        metadata: { userId },
      },
      metadata: { userId },
      success_url: `${origin}/upgrade?success=1`,
      cancel_url: `${origin}/upgrade?canceled=1`,
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[stripe-checkout] Error creating session:", err);
    return Response.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
