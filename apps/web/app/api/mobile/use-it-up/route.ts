import { getDb, getPantryView, loadPreferenceSignals, withTenant } from "@gm/db";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
} from "@gm/core/recipe";
import { selectExpiringSoon } from "@gm/core/pantry";
import { dietExclusions, projectUserModel } from "@gm/core/personalization";
import { verifyMobileToken } from "../_lib";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  // Each call fans out up to ~26 TheMealDB requests; throttle to prevent abuse/cost spikes.
  const rl = rateLimit(`use-it-up:${userId}`, 20, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  try {
    const { pantry, signals } = await withTenant(getDb(), userId, async (tx) => ({
      pantry: await getPantryView(tx, userId),
      signals: await loadPreferenceSignals(tx, userId),
    }));

    const expiring = selectExpiringSoon(pantry, {
      domain: "grocery",
      withinDays: 5,
      excludeExpired: true,
    });
    if (expiring.length === 0) return Response.json({ recipes: [], expiring: [] });

    const expiringIds = new Set(expiring.map((e) => e.canonicalItemId));
    const inStock = pantry.filter(
      (p) => p.status === "in_stock" || p.status === "low" || p.status === "expired_likely",
    );
    const idx = buildPantryIndex(
      inStock.map((p) => ({
        name: p.name,
        aliases: p.aliases ?? [],
        inStock: true,
        expiringSoon: expiringIds.has(p.canonicalItemId),
      })),
    );

    const provider = new TheMealDBProvider();
    const seeds = expiring.slice(0, 6).map((e) => e.name);
    const found = (
      await Promise.all(seeds.map((s) => provider.searchByIngredient(s).catch(() => [])))
    ).flat();
    const ids = [...new Set(found.map((f) => f.id))].slice(0, 20);
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
      return annotateRecipe(
        { id: r.id, title: r.title, ingredients: r.ingredients, effortScore, batchScore: 0, cuisine: r.cuisine },
        idx,
      );
    });

    // Rank all annotated recipes, then keep only those using at least one expiring ingredient.
    const allRanked = rankRecipes(annotated, {
      limit: 20,
      prefs: {
        allergens: model.allergens,
        dietKeywords: exclusions,
        dislikes: model.dislikes,
        loves: model.loves,
        cuisineAffinity: model.cuisineAffinity,
      },
    });
    const ranked = allRanked.filter((r) => r.usesExpiring > 0).slice(0, 10);

    const idToFull = new Map(full.map((r) => [r.id, r]));
    const recipes = ranked.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: idToFull.get(r.id)?.imageUrl ?? null,
      cuisine: idToFull.get(r.id)?.cuisine ?? null,
      usesExpiring: r.usesExpiring,
      haveCount: r.haveCount,
    }));

    return Response.json({
      recipes,
      expiring: expiring.map((e) => ({ name: e.name, daysLeft: e.daysLeft })),
    });
  } catch (err) {
    console.error("[use-it-up]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
