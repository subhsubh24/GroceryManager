import { loadEnv } from "@gm/config/env";
import { getActiveListView, getDb, loadReorderInputs, withTenant } from "@gm/db";
import { buildDraftOrders, mergeInstacartItems, type ReorderInputRow } from "@gm/core/reorder";
import { instacart } from "@gm/core/integrations";
import { currentUserId } from "@/app/lib/tenant";
import { CopyListButton } from "./copy-list-button";

export const dynamic = "force-dynamic";

const { buildInstacartSearchUrl, buildListText } = instacart;

async function loadDraft() {
  try {
    const env = loadEnv();
    const userId = await currentUserId();
    if (!userId)
      return { draft: null, listItems: [], hasInstacartKey: false, error: null as string | null };
    const { rows, list } = await withTenant(getDb(), userId, async (tx) => ({
      rows: (await loadReorderInputs(tx, userId)) as ReorderInputRow[],
      list: await getActiveListView(tx, userId),
    }));
    const draft = buildDraftOrders(rows, { associateTag: env.AMAZON_ASSOCIATE_TAG });
    const listItems = list.filter((i) => !i.checked);
    return {
      draft,
      listItems,
      hasInstacartKey: Boolean(env.INSTACART_API_KEY),
      error: null as string | null,
    };
  } catch (e) {
    return {
      draft: null,
      listItems: [],
      hasInstacartKey: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export default async function ListPage() {
  const { draft, listItems, hasInstacartKey, error } = await loadDraft();
  const nothingDue =
    draft &&
    draft.instacart.items.length === 0 &&
    draft.amazon.items.length === 0 &&
    listItems.length === 0;

  // The exact set the official push would order — reused for the keyless copy-list + search links.
  const merged = draft
    ? mergeInstacartItems(draft.instacart.items, listItems.map((i) => ({ name: i.name })))
    : [];
  const listText = buildListText(merged, "Your GroceryManager list");

  // Keyless: each item name links to an Instacart search (how you'd shop it by hand). With a key,
  // the one-tap prefill button does the work, so names stay plain text.
  const itemLabel = (name: string, extra: string) =>
    hasInstacartKey ? (
      <>
        {name}
        {extra}
      </>
    ) : (
      <>
        <a
          href={buildInstacartSearchUrl(name)}
          target="_blank"
          rel="noreferrer"
          className="text-brand-700 hover:underline"
        >
          {name}
        </a>
        {extra}
      </>
    );

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <div className="flex items-center justify-between">
        <a href="/" className="text-sm text-brand-600">← Home</a>
        <div className="flex gap-4">
          <a href="/capture" className="text-sm font-medium text-brand-600">Quick add →</a>
          <a href="/staples" className="text-sm font-medium text-brand-600">Staples autopilot →</a>
        </div>
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

      {draft && (draft.instacart.items.length > 0 || listItems.length > 0) && (
        <section className="mb-6 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Groceries · Instacart</h2>
          {draft.instacart.items.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-ink/70">
              {draft.instacart.items.map((i) => (
                <li key={i.canonicalItemId}>
                  {itemLabel(
                    i.name,
                    i.recommendQty ? ` · ${Math.round(i.recommendQty)} ${i.unit ?? ""}` : "",
                  )}
                </li>
              ))}
            </ul>
          )}
          {listItems.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium uppercase tracking-wide text-ink/40">From your list</div>
              <ul className="mt-1 space-y-1 text-sm text-ink/70">
                {listItems.map((i) => (
                  <li key={i.id}>{itemLabel(i.name, "")}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-xs text-ink/50">Staples due + your list — one cart.</p>

          {hasInstacartKey ? (
            <form action="/api/instacart" method="post" className="mt-3">
              <button
                type="submit"
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
              >
                Shop with Instacart
              </button>
            </form>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyListButton text={listText} />
                <a
                  href="https://www.instacart.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-brand-600"
                >
                  Open Instacart →
                </a>
              </div>
              <p className="mt-2 text-xs text-ink/50">
                Copy your list and paste it into Instacart, or tap an item to search it. One-tap
                prefill turns on once Instacart is connected.
              </p>
            </>
          )}
        </section>
      )}

      {draft && draft.amazon.items.length > 0 && (
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-ink">Household, care &amp; supplements · Amazon</h2>
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
