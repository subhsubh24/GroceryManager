import { getDb, getPantryView, loadPreferenceSignals, withTenant } from "@gm/db";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
} from "@gm/core/recipe";
import { dietExclusions, KNOWN_DIETS, projectUserModel } from "@gm/core/personalization";
import { currentUserId } from "@/app/lib/tenant";

export const dynamic = "force-dynamic";

/** Guest diets offered as quick filters (subset of KNOWN_DIETS most common when hosting). */
const GUEST_DIETS = ["vegan", "vegetarian", "gluten-free", "dairy-free", "pescatarian"];

async function loadRecipes(lowEnergy: boolean, guest: string | null) {
  try {
    const userId = await currentUserId();
    if (!userId) return { ranked: [], images: new Map<string, string>(), error: null as string | null };

    // Read pantry + taste signals together in one tenant tx; the provider fetch happens after.
    const { pantry, signals } = await withTenant(getDb(), userId, async (tx) => ({
      pantry: await getPantryView(tx, userId),
      signals: await loadPreferenceSignals(tx, userId),
    }));
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
    const model = projectUserModel(signals);
    // Enforce the user's own diet, plus tonight's guest diet — both hard-exclude (§7.2/§10).
    const exclusions = dietExclusions([...model.diets, ...(guest ? [guest] : [])]);
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
        allergens: [...model.allergens, ...exclusions],
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
  searchParams: Promise<{ energy?: string; guest?: string }>;
}) {
  const sp = await searchParams;
  const lowEnergy = sp.energy === "low";
  const guest = sp.guest && KNOWN_DIETS.includes(sp.guest.toLowerCase()) ? sp.guest.toLowerCase() : null;
  const { ranked, error, images } = await loadRecipes(lowEnergy, guest);

  const href = (over: { energy?: "low" | null; guest?: string | null }) => {
    const energy = over.energy === undefined ? (lowEnergy ? "low" : null) : over.energy;
    const g = over.guest === undefined ? guest : over.guest;
    const p = new URLSearchParams();
    if (energy) p.set("energy", energy);
    if (g) p.set("guest", g);
    const s = p.toString();
    return s ? `/recipes?${s}` : "/recipes";
  };

  const tab = (h: string, label: string, active: boolean) => (
    <a
      href={h}
      className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
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

      <div className="mb-3 flex gap-2">
        {tab(href({ energy: null }), "Cook something nice", !lowEnergy)}
        {tab(href({ energy: "low" }), "Keep it easy", lowEnergy)}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink/40">Cooking for a guest?</span>
        {GUEST_DIETS.map((g) => tab(href({ guest: guest === g ? null : g }), g, guest === g))}
        {guest && (
          <a href={href({ guest: null })} className="text-xs text-ink/40 underline">
            clear
          </a>
        )}
      </div>

      {guest && (
        <p className="mb-6 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
          Filtered to fit a <strong className="capitalize">{guest}</strong> guest — meals with conflicting
          ingredients are hidden.
        </p>
      )}

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
              <a href={`/cook/${r.id}`} className="mt-2 inline-block text-xs font-medium text-brand-600">
                Cook mode →
              </a>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
