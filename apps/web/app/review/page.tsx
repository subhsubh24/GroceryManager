import { getDb, getReviewQueue, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";
import { confirmReviewItemAction, dismissReviewItemAction } from "./actions";
import { SubmitButton } from "../pantry/sync-buttons";
import { PageHeader } from "@/app/components/page-header";
import { Check, ReceiptText } from "@/app/components/icons";

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
    <main className="page">
      <PageHeader
        accent="ocean"
        icon={ReceiptText}
        eyebrow="Review inbox"
        title="Review inbox"
        subtitle={
          <>
            Low-confidence items the app couldn&apos;t place with certainty. Confirming teaches it (the ratchet).
          </>
        }
        back={{ href: "/pantry", label: "Pantry" }}
      />

      {error && (
        <p className="notice-warn mt-6">
          Couldn&apos;t reach the database. Set <code>DATABASE_URL</code> and run the migrations/seed.
        </p>
      )}

      {rows.length === 0 && !error && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <Check className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">Nothing to review</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">You&apos;re all caught up.</p>
        </div>
      )}

      <ul className="mt-6 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="font-medium text-ink-900">{r.rawText}</div>
            <div className="text-xs text-ink-400">
              {r.retailer}
              {r.canonicalName ? ` · best guess: ${r.canonicalName}` : " · no confident match"}
              {r.matchConfidence != null ? ` · ${Math.round(r.matchConfidence * 100)}% sure` : ""}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={confirmReviewItemAction}>
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton className="btn-primary btn-sm" pendingLabel="Adding…">
                  Add to pantry
                </SubmitButton>
              </form>
              <form action={dismissReviewItemAction}>
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">
                  Not mine
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
