import { describe, expect, it } from "vitest";
import { GEMINI_MODELS, THINKING_BUDGET } from "@gm/config/constants";
import { TIER_ORDER, nextTier, resolveModel, thinkingBudgetFor } from "./models.js";

describe("TIER_ORDER", () => {
  it("is the cheap → mid → reasoning escalation ladder", () => {
    expect(TIER_ORDER).toEqual(["cheap", "mid", "reasoning"]);
  });
});

describe("nextTier", () => {
  it("escalates cheap → mid → reasoning", () => {
    expect(nextTier("cheap")).toBe("mid");
    expect(nextTier("mid")).toBe("reasoning");
  });

  it("returns null at the top tier so escalation terminates (no runaway loop)", () => {
    expect(nextTier("reasoning")).toBeNull();
  });
});

describe("resolveModel", () => {
  it("maps each tier to its concrete model id when Flash-Lite is enabled", () => {
    expect(resolveModel("cheap", true)).toBe(GEMINI_MODELS.cheap);
    expect(resolveModel("mid", true)).toBe(GEMINI_MODELS.mid);
    expect(resolveModel("reasoning", true)).toBe(GEMINI_MODELS.reasoning);
  });

  it("transparently falls the cheap tier back to Flash (mid) when Flash-Lite is off", () => {
    expect(resolveModel("cheap", false)).toBe(GEMINI_MODELS.mid);
  });

  it("leaves mid/reasoning unaffected by the useFlashLite flag", () => {
    expect(resolveModel("mid", false)).toBe(GEMINI_MODELS.mid);
    expect(resolveModel("reasoning", false)).toBe(GEMINI_MODELS.reasoning);
  });
});

describe("thinkingBudgetFor", () => {
  it("returns the configured budget for each tier", () => {
    expect(thinkingBudgetFor("cheap")).toBe(THINKING_BUDGET.cheap);
    expect(thinkingBudgetFor("mid")).toBe(THINKING_BUDGET.mid);
    expect(thinkingBudgetFor("reasoning")).toBe(THINKING_BUDGET.reasoning);
  });
});
