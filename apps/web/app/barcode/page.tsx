import { PageHeader } from "@/app/components/page-header";
import { ScanBarcode } from "@/app/components/icons";
import { addScannedItemAction } from "./actions";
import { BarcodeScanner } from "./barcode-scanner";

export const dynamic = "force-dynamic";

export default function BarcodePage() {
  return (
    <main className="page">
      <PageHeader
        accent="ocean"
        icon={ScanBarcode}
        eyebrow="Scan a barcode"
        title="Add by barcode"
        subtitle="Point your camera at a barcode, or type the number — we'll look it up and add it to your list."
        back={{ href: "/list", label: "Reorder" }}
      />

      <BarcodeScanner addAction={addScannedItemAction} />
    </main>
  );
}
