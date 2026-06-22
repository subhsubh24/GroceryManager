import { parseAxis, REMIX_AXES, type RemixAxis, type RemixResult } from "@gm/core/recipe";
import { geminiRemix, suggestRemix } from "@gm/core/recipe/remix-llm";
import { loadRecipeAnySource } from "@/app/lib/recipe";
import { addNamesToListAction } from "@/app/lib/list-actions";
import { PageHeader } from "@/app/components/page-header";
import { ArrowLeft, ArrowRight, Wand2 } from "@/app/components/icons";

export const dynamic = "force-dynamic";

const AXIS_LABEL: Record<RemixAxis, string> = {
  healthier: "Healthier",
  cheaper: "Cheaper",
  faster: "Faster",
  vegan: "Vegan",
};

async function load(id: string, axis: RemixAxis) {
  try {
    const recipe = await loadRecipeAnySource(id);
    if (!recipe) return { recipe: null, remix: null as RemixResult | null, error: null as string | null };
    // Keyless-first: the LLM enriches only when a key is configured (mirrors cook/plan gating).
    const generate = process.env.GEMINI_API_KEY ? geminiRemix() : undefined;
    const remix = await suggestRemix(
      { generate },
      { ingredients: recipe.ingredients.map((i) => i.name), axis, title: recipe.title },
    );
    return { recipe, remix, error: null as string | null };
  } catch (e) {
    return { recipe: null, remix: null as RemixResult | null, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function RemixPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ axis?: string }>;
}) {
  const { id } = await params;
  const axis = parseAxis((await searchParams).axis);
  const { recipe, remix, error } = await load(id, axis);

  const replacements = remix?.swaps.map((s) => s.replacement) ?? [];

  return (
    <main className="page">
      {!recipe ? (
        <>
          <div className="flex items-center justify-between">
            <a href={`/cook/${id}`} className="back-link">
              <ArrowLeft className="h-4 w-4" /> Back to recipe
            </a>
          </div>
          <div className="notice-warn mt-6">
            {error ? `Couldn't load this recipe. ${error.slice(0, 120)}` : "Recipe not found."}
          </div>
        </>
      ) : (
        <>
          <PageHeader
            accent="grape"
            icon={Wand2}
            eyebrow="Recipe remix"
            title={recipe.title}
            subtitle="Make it your way."
            back={{ href: `/cook/${id}`, label: "Back to recipe" }}
          />

          <div className="mt-6 mb-4 flex flex-wrap gap-2">
            {REMIX_AXES.map((a) => (
              <a
                key={a}
                href={`/remix/${id}?axis=${a}`}
                className={`tab ${a === axis ? "tab-active" : "tab-idle"}`}
              >
                {AXIS_LABEL[a]}
              </a>
            ))}
          </div>

          {remix && remix.swaps.length === 0 ? (
            <div className="empty-state mt-6">
              <div className="empty-emoji">
                <Wand2 className="h-6 w-6" strokeWidth={2} />
              </div>
              <p className="text-sm font-medium text-ink-700">Nothing to swap</p>
              <p className="mt-1 max-w-xs text-sm text-ink-400">{remix.note}</p>
            </div>
          ) : remix ? (
            <>
              <p className="notice-ok mb-4">{remix.note}</p>

              <ul className="space-y-3">
                {remix.swaps.map((s, i) => (
                  <li key={`${s.original}-${i}`} className="card p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-ink-500 line-through">{s.original}</span>
                      <ArrowRight aria-hidden className="h-4 w-4 text-ink-300" strokeWidth={2} />
                      <span className="font-semibold text-ink-900">{s.replacement}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-400">{s.reason}</p>
                  </li>
                ))}
              </ul>

              {replacements.length > 0 && (
                <section className="card-pad mt-6">
                  <h2 className="section-title mb-1">Shop the swaps</h2>
                  <p className="mb-3 text-sm text-ink-500">
                    Add the {replacements.length} replacement{replacements.length === 1 ? "" : "s"} to
                    your list in a tap.
                  </p>
                  <form action={addNamesToListAction}>
                    {replacements.map((name, i) => (
                      <input key={`${name}-${i}`} type="hidden" name="name" value={name} />
                    ))}
                    <button type="submit" className="btn-dark">
                      Add replacements to my list →
                    </button>
                  </form>
                </section>
              )}
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
