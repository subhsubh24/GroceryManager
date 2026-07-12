/**
 * DETERMINISTIC, CI-SAFE guard for the multi-workflow Margin eval suites (runs in the normal gate —
 * NO Gemini). It exercises everything the live model does NOT: matrix shape/variety, the GENUINE
 * graders (on hand-built good/bad outputs), fuzz determinism + self-labelling, the substitution
 * fall-through invariant, the registry selection, and the generic runner (over a fake workflow).
 */
import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../../client.js";
import { findSubstitutions } from "../../../recipe/substitute.js";
import { mulberry32, syntheticReceipts, syntheticRecipes } from "./fuzz.js";
import { receiptExtractionEval } from "./workflows/receipt-extraction.js";
import { recipeImportEval } from "./workflows/recipe-import.js";
import { substitutionEval, SUBSTITUTION_INGREDIENTS } from "./workflows/substitution.js";
import { ALL_WORKFLOW_EVALS, selectWorkflows } from "./workflows/registry.js";
import { runWorkflowEval } from "./workflows/runner.js";
import type { MarginWorkflowEval } from "./workflows/types.js";

const cast = <T,>(o: unknown): T => o as T;

describe("margin multi-workflow matrices (shape + variety)", () => {
  it("every covered workflow has a non-trivial, well-formed, uniquely-named matrix", () => {
    for (const w of ALL_WORKFLOW_EVALS) {
      expect(w.cases.length).toBeGreaterThanOrEqual(10);
      const names = w.cases.map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
      expect(w.workflowId.startsWith("grocerymanager-")).toBe(true);
    }
  });

  it("receipt + recipe matrices mix golden, edge, and fuzz cases", () => {
    for (const w of [receiptExtractionEval, recipeImportEval]) {
      const tags = new Set(w.cases.flatMap((c) => c.tags));
      expect(tags.has("golden")).toBe(true);
      expect(tags.has("edge")).toBe(true);
      expect(tags.has("fuzz")).toBe(true);
    }
  });

  it("registry has unique workflowIds and selects by name / id / all / bogus", () => {
    const ids = ALL_WORKFLOW_EVALS.map((w) => w.workflowId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(selectWorkflows("all")).toHaveLength(ALL_WORKFLOW_EVALS.length);
    expect(selectWorkflows(undefined)).toHaveLength(ALL_WORKFLOW_EVALS.length);
    expect(selectWorkflows("receipt-extraction").map((w) => w.name)).toEqual(["receipt-extraction"]);
    expect(selectWorkflows("grocerymanager-substitution").map((w) => w.name)).toEqual(["substitution"]);
    expect(selectWorkflows("recipe-import,substitution")).toHaveLength(2);
    expect(selectWorkflows("does-not-exist")).toHaveLength(ALL_WORKFLOW_EVALS.length); // typo → all, never nothing
  });
});

describe("margin graders (genuine — good passes, bad fails; no Gemini)", () => {
  it("receipt grader passes a faithful extraction and fails an empty one", () => {
    const input = receiptExtractionEval.cases.find((c) => c.name === "edge:single-item")!.input;
    const good = cast<never>({ retailer: "kroger", totalCents: 349, lineItems: [{ name: "milk" }] });
    const bad = cast<never>({ retailer: "walmart", totalCents: 0, lineItems: [] });
    expect(receiptExtractionEval.grade(good, input).ok).toBe(true);
    expect(receiptExtractionEval.grade(bad, input).ok).toBe(false);
  });

  it("recipe grader passes a faithful import and fails an empty one", () => {
    const input = recipeImportEval.cases.find((c) => c.name === "edge:minimal")!.input;
    const good = cast<never>({
      title: "Cacio e Pepe",
      ingredients: [{ name: "spaghetti" }, { name: "pecorino" }, { name: "black pepper" }],
      instructions: "1. Boil.\n2. Toss.\n3. Serve.",
    });
    const bad = cast<never>({ title: "?", ingredients: [], instructions: "" });
    expect(recipeImportEval.grade(good, input).ok).toBe(true);
    expect(recipeImportEval.grade(bad, input).ok).toBe(false);
  });

  it("substitution grader: acceptable+LLM passes; wrong or non-LLM fails", () => {
    const input = substitutionEval.cases.find((c) => c.name === "sub:mascarpone")!.input;
    const good = cast<never>({ source: "ai", substitutions: [{ text: "Use equal parts cream cheese", uses: ["cream cheese"] }] });
    const wrong = cast<never>({ source: "ai", substitutions: [{ text: "just use water", uses: ["water"] }] });
    const notLlm = cast<never>({ source: "known", substitutions: [{ text: "cream cheese", uses: ["cream cheese"] }] });
    expect(substitutionEval.grade(good, input).ok).toBe(true);
    expect(substitutionEval.grade(wrong, input).ok).toBe(false);
    expect(substitutionEval.grade(notLlm, input).ok).toBe(false); // no LLM economics ⇒ not a valid outcome
  });
});

describe("substitution ingredients all fall through the static table (so the LLM path runs)", () => {
  it("findSubstitutions returns [] for every curated ingredient", () => {
    for (const ing of SUBSTITUTION_INGREDIENTS) {
      expect(findSubstitutions(ing)).toEqual([]);
    }
  });
});

describe("fuzz is deterministic + self-labelled", () => {
  it("mulberry32 is deterministic for a given seed", () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("synthetic receipts/recipes are reproducible and seed-sensitive", () => {
    expect(syntheticReceipts(6, 7)).toEqual(syntheticReceipts(6, 7));
    expect(syntheticReceipts(6, 7)).not.toEqual(syntheticReceipts(6, 8));
    expect(syntheticRecipes(5, 3)).toEqual(syntheticRecipes(5, 3));
  });

  it("each synthetic case is self-labelled (expected derived from the generated input)", () => {
    for (const r of syntheticReceipts(8)) {
      expect(r.expected.itemNames.length).toBeGreaterThan(0);
      expect(r.expected.retailer).toBe(r.retailerHint);
    }
    for (const r of syntheticRecipes(8)) {
      expect(r.text).toContain(r.expected.title);
      expect(r.expected.ingredientNames.length).toBeGreaterThan(0);
      expect(r.expected.minSteps).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("generic runner (over a fake workflow — no Gemini, no network)", () => {
  const fake: MarginWorkflowEval<{ v: number }, { v: number }> = {
    workflowId: "grocerymanager-test-fake",
    name: "fake",
    spend: "low",
    about: "test-only",
    cases: [
      { name: "pass", tags: [], input: { v: 1 } },
      { name: "fail", tags: [], input: { v: 0 } },
    ],
    run: async (input) => ({ v: input.v }),
    grade: (output) => ({ score: output.v, ok: output.v > 0, detail: output.v > 0 ? [] : ["v<=0"] }),
  };

  it("grades every case, records outcomes fail-safe, and restores MARGIN_WORKFLOW_ID", async () => {
    const before = process.env.MARGIN_WORKFLOW_ID;
    const seen: string[] = [];
    const results = await runWorkflowEval(fake, {} as GeminiClient, {
      onResult: (r) => seen.push(r.result.name),
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.workflow === "grocerymanager-test-fake")).toBe(true);
    expect(results.find((r) => r.result.name === "pass")!.result.score.ok).toBe(true);
    expect(results.find((r) => r.result.name === "fail")!.result.score.ok).toBe(false);
    expect(seen).toEqual(["pass", "fail"]);
    expect(process.env.MARGIN_WORKFLOW_ID).toBe(before); // restored (undefined here)
  });

  it("honors a cost cap", async () => {
    const results = await runWorkflowEval(fake, {} as GeminiClient, { maxCases: 1, emit: false });
    expect(results).toHaveLength(1);
  });
});
