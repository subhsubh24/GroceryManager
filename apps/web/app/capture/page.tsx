import { revalidatePath } from "next/cache";
import { getActiveListView, getDb, withTenant } from "@gm/db";
import { captureToList, parseQuickCapture } from "@gm/core/capture";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";

export const dynamic = "force-dynamic";

async function capture(formData: FormData) {
  "use server";
  const items = parseQuickCapture(String(formData.get("text") ?? ""));
  if (items.length === 0) return;
  const userId = await currentUserId();
  if (!userId) return;
  await withTenant(getDb(), userId, (tx) => captureToList(tx, userId, items));
  revalidatePath("/capture");
}

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null, items: [] };
    const items = await withTenant(getDb(), userId, (tx) => getActiveListView(tx, userId));
    return { ready: true as const, error: null as string | null, items };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e), items: [] };
  }
}

const REASON_LABEL: Record<string, string> = {
  manual: "added",
  predicted_runout: "running low",
  recipe_need: "recipe",
  low_stock: "low",
};

export default async function CapturePage() {
  const data = await load();

  return (
    <main className="page">
      <PageHeader
        accent="citrus"
        emoji="✍️"
        eyebrow="Quick add"
        title="Quick add"
        subtitle={
          <>
            Just type it like you&apos;d say it — &ldquo;we&apos;re out of olive oil and need 2 lbs
            chicken, some spinach.&rdquo; We&apos;ll sort it onto your list.
          </>
        }
        back={{ href: "/list", label: "Reorder" }}
      />

      <form action={capture} className="mt-6 mb-8">
        <textarea
          name="text"
          rows={3}
          placeholder="we're out of milk and need taco stuff…"
          className="input"
        />
        <button type="submit" className="btn-primary mt-3">
          Add to list
        </button>
      </form>

      {!data.ready && (
        <p className="notice-warn">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {data.ready && (
        <section>
          <h2 className="section-title mb-3">On your list</h2>
          {data.items.length === 0 ? (
            <div className="empty-state mt-6">
              <div className="empty-emoji">🛒</div>
              <p className="text-sm font-medium text-ink-700">Nothing yet</p>
              <p className="mt-1 max-w-xs text-sm text-ink-400">Add a few things above.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.items.map((i) => (
                <li key={i.id} className="row">
                  <span className={`text-ink-900 ${i.checked ? "line-through opacity-50" : ""}`}>{i.name}</span>
                  <span className="pill-brand">
                    {REASON_LABEL[i.reason] ?? i.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
