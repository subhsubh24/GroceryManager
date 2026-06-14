import { revalidatePath } from "next/cache";
import { getActiveListView, getDb, withTenant } from "@gm/db";
import { captureToList, parseQuickCapture } from "@gm/core/capture";
import { currentUserId } from "@/app/lib/tenant";

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
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/list" className="text-sm text-brand-600">← Reorder</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Quick add</h1>
      <p className="mb-5 text-sm text-ink/60">
        Just type it like you&apos;d say it — &ldquo;we&apos;re out of olive oil and need 2 lbs
        chicken, some spinach.&rdquo; We&apos;ll sort it onto your list.
      </p>

      <form action={capture} className="mb-8">
        <textarea
          name="text"
          rows={3}
          placeholder="we're out of milk and need taco stuff…"
          className="w-full rounded-2xl border border-black/10 bg-white p-4 text-sm text-ink shadow-sm outline-none focus:border-brand-300"
        />
        <button
          type="submit"
          className="mt-3 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
        >
          Add to list
        </button>
      </form>

      {!data.ready && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {data.ready && (
        <section>
          <h2 className="mb-3 font-semibold text-ink">On your list</h2>
          {data.items.length === 0 ? (
            <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
              Nothing yet — add a few things above.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.items.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm"
                >
                  <span className={`text-ink ${i.checked ? "line-through opacity-50" : ""}`}>{i.name}</span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
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
