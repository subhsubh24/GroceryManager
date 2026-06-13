import { getDb, getLatestUserId, getPantryView, loadPreferenceSignals } from "@gm/db";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
} from "@gm/core/recipe";
import { projectUserModel } from "@gm/core/personalization";

export const dynamic = "force-dynamic";

async function loadRecipes(lowEnergy: boolean) {
  try {
    const db = getDb();
    const userId = await getLatestUserId(db);
    if (!userId) return { ranked: [], images: new Map<string, string>(), error: null as string | null };

    const pantry = await getPantryView(db, userId);
    const inStock = pantry.filter((p) => p.status === "in_stock" || p.status === "low");
    if (inStock.length === 0) return { ranked: [], images: new Map<string, string>(), error: null as string | null };

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
    const found = (await Promise.all(seeds.map((s) => provider.searchByIngredient(s).catch(() => [])))).flat();
    const ids = [...new Set(found.map((f) => f.id))].slice(0, 8);
    const full = (await Promise.all(ids.map((id) => provider.getById(id).catch(() => null)))).filter(
      (r): r is NonNullable<typeof r> => r != null,
    );

    const images = new Map(full.map((r) => [r.id, r.imageUrl ?? ""]));
    const model = projectUserModel(await loadPreferenceSignals(db, userId));
    const annotated = full.map((r) => {
      const { effortScore } = estimateEffort({
        ingredientCount: r.ingredients.length,
        instructions: r.instructions,
      });
      return annotateRecipe(
        { id: r.id, title: r.title, ingredients: r.ingredients, effortScore, cuisine: r.cuisine },
        idx,
      );
    });
    const ranked = rankRecipes(annotated, {
      limit: 8,
      lowEnergy,
      prefs: {
        allergens: model.allergens,
        dislikes: model.dislikes,
        loves: model.loves,
        cuisineAffinity: model.cuisineAffinity,
      },
    });
    return { ranked, images, error: null as string | null };
  } catch (e) {
    return { ranked: [], images: new Map<string, string>(), error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ energy?: string }>;
}) {
  const lowEnergy = (await searchParams).energy === "low";
  const { ranked, error, images } = await loadRecipes(lowEnergy);

  const tab = (href: string, label: string, active: boolean) => (
    <a
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
        active ? "bg-brand-500 text-white" : "bg-white text-ink/70 border border-black/5"
      }`}
    >
      {label}
    </a>
  );

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Cook tonight</h1>
      <p className="mb-4 text-sm text-ink/60">Ranked by what you already have. How much do you feel like cooking?</p>

      <div className="mb-6 flex gap-2">
        {tab("/recipes", "Cook something nice", !lowEnergy)}
        {tab("/recipes?energy=low", "Keep it easy", lowEnergy)}
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t load recipes (DB or provider). {error.slice(0, 120)}
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
