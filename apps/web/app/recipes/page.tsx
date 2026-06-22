import { getDb, getPantryView, loadPreferenceSignals, loadSavedRecipes, withTenant } from "@gm/db";
import { dedupeSaved } from "@gm/core/recipe";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateBatchFriendly,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
} from "@gm/core/recipe";

type Mood = "nice" | "easy" | "batch";
import { dietExclusions, KNOWN_DIETS, projectUserModel } from "@gm/core/personalization";
import { currentUserId } from "@/app/lib/tenant";
import { addNamesToListAction } from "@/app/lib/list-actions";
import { PageHeader } from "@/app/components/page-header";
import { ChefHat, Sparkles } from "@/app/components/icons";
import { SaveButton } from "@/app/cookbook/save-button";

export const dynamic = "force-dynamic";

/** Guest diets offered as quick filters (subset of KNOWN_DIETS most common when hosting). */
const GUEST_DIETS = ["vegan", "vegetarian", "gluten-free", "dairy-free", "pescatarian"];

async function loadRecipes(mood: Mood, guest: string | null) {
  const emptySaved = new Set<string>();
  try {
    const userId = await currentUserId();
    if (!userId)
      return { ranked: [], images: new Map<string, string>(), savedIds: emptySaved, error: null as string | null };

    // Read pantry + taste signals + saved recipes together in one tenant tx; provider fetch is after.
    const { pantry, signals, saved } = await withTenant(getDb(), userId, async (tx) => ({
      pantry: await getPantryView(tx, userId),
      signals: await loadPreferenceSignals(tx, userId),
      saved: await loadSavedRecipes(tx, userId),
    }));
    const savedIds = new Set(dedupeSaved(saved).map((r) => r.id));
    const inStock = pantry.filter((p) => p.status === "in_stock" || p.status === "low");
    if (inStock.length === 0)
      return { ranked: [], images: new Map<string, string>(), savedIds, error: null as string | null };

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
      const { batchScore } = estimateBatchFriendly({
        title: r.title,
        instructions: r.instructions,
        cuisine: r.cuisine,
      });
      return annotateRecipe(
        { id: r.id, title: r.title, ingredients: r.ingredients, effortScore, batchScore, cuisine: r.cuisine },
        idx,
      );
    });
    const ranked = rankRecipes(annotated, {
      limit: 8,
      lowEnergy: mood === "easy",
      batchCook: mood === "batch",
      prefs: {
        allergens: [...model.allergens, ...exclusions],
        dislikes: model.dislikes,
        loves: model.loves,
        cuisineAffinity: model.cuisineAffinity,
      },
    });
    return { ranked, images, savedIds, error: null as string | null };
  } catch (e) {
    return {
      ranked: [],
      images: new Map<string, string>(),
      savedIds: emptySaved,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ mood?: string; guest?: string }>;
}) {
  const sp = await searchParams;
  const mood: Mood = sp.mood === "easy" ? "easy" : sp.mood === "batch" ? "batch" : "nice";
  const guest = sp.guest && KNOWN_DIETS.includes(sp.guest.toLowerCase()) ? sp.guest.toLowerCase() : null;
  const { ranked, error, images, savedIds } = await loadRecipes(mood, guest);

  const href = (over: { mood?: Mood; guest?: string | null }) => {
    const m = over.mood === undefined ? mood : over.mood;
    const g = over.guest === undefined ? guest : over.guest;
    const p = new URLSearchParams();
    if (m !== "nice") p.set("mood", m);
    if (g) p.set("guest", g);
    const s = p.toString();
    return s ? `/recipes?${s}` : "/recipes";
  };

  const tab = (h: string, label: string, active: boolean, cap = false) => (
    <a
      href={h}
      className={`tab ${cap ? "capitalize " : ""}${active ? "tab-active" : "tab-idle"}`}
    >
      {label}
    </a>
  );

  return (
    <main className="page">
      <PageHeader
        accent="berry"
        icon={ChefHat}
        eyebrow="Cook tonight"
        title="Cook tonight"
        subtitle="Ranked by what you already have. How much do you feel like cooking?"
        topRight={
          <div className="flex items-center gap-3">
            <a href="/make" className="nav-link">
              Make something →
            </a>
            <a href="/cookbook" className="nav-link">
              My Cookbook →
            </a>
            <a href="/import" className="nav-link">
              Import a recipe →
            </a>
          </div>
        }
      />

      <div className="mt-6 mb-3 flex flex-wrap gap-2">
        {tab(href({ mood: "nice" }), "Cook something nice", mood === "nice")}
        {tab(href({ mood: "easy" }), "Keep it easy", mood === "easy")}
        {tab(href({ mood: "batch" }), "Batch & meal-prep", mood === "batch")}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-400">Cooking for a guest?</span>
        {GUEST_DIETS.map((g) => tab(href({ guest: guest === g ? null : g }), g, guest === g, true))}
        {guest && (
          <a href={href({ guest: null })} className="text-xs text-ink-400 underline">
            clear
          </a>
        )}
      </div>

      {mood === "batch" && (
        <p className="notice-ok mb-4">
          Cook once, eat all week — favoring dishes that keep, reheat, and scale.
        </p>
      )}
      {guest && (
        <p className="notice-ok mb-6">
          Filtered to fit a <strong className="capitalize">{guest}</strong> guest — meals with conflicting
          ingredients are hidden.
        </p>
      )}

      {error && (
        <p className="notice-warn mb-4">
          Couldn&apos;t load recipes (DB or provider). {error.slice(0, 120)}
        </p>
      )}
      {ranked.length === 0 && !error && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <ChefHat className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">No suggestions yet</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Add a few items to your pantry and suggestions will appear here.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {ranked.map((r) => (
          <li key={r.id} className="card card-hover p-4 flex gap-4">
            {images.get(r.id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images.get(r.id)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink-900">
                {r.title}
                {r.batchFriendly && (
                  <span className="pill-success ml-2 font-normal">
                    batch-friendly
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-400">
                have {r.haveCount}/{r.totalCore}
                {r.usesExpiring > 0 ? ` · uses ${r.usesExpiring} expiring` : ""}
              </div>
              {r.missing.length > 0 && (
                <div className="mt-1 text-xs text-ink-400">missing: {r.missing.join(", ")}</div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a href={`/cook/${r.id}`} className="text-xs font-medium text-brand-700">
                  Cook mode →
                </a>
                <a
                  href={`/remix/${r.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-grape-700"
                >
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2} /> Remix
                </a>
                {r.missing.length > 0 && (
                  <form action={addNamesToListAction}>
                    {r.missing.map((m) => (
                      <input key={m} type="hidden" name="name" value={m} />
                    ))}
                    <button type="submit" className="text-xs font-medium text-brand-700">
                      + Add {r.missing.length} missing to list
                    </button>
                  </form>
                )}
              </div>
            </div>
            <SaveButton
              recipe={{ id: r.id, title: r.title, imageUrl: images.get(r.id) || undefined }}
              initialSaved={savedIds.has(r.id)}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
