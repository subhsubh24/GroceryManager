"use client";

import { PageHeader } from "@/app/components/page-header";
import { ReceiptText } from "@/app/components/icons";

export default function AddReceiptError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page">
      <PageHeader
        accent="ocean"
        icon={ReceiptText}
        eyebrow="Add a receipt"
        title="Snap a receipt"
      />
      <div className="card-pad mt-6">
        <p className="text-ink-500">
          Something went wrong loading the receipt uploader. Try again or come back in a moment.
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
