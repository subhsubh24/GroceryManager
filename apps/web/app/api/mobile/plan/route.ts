import { loadEnv } from "@gm/config/env";
import {
  getDb,
  getPantryView,
  getUserBudgetCents,
  loadPreferenceSignals,
  withTenant,
} from "@gm/db";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
} from "@gm/core/recipe";
import { selectExpiringSoon } from "@gm/core/pantry";
import { dietExclusions, projectUserModel } from "@gm/core/personalization";
import { geminiPlanGenerator, planWeek } from "@gm/core/agent";
import { canUse, isPremium } from "@gm/core/billing";
import { verifyMobileToken } from "../_lib";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";
import { checkLlmQuota } from "../../_lib/llm-quota";

export const runtime = "nodejs";

const TARGET_DINNERS = 5;

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  const rl = rateLimit(`plan:${userId}`, 10, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  try {
    const { pantry, signals, budgetCents } = await withTenant(getDb(), userId, async (tx) => ({
      pantry: await getPantryView(tx, userId),
      signals: await loadPreferenceSignals(tx, userId),
      budgetCents: await getUserBudgetCents(tx, userId),
    }));

    const billingOn = process.env.FEATURE_BILLING === "1";
    if (!canUse("plan_week", isPremium(signals), billingOn)) {
      return Response.json({ upgradeRequired: true });
    }

    const quota = checkLlmQuota(userId, isPremium(signals));
    if (!quota.allowed) {
      return Response.json(
        { error: "Daily AI limit reached. Upgrade for more.", upgradeRequired: !isPremium(signals) },
        { status: 429 },
      );
    }

    const inStock = pantry.filter((p) => p.status === "in_stock" || p.status === "low");
    if (inStock.length === 0) {
      return Response.json({ empty: true, upgradeRequired: false, plan: null });
    }

    const expiringNames = selectExpiringSoon(pantry, {
      domain: "grocery",
      withinDays: 5,
      excludeExpired: true,
    }).map((e) => e.name);

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

    const annotated = full.map((r) => {
      const { effortScore } = estimateEffort({
        ingredientCount: r.ingredients.length,
        instructions: r.instructions,
      });
      return annotateRecipe(
        { id: r.id, title: r.title, ingredients: r.ingredients, effortScore, cuisine: r.cuisine },
        idx,
      );
    });
    const annotatedById = new Map(annotated.map((a) => [a.id, a]));

    const model = projectUserModel(signals);
    const ranked = rankRecipes(annotated, {
      limit: 8,
      prefs: {
        allergens: model.allergens,
        dietKeywords: dietExclusions(model.diets),
        dislikes: model.dislikes,
        loves: model.loves,
        cuisineAffinity: model.cuisineAffinity,
      },
    });

    const candidates = ranked.map((r) => ({
      id: r.id,
      title: r.title,
      coverage: r.coverage,
      missing: r.missing,
      usesExpiring: r.usesExpiring,
      expiringIngredients: (annotatedById.get(r.id)?.ingredients ?? [])
        .filter((i) => i.inPantry && i.expiringSoon)
        .map((i) => i.name),
      cuisine: annotatedById.get(r.id)?.cuisine,
    }));

    const env = loadEnv();
    const generate =
      env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT ? geminiPlanGenerator() : undefined;

    const result = await planWeek(
      {
        candidates,
        expiringNames,
        prefs: { diets: model.diets, allergens: model.allergens, dislikes: model.dislikes },
        budgetCents,
        targetDinners: TARGET_DINNERS,
      },
      { generate },
    );

    const imageMap = new Map(full.map((r) => [r.id, r.imageUrl ?? null]));

    return Response.json({
      empty: false,
      upgradeRequired: false,
      source: result.source,
      plan: {
        narrative: result.plan.narrative,
        dinners: result.plan.dinners.map((d) => ({
          ...d,
          imageUrl: imageMap.get(d.recipeId) ?? null,
        })),
        addToList: result.plan.addToList,
      },
    });
  } catch (err) {
    console.error("[mobile/plan]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
