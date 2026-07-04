import { getDb, withTenant } from "@gm/db";
import { loadEnv } from "@gm/config/env";
import { logCook } from "@gm/core/recipe/log-cook";
import { estimateMealMacros } from "@gm/core/nutrition";
import { GeminiClient } from "@gm/core/llm";
import { verifyMobileToken } from "../_lib";
import { parseJsonBody, requireString, serverError } from "../../_lib/guard";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";
import { isPersistedRecipeId, loadRecipeAnySource } from "../../../lib/recipe";

export const runtime = "nodejs";

/**
 * Mobile "I cooked this" — the native parity for the web `logCookedRecipe` server action. Logs the
 * meal, draws down the ingredients used (consume_recipe), and learns the cuisine (PLAN §7.2/§8.7),
 * all inside a single tenant (RLS) transaction so a mid-way failure rolls back cleanly. Macros are
 * computed OUTSIDE the tx (network) and are best-effort. Recipes are a shared catalog (no RLS), so
 * they load without a tenant. Mirrors the web path exactly to keep the pantry ledger the single
 * source of truth on both platforms.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Authorization header required" }, { status: 401 });
  }

  const userId = verifyMobileToken(token);
  if (!userId) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const rl = rateLimit(`cook-log-write:${userId}`, 30, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const bodyOrErr = await parseJsonBody<{ recipeId?: string; servings?: number }>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const idCheck = requireString(body.recipeId, "recipeId", 128);
  if (!idCheck.ok) return idCheck.response;
  const id = idCheck.value;

  // Servings defaults to 1; clamp to a sane ceiling so a bad client can't scale the drawdown wildly.
  const servingsRaw = body.servings;
  const servingsMade =
    typeof servingsRaw === "number" && Number.isFinite(servingsRaw) && servingsRaw > 0
      ? Math.min(servingsRaw, 100)
      : 1;

  try {
    const recipe = await loadRecipeAnySource(id);
    if (!recipe) return Response.json({ error: "Recipe not found" }, { status: 404 });

    const env = loadEnv();
    const llm = env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT ? new GeminiClient(env) : null;
    const macros = await estimateMealMacros(recipe.ingredients, servingsMade, {
      fdcApiKey: env.FDC_API_KEY,
      llm,
    }).catch(() => undefined);

    const res = await withTenant(getDb(), userId, (tx) =>
      logCook(
        tx,
        userId,
        {
          recipeId: isPersistedRecipeId(id) ? id : undefined,
          externalId: recipe.id,
          title: recipe.title,
          imageUrl: recipe.imageUrl,
          cuisine: recipe.cuisine,
          ingredients: recipe.ingredients,
        },
        { servingsMade, macros },
      ),
    );

    return Response.json({ ok: true, decremented: res.decremented });
  } catch (err) {
    return serverError("mobile/cook POST", err);
  }
}
