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
import { projectUserModel } from "@gm/core/personalization";
import { geminiPlanGenerator, planWeek, type PlanCandidate } from "@gm/core/agent";
import { captureToList } from "@gm/core/capture";
import { currentUserId } from "@/app/lib/tenant";

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
        allergens: model.allergens,
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
      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
        active ? "bg-brand-500 text-white" : "bg-white text-ink/70 border border-black/5"
      }`}
    >
      {label}
    </a>
  );

  const result = data.ready ? data.result : null;
  const images = data.ready ? data.images : new Map<string, string>();
  const dinners = result?.plan.dinners ?? [];
  const addToList = result?.plan.addToList ?? [];

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Plan my week</h1>
      <p className="mb-4 text-sm text-ink/60">
        Five dinners built from what you have, using up what&apos;s about to expire first.
      </p>

      <div className="mb-6 flex gap-2">
        {tab("/plan", "Normal week", !lowEnergy)}
        {tab("/plan?energy=low", "Low-energy week", lowEnergy)}
      </div>

      {!data.ready && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t build a plan (DB or recipe provider). {data.error?.slice(0, 120)}
        </p>
      )}

      {result && (
        <div className="space-y-6">
          <section className="rounded-2xl bg-brand-500 p-6 text-white shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-lg font-semibold">Your week</h2>
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
                  className="flex gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
                >
                  {images.get(d.recipeId) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images.get(d.recipeId)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-brand-600">{d.day}</div>
                    <div className="font-medium text-ink">{d.title}</div>
                    <div className="text-xs text-ink/50">{d.reason}</div>
                    {d.usesExpiring.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {d.usesExpiring.map((n) => (
                          <span key={n} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                            uses {n}
                          </span>
                        ))}
                      </div>
                    )}
                    <a href={`/cook/${d.recipeId}`} className="mt-2 inline-block text-xs font-medium text-brand-600">
                      Cook mode →
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {dinners.length === 0 && (
            <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
              Add a few items to your pantry and a weekly plan will appear here.
            </p>
          )}

          {addToList.length > 0 && (
            <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="mb-1 font-semibold text-ink">Shopping gap</h2>
              <p className="mb-3 text-sm text-ink/60">
                {addToList.length} item{addToList.length === 1 ? "" : "s"} you&apos;ll need for this week.
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {addToList.map((n) => (
                  <span key={n} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">
                    {n}
                  </span>
                ))}
              </div>
              <form action={addPlanItemsToList}>
                <input type="hidden" name="items" value={JSON.stringify(addToList)} />
                <button
                  type="submit"
                  className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                >
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
