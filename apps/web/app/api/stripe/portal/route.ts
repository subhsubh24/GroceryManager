/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for the current user.
 * Returns { url } on success — the client should redirect to that URL.
 * Returns 503 when STRIPE_SECRET_KEY is not configured.
 * Returns 404 when no Stripe customer ID is found for the user.
 */

import Stripe from "stripe";
import { getDb, loadPreferenceSignals, withTenant } from "@gm/db";
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

  const rl = rateLimit(`stripe-portal:${userId}`, 5, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // Require Stripe secret key
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ error: "Billing not configured" }, { status: 503 });
  }

  // Load preference signals to find stripe_customer_id
  let customerId: string | null = null;
  try {
    const signals = await withTenant(getDb(), userId, (tx) =>
      loadPreferenceSignals(tx, userId),
    );
    const customerSignal = signals.find((s) => s.topic === "stripe_customer_id");
    customerId = customerSignal?.value ?? null;
  } catch {
    customerId = null;
  }

  if (!customerId) {
    return Response.json(
      { error: "No billing account found — subscribe first" },
      { status: 404 },
    );
  }

  // Derive return URL
  const origin = new URL(req.url).origin;

  try {
    const stripe = new Stripe(secretKey);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/manage-subscription`,
    });

    return Response.json({ url: portalSession.url });
  } catch (err) {
    console.error("[stripe-portal] Error creating portal session:", err);
    return Response.json({ error: "Failed to create billing portal session" }, { status: 500 });
  }
}
