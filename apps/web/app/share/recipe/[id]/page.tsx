import type { Metadata } from "next";
import { splitSteps } from "@gm/core/recipe";
import { instacart } from "@gm/core/integrations";
import { CopyListButton } from "@/app/list/copy-list-button";
import { loadRecipeAnySource } from "@/app/lib/recipe";
import { Leaf } from "@/app/components/icons";
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
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-brand">
              <Leaf className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-sm font-semibold text-ink-800">GroceryManager</span>
          </a>
          <span className="pill-brand">Shared recipe</span>
        </div>
        {recipe.imageUrl ? (
          // Magazine-style hero: full-bleed image with a scrim and the title laid over it.
          <div className="relative mt-4 overflow-hidden rounded-3xl shadow-lift">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recipe.imageUrl} alt="" className="h-64 w-full object-cover sm:h-72" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/25 to-transparent" />
            <h1 className="absolute inset-x-0 bottom-0 p-5 font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              {recipe.title}
            </h1>
          </div>
        ) : (
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            {recipe.title}
          </h1>
        )}
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
        {recipe.sourceUrl && (
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="nav-link">
            View original source →
          </a>
        )}
      </div>

      {/* Conversion CTA — the share page is the growth surface; make the next step irresistible. */}
      <section className="panel-brand mt-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-sm">
            <h2 className="font-display text-xl font-semibold">Cook this without the chaos</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/90">
              GroceryManager plans your week, fills your pantry from receipts, and shops the gaps in
              a tap.
            </p>
          </div>
          {/* `brand-solid-hover` (deep green) — brand-solid fails WCAG AA as text on white; the
              hover-shade token clears 4.5:1. */}
          <a
            href="/signup"
            className="btn inline-flex shrink-0 bg-white px-5 py-3 text-base text-brand-solid-hover shadow-lift hover:bg-white/95"
          >
            Try it free →
          </a>
        </div>
      </section>
    </main>
  );
}
