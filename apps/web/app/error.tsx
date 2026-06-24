"use client";

import { PageHeader } from "@/app/components/page-header";
import { Leaf } from "@/app/components/icons";

export default function HomeError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page">
      <PageHeader accent="brand" icon={Leaf} eyebrow="GroceryManager" title="Something went wrong" />
      <div className="card-pad mt-6">
        <p className="text-ink-500">
          Couldn&apos;t load your dashboard. Try again or come back in a moment.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={() => reset()} className="btn-primary">
            Try again
          </button>
          <a href="/signin" className="btn-secondary">
            Sign in again
          </a>
        </div>
      </div>
    </main>
  );
}
