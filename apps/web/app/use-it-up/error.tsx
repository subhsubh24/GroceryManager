"use client";

import { PageHeader } from "@/app/components/page-header";
import { Recycle } from "@/app/components/icons";

export default function UseItUpError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page">
      <PageHeader
        accent="brand"
        icon={Recycle}
        eyebrow="Pantry"
        title="Use it up"
      />
      <div className="card-pad mt-6">
        <p className="text-ink-500">
          Something went wrong loading expiry suggestions. Try again or come back in a moment.
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
