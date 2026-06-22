import { loadEnv } from "@gm/config/env";
import { getDb, getPantryView, withTenant } from "@gm/db";
import type { MealEnergy } from "@gm/core/recipe/generate-llm";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { Sparkles, Package } from "@/app/components/icons";
import { MealGenerator } from "./meal-generator";

export const dynamic = "force-dynamic";

/**
 * "What can I make?" — the GENERATIVE complement to /recipes (which retrieves curated recipes). The
 * LLM invents meals from the user's actual in-stock pantry, tuned to a chosen energy level. The page
 * does the cheap, deterministic checks server-side (is there a pantry? is a key configured?) and
 * renders empty/degraded states up front; the actual generation runs in the <MealGenerator> client
 * component, which calls the server action on demand.
 */
async function loadGate(): Promise<{ hasPantry: boolean }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { hasPantry: false };
    const pantry = await withTenant(getDb(), userId, (tx) => getPantryView(tx, userId));
    const hasPantry = pantry.some((p) => p.status === "in_stock" || p.status === "low");
    return { hasPantry };
  } catch {
    // A DB hiccup shouldn't crash the page — treat as "no pantry" and show the friendly empty state.
    return { hasPantry: false };
  }
}

export default async function MakePage({
  searchParams,
}: {
  searchParams: Promise<{ energy?: string }>;
}) {
  const sp = await searchParams;
  const energy: MealEnergy = sp.energy === "nice" ? "nice" : sp.energy === "zero" ? "zero" : "easy";

  const env = loadEnv();
  const hasKey = Boolean(env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT);
  const { hasPantry } = await loadGate();
  const canGenerate = hasKey && hasPantry;

  const href = (e: MealEnergy) => (e === "easy" ? "/make" : `/make?energy=${e}`);
  const tab = (e: MealEnergy, label: string) => (
    <a href={href(e)} className={`tab ${energy === e ? "tab-active" : "tab-idle"}`}>
      {label}
    </a>
  );

  return (
    <main className="page">
      <PageHeader
        accent="grape"
        icon={Sparkles}
        eyebrow="Make something"
        title="What can I make?"
        subtitle="AI meal ideas from what's in your kitchen — tuned to how much you feel like cooking."
        topRight={
          <a href="/recipes" className="nav-link">
            Cook tonight →
          </a>
        }
      />

      <div className="mt-6 mb-3 flex flex-wrap gap-2">
        {tab("nice", "Cook something nice")}
        {tab("easy", "Keep it easy")}
        {tab("zero", "Zero effort")}
      </div>

      {!hasPantry ? (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <Package className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">Add a few pantry items first</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Meal ideas are built from what you have on hand. Stock your pantry and come back.
          </p>
          <a href="/pantry" className="btn-primary mt-4">
            Go to pantry
          </a>
        </div>
      ) : !hasKey ? (
        <p className="notice-warn mt-6">
          AI meal generation needs a Gemini API key. Until one is configured, try{" "}
          <a href="/recipes" className="underline">
            Cook tonight
          </a>{" "}
          for recipes matched to your pantry.
        </p>
      ) : (
        <MealGenerator energy={energy} canGenerate={canGenerate} />
      )}
    </main>
  );
}
