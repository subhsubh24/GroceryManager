import { PageHeader } from "@/app/components/page-header";
import { ReceiptText } from "@/app/components/icons";
import { ReceiptUploader } from "./receipt-uploader";

export const dynamic = "force-dynamic";
// Extract (a vision LLM call) + ingest several lines inline — give it room beyond the 10s default.
export const maxDuration = 60;

export default function AddReceiptPage() {
  return (
    <main className="page">
      <PageHeader
        accent="ocean"
        icon={ReceiptText}
        eyebrow="Add a receipt"
        title="Snap a receipt"
        subtitle="Shopped somewhere else? Photograph or upload a paper/email receipt and we'll add it to your pantry."
        back={{ href: "/pantry", label: "Pantry" }}
      />
      <div className="mt-6">
        <ReceiptUploader />
      </div>
    </main>
  );
}
