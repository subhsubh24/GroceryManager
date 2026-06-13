import { getDb, getReviewQueue, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";

export const dynamic = "force-dynamic";

async function loadReview() {
  try {
    const userId = await currentUserId();
    if (!userId) return { rows: [], error: null as string | null };
    const rows = await withTenant(getDb(), userId, (tx) => getReviewQueue(tx, userId));
    return { rows, error: null as string | null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function ReviewPage() {
  const { rows, error } = await loadReview();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/pantry" className="text-sm text-brand-600">← Pantry</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Review inbox</h1>
      <p className="mb-6 text-sm text-ink/60">
        Low-confidence items the app couldn&apos;t place with certainty. Confirming teaches it (the ratchet).
      </p>

      {error && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. Set <code>DATABASE_URL</code> and run the migrations/seed.
        </p>
      )}

      {rows.length === 0 && !error && (
        <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">Nothing to review. 🎉</p>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm">
            <div className="font-medium text-ink">{r.rawText}</div>
            <div className="text-xs text-ink/50">
              {r.retailer}
              {r.canonicalName ? ` · best guess: ${r.canonicalName}` : " · no confident match"}
              {r.matchConfidence != null ? ` · ${Math.round(r.matchConfidence * 100)}% sure` : ""}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
