import { getDb, loadSavedRecipes, withTenant } from "@gm/db";
import { dedupeSaved, type SavedRecipe } from "@gm/core/recipe";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { SaveButton } from "./save-button";

export const dynamic = "force-dynamic";

async function loadCookbook(): Promise<{ recipes: SavedRecipe[]; error: string | null }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { recipes: [], error: null };
    const rows = await withTenant(getDb(), userId, (tx) => loadSavedRecipes(tx, userId));
    return { recipes: dedupeSaved(rows), error: null };
  } catch (e) {
    return { recipes: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function CookbookPage() {
  const { recipes, error } = await loadCookbook();

  return (
    <main className="page">
      <PageHeader
        accent="berry"
        emoji="📖"
        eyebrow="Your collection"
        title="My Cookbook"
        subtitle="Recipes you've saved — ready to cook again."
        topRight={
          <a href="/recipes" className="nav-link">
            Find recipes →
          </a>
        }
      />

      {error && (
        <p className="notice-warn mt-6">
          Couldn&apos;t load your cookbook. {error.slice(0, 120)}
        </p>
      )}

      {!error && recipes.length === 0 && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">📖</div>
          <p className="text-sm font-medium text-ink-700">No saved recipes yet</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Tap the heart on any recipe to add it here.
          </p>
        </div>
      )}

      {recipes.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {recipes.map((r) => (
            <li key={r.id} className="card card-hover p-4 flex gap-4">
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="font-medium text-ink-900">{r.title}</div>
                {r.cuisine ? <div className="text-xs text-ink-400">{r.cuisine}</div> : null}
                <div className="mt-2 flex items-center justify-between gap-3">
                  <a href={`/cook/${r.id}`} className="text-xs font-medium text-brand-700">
                    Cook mode →
                  </a>
                  <SaveButton recipe={r} initialSaved />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
