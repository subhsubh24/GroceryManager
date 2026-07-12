import { describe, expect, it } from "vitest";
import { buildLlmCallPayload, recordLlmCall, WORKFLOW_ID } from "./meter.js";

describe("buildLlmCallPayload", () => {
  it("maps every Gemini usageMetadata field to the right Margin token count", () => {
    const p = buildLlmCallPayload(
      "gemini-flash-lite",
      { usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45, cachedContentTokenCount: 30 } },
      850,
    );
    // Field mapping is load-bearing: a swap would silently corrupt cost-per-outcome.
    expect(p.inputTokens).toBe(120);
    expect(p.outputTokens).toBe(45);
    expect(p.cacheReadTokens).toBe(30);
    expect(p.model).toBe("gemini-flash-lite");
    expect(p.latencyMs).toBe(850);
    expect(p.workflowId).toBe(WORKFLOW_ID);
    expect(p.provider).toBe("google");
    expect(p.status).toBe("ok");
  });

  it("defaults every token count to 0 when usageMetadata is absent", () => {
    const p = buildLlmCallPayload("gemini-flash", {}, 12);
    expect(p.inputTokens).toBe(0);
    expect(p.outputTokens).toBe(0);
    expect(p.cacheReadTokens).toBe(0);
    expect(p.latencyMs).toBe(12);
  });

  it("defaults individual missing token fields to 0 (partial usageMetadata)", () => {
    const p = buildLlmCallPayload("gemini-flash", { usageMetadata: { promptTokenCount: 7 } }, 5);
    expect(p.inputTokens).toBe(7);
    expect(p.outputTokens).toBe(0);
    expect(p.cacheReadTokens).toBe(0);
  });
});

describe("recordLlmCall", () => {
  it("is fail-safe: returns void and never throws for a real response (no MARGIN_INGEST_KEY in CI)", () => {
    // With no key the SDK no-ops before any network I/O; recordLlmCall must stay silent + void.
    expect(recordLlmCall("gemini-flash", { usageMetadata: { promptTokenCount: 3 } }, 100)).toBeUndefined();
    expect(() => recordLlmCall("gemini-flash", {}, 0)).not.toThrow();
  });
});
