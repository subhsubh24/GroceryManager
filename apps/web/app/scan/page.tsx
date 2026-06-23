import { ScanClient } from "./scan-client";
import { PageHeader } from "@/app/components/page-header";
import { OnboardingFinish } from "@/app/components/onboarding-finish";
import { Camera } from "@/app/components/icons";

export const dynamic = "force-dynamic";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="page">
      <PageHeader
        accent="grape"
        icon={Camera}
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
      {sp.from === "onboarding" && <OnboardingFinish />}
      <div className="mt-6">
        <ScanClient />
      </div>
    </main>
  );
}
