import { getDb, getLatestUserId, getPantryView, loadWrappedInputs } from "@gm/db";
import { selectExpiringSoon } from "@gm/core/pantry";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
  type RankedRecipe,
} from "@gm/core/recipe";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const db = getDb();
    const userId = await getLatestUserId(db);
    if (!userId) return { ready: false as const, error: null as string | null };

    const [pantry, wrapped] = await Promise.all([
      getPantryView(db, userId),
      loadWrappedInputs(db, userId, 30),
    ]);
    const expiring = selectExpiringSoon(pantry, { domain: "grocery", withinDays: 5 });

    // Index every in-stock item (accurate coverage/missing), flagging the at-risk ones so the
    // matcher's usesExpiring counts exactly what we're trying to rescue.
    const expiringIds = new Set(expiring.map((e) => e.canonicalItemId));
    const inStock = pantry.filter(
      (p) => p.status === "in_stock" || p.status === "low" || p.status === "expired_likely",
    );
    const idx = buildPantryIndex(
      inStock.map((p) => ({
        name: p.name,
        aliases: p.aliases ?? [],
        inStock: true,
        expiringSoon: expiringIds.has(p.canonicalItemId),
      })),
    );

    let recipes: RankedRecipe[] = [];
    const images = new Map<string, string>();
    if (expiring.length > 0) {
      const provider = new TheMealDBProvider();
      const seeds = expiring.slice(0, 4).map((e) => e.name);
      const found = (
        await Promise.all(seeds.map((s) => provider.searchByIngredient(s).catch(() => [])))
      ).flat();
      const ids = [...new Set(found.map((f) => f.id))].slice(0, 8);
      const full = (await Promise.all(ids.map((id) => provider.getById(id).catch(() => null)))).filter(
        (r): r is NonNullable<typeof r> => r != null,
      );
      for (const r of full) images.set(r.id, r.imageUrl ?? "");
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
      // Heavily weight expiring usage; only show recipes that actually rescue something.
      recipes = rankRecipes(annotated, { limit: 6, weights: { expiring: 1 } }).filter(
        (r) => r.usesExpiring > 0,
      );
    }

    return {
      ready: true as const,
      error: null as string | null,
      expiring,
      recipes,
      images,
      spoilage30: wrapped.spoilageCount,
    };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

function urgencyLabel(reason: string, daysLeft: number | null): { text: string; cls: string } {
  if (reason === "expired_likely") return { text: "likely expired", cls: "bg-zinc-200 text-zinc-700" };
  if (daysLeft != null && daysLeft <= 0) return { text: "use today", cls: "bg-red-100 text-red-700" };
  if (daysLeft === 1) return { text: "1 day left", cls: "bg-amber-100 text-amber-800" };
  return { text: `${daysLeft} days left`, cls: "bg-amber-100 text-amber-800" };
}

export default async function UseItUpPage() {
  const data = await load();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/pantry" className="text-sm text-brand-600">← Pantry</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Use it up</h1>
      <p className="mb-6 text-sm text-ink/60">
        What&apos;s about to go bad — and meals to rescue it before it does.
      </p>

      {!data.ready && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {data.ready && data.spoilage30 > 0 && (
        <p className="mb-6 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700">
          You&apos;ve let <strong>{data.spoilage30}</strong> item{data.spoilage30 === 1 ? "" : "s"} expire in the
          last 30 days. Let&apos;s waste less.
        </p>
      )}

      {data.ready && data.expiring.length === 0 && (
        <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
          Nothing about to spoil right now. 🌱
        </p>
      )}

      {data.ready && data.expiring.length > 0 && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-semibold text-ink">Expiring soon</h2>
            <ul className="space-y-2">
              {data.expiring.map((e) => {
                const u = urgencyLabel(e.reason, e.daysLeft);
                return (
                  <li
                    key={e.canonicalItemId}
                    className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="font-medium text-ink">{e.name}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${u.cls}`}>{u.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-semibold text-ink">Cook these to use them up</h2>
            {data.recipes.length === 0 ? (
              <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
                No matching rescue recipes right now — try the{" "}
                <a href="/recipes" className="text-brand-600">
                  full recipe list
                </a>
                .
              </p>
            ) : (
              <ul className="space-y-3">
                {data.recipes.map((r) => (
                  <li
                    key={r.id}
                    className="flex gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
                  >
                    {data.images.get(r.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.images.get(r.id)}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{r.title}</div>
                      <div className="text-xs text-brand-600">
                        uses {r.usesExpiring} expiring · have {r.haveCount}/{r.totalCore}
                      </div>
                      {r.missing.length > 0 && (
                        <div className="mt-1 text-xs text-ink/40">missing: {r.missing.join(", ")}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
