import { redirect } from "next/navigation";
import {
  getDb,
  getPantryView,
  getUserBudgetCents,
  loadPreferenceSignals,
  withTenant,
} from "@gm/db";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
} from "@gm/core/recipe";
import { selectExpiringSoon } from "@gm/core/pantry";
import { dietExclusions, projectUserModel } from "@gm/core/personalization";
import { geminiPlanGenerator, planWeek, type PlanCandidate } from "@gm/core/agent";
import { captureToList } from "@gm/core/capture";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";

export const dynamic = "force-dynamic";

const TARGET_DINNERS = 5;

async function addPlanItemsToList(formData: FormData) {
  "use server";
  let names: string[] = [];
  try {
    names = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    names = [];
  }
  names = names.filter((n): n is string => typeof n === "string" && n.trim().length > 0).map((n) => n.trim());
  if (names.length === 0) return;

  const userId = await currentUserId();
  if (!userId) return;
  await withTenant(getDb(), userId, (tx) =>
    captureToList(tx, userId, names.map((name) => ({ name }))),
  );
  redirect("/list");
}

async function load(lowEnergy: boolean) {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };

    const { pantry, signals, budgetCents } = await withTenant(getDb(), userId, async (tx) => ({
      pantry: await getPantryView(tx, userId),
      signals: await loadPreferenceSignals(tx, userId),
      budgetCents: await getUserBudgetCents(tx, userId),
    }));

    const inStock = pantry.filter((p) => p.status === "in_stock" || p.status === "low");
    const expiringNames = selectExpiringSoon(pantry, { domain: "grocery", withinDays: 5 }).map((e) => e.name);

    const idx = buildPantryIndex(
      inStock.map((p) => ({
        name: p.name,
        aliases: p.aliases ?? [],
        inStock: true,
        expiringSoon: p.status === "low" || p.status === "expired_likely",
      })),
    );

    // Candidate set: pull recipes seeded by what's on hand, then annotate + rank (§7.2).
    const provider = new TheMealDBProvider();
    const seeds = inStock.slice(0, 4).map((p) => p.name);
    const found = (await Promise.all(seeds.map((s) => provider.searchByIngredient(s).catch(() => [])))).flat();
    const ids = [...new Set(found.map((f) => f.id))].slice(0, 8);
    const full = (await Promise.all(ids.map((id) => provider.getById(id).catch(() => null)))).filter(
      (r): r is NonNullable<typeof r> => r != null,
    );

    const images = new Map(full.map((r) => [r.id, r.imageUrl ?? ""]));
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
    const annotatedById = new Map(annotated.map((a) => [a.id, a]));

    const model = projectUserModel(signals);
    const ranked = rankRecipes(annotated, {
      limit: 8,
      lowEnergy,
      prefs: {
        allergens: [...model.allergens, ...dietExclusions(model.diets)],
        dislikes: model.dislikes,
        loves: model.loves,
        cuisineAffinity: model.cuisineAffinity,
      },
    });

    const candidates: PlanCandidate[] = ranked.map((r) => ({
      id: r.id,
      title: r.title,
      coverage: r.coverage,
      missing: r.missing,
      usesExpiring: r.usesExpiring,
      expiringIngredients: (annotatedById.get(r.id)?.ingredients ?? [])
        .filter((i) => i.inPantry && i.expiringSoon)
        .map((i) => i.name),
      cuisine: annotatedById.get(r.id)?.cuisine,
    }));

    // The LLM upgrades the plan when a key is configured; otherwise the deterministic floor runs.
    const generate = process.env.GEMINI_API_KEY ? geminiPlanGenerator() : undefined;
    const result = await planWeek(
      {
        candidates,
        expiringNames,
        prefs: { diets: model.diets, allergens: model.allergens, dislikes: model.dislikes },
        budgetCents,
        targetDinners: TARGET_DINNERS,
        lowEnergy,
      },
      { generate },
    );

    return { ready: true as const, error: null as string | null, result, images };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ energy?: string }>;
}) {
  const lowEnergy = (await searchParams).energy === "low";
  const data = await load(lowEnergy);

  const tab = (href: string, label: string, active: boolean) => (
    <a
      href={href}
      className={`tab ${active ? "tab-active" : "tab-idle"}`}
    >
      {label}
    </a>
  );

  const result = data.ready ? data.result : null;
  const images = data.ready ? data.images : new Map<string, string>();
  const dinners = result?.plan.dinners ?? [];
  const addToList = result?.plan.addToList ?? [];

  return (
    <main className="page">
      <PageHeader
        accent="grape"
        emoji="🗓️"
        eyebrow="Your week"
        title="Plan my week"
        subtitle="Five dinners built from what you have, using up what's about to expire first."
      />

      <div className="mt-6 mb-6 flex gap-2">
        {tab("/plan", "Normal week", !lowEnergy)}
        {tab("/plan?energy=low", "Low-energy week", lowEnergy)}
      </div>

      {!data.ready && (
        <p className="notice-warn mb-4">
          Couldn&apos;t build a plan (DB or recipe provider). {data.error?.slice(0, 120)}
        </p>
      )}

      {result && (
        <div className="space-y-6">
          <section className="panel-brand">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold">Your week</h2>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                {result.source === "llm" ? "Planned by AI ✨" : "Auto-planned"}
              </span>
            </div>
            <p className="text-sm text-white/90">{result.plan.narrative}</p>
          </section>

          {dinners.length > 0 && (
            <ol className="space-y-3">
              {dinners.map((d) => (
                <li
                  key={`${d.day}-${d.recipeId}`}
                  className="card card-hover p-4 flex gap-4"
                >
                  {images.get(d.recipeId) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images.get(d.recipeId)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-brand-700">{d.day}</div>
                    <div className="font-medium text-ink-900">{d.title}</div>
                    <div className="text-xs text-ink-400">{d.reason}</div>
                    {d.usesExpiring.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {d.usesExpiring.map((n) => (
                          <span key={n} className="pill-warn">
                            uses {n}
                          </span>
                        ))}
                      </div>
                    )}
                    <a href={`/cook/${d.recipeId}`} className="mt-2 inline-block text-xs font-medium text-brand-700">
                      Cook mode →
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {dinners.length === 0 && (
            <div className="empty-state mt-6">
              <div className="empty-emoji">🌱</div>
              <p className="text-sm font-medium text-ink-700">No weekly plan yet</p>
              <p className="mt-1 max-w-xs text-sm text-ink-400">
                Add a few items to your pantry and a weekly plan will appear here.
              </p>
            </div>
          )}

          {addToList.length > 0 && (
            <section className="card-pad">
              <h2 className="section-title mb-1">Shopping gap</h2>
              <p className="mb-3 text-sm text-ink-500">
                {addToList.length} item{addToList.length === 1 ? "" : "s"} you&apos;ll need for this week.
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {addToList.map((n) => (
                  <span key={n} className="pill-brand">
                    {n}
                  </span>
                ))}
              </div>
              <form action={addPlanItemsToList}>
                <input type="hidden" name="items" value={JSON.stringify(addToList)} />
                <button type="submit" className="btn-dark">
                  Add {addToList.length} to my list →
                </button>
              </form>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
