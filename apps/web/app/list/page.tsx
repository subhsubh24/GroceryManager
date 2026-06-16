import { loadEnv } from "@gm/config/env";
import { getActiveListView, getDb, loadReorderInputs, withTenant } from "@gm/db";
import { buildDraftOrders, mergeInstacartItems, type ReorderInputRow } from "@gm/core/reorder";
import { instacart } from "@gm/core/integrations";
import { currentUserId } from "@/app/lib/tenant";
import { CopyListButton } from "./copy-list-button";
import { PageHeader } from "@/app/components/page-header";

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
    <main className="page">
      <PageHeader
        accent="brand"
        emoji="🛒"
        eyebrow="Reorder"
        title="Reorder"
        subtitle={
          <>
            Drafted from what&apos;s running low — one tap to order, you confirm checkout.
          </>
        }
        topRight={
          <div className="flex gap-4">
            <a href="/capture" className="nav-link">Quick add →</a>
            <a href="/staples" className="nav-link">Staples autopilot →</a>
          </div>
        }
      />

      {error && (
        <p className="notice-warn mt-6 mb-4">
          Couldn&apos;t reach the database. Set <code>DATABASE_URL</code> and run migrations/seed.
        </p>
      )}

      {nothingDue && !error && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">✅</div>
          <p className="text-sm font-medium text-ink-700">Nothing due right now</p>
        </div>
      )}

      {draft && (draft.instacart.items.length > 0 || listItems.length > 0) && (
        <section className="card-pad mt-6 mb-6">
          <h2 className="section-title">Groceries · Instacart</h2>
          {draft.instacart.items.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-ink-500">
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
              <div className="text-xs font-medium uppercase tracking-wide text-ink-400">From your list</div>
              <ul className="mt-1 space-y-1 text-sm text-ink-500">
                {listItems.map((i) => (
                  <li key={i.id}>{itemLabel(i.name, "")}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-xs text-ink-400">Staples due + your list — one cart.</p>

          {hasInstacartKey ? (
            <form action="/api/instacart" method="post" className="mt-3">
              <button type="submit" className="btn-primary">
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
                  className="nav-link"
                >
                  Open Instacart →
                </a>
              </div>
              <p className="mt-2 text-xs text-ink-400">
                Copy your list and paste it into Instacart, or tap an item to search it. One-tap
                prefill turns on once Instacart is connected.
              </p>
            </>
          )}
        </section>
      )}

      {draft && draft.amazon.items.length > 0 && (
        <section className="card-pad">
          <h2 className="section-title">Household, care &amp; supplements · Amazon</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink-500">
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
              className="btn-dark mt-4"
            >
              Add all to Amazon cart
            </a>
          ) : (
            <p className="mt-3 text-xs text-ink-400">
              The Add-to-Cart link appears once items have an ASIN (from the Amazon vertical).
            </p>
          )}
        </section>
      )}
    </main>
  );
}
