/**
 * Receipt verification hook (PLAN §5.5 / §8.4) — the deterministic guard that runs on the LLM's
 * ReceiptExtraction *before* it can touch the pantry. The writer never grades itself.
 *
 * Used as the `verify` step in `generateWithVerify`: success is silent, failures are verbose
 * (the reason is fed back into the loop, which retries with more context, then escalates a tier).
 */
import type { ReceiptExtraction } from "@gm/shared";

export type VerifyVerdict = { ok: true } | { ok: false; reason: string };

/** Cents tolerance for the line-totals-vs-grand-total reconciliation. */
function totalsTolerance(totalCents: number): number {
  return Math.max(100, Math.round(Math.abs(totalCents) * 0.05));
}

export function verifyReceipt(r: ReceiptExtraction): VerifyVerdict {
  if (r.lineItems.length === 0) {
    return { ok: false, reason: "no line items extracted" };
  }

  for (const [i, li] of r.lineItems.entries()) {
    if (!li.name.trim()) {
      return { ok: false, reason: `line ${i}: empty product name` };
    }
    if (li.confidence < 0 || li.confidence > 1) {
      return { ok: false, reason: `line ${i}: confidence out of range (${li.confidence})` };
    }
    if (li.quantity != null && li.quantity < 0) {
      return { ok: false, reason: `line ${i} (${li.name}): negative quantity` };
    }
    if (li.unitPriceCents != null && li.unitPriceCents < 0) {
      return { ok: false, reason: `line ${i} (${li.name}): negative unit price` };
    }
    if (li.lineTotalCents != null && li.lineTotalCents < 0) {
      return { ok: false, reason: `line ${i} (${li.name}): negative line total` };
    }
  }

  // Reconcile against OVER-extraction only: line items summing to MORE than the grand total signals
  // hallucinated or duplicated lines (a real error). Summing to LESS is normal — tax, delivery fees,
  // tips, and discounts all sit between line items and the total — so we DON'T fail on it; doing so
  // forced needless, costly tier escalation on ordinary receipts (caught by the eval harness).
  if (r.totalCents != null && r.lineItems.every((li) => li.lineTotalCents != null)) {
    const sum = r.lineItems.reduce((s, li) => s + (li.lineTotalCents ?? 0), 0);
    if (sum - r.totalCents > totalsTolerance(r.totalCents)) {
      return {
        ok: false,
        reason: `line totals (${sum}¢) exceed the grand total (${r.totalCents}¢) — likely duplicated lines`,
      };
    }
  }

  return { ok: true };
}
