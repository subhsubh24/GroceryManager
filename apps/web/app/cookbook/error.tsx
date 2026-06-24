"use client";

import { PageHeader } from "@/app/components/page-header";
import { BookOpen } from "@/app/components/icons";

export default function CookbookError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page">
      <PageHeader
        accent="berry"
        icon={BookOpen}
        eyebrow="Your collection"
        title="My Cookbook"
      />
      <div className="card-pad mt-6">
        <p className="text-ink-500">
          Something went wrong loading your cookbook. Try again or come back in a moment.
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
