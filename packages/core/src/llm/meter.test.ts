import { afterEach, describe, expect, it } from "vitest";
import { buildLlmCallPayload, newSessionId, recordLlmCall, WORKFLOW_ID, WORKFLOWS } from "./meter.js";

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

describe("buildLlmCallPayload — supply-chain tagging (MeterContext)", () => {
  const res = { usageMetadata: { promptTokenCount: 10 } };

  it("tags the call with the context's workflow, operation, and session", () => {
    const p: { workflowId: string; operation?: string; sessionId?: string; isRetry?: boolean } =
      buildLlmCallPayload("gemini-flash-lite", res, 100, {
        workflowId: WORKFLOWS.recipeImport,
        operation: "import-text",
        sessionId: "sess-1",
      });
    expect(p.workflowId).toBe(WORKFLOWS.recipeImport);
    expect(p.operation).toBe("import-text");
    expect(p.sessionId).toBe("sess-1");
    expect(p.isRetry).toBeUndefined();
  });

  it("marks retries so escalated spend is separable from first-try spend", () => {
    const first = buildLlmCallPayload("m", res, 1, { operation: "generate", sessionId: "s" });
    const retry = buildLlmCallPayload("m", res, 1, { operation: "generate", sessionId: "s", isRetry: true });
    expect(first.isRetry).toBeUndefined();
    expect(retry.isRetry).toBe(true);
  });

  it("links multiple operations under one shared session (the journey chain)", () => {
    const session = newSessionId(WORKFLOWS.planWeek);
    const steps = ["generate", "substitute", "extract"].map((operation, i) =>
      buildLlmCallPayload("m", res, i, { workflowId: WORKFLOWS.planWeek, operation, sessionId: session }),
    ) as Array<ReturnType<typeof buildLlmCallPayload> & { operation?: string }>;
    // All share ONE session; each carries its own distinct operation label → a multi-node chain.
    expect(new Set(steps.map((s) => s.sessionId))).toEqual(new Set([session]));
    expect(steps.map((s) => s.operation)).toEqual(["generate", "substitute", "extract"]);
  });

  it("newSessionId is unique per run and prefixed by the workflow", () => {
    const a = newSessionId(WORKFLOWS.substitution);
    const b = newSessionId(WORKFLOWS.substitution);
    expect(a).not.toBe(b);
    expect(a.startsWith(`${WORKFLOWS.substitution}:`)).toBe(true);
  });

  describe("env precedence (eval-batch tags win over per-call context)", () => {
    afterEach(() => {
      delete process.env.MARGIN_WORKFLOW_ID;
      delete process.env.MARGIN_SESSION_ID;
    });

    it("MARGIN_WORKFLOW_ID / MARGIN_SESSION_ID override the ctx (single-threaded eval batch)", () => {
      process.env.MARGIN_WORKFLOW_ID = "eval-workflow";
      process.env.MARGIN_SESSION_ID = "eval:run-1";
      const p = buildLlmCallPayload("m", res, 1, {
        workflowId: WORKFLOWS.substitution,
        operation: "substitute",
        sessionId: "app-session",
      });
      expect(p.workflowId).toBe("eval-workflow");
      expect(p.sessionId).toBe("eval:run-1");
    });
  });
});

describe("recordLlmCall", () => {
  it("is fail-safe: returns void and never throws for a real response (no MARGIN_INGEST_KEY in CI)", () => {
    // With no key the SDK no-ops before any network I/O; recordLlmCall must stay silent + void.
    expect(recordLlmCall("gemini-flash", { usageMetadata: { promptTokenCount: 3 } }, 100)).toBeUndefined();
    expect(() => recordLlmCall("gemini-flash", {}, 0)).not.toThrow();
  });
});
