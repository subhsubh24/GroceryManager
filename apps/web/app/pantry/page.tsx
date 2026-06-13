import { getDb, getLatestUserId, getPantryView } from "@gm/db";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  in_stock: { label: "in stock", cls: "bg-brand-50 text-brand-700" },
  low: { label: "low", cls: "bg-amber-100 text-amber-800" },
  out: { label: "out", cls: "bg-red-100 text-red-700" },
  expired_likely: { label: "likely expired", cls: "bg-zinc-200 text-zinc-700" },
};

async function loadPantry() {
  try {
    const db = getDb();
    const userId = await getLatestUserId(db);
    if (!userId) return { rows: [], error: null as string | null };
    return { rows: await getPantryView(db, userId), error: null as string | null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function PantryPage() {
  const { rows, error } = await loadPantry();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Pantry</h1>
        <a href="/review" className="text-sm font-medium text-brand-600">Review inbox →</a>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. Set <code>DATABASE_URL</code> and run the migrations/seed.
        </p>
      )}

      {rows.length === 0 && !error && (
        <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
          Your pantry is empty. Connect Gmail or scan a receipt and it&apos;ll fill itself.
        </p>
      )}

      <ul className="space-y-2">
        {rows.map((r) => {
          const s = STATUS[r.status] ?? { label: r.status, cls: "bg-zinc-100 text-zinc-700" };
          return (
            <li
              key={r.canonicalItemId}
              className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <div className="font-medium text-ink">{r.name}</div>
                <div className="text-xs text-ink/50">
                  {r.domain} · {Math.round(Number(r.baseQtyOnHand))} on hand · {Math.round(r.confidence * 100)}% sure
                  {r.estimatedRunOutAt ? ` · runs out ~${new Date(r.estimatedRunOutAt).toISOString().slice(0, 10)}` : ""}
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
