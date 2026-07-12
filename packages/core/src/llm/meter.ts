/**
 * Margin economics meter (cost-per-outcome telemetry).
 *
 * Emits each Gemini call's tokens + latency and each "plan-week" outcome to a Margin ingest API
 * via the `margin-meter` SDK. Everything here is FAIL-SAFE and NON-BLOCKING: construction is guarded
 * (a bad env can never throw at import time), and every emit is a floating promise whose rejection is
 * swallowed — telemetry must never crash, slow, or alter the host call path. With no `MARGIN_INGEST_KEY`
 * the SDK short-circuits before any network I/O, so this is a no-op in dev/CI.
 */
import { MarginMeter } from "margin-meter";

/** The one workflow this project meters — its "cost per successful weekly plan". */
export const WORKFLOW_ID = "grocerymanager-plan-week";

/** A single guarded meter shared across the LLM client + agents (null if construction ever fails). */
export const meter: MarginMeter | null = (() => {
  try {
    return new MarginMeter();
  } catch {
    return null;
  }
})();

/** The token-count shape every Gemini response carries (all optional — read defensively). */
interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
}

/**
 * Fire one measured LLM call at Margin, non-blocking. Reads `res.usageMetadata` defensively (any
 * Gemini `generateContent`/`embedContent` response) and never lets a telemetry failure surface.
 */
export function recordLlmCall(model: string, res: unknown, latencyMs: number): void {
  const md = (res as { usageMetadata?: UsageMetadata }).usageMetadata;
  void meter
    ?.recordCall({
      workflowId: WORKFLOW_ID,
      provider: "google",
      model,
      inputTokens: md?.promptTokenCount ?? 0,
      outputTokens: md?.candidatesTokenCount ?? 0,
      cacheReadTokens: md?.cachedContentTokenCount ?? 0,
      latencyMs,
      status: "ok",
    })
    ?.catch(() => {});
}
