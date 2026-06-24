import { getDb, withTenant } from "@gm/db";
import { logCook } from "@gm/core/recipe/log-cook";
import { isPersistedRecipeId, loadRecipeAnySource } from "@/app/lib/recipe";
import { verifyMobileToken } from "../_lib";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  let recipeId: string, servings: number;
  try {
    const body = (await req.json()) as { recipeId?: unknown; servings?: unknown };
    recipeId = typeof body.recipeId === "string" ? body.recipeId : "";
    servings = typeof body.servings === "number" && body.servings > 0 ? body.servings : 1;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!recipeId) return Response.json({ error: "recipeId required" }, { status: 400 });

  const recipe = await loadRecipeAnySource(recipeId);
  if (!recipe) return Response.json({ error: "Recipe not found" }, { status: 404 });

  // Macros skipped on mobile — logCook works fine with null macros.
  await withTenant(getDb(), userId, (tx) =>
    logCook(
      tx,
      userId,
      {
        recipeId: isPersistedRecipeId(recipeId) ? recipeId : undefined,
        externalId: recipe.id,
        title: recipe.title,
        imageUrl: recipe.imageUrl,
        cuisine: recipe.cuisine,
        ingredients: recipe.ingredients,
      },
      { servingsMade: servings },
    ),
  );

  return Response.json({ success: true });
}
