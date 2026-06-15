import { describe, expect, it } from "vitest";
import {
  accumulateParseResult,
  emptyGmailSyncSummary,
  type ParseReceiptResult,
} from "./gmail-sync.js";

const ingested = (lines: number, review = 0): ParseReceiptResult => ({
  skipped: false,
  deduped: false,
  purchaseId: "p",
  linesIngested: lines,
  needsReview: review,
});
const deduped: ParseReceiptResult = {
  skipped: false,
  deduped: true,
  purchaseId: "p",
  linesIngested: 0,
  needsReview: 0,
};
const skipped: ParseReceiptResult = { skipped: true };

describe("gmail sync summary accumulation", () => {
  it("starts at zero", () => {
    expect(emptyGmailSyncSummary()).toEqual({
      scanned: 0,
      receipts: 0,
      ingested: 0,
      deduped: 0,
      linesIngested: 0,
      needsReview: 0,
    });
  });

  it("counts a skipped (non-receipt) message as scanned only", () => {
    const s = accumulateParseResult(emptyGmailSyncSummary(), skipped);
    expect(s).toEqual({
      scanned: 1,
      receipts: 0,
      ingested: 0,
      deduped: 0,
      linesIngested: 0,
      needsReview: 0,
    });
  });

  it("counts a freshly ingested receipt with its line + review totals", () => {
    const s = accumulateParseResult(emptyGmailSyncSummary(), ingested(5, 2));
    expect(s).toEqual({
      scanned: 1,
      receipts: 1,
      ingested: 1,
      deduped: 0,
      linesIngested: 5,
      needsReview: 2,
    });
  });

  it("counts an already-seen receipt as deduped, not ingested (idempotency)", () => {
    const s = accumulateParseResult(emptyGmailSyncSummary(), deduped);
    expect(s).toMatchObject({ scanned: 1, receipts: 1, ingested: 0, deduped: 1 });
  });

  it("rolls up a mixed batch correctly", () => {
    const results = [ingested(3, 1), skipped, deduped, ingested(2, 0), skipped];
    const s = results.reduce(accumulateParseResult, emptyGmailSyncSummary());
    expect(s).toEqual({
      scanned: 5,
      receipts: 3, // two ingested + one deduped
      ingested: 2,
      deduped: 1,
      linesIngested: 5, // 3 + 2
      needsReview: 1,
    });
  });
});
