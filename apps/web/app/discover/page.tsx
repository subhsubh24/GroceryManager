import { getDb, getPantryView, loadPreferenceSignals, loadSeenRecipeIds, withTenant } from "@gm/db";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateBatchFriendly,
  estimateEffort,
  nextDiscoveryBatch,
  rankRecipes,
  TheMealDBProvider,
} from "@gm/core/recipe";
import { dietExclusions, projectUserModel } from "@gm/core/personalization";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { SwipeDeck, type DeckCard } from "./swipe-deck";

export const dynamic = "force-dynamic";

/**
 * Build the Discover deck. Mirrors the /recipes loader (pantry → searchByIngredient seeds → getById
 * → annotate → rank) to produce taste-tuned candidates, then drops anything already swiped on
 * (loadSeenRecipeIds) and caps to a deck via nextDiscoveryBatch. We pull a wider candidate set than
 * /recipes so a deck still has cards after the seen-filter. Resilient: any failure → empty + message.
 */
async function loadDeck() {
  try {
    const userId = await currentUserId();
    if (!userId) return { deck: [] as DeckCard[], error: null as string | null };

    const { pantry, signals, seen } = await withTenant(getDb(), userId, async (tx) => ({
      pantry: await getPantryView(tx, userId),
      signals: await loadPreferenceSignals(tx, userId),
      seen: await loadSeenRecipeIds(tx, userId),
    }));

    const inStock = pantry.filter((p) => p.status === "in_stock" || p.status === "low");
    if (inStock.length === 0) return { deck: [] as DeckCard[], error: null as string | null };

    const idx = buildPantryIndex(
      inStock.map((p) => ({
        name: p.name,
        aliases: p.aliases ?? [],
        inStock: true,
        expiringSoon: p.status === "low" || p.status === "expired_likely",
      })),
    );

    const provider = new TheMealDBProvider();
    // Wider net than /recipes (more seeds + ids) so the deck survives the already-seen filter.
    const seeds = inStock.slice(0, 6).map((p) => p.name);
    const found = (await Promise.all(seeds.map((s) => provider.searchByIngredient(s).catch(() => [])))).flat();
    const ids = [...new Set(found.map((f) => f.id))].slice(0, 24);
    const full = (await Promise.all(ids.map((id) => provider.getById(id).catch(() => null)))).filter(
      (r): r is NonNullable<typeof r> => r != null,
    );

    const images = new Map(full.map((r) => [r.id, r.imageUrl ?? ""]));
    const model = projectUserModel(signals);
    const exclusions = dietExclusions(model.diets);
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
      limit: 24,
      prefs: {
        allergens: [...model.allergens, ...exclusions],
        dislikes: model.dislikes,
        loves: model.loves,
        cuisineAffinity: model.cuisineAffinity,
      },
    });

    // Carry the display fields onto each ranked card, then filter seen + cap to the deck.
    const cuisineById = new Map(full.map((r) => [r.id, r.cuisine ?? undefined]));
    const candidates: DeckCard[] = ranked.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: images.get(r.id) || undefined,
      cuisine: cuisineById.get(r.id),
      haveCount: r.haveCount,
      totalCore: r.totalCore,
    }));
    const deck = nextDiscoveryBatch(candidates, seen);
    return { deck, error: null as string | null };
  } catch (e) {
    return { deck: [] as DeckCard[], error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function DiscoverPage() {
  const { deck, error } = await loadDeck();

  return (
    <main className="page">
      <PageHeader
        accent="berry"
        emoji="🔥"
        eyebrow="Discover"
        title="For you"
        subtitle="Like what looks good — skip what doesn't. It learns your taste as you go."
        topRight={
          <a href="/recipes" className="nav-link">
            Cook tonight →
          </a>
        }
      />

      {error && (
        <p className="notice-warn mt-6">
          Couldn&apos;t load ideas (DB or provider). {error.slice(0, 120)}
        </p>
      )}

      {!error && deck.length === 0 && (
        <div className="empty-state mt-10">
          <div className="empty-emoji">🔥</div>
          <p className="text-sm font-medium text-ink-700">Nothing to discover yet</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Add a few items to your pantry and fresh ideas will show up here to swipe through.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <a href="/pantry" className="btn-primary btn-sm">
              Add pantry items
            </a>
            <a href="/onboarding" className="btn-ghost btn-sm">
              Tell me your taste
            </a>
          </div>
        </div>
      )}

      {!error && deck.length > 0 && (
        <div className="mt-8">
          <SwipeDeck deck={deck} />
        </div>
      )}
    </main>
  );
}
