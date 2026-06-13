import { getDb, getLatestUserId, getPantryView } from "@gm/db";
import { annotateRecipe, buildPantryIndex, rankRecipes, TheMealDBProvider } from "@gm/core/recipe";

export const dynamic = "force-dynamic";

async function loadRecipes() {
  try {
    const db = getDb();
    const userId = await getLatestUserId(db);
    if (!userId) return { ranked: [], error: null as string | null, images: new Map<string, string>() };

    const pantry = await getPantryView(db, userId);
    const inStock = pantry.filter((p) => p.status === "in_stock" || p.status === "low");
    if (inStock.length === 0) return { ranked: [], error: null as string | null, images: new Map<string, string>() };

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
    const full = (await Promise.all(ids.map((id) => provider.getById(id).catch(() => null)))).filter(
      (r): r is NonNullable<typeof r> => r != null,
    );

    const images = new Map(full.map((r) => [r.id, r.imageUrl ?? ""]));
    const annotated = full.map((r) =>
      annotateRecipe({ id: r.id, title: r.title, ingredients: r.ingredients }, idx),
    );
    const ranked = rankRecipes(annotated, { limit: 8 });
    return { ranked, error: null as string | null, images };
  } catch (e) {
    return { ranked: [], error: e instanceof Error ? e.message : String(e), images: new Map<string, string>() };
  }
}

export default async function RecipesPage() {
  const { ranked, error, images } = await loadRecipes();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Cook tonight</h1>
      <p className="mb-6 text-sm text-ink/60">Ranked by how much you already have — missing items are one tap away.</p>

      {error && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t load recipes (DB or recipe provider). {error.slice(0, 120)}
        </p>
      )}
      {ranked.length === 0 && !error && (
        <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
          Add a few items to your pantry and suggestions will appear here.
        </p>
      )}

      <ul className="space-y-3">
        {ranked.map((r) => (
          <li key={r.id} className="flex gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            {images.get(r.id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images.get(r.id)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            ) : null}
            <div className="min-w-0">
              <div className="font-medium text-ink">{r.title}</div>
              <div className="text-xs text-ink/50">
                have {r.haveCount}/{r.totalCore}
                {r.usesExpiring > 0 ? ` · uses ${r.usesExpiring} expiring` : ""}
              </div>
              {r.missing.length > 0 && (
                <div className="mt-1 text-xs text-ink/40">missing: {r.missing.join(", ")}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
