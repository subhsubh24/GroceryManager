import { ScanClient } from "./scan-client";
import { PageHeader } from "@/app/components/page-header";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return (
    <main className="page">
      <PageHeader
        accent="grape"
        emoji="📸"
        eyebrow="Scan my fridge"
        title="Scan my fridge"
        subtitle={
          <>
            Snap a shelf and I&apos;ll reconcile what&apos;s actually there against what I think you
            have — confirming, never guessing. I&apos;ll never cross something off just because
            it&apos;s hidden.
          </>
        }
      />
      <div className="mt-6">
        <ScanClient />
      </div>
    </main>
  );
}
