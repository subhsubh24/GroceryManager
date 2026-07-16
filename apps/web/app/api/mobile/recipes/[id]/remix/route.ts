import { getDb, loadPreferenceSignals, loadRecipeForCook, withTenant } from "@gm/db";
import { parseAxis, TheMealDBProvider } from "@gm/core/recipe";
import { geminiRemix, suggestRemix } from "@gm/core/recipe/remix-llm";
import { canUse, isPremium } from "@gm/core/billing";
import { loadEnv } from "@gm/config/env";
import { verifyMobileToken } from "../../../_lib";
import { serverError } from "../../../../_lib/guard";
import { checkLlmQuota } from "../../../../_lib/llm-quota";
import { rateLimit, tooManyRequests } from "../../../../_lib/rate-limit";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mobile parity for the web `/remix/[id]` page (the "AR recipe remix" premium perk the mobile
 * paywall advertises: "AI recipe remix"). Returns a discriminated union so the native client can render the same
 * states the web page does: an upgrade prompt for free users (billing on), a daily-limit state
 * when the per-user AI quota is spent, or the remix itself. Keyless-first: with no Gemini key the
 * deterministic swap table still answers, so the perk works in CI / pre-launch and degrades — an
 * LLM error never escapes as a 500.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });

  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  // Remix can reach the LLM, so rate-limit it tighter than a plain read.
  const rl = rateLimit(`recipe-remix:${userId}`, 20, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { id } = await params;
  if (!id) return Response.json({ error: "Recipe id required" }, { status: 400 });
  const axis = parseAxis(new URL(req.url).searchParams.get("axis"));

  const billingOn = process.env.FEATURE_BILLING === "1";
  try {
    // Load preference signals once, UNCONDITIONALLY, so BOTH the entitlement gate (when billing is
    // on) and the per-user daily AI quota tier below reflect the user's REAL entitlement — not the
    // billing flag. (Gating premium on `billingOn` would silently throttle a real premium user to
    // the free AI cap whenever the flag is off; plan/route.ts + the web remix page load it the same
    // way.) A DB error here throws into the catch → serverError, so the gate still fails closed.
    const signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
    const premium = isPremium(signals);
    if (billingOn && !canUse("remix", premium, billingOn)) {
      return Response.json({ upgradeRequired: true });
    }

    const recipe = UUID.test(id)
      ? await loadRecipeForCook(getDb(), id)
      : await new TheMealDBProvider().getById(id);
    if (!recipe) return Response.json({ error: "Recipe not found" }, { status: 404 });

    // Keyless-first: the LLM enriches only when a key is configured (mirrors the web remix page +
    // cook/plan gating). When it will run, spend a slot from the per-user daily AI quota first.
    const env = loadEnv();
    const hasLlm = !!(env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT);
    if (hasLlm) {
      // premium (computed above) sets the daily-quota tier — a real entitlement gets the higher cap.
      const quota = checkLlmQuota(userId, premium);
      if (!quota.allowed) return Response.json({ quotaExceeded: true });
    }

    const generate = hasLlm ? geminiRemix() : undefined;
    const remix = await suggestRemix(
      { generate },
      { ingredients: recipe.ingredients.map((i) => i.name), axis, title: recipe.title },
    );
    return Response.json({ title: recipe.title, axis, remix });
  } catch (err) {
    // A transient DB/LLM failure or upstream TheMealDB error must not escape as an uncaught 500
    // (an HTML error page to a JSON mobile client). Log server-side (G3) + return controlled JSON.
    return serverError("mobile/recipes-remix", err);
  }
}
