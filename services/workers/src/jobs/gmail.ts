/**
 * Gmail ingestion jobs (PLAN §5.1). The orchestration now lives in @gm/core/ingestion so the same
 * poll → extract → normalize → pantry chain is shared with the web app's manual "Sync receipts now"
 * action. This thin re-export keeps the worker's existing imports stable.
 */
export {
  parseReceiptForUser,
  pollGmailForUser,
  renewGmailWatch,
  syncGmailForUser,
} from "@gm/core/ingestion";
