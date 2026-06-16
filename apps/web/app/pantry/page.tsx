import { loadEnv } from "@gm/config/env";
import { getDb, getGoogleCredential, getPantryView, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";
import { backfillGmailAction, connectGmailAction, syncGmailAction } from "./actions";
import { PageHeader } from "@/app/components/page-header";

export const dynamic = "force-dynamic";
// Backfill parses several receipts inline (each an LLM call) — give it room beyond the 10s default.
export const maxDuration = 60;

const STATUS: Record<string, { label: string; cls: string }> = {
  in_stock: { label: "in stock", cls: "pill-success" },
  low: { label: "low", cls: "pill-warn" },
  out: { label: "out", cls: "pill-danger" },
  expired_likely: { label: "likely expired", cls: "pill-muted" },
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
  const env = loadEnv();
  const oauthConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

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
    ok: "notice-ok",
    info: "notice-info",
    err: "notice-warn",
  } as const;

  return (
    <main className="page">
      <PageHeader
        accent="brand"
        emoji="🧺"
        eyebrow="Your kitchen"
        title="Pantry"
        topRight={
          <div className="flex gap-4">
            <a href="/use-it-up" className="nav-link">Use it up →</a>
            <a href="/review" className="nav-link">Review inbox →</a>
          </div>
        }
      />

      {/* Receipts → pantry: connect Gmail once, then auto-fill from receipt emails. */}
      <section className="card-pad mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="tile shrink-0">📧</div>
            <div>
              <h2 className="section-title">
                Fill from receipts{" "}
                {connected && <span className="pill-success ml-1 align-middle">connected ✓</span>}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Pulls your Amazon, Whole Foods &amp; Instacart receipt emails and updates the pantry.
              </p>
            </div>
          </div>
          {connected ? (
            <div className="flex flex-wrap gap-2">
              <form action={syncGmailAction}>
                <button type="submit" className="btn-primary">
                  Sync receipts now
                </button>
              </form>
              <form action={backfillGmailAction}>
                <button
                  type="submit"
                  className="btn-secondary"
                  title="Import the last ~6 months of receipts to seed your pantry"
                >
                  Import past receipts
                </button>
              </form>
            </div>
          ) : (
            <form action={connectGmailAction}>
              <button type="submit" className="btn-secondary">
                Connect Gmail
              </button>
            </form>
          )}
        </div>
        {!connected && !oauthConfigured && (
          <p className="mt-3 text-xs text-ink-400">
            Gmail sign-in needs <code>GOOGLE_CLIENT_ID</code>/<code>GOOGLE_CLIENT_SECRET</code> set —
            see <code>docs/GMAIL_SETUP.md</code>.
          </p>
        )}
        {syncBanner && <p className={`mt-4 ${bannerCls[syncBanner.kind]}`}>{syncBanner.text}</p>}
      </section>

      {error && (
        <p className="notice-warn mt-6">
          Couldn&apos;t reach the database. Set <code>DATABASE_URL</code> and run the migrations/seed.
        </p>
      )}

      {rows.length === 0 && !error && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">🧺</div>
          <p className="text-sm font-medium text-ink-700">Your pantry is empty</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Connect Gmail or scan a receipt and it&apos;ll fill itself.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-2.5">
        {rows.map((r) => {
          const s = STATUS[r.status] ?? { label: r.status, cls: "pill-muted" };
          return (
            <li key={r.canonicalItemId} className="row">
              <div className="min-w-0">
                <div className="font-semibold text-ink-900">{r.name}</div>
                <div className="mt-0.5 text-xs text-ink-400">
                  {r.domain} · {Math.round(Number(r.baseQtyOnHand))} on hand · {Math.round(r.confidence * 100)}% sure
                  {r.estimatedRunOutAt ? ` · runs out ~${new Date(r.estimatedRunOutAt).toISOString().slice(0, 10)}` : ""}
                </div>
              </div>
              <span className={s.cls}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
