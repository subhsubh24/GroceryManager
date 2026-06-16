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
      <main className="page-narrow">
        <p className="notice-warn mt-4">Recipe not found.</p>
      </main>
    );
  }

  const steps = splitSteps(recipe.instructions);
  const listText = instacart.buildListText(
    recipe.ingredients.map((i) => ({ name: i.measure ? `${i.measure} ${i.name}` : i.name })),
    recipe.title,
  );

  return (
    <main className="page-narrow">
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-base shadow-brand">
            🧺
          </span>
          <p className="text-sm font-semibold text-ink-800">GroceryManager</p>
        </div>
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt="" className="mt-4 h-56 w-full rounded-3xl object-cover shadow-card" />
        ) : null}
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink-900">
          {recipe.title}
        </h1>
      </div>

      <section className="card-pad mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Ingredients</h2>
          <CopyListButton text={listText} />
        </div>
        <ul className="space-y-1.5 text-sm">
          {recipe.ingredients.map((ing, i) => (
            <li key={`${ing.name}-${i}`}>
              <a
                href={instacart.buildInstacartSearchUrl(ing.name)}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-700 hover:underline"
              >
                {ing.measure ? `${ing.measure} ` : ""}
                {ing.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-400">Tap an ingredient to find it on Instacart, or copy the list.</p>
      </section>

      {steps.length > 0 && (
        <section className="card-pad mt-5">
          <h2 className="section-title mb-3">Steps</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-700 marker:font-semibold marker:text-brand-500">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ShareLinkButton title={recipe.title} />
        <a href="/" className="nav-link">
          Plan your week with GroceryManager →
        </a>
      </div>
      {recipe.sourceUrl && (
        <p className="mt-3 text-xs text-ink-400">
          Source:{" "}
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="underline">
            {recipe.sourceUrl}
          </a>
        </p>
      )}
    </main>
  );
}
