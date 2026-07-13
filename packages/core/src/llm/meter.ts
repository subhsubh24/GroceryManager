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

/**
 * The Margin workflow ids this project meters. Each is a distinct "cost per outcome" workflow; the
 * app path tags every LLM call with the RIGHT one (via {@link MeterContext}) so Margin attributes
 * spend to the workflow that actually incurred it — not a single hard-coded default.
 */
export const WORKFLOWS = {
  planWeek: "grocerymanager-plan-week",
  recipeImport: "grocerymanager-recipe-import",
  substitution: "grocerymanager-substitution",
  receiptExtraction: "grocerymanager-receipt-extraction",
} as const;

/** The default workflow (kept for back-compat: an un-tagged call attributes here). */
export const WORKFLOW_ID = WORKFLOWS.planWeek;

/**
 * Per-CALL metering context, threaded from a workflow entry point through the {@link GeminiClient}
 * to each emit. This is what turns a flat stream of LLM calls into Margin's supply-chain graph:
 *
 *  - `workflowId` attributes the call's spend to the right workflow (recipe-import / plan-week / …).
 *  - `operation` names the STEP within that workflow (e.g. "generate", "verify-retry", "import-vision")
 *    so a multi-call workflow decomposes into per-operation NODES instead of collapsing to one.
 *  - `sessionId` is SHARED across every call of one workflow run, linking the steps into one traceable
 *    chain (the unit the Money Map decomposes).
 *  - `isRetry` marks an escalation/retry attempt so retried spend is separable from first-try spend.
 *
 * Request-scoped (passed as a value, never process-global) so it is safe under concurrent serverless
 * invocations — unlike the `MARGIN_*` env fallbacks below, which a single-threaded eval batch sets.
 */
export interface MeterContext {
  workflowId?: string;
  operation?: string;
  sessionId?: string;
  isRetry?: boolean;
}

/** A {@link RecordCallInput} plus the supply-chain STEP label (see {@link MeterContext.operation}). */
type MeteredCallInput = RecordCallInput & { operation?: string };

/**
 * Mint a fresh, shared session id for one workflow run (`<prefix>:<random>`), so every LLM call that
 * run makes links into one chain. Fail-safe: falls back to a timestamp if `crypto.randomUUID` is
 * unavailable (older/edge runtimes), never throwing.
 */
export function newSessionId(prefix: string): string {
  try {
    const rand = globalThis.crypto?.randomUUID?.();
    if (rand) return `${prefix}:${rand}`;
  } catch {
    /* fall through to the timestamp fallback */
  }
  return `${prefix}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

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
 *
 * Attribution precedence — env FIRST, then the request-scoped {@link MeterContext}, then the default:
 *  - `workflowId`: `MARGIN_WORKFLOW_ID` (eval batch) ‖ `ctx.workflowId` (app path) ‖ {@link WORKFLOW_ID}.
 *  - `sessionId`:  `MARGIN_SESSION_ID` (eval batch) ‖ `ctx.sessionId` (one-run chain).
 * Env wins so a single-threaded eval batch keeps tagging its whole run as one synthetic session /
 * workflow even though the same app functions now supply their own ctx; in prod both env vars are
 * unset, so the per-request ctx drives attribution. `operation` + `isRetry` come only from ctx.
 *
 * `operation` is the supply-chain STEP label. It is attached here so the mapping is complete and
 * forward-compatible; note the pinned `margin-meter@0.1.0` transport does not yet forward it over the
 * wire (only `workflowId` + `sessionId` land today), so the cross-workflow chain is visible now and
 * the per-operation decomposition lands the moment the SDK forwards the field — no app change needed.
 */
export function buildLlmCallPayload(
  model: string,
  res: unknown,
  latencyMs: number,
  ctx?: MeterContext,
): MeteredCallInput {
  const md = (res as { usageMetadata?: UsageMetadata }).usageMetadata;
  const env = typeof process !== "undefined" ? process.env : undefined;
  const sessionId = env?.MARGIN_SESSION_ID || ctx?.sessionId || undefined;
  return {
    workflowId: env?.MARGIN_WORKFLOW_ID || ctx?.workflowId || WORKFLOW_ID,
    provider: "google",
    model,
    inputTokens: md?.promptTokenCount ?? 0,
    outputTokens: md?.candidatesTokenCount ?? 0,
    cacheReadTokens: md?.cachedContentTokenCount ?? 0,
    latencyMs,
    status: "ok",
    ...(sessionId ? { sessionId } : {}),
    ...(ctx?.operation ? { operation: ctx.operation } : {}),
    ...(ctx?.isRetry ? { isRetry: true } : {}),
  };
}

/**
 * Fire one measured LLM call at Margin, tagged with the optional {@link MeterContext} (workflow /
 * operation / session / retry). Kept off the host's critical path but flushed via `keepAlive` so it
 * survives the serverless freeze; never lets a telemetry failure surface.
 */
export function recordLlmCall(model: string, res: unknown, latencyMs: number, ctx?: MeterContext): void {
  keepAlive(meter?.recordCall(buildLlmCallPayload(model, res, latencyMs, ctx)));
}
