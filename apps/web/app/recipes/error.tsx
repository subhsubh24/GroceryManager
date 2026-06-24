"use client";

import { PageHeader } from "@/app/components/page-header";
import { ChefHat } from "@/app/components/icons";

export default function RecipesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page">
      <PageHeader
        accent="brand"
        icon={ChefHat}
        eyebrow="Recipes"
        title="Recipe Suggestions"
      />
      <div className="card-pad mt-6">
        <p className="text-ink-500">
          Couldn&apos;t load recipe ideas. Try again.
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
