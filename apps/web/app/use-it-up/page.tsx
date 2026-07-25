import { revalidatePath } from "next/cache";
import { getDb, getPantryView, loadPreferenceSignals, loadWasteEvents, withTenant } from "@gm/db";
import { recordWaste, selectExpiringSoon, summarizeWaste } from "@gm/core/pantry";
import { dietExclusions, projectUserModel } from "@gm/core/personalization";
import { currentUserId } from "@/app/lib/tenant";
import { titleCase } from "@/app/lib/format";
import { PageHeader } from "@/app/components/page-header";
import { ChefHat, Recycle, Sprout } from "@/app/components/icons";
import { CookedItButton } from "@/app/components/cooked-it-button";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
  type RankedRecipe,
} from "@gm/core/recipe";

export const dynamic = "force-dynamic";

async function markWasted(formData: FormData) {
  "use server";
  const canonicalItemId = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "") || null;
  if (!canonicalItemId) return;
  const userId = await currentUserId();
  if (!userId) return;
  await withTenant(getDb(), userId, (tx) => recordWaste(tx, userId, canonicalItemId, name));
  revalidatePath("/use-it-up");
}

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };

    const [pantry, wasteEvents, signals] = await withTenant(getDb(), userId, (tx) =>
      Promise.all([
        getPantryView(tx, userId),
        loadWasteEvents(tx, userId, 30),
        loadPreferenceSignals(tx, userId),
      ]),
    );
    const model = projectUserModel(signals);
    const exclusions = dietExclusions(model.diets);
    const waste = summarizeWaste(wasteEvents);
    const expiring = selectExpiringSoon(pantry, { domain: "grocery", withinDays: 5, excludeExpired: true });

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
      recipes = rankRecipes(annotated, {
        limit: 6,
        weights: { expiring: 1 },
        prefs: {
          allergens: model.allergens,
          dietKeywords: exclusions,
          dislikes: model.dislikes,
          loves: model.loves,
          cuisineAffinity: model.cuisineAffinity,
        },
      }).filter((r) => r.usesExpiring > 0);
    }

    return {
      ready: true as const,
      error: null as string | null,
      expiring,
      recipes,
      images,
      waste,
    };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

function urgencyLabel(reason: string, daysLeft: number | null): { text: string; cls: string } {
  if (reason === "expired_likely") return { text: "likely expired", cls: "pill-muted" };
  if (daysLeft != null && daysLeft <= 0) return { text: "use today", cls: "pill-danger" };
  if (daysLeft === 1) return { text: "1 day left", cls: "pill-warn" };
  return { text: `${daysLeft} days left`, cls: "pill-warn" };
}

export default async function UseItUpPage() {
  const data = await load();

  return (
    <main className="page">
      <PageHeader
        accent="berry"
        icon={Recycle}
        eyebrow="Reduce waste"
        title="Use it up"
        subtitle="What's about to go bad — and meals to rescue it before it does."
        back={{ href: "/pantry", label: "Pantry" }}
      />

      {!data.ready && (
        <p className="notice-warn mt-6">
          Couldn&apos;t reach the database.
        </p>
      )}

      {data.ready && data.waste.count > 0 && (
        <div className="notice-info mt-6">
          You&apos;ve let <strong>{data.waste.count}</strong> item{data.waste.count === 1 ? "" : "s"} expire in
          the last 30 days. Let&apos;s waste less.
          {data.waste.byItem.some((i) => i.count > 1) && (
            <div className="mt-1 text-xs text-ink-400">
              Repeat offenders: {data.waste.byItem.filter((i) => i.count > 1).map((i) => `${i.name} (×${i.count})`).join(", ")} —
              I&apos;ve trimmed how much of these I&apos;ll suggest buying.
            </div>
          )}
        </div>
      )}

      {data.ready && data.expiring.length === 0 && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <Sprout className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">Nothing about to spoil</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">You&apos;re all caught up right now.</p>
        </div>
      )}

      {data.ready && data.expiring.length > 0 && (
        <div className="space-y-8">
          <section>
            <h2 className="section-title mb-3">Expiring soon</h2>
            <ul className="space-y-2">
              {data.expiring.map((e) => {
                const u = urgencyLabel(e.reason, e.daysLeft);
                return (
                  <li key={e.canonicalItemId} className="row">
                    <span className="min-w-0 font-medium text-ink-900">{titleCase(e.name)}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={u.cls}>{u.text}</span>
                      <form action={markWasted}>
                        <input type="hidden" name="id" value={e.canonicalItemId} />
                        <input type="hidden" name="name" value={e.name} />
                        <button
                          type="submit"
                          className="btn-ghost btn-sm min-h-[44px] -my-2 -mr-2 rounded-full"
                          title="Mark as wasted — removes it and teaches me to buy less"
                        >
                          Tossed it
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="section-title mb-3">Cook these to use them up</h2>
            {data.recipes.length === 0 ? (
              <div className="empty-state mt-6">
                <div className="empty-emoji">
                  <ChefHat className="h-6 w-6" strokeWidth={2} />
                </div>
                <p className="text-sm font-medium text-ink-700">No matching rescue recipes right now</p>
                <p className="mt-1 max-w-xs text-sm text-ink-400">
                  Try the{" "}
                  <a href="/recipes" className="text-brand-700">
                    full recipe list
                  </a>
                  .
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.recipes.map((r) => (
                  <li key={r.id} className="card-pad flex gap-4">
                    {data.images.get(r.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.images.get(r.id)}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="font-medium text-ink-900">{r.title}</div>
                      <div className="text-xs text-brand-700">
                        uses {r.usesExpiring} expiring · have {r.haveCount}/{r.totalCore}
                      </div>
                      {r.missing.length > 0 && (
                        <div className="mt-1 text-xs text-ink-400">missing: {r.missing.join(", ")}</div>
                      )}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {/* ≥44px hit target (WCAG 2.5.5 / Apple HIG) — primary control in the core cook loop. */}
                        <a href={`/cook/${r.id}`} className="btn-secondary min-h-[44px]">
                          Cook →
                        </a>
                        <CookedItButton recipeId={r.id} />
                      </div>
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
