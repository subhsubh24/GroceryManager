import { loadEnv } from "@gm/config/env";
import { getDb, getGoogleCredential, getPantryView, getReviewQueue, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";
import { humanize, timeAgo, titleCase } from "@/app/lib/format";
import {
  addPantryItemAction,
  backfillGmailAction,
  connectGmailAction,
  removePantryItemAction,
  syncGmailAction,
} from "./actions";
import { confirmReviewItemAction, dismissReviewItemAction } from "../review/actions";
import { SubmitButton } from "./sync-buttons";
import { ClearPantryButton } from "./clear-button";
import { PageHeader } from "@/app/components/page-header";
import { Check, Mail, Package, Trash2 } from "@/app/components/icons";

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
    if (!userId) return { rows: [], review: [], connected: false, error: null as string | null };
    const { rows, cred, review } = await withTenant(getDb(), userId, async (tx) => ({
      rows: await getPantryView(tx, userId),
      cred: await getGoogleCredential(tx, userId),
      review: await getReviewQueue(tx, userId),
    }));
    return { rows, review, connected: Boolean(cred), error: null as string | null };
  } catch (e) {
    return { rows: [], review: [], connected: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Banner shown after a sync/backfill attempt — a friendly result, or a friendly + actionable error. */
type Banner =
  | { kind: "ok" | "info"; text: string }
  | {
      kind: "err";
      title: string;
      hint: string | null;
      link: { href: string; label: string } | null;
      raw: string;
    };

/**
 * Turn a raw Gmail/Google API error into a friendly, actionable message (the raw text is kept and
 * shown behind a "Details" toggle). Most "sync failures" are upstream Google Cloud config the user can
 * fix in a click — so we name the fix and link straight to it rather than dumping a wall of JSON.
 */
function friendlyGmailError(raw: string): {
  title: string;
  hint: string | null;
  link: { href: string; label: string } | null;
} {
  const r = raw.toLowerCase();
  // The exact "enable this API" console URL, when Google includes it in the error.
  const enableUrl = raw.match(
    /https:\/\/console\.developers\.google\.com\/apis\/api\/gmail\.googleapis\.com\/overview\?project=\d+/,
  )?.[0];
  if (
    r.includes("service_disabled") ||
    r.includes("accessnotconfigured") ||
    r.includes("has not been used in project")
  ) {
    return {
      title: "Gmail API isn't enabled yet",
      hint: "Turn on the Gmail API in your Google Cloud project, wait a couple of minutes, then sync again.",
      link: enableUrl ? { href: enableUrl, label: "Enable the Gmail API" } : null,
    };
  }
  if (r.includes("access_denied") || r.includes("approved testers") || r.includes("verification process")) {
    return {
      title: "Your Google account isn't an approved tester",
      hint: "Add your email as a Test user on the app's OAuth consent screen, then reconnect Gmail.",
      link: null,
    };
  }
  if (r.includes("invalid_grant") || r.includes("expired or revoked") || r.includes("invalid credentials")) {
    return {
      title: "Your Gmail connection expired",
      hint: "Reconnect Gmail to refresh access, then try again.",
      link: null,
    };
  }
  if (r.includes("exceeded your current quota") || r.includes("resource_exhausted") || r.includes("429")) {
    return {
      title: "The AI is rate-limited right now",
      hint: "Your Gemini key is out of quota — the free tier is very limited and can't parse receipts reliably. Add billing to your Google AI key (pennies per sync), or try again later.",
      link: { href: "https://aistudio.google.com/apikey", label: "Manage your Gemini key & billing" },
    };
  }
  if (r.includes("not signed in")) {
    return { title: "You're signed out", hint: "Sign in again, then retry.", link: null };
  }
  return {
    title: "Couldn't sync from Gmail",
    hint: "Something went wrong reaching Gmail. Give it a moment and try again.",
    link: null,
  };
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
  const { rows, review, connected, error } = await loadPantry();
  const sp = await searchParams;
  const env = loadEnv();
  const oauthConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  // Result banner from the sync action's redirect query string.
  let syncBanner: Banner | null = null;
  if (sp.error) {
    syncBanner = { kind: "err", ...friendlyGmailError(sp.error), raw: sp.error };
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
        icon={Package}
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
            <div className="tile shrink-0">
              <Mail className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="section-title">
                Fill from receipts{" "}
                {connected && (
                  <span className="pill-success ml-1 inline-flex items-center gap-1 align-middle">
                    <Check className="h-3.5 w-3.5" strokeWidth={2} /> connected
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Pulls your Amazon, Whole Foods &amp; Instacart receipt emails and updates the pantry.
              </p>
            </div>
          </div>
          {connected ? (
            <div className="flex flex-wrap gap-2">
              <form action={syncGmailAction}>
                <SubmitButton className="btn-primary" pendingLabel="Syncing…">
                  Sync receipts now
                </SubmitButton>
              </form>
              <form action={backfillGmailAction}>
                <SubmitButton
                  className="btn-secondary"
                  pendingLabel="Importing…"
                  title="Import the last ~6 months of receipts to seed your pantry"
                >
                  Import past receipts
                </SubmitButton>
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
        {/* Shopped somewhere that isn't an email receipt? Snap the paper one — same pantry. */}
        <a href="/add-receipt" className="nav-link mt-3 inline-block">
          Snap a paper receipt →
        </a>
        {!connected && !oauthConfigured && (
          <p className="mt-3 text-xs text-ink-400">
            Gmail sign-in needs <code>GOOGLE_CLIENT_ID</code>/<code>GOOGLE_CLIENT_SECRET</code> set —
            see <code>docs/GMAIL_SETUP.md</code>.
          </p>
        )}
        {syncBanner &&
          (syncBanner.kind === "err" ? (
            <div className="notice-warn mt-4">
              <p className="font-semibold">{syncBanner.title}</p>
              {syncBanner.hint && <p className="mt-1 text-sm">{syncBanner.hint}</p>}
              {syncBanner.link && (
                <a
                  href={syncBanner.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold underline underline-offset-2"
                >
                  {syncBanner.link.label} →
                </a>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-ink-400">Details</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink-50 p-2 text-[11px] leading-relaxed text-ink-500">
                  {syncBanner.raw}
                </pre>
              </details>
            </div>
          ) : (
            <p className={`mt-4 ${bannerCls[syncBanner.kind]}`}>{syncBanner.text}</p>
          ))}
      </section>

      {/* Manual add — type an item + quantity and it joins the pantry like a receipt line would. */}
      <section className="card-pad mt-4">
        <form action={addPantryItemAction} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="name"
            placeholder="Add an item — e.g. olive oil"
            aria-label="Item name"
            className="input input-lg min-w-0 flex-1"
          />
          <input
            type="number"
            name="qty"
            defaultValue={1}
            min={1}
            aria-label="Quantity"
            className="input input-lg w-20"
          />
          <SubmitButton className="btn-primary" pendingLabel="Adding…">
            Add
          </SubmitButton>
        </form>
      </section>

      {/* Inline review — low-confidence receipt lines surfaced right here (no separate trip to an
          inbox): add the real ones to the pantry, dismiss the rest. */}
      {review.length > 0 && (
        <section className="mt-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="section-title">Confirm these</h2>
            <a href="/review" className="nav-link">Open inbox →</a>
          </div>
          <p className="mb-3 text-xs text-ink-400">
            We couldn&apos;t place these with certainty — add the real ones, skip the rest.
          </p>
          <ul className="space-y-2.5">
            {[...review]
              .sort(
                (a, b) =>
                  new Date(b.purchasedAt ?? 0).getTime() - new Date(a.purchasedAt ?? 0).getTime(),
              )
              .map((r) => (
                <li key={r.id} className="card p-4">
                  {/* Lead with the clean best-guess name; the raw receipt line is secondary. */}
                  <div className="font-semibold text-ink-900">{titleCase(r.canonicalName ?? r.rawText)}</div>
                  <div className="mt-0.5 text-xs text-ink-400">
                    {humanize(r.retailer)} · {timeAgo(r.purchasedAt)}
                    {r.matchConfidence != null ? ` · ${Math.round(r.matchConfidence * 100)}% sure` : ""}
                  </div>
                  <div className="mt-1 truncate text-xs text-ink-300" title={r.rawText}>
                    {r.rawText}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <form action={confirmReviewItemAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton className="btn-primary btn-sm" pendingLabel="Adding…">
                        Add to pantry
                      </SubmitButton>
                    </form>
                    <form action={dismissReviewItemAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton className="btn-ghost btn-sm" pendingLabel="Removing…">
                        Not mine / expired
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="notice-warn mt-6">
          Couldn&apos;t reach the database. Set <code>DATABASE_URL</code> and run the migrations/seed.
        </p>
      )}

      {rows.length === 0 && !error && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <Package className="h-6 w-6" strokeWidth={2} />
          </div>
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
                <div className="font-semibold text-ink-900">{titleCase(r.name)}</div>
                <div className="mt-0.5 text-xs text-ink-400">
                  {humanize(r.domain)} · {Math.round(Number(r.baseQtyOnHand))} on hand · {Math.round(r.confidence * 100)}% sure
                  {r.estimatedRunOutAt ? ` · runs out ~${new Date(r.estimatedRunOutAt).toISOString().slice(0, 10)}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={s.cls}>{s.label}</span>
                <form action={removePantryItemAction}>
                  <input type="hidden" name="canonicalItemId" value={r.canonicalItemId} />
                  <button
                    type="submit"
                    aria-label="Remove"
                    className="text-ink-300 transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      {!error && (
        <div className="mt-10 border-t border-line pt-4 text-center">
          <ClearPantryButton />
        </div>
      )}
    </main>
  );
}
