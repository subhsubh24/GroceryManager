"use client";

import { PageHeader } from "@/app/components/page-header";
import { CalendarDays } from "@/app/components/icons";

export default function PlanError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page">
      <PageHeader
        accent="grape"
        icon={CalendarDays}
        eyebrow="Plan"
        title="Plan My Week"
      />
      <div className="card-pad mt-6">
        <p className="text-ink-500">
          Couldn&apos;t build your plan. Give it another try — planning takes a
          moment.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary"
          >
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
