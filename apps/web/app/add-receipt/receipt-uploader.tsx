"use client";
import { useActionState } from "react";
import { analyzeAndIngestReceipt, type AnalyzeReceiptState } from "./actions";

// Defined here (not in actions.ts) — a "use server" file may only export async functions.
const initialReceiptState: AnalyzeReceiptState = { status: "idle" };

/**
 * Snap/upload a paper or email receipt — mirrors the fridge-scan uploader: one file input (camera on
 * mobile via `capture`), a submit button, and a result banner. Extract + ingest happen in one server
 * action, so on success we just confirm and point at the pantry.
 */
export function ReceiptUploader() {
  const [state, formAction, pending] = useActionState<AnalyzeReceiptState, FormData>(
    analyzeAndIngestReceipt,
    initialReceiptState,
  );
  const ready = state.status === "ready" ? state : null;

  return (
    <div className="space-y-6">
      <form action={formAction} className="card-pad">
        <label className="mb-2 block field-label">Receipt photo(s)</label>
        <input
          type="file"
          name="photos"
          accept="image/*"
          capture="environment"
          multiple
          className="input-file mb-4"
        />

        <button type="submit" disabled={pending} className="btn-dark">
          {pending ? "Reading…" : ready ? "Add another" : "Add to pantry"}
        </button>
      </form>

      {state.status === "error" && <p className="notice-warn">{state.message}</p>}

      {ready && (
        <div className="space-y-3">
          <p className="notice-ok">{ready.message}</p>
          <a href="/pantry" className="nav-link">
            View pantry →
          </a>
        </div>
      )}
    </div>
  );
}
