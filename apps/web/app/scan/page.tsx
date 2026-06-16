import { ScanClient } from "./scan-client";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return (
    <main className="page">
      <a href="/" className="back-link">
        <span aria-hidden>←</span> Home
      </a>
      <div className="mt-4 mb-6 animate-fade-in-up">
        <p className="eyebrow">Scan my fridge</p>
        <h1 className="page-title mt-2">Scan my fridge</h1>
        <p className="page-subtitle">
          Snap a shelf and I&apos;ll reconcile what&apos;s actually there against what I think you
          have — confirming, never guessing. I&apos;ll never cross something off just because
          it&apos;s hidden.
        </p>
      </div>
      <ScanClient />
    </main>
  );
}
