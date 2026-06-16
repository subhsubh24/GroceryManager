import { ScanClient } from "./scan-client";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Scan my fridge</h1>
      <p className="mb-6 text-sm text-ink/60">
        Snap a shelf and I&apos;ll reconcile what&apos;s actually there against what I think you have —
        confirming, never guessing. I&apos;ll never cross something off just because it&apos;s hidden.
      </p>
      <ScanClient />
    </main>
  );
}
