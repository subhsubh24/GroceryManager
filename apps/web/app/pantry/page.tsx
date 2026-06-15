import { loadEnv } from "@gm/config/env";
import { getDb, getGoogleCredential, getPantryView, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";
import { syncGmailAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  in_stock: { label: "in stock", cls: "bg-brand-50 text-brand-700" },
  low: { label: "low", cls: "bg-amber-100 text-amber-800" },
  out: { label: "out", cls: "bg-red-100 text-red-700" },
  expired_likely: { label: "likely expired", cls: "bg-zinc-200 text-zinc-700" },
};

const plural = (n: number) => (n === 1 ? "" : "s");

async function loadPantry() {
  try {
    const userId = await currentUserId();
    if (!userId) return { rows: [], connected: false, error: null as string | null };
    const { rows, cred } = await withTenant(getDb(), userId, async (tx) => ({
      rows: await getPantryView(tx, userId),
      cred: await getGoogleCredential(tx, userId),
    }));
    return { rows, connected: Boolean(cred), error: null as string | null };
  } catch (e) {
    return { rows: [], connected: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function PantryPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    scanned?: string;
    ingested?: string;
    lines?: string;
    review?: string;
  }>;
}) {
  const { rows, connected, error } = await loadPantry();
  const sp = await searchParams;
  const oauthConfigured = Boolean(loadEnv().GOOGLE_CLIENT_ID && loadEnv().GOOGLE_CLIENT_SECRET);

  // Result banner from the sync action's redirect query string.
  let syncBanner: { kind: "ok" | "info" | "err"; text: string } | null = null;
  if (sp.error) {
    syncBanner = { kind: "err", text: `Sync failed: ${sp.error}` };
  } else if (sp.scanned !== undefined) {
    const scanned = Number(sp.scanned);
    const ingested = Number(sp.ingested ?? 0);
    const lines = Number(sp.lines ?? 0);
    const review = Number(sp.review ?? 0);
    syncBanner =
      ingested > 0
        ? {
            kind: "ok",
            text: `Synced ${scanned} message${plural(scanned)} — added ${ingested} receipt${plural(
              ingested,
            )}, ${lines} item${plural(lines)}${review > 0 ? `; ${review} need review` : ""}.`,
          }
        : {
            kind: "info",
            text: `Checked ${scanned} message${plural(scanned)} — nothing new to add.`,
          };
  }
  const bannerCls = {
    ok: "bg-brand-50 text-brand-800",
    info: "bg-zinc-100 text-zinc-700",
    err: "bg-amber-50 text-amber-800",
  } as const;

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Pantry</h1>
        <div className="flex gap-4">
          <a href="/use-it-up" className="text-sm font-medium text-brand-600">Use it up →</a>
          <a href="/review" className="text-sm font-medium text-brand-600">Review inbox →</a>
        </div>
      </div>

      {/* Receipts → pantry: connect Gmail once, then auto-fill from receipt emails. */}
      <section className="mb-6 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink">
              Fill from receipts {connected && <span className="text-brand-600">· connected ✓</span>}
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              Pulls your Amazon, Whole Foods &amp; Instacart receipt emails and updates the pantry.
            </p>
          </div>
          {connected ? (
            <form action={syncGmailAction}>
              <button
                type="submit"
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
              >
                Sync receipts now
              </button>
            </form>
          ) : (
            <a
              href="/api/auth/signin"
              className="rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-sm"
            >
              Connect Gmail
            </a>
          )}
        </div>
        {!connected && !oauthConfigured && (
          <p className="mt-3 text-xs text-ink/40">
            Gmail sign-in needs <code>GOOGLE_CLIENT_ID</code>/<code>GOOGLE_CLIENT_SECRET</code> set —
            see <code>docs/GMAIL_SETUP.md</code>.
          </p>
        )}
        {syncBanner && (
          <p className={`mt-3 rounded-xl p-3 text-sm ${bannerCls[syncBanner.kind]}`}>{syncBanner.text}</p>
        )}
      </section>

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
