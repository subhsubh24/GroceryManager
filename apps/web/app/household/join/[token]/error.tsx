"use client";
import { PageHeader } from "@/app/components/page-header";
import { Link2 } from "@/app/components/icons";

export default function HouseholdJoinError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page">
      <PageHeader
        accent="brand"
        icon={Link2}
        eyebrow="Household invite"
        title="Something went wrong"
      />
      <div className="card-pad mt-6">
        <p className="text-ink-500">
          Couldn&apos;t load this invite link. Try again or ask for a fresh one.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={() => reset()} className="btn-primary">
            Try again
          </button>
          <a href="/" className="btn-secondary">
            Back home
          </a>
        </div>
      </div>
    </main>
  );
}
