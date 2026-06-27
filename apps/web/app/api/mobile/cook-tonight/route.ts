import { getDb, getPantryView, loadPreferenceSignals, withTenant } from "@gm/db";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateBatchFriendly,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
} from "@gm/core/recipe";
import { dietExclusions, projectUserModel } from "@gm/core/personalization";
import { isPremium } from "@gm/core/billing";
import { verifyMobileToken } from "../_lib";
import { rateLimit, tooManyRequests } from "../_lib/rate-limit";
import { checkLlmQuota } from "../_lib/llm-quota";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  const rl = rateLimit(`cook-tonight:${userId}`, 20, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  try {
    const { pantry, signals } = await withTenant(getDb(), userId, async (tx) => ({
      pantry: await getPantryView(tx, userId),
      signals: await loadPreferenceSignals(tx, userId),
    }));

    const quota = checkLlmQuota(userId, isPremium(signals));
    if (!quota.allowed) {
      return Response.json(
        { error: "Daily AI limit reached. Upgrade for more.", upgradeRequired: !isPremium(signals) },
        { status: 429 },
      );
    }

    const inStock = pantry.filter(
      (p) => p.status === "in_stock" || p.status === "low" || p.status === "expired_likely",
    );
    if (inStock.length === 0) return Response.json({ recipes: [] });

    const idx = buildPantryIndex(
      inStock.map((p) => ({
        name: p.name,
        aliases: p.aliases ?? [],
        inStock: true,
        expiringSoon: p.status === "low" || p.status === "expired_likely",
      })),
    );

    const provider = new TheMealDBProvider();
    const seeds = inStock.slice(0, 4).map((p) => p.name);
    const found = (
      await Promise.all(seeds.map((s) => provider.searchByIngredient(s).catch(() => [])))
    ).flat();
    const ids = [...new Set(found.map((f) => f.id))].slice(0, 8);
    const full = (
      await Promise.all(ids.map((id) => provider.getById(id).catch(() => null)))
    ).filter((r): r is NonNullable<typeof r> => r != null);

    const model = projectUserModel(signals);
    const exclusions = dietExclusions(model.diets);
    const annotated = full.map((r) => {
      const { effortScore } = estimateEffort({
        ingredientCount: r.ingredients.length,
        instructions: r.instructions,
      });
      const { batchScore } = estimateBatchFriendly({
        title: r.title,
        instructions: r.instructions,
        cuisine: r.cuisine,
      });
      return annotateRecipe(
        { id: r.id, title: r.title, ingredients: r.ingredients, effortScore, batchScore, cuisine: r.cuisine },
        idx,
      );
    });

    const ranked = rankRecipes(annotated, {
      limit: 8,
      prefs: {
        allergens: model.allergens,
        dietKeywords: exclusions,
        dislikes: model.dislikes,
        loves: model.loves,
        cuisineAffinity: model.cuisineAffinity,
      },
    });

    const recipes = ranked.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: full.find((f) => f.id === r.id)?.imageUrl ?? null,
      haveCount: r.haveCount,
      cuisine: full.find((f) => f.id === r.id)?.cuisine ?? null,
    }));

    return Response.json({ recipes });
  } catch (err) {
    console.error("[cook-tonight]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
