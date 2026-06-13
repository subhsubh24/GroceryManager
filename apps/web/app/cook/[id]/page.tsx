import { splitSteps, TheMealDBProvider } from "@gm/core/recipe";
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
        </>
      )}
    </main>
  );
}
