/**
 * Margin economics meter (cost-per-outcome telemetry).
 *
 * Emits each Gemini call's tokens + latency and each "plan-week" outcome to a Margin ingest API
 * via the `margin-meter` SDK. Everything here is FAIL-SAFE and NON-BLOCKING: construction is guarded
 * (a bad env can never throw at import time), and every emit is kept off the host's critical path.
 * With no `MARGIN_INGEST_KEY` the SDK short-circuits before any network I/O, so this is a no-op in
 * dev/CI.
 *
 * IMPORTANT — serverless freeze: on Vercel the function is frozen the instant the response is sent,
 * BEFORE a bare floating promise's `fetch` can finish, so a plain `void meter.recordCall(...)` is
 * silently dropped in production. We therefore hand every emit to `waitUntil`, which extends the
 * invocation's lifetime until the emit resolves WITHOUT delaying the response. Off Vercel (tests,
 * local, long-running workers) `waitUntil` is a safe no-op and the promise settles on its own.
 */
import { waitUntil } from "@vercel/functions";
import { MarginMeter, type RecordCallInput } from "margin-meter";

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
 * Keep the invocation alive until a telemetry emit resolves, so it survives the serverless freeze —
 * without blocking the response, and without ever throwing into the host call path. The `.catch` is
 * attached BEFORE handing the promise to `waitUntil` so a failed emit can never surface anywhere; the
 * `waitUntil` call is itself guarded because off Vercel (tests / local / workers) there's no request
 * context — nothing freezes the process there, so letting the promise settle on its own is enough.
 */
export function keepAlive(emit: Promise<unknown> | undefined): void {
  if (!emit) return;
  const settled = emit.catch(() => {});
  try {
    waitUntil(settled);
  } catch {
    /* no serverless request context (tests / local / workers) — `settled` resolves on its own */
  }
}

/**
 * Build the Margin payload for one Gemini call, reading `res.usageMetadata` defensively (any
 * `generateContent`/`embedContent` response) and defaulting every missing token count to 0. Pure +
 * exported so the mapping — the raw material for cost-per-outcome — is unit-testable without a live
 * meter (a wrong field or dropped default silently corrupts the dataset, since emit is fail-safe).
 */
export function buildLlmCallPayload(model: string, res: unknown, latencyMs: number): RecordCallInput {
  const md = (res as { usageMetadata?: UsageMetadata }).usageMetadata;
  return {
    workflowId: WORKFLOW_ID,
    provider: "google",
    model,
    inputTokens: md?.promptTokenCount ?? 0,
    outputTokens: md?.candidatesTokenCount ?? 0,
    cacheReadTokens: md?.cachedContentTokenCount ?? 0,
    latencyMs,
    status: "ok",
  };
}

/**
 * Fire one measured LLM call at Margin. Kept off the host's critical path but flushed via `keepAlive`
 * so it survives the serverless freeze; never lets a telemetry failure surface.
 */
export function recordLlmCall(model: string, res: unknown, latencyMs: number): void {
  keepAlive(meter?.recordCall(buildLlmCallPayload(model, res, latencyMs)));
}
