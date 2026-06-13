import { loadEnv } from "@gm/config/env";
import { getDb, getLatestUserId, loadReorderInputs } from "@gm/db";
import { buildDraftOrders, type ReorderInputRow } from "@gm/core/reorder";

export const dynamic = "force-dynamic";

async function loadDraft() {
  try {
    const db = getDb();
    const userId = await getLatestUserId(db);
    if (!userId) return { draft: null, error: null as string | null };
    const rows = (await loadReorderInputs(db, userId)) as ReorderInputRow[];
    const draft = buildDraftOrders(rows, { associateTag: loadEnv().AMAZON_ASSOCIATE_TAG });
    return { draft, error: null as string | null };
  } catch (e) {
    return { draft: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function ListPage() {
  const { draft, error } = await loadDraft();
  const nothingDue =
    draft && draft.instacart.items.length === 0 && draft.amazon.items.length === 0;

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <div className="flex items-center justify-between">
        <a href="/" className="text-sm text-brand-600">← Home</a>
        <a href="/staples" className="text-sm font-medium text-brand-600">Staples autopilot →</a>
      </div>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Reorder</h1>
      <p className="mb-6 text-sm text-ink/60">
        Drafted from what&apos;s running low — one tap to order, you confirm checkout.
      </p>

      {error && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. Set <code>DATABASE_URL</code> and run migrations/seed.
        </p>
      )}

      {nothingDue && !error && (
        <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">Nothing due right now. ✅</p>
      )}

      {draft && draft.instacart.items.length > 0 && (
        <section className="mb-6 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Groceries · Instacart</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink/70">
            {draft.instacart.items.map((i) => (
              <li key={i.canonicalItemId}>
                {i.name}
                {i.recommendQty ? ` · ${Math.round(i.recommendQty)} ${i.unit ?? ""}` : ""}
              </li>
            ))}
          </ul>
          <form action="/api/instacart" method="post" className="mt-4">
            <button
              type="submit"
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
            >
              Shop with Instacart
            </button>
          </form>
        </section>
      )}

      {draft && draft.amazon.items.length > 0 && (
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Household &amp; care · Amazon</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink/70">
            {draft.amazon.items.map((i) => (
              <li key={i.canonicalItemId}>
                {i.name}
                {i.asin ? "" : " · (no ASIN yet)"}
              </li>
            ))}
          </ul>
          {draft.amazon.addToCartUrl ? (
            <a
              href={draft.amazon.addToCartUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"
            >
              Add all to Amazon cart
            </a>
          ) : (
            <p className="mt-3 text-xs text-ink/50">
              The Add-to-Cart link appears once items have an ASIN (from the Amazon vertical).
            </p>
          )}
        </section>
      )}
    </main>
  );
}
