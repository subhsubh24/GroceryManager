import {
  getDb,
  getPantryView,
  loadPreferenceSignals,
  loadSeenRecipeIds,
  recordSwipeSignals,
  withTenant,
} from "@gm/db";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateBatchFriendly,
  estimateEffort,
  nextDiscoveryBatch,
  rankRecipes,
  swipeToSignals,
  TheMealDBProvider,
} from "@gm/core/recipe";
import { dietExclusions, projectUserModel } from "@gm/core/personalization";
import { canUse, isPremium } from "@gm/core/billing";
import { verifyMobileToken } from "../_lib";

export const runtime = "nodejs";

function authFromReq(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
}

export async function GET(req: Request) {
  const token = authFromReq(req);
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  try {
    const { pantry, signals, seenIds } = await withTenant(getDb(), userId, async (tx) => ({
      pantry: await getPantryView(tx, userId),
      signals: await loadPreferenceSignals(tx, userId),
      seenIds: await loadSeenRecipeIds(tx, userId),
    }));

    const billingOn = process.env.FEATURE_BILLING === "1";
    if (!canUse("discover", isPremium(signals), billingOn)) {
      return Response.json({ upgradeRequired: true });
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
    const seeds = inStock.slice(0, 6).map((p) => p.name);
    const found = (
      await Promise.all(seeds.map((s) => provider.searchByIngredient(s).catch(() => [])))
    ).flat();
    const ids = [...new Set(found.map((f) => f.id))].slice(0, 24);
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
      limit: 24,
      prefs: {
        allergens: model.allergens,
        dietKeywords: exclusions,
        dislikes: model.dislikes,
        loves: model.loves,
        cuisineAffinity: model.cuisineAffinity,
      },
    });

    const idToFull = new Map(full.map((r) => [r.id, r]));
    const batch = nextDiscoveryBatch(ranked, seenIds, 12);
    const recipes = batch.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: idToFull.get(r.id)?.imageUrl ?? null,
      cuisine: idToFull.get(r.id)?.cuisine ?? null,
      haveCount: r.haveCount,
    }));

    return Response.json({ recipes });
  } catch (err) {
    console.error("[discover]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const token = authFromReq(req);
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  let body: { recipeId?: unknown; cuisine?: unknown; dir?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recipeId, cuisine, dir } = body;
  if (typeof recipeId !== "string" || (dir !== "like" && dir !== "skip")) {
    return Response.json({ error: "recipeId (string) and dir (like|skip) required" }, { status: 400 });
  }

  try {
    const signals = swipeToSignals(
      { recipeId, cuisine: typeof cuisine === "string" ? cuisine : undefined },
      dir,
    );
    await withTenant(getDb(), userId, (tx) => recordSwipeSignals(tx, userId, signals));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed to record swipe" }, { status: 500 });
  }
}
