import type { Metadata } from "next";
import { splitSteps } from "@gm/core/recipe";
import { instacart } from "@gm/core/integrations";
import { CopyListButton } from "@/app/list/copy-list-button";
import { loadRecipeAnySource } from "@/app/lib/recipe";
import { ShareLinkButton } from "./share-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const r = await loadRecipeAnySource(id);
    if (r) return { title: `${r.title} · GroceryManager`, description: `Cook ${r.title} — shop the ingredients in a tap.` };
  } catch {
    /* fall through */
  }
  return { title: "Recipe · GroceryManager" };
}

export default async function ShareRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let recipe: Awaited<ReturnType<typeof loadRecipeAnySource>> = null;
  try {
    recipe = await loadRecipeAnySource(id);
  } catch {
    recipe = null;
  }

  if (!recipe) {
    return (
      <main className="mx-auto min-h-dvh max-w-2xl px-5 pb-16 pt-10">
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Recipe not found.</p>
      </main>
    );
  }

  const steps = splitSteps(recipe.instructions);
  const listText = instacart.buildListText(
    recipe.ingredients.map((i) => ({ name: i.measure ? `${i.measure} ${i.name}` : i.name })),
    recipe.title,
  );

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 pb-16 pt-8">
      <p className="text-sm font-medium text-brand-600">GroceryManager</p>
      {recipe.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.imageUrl} alt="" className="mt-3 h-52 w-full rounded-2xl object-cover" />
      ) : null}
      <h1 className="mt-4 text-2xl font-bold text-ink">{recipe.title}</h1>

      <section className="mt-6 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Ingredients</h2>
          <CopyListButton text={listText} />
        </div>
        <ul className="space-y-1 text-sm">
          {recipe.ingredients.map((ing, i) => (
            <li key={`${ing.name}-${i}`}>
              <a
                href={instacart.buildInstacartSearchUrl(ing.name)}
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 hover:underline"
              >
                {ing.measure ? `${ing.measure} ` : ""}
                {ing.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink/50">Tap an ingredient to find it on Instacart, or copy the list.</p>
      </section>

      {steps.length > 0 && (
        <section className="mt-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-ink">Steps</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink/80">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ShareLinkButton title={recipe.title} />
        <a href="/" className="text-sm font-medium text-brand-600">
          Plan your week with GroceryManager →
        </a>
      </div>
      {recipe.sourceUrl && (
        <p className="mt-3 text-xs text-ink/40">
          Source:{" "}
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="underline">
            {recipe.sourceUrl}
          </a>
        </p>
      )}
    </main>
  );
}
