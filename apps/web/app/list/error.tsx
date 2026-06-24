"use client";

import { PageHeader } from "@/app/components/page-header";
import { ShoppingCart } from "@/app/components/icons";

export default function ListError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page">
      <PageHeader
        accent="brand"
        icon={ShoppingCart}
        eyebrow="List"
        title="Shopping List"
      />
      <div className="card-pad mt-6">
        <p className="text-ink-500">
          Couldn&apos;t load your list. Give it another try.
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
