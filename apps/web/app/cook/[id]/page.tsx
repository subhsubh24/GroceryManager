import { redirect } from "next/navigation";
import { getDb, withTenant } from "@gm/db";
import { findSubstitutions, splitSteps, TheMealDBProvider } from "@gm/core/recipe";
import { logCook } from "@gm/core/recipe/log-cook";
import { getSubstitutions } from "@gm/core/recipe/substitute-llm";
import { currentUserId } from "@/app/lib/tenant";
import { CookMode } from "./cook-mode.js";
import { SwapFinder, type SwapState } from "./swap-finder.js";

export const dynamic = "force-dynamic";

async function load(id: string) {
  try {
    const recipe = await new TheMealDBProvider().getById(id);
    return { recipe, error: null as string | null };
  } catch (e) {
    return { recipe: null, error: e instanceof Error ? e.message : String(e) };
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

          <section className="mt-8 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-ink">Out of something?</h2>
            <p className="mt-0.5 mb-3 text-xs text-ink/50">Common swaps for this recipe — or look one up.</p>
            {(() => {
              const known = recipe.ingredients
                .map((i) => ({ name: i.name, subs: findSubstitutions(i.name) }))
                .filter((k) => k.subs.length > 0);
              return known.length > 0 ? (
                <ul className="mb-4 space-y-2">
                  {known.map((k) => (
                    <li key={k.name}>
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-ink">
                          {k.name} <span className="text-xs font-normal text-brand-600">· swap</span>
                        </summary>
                        <ul className="mt-1 space-y-1 pl-3 text-sm text-ink/70">
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

          <form action={logThisCook} className="mt-6 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
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
