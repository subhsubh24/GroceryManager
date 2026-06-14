import { redirect } from "next/navigation";
import { getDb, withTenant } from "@gm/db";
import { splitSteps, TheMealDBProvider } from "@gm/core/recipe";
import { logCook } from "@gm/core/recipe/log-cook";
import { currentUserId } from "@/app/lib/tenant";
import { CookMode } from "./cook-mode.js";

export const dynamic = "force-dynamic";

async function load(id: string) {
  try {
    const recipe = await new TheMealDBProvider().getById(id);
    return { recipe, error: null as string | null };
  } catch (e) {
    return { recipe: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function logThisCook(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const servings = Number(formData.get("servings") ?? 1);
  if (!id) return;
  const userId = await currentUserId();
  if (!userId) return;
  const recipe = await new TheMealDBProvider().getById(id);
  if (!recipe) return;
  await withTenant(getDb(), userId, (tx) =>
    logCook(
      tx,
      userId,
      {
        externalId: recipe.id,
        title: recipe.title,
        imageUrl: recipe.imageUrl,
        cuisine: recipe.cuisine,
        ingredients: recipe.ingredients,
      },
      { servingsMade: Number.isFinite(servings) && servings > 0 ? servings : 1 },
    ),
  );
  redirect("/pantry");
}

export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recipe, error } = await load(id);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/recipes" className="text-sm text-brand-600">← Recipes</a>

      {!recipe ? (
        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          {error ? `Couldn't load this recipe. ${error.slice(0, 120)}` : "Recipe not found."}
        </div>
      ) : (
        <>
          <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">{recipe.title}</h1>
          <p className="mb-6 text-sm text-ink/60">
            Cook mode · screen stays awake · tap through each step.
          </p>
          <CookMode
            imageUrl={recipe.imageUrl}
            steps={splitSteps(recipe.instructions)}
            ingredients={recipe.ingredients}
          />

          <form action={logThisCook} className="mt-8 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <input type="hidden" name="id" value={id} />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold text-ink">Made it?</div>
                <div className="text-xs text-ink/50">
                  Logs the meal, learns your taste, and draws down what you used.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-ink/60">
                  Servings
                  <input
                    name="servings"
                    type="number"
                    min="1"
                    defaultValue={1}
                    className="ml-1.5 w-16 rounded-lg border border-black/10 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                >
                  I cooked this ✓
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </main>
  );
}
