import { redirect } from "next/navigation";
import { getDb, isRecipeSaved, withTenant } from "@gm/db";
import { findSubstitutions, splitSteps } from "@gm/core/recipe";
import { logCook } from "@gm/core/recipe/log-cook";
import { getSubstitutions } from "@gm/core/recipe/substitute-llm";
import { currentUserId } from "@/app/lib/tenant";
import { isPersistedRecipeId, loadRecipeAnySource } from "@/app/lib/recipe";
import { SaveButton } from "@/app/cookbook/save-button";
import { CookMode } from "./cook-mode.js";
import { SwapFinder, type SwapState } from "./swap-finder.js";

export const dynamic = "force-dynamic";

async function load(id: string) {
  try {
    const recipe = await loadRecipeAnySource(id);
    let saved = false;
    if (recipe) {
      const userId = await currentUserId();
      if (userId) saved = await withTenant(getDb(), userId, (tx) => isRecipeSaved(tx, userId, recipe.id));
    }
    return { recipe, saved, error: null as string | null };
  } catch (e) {
    return { recipe: null, saved: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function askSwap(_prev: SwapState, formData: FormData): Promise<SwapState> {
  "use server";
  const q = String(formData.get("q") ?? "").trim();
  if (!q) return { status: "idle" };
  const res = await getSubstitutions(q); // static table first, LLM only for the long tail
  return { status: "done", ingredient: q, source: res.source, subs: res.substitutions };
}

async function logThisCook(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const servings = Number(formData.get("servings") ?? 1);
  if (!id) return;
  const userId = await currentUserId();
  if (!userId) return;
  const recipe = await loadRecipeAnySource(id);
  if (!recipe) return;
  await withTenant(getDb(), userId, (tx) =>
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
      { servingsMade: Number.isFinite(servings) && servings > 0 ? servings : 1 },
    ),
  );
  redirect("/pantry");
}

export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recipe, saved, error } = await load(id);

  return (
    <main className="page">
      <div className="flex items-center justify-between">
        <a href="/recipes" className="back-link">
          <span aria-hidden>←</span> Recipes
        </a>
        {recipe && (
          <a href={`/share/recipe/${id}`} className="nav-link">
            Share →
          </a>
        )}
      </div>

      {!recipe ? (
        <div className="notice-warn mt-6">
          {error ? `Couldn't load this recipe. ${error.slice(0, 120)}` : "Recipe not found."}
        </div>
      ) : (
        <>
          <div className="mt-4 animate-fade-in-up">
            <p className="eyebrow">Cook mode</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h1 className="page-title">{recipe.title}</h1>
              <SaveButton
                recipe={{ id: recipe.id, title: recipe.title, imageUrl: recipe.imageUrl, cuisine: recipe.cuisine }}
                initialSaved={saved}
              />
            </div>
            <p className="page-subtitle">Screen stays awake · tap through each step.</p>
            <a href={`/remix/${id}`} className="mt-2 inline-block text-sm font-medium text-grape-700">
              Remix this recipe ✨
            </a>
          </div>
          <div className="mt-6">
            <CookMode
              imageUrl={recipe.imageUrl}
              steps={splitSteps(recipe.instructions)}
              ingredients={recipe.ingredients}
            />
          </div>

          <section className="card-pad mt-8">
            <h2 className="section-title">Out of something?</h2>
            <p className="mt-0.5 mb-3 text-xs text-ink-400">Common swaps for this recipe — or look one up.</p>
            {(() => {
              const known = recipe.ingredients
                .map((i) => ({ name: i.name, subs: findSubstitutions(i.name) }))
                .filter((k) => k.subs.length > 0);
              return known.length > 0 ? (
                <ul className="mb-4 space-y-2">
                  {known.map((k) => (
                    <li key={k.name}>
                      <details className="group rounded-xl border border-line bg-cream/50 px-3.5 py-2.5 transition open:bg-surface">
                        <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-ink-800 marker:content-none">
                          <span>
                            {k.name} <span className="text-xs font-normal text-brand-600">· swap</span>
                          </span>
                          <span className="text-ink-300 transition group-open:rotate-180">▾</span>
                        </summary>
                        <ul className="mt-2 space-y-1 pl-3 text-sm text-ink-600">
                          {k.subs.map((s, i) => (
                            <li key={i}>{s.text}</li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : null;
            })()}
            <SwapFinder action={askSwap} />
          </section>

          <form action={logThisCook} className="card-pad mt-6">
            <input type="hidden" name="id" value={id} />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="tile shrink-0">🍽️</div>
                <div>
                  <div className="section-title">Made it?</div>
                  <div className="text-xs text-ink-400">
                    Logs the meal, learns your taste, and draws down what you used.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <label className="text-sm text-ink-500">
                  Servings
                  <input
                    name="servings"
                    type="number"
                    min="1"
                    defaultValue={1}
                    className="ml-1.5 w-16 rounded-lg border border-line bg-surface px-2 py-1 text-sm shadow-xs focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
                <button type="submit" className="btn-primary">
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
