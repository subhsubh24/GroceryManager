import { getDb, getReviewQueue, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";
import { ReviewList } from "./review-list";
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

      {rows.length > 0 && <div className="mt-6"><ReviewList items={rows} /></div>}
    </main>
  );
}
