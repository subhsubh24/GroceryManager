/**
 * Margin cost-per-outcome eval for INGREDIENT SUBSTITUTIONS (workflow #14) — the LLM fallback for
 * ingredients not in the static table. This workflow had NO grader, so we add a GENUINE one: recall
 * against a curated, human-verified set of ACCEPTABLE substitutes per ingredient (the model need only
 * surface one good swap). Every ingredient here is chosen to FALL THROUGH the static table so the LLM
 * path actually runs (asserted in the deterministic test) — otherwise no economics would be emitted.
 */
import type { EvalScore } from "../../harness.js";
import { namePresent } from "../../harness.js";
import { getSubstitutions } from "../../../../recipe/substitute-llm.js";
import type { EvalCase, MarginWorkflowEval } from "./types.js";

export interface SubInput {
  ingredient: string;
  /** Human-verified acceptable substitutes — surfacing ANY one (in text or `uses`) is a pass. */
  acceptable: string[];
}

type SubOutput = Awaited<ReturnType<typeof getSubstitutions>>;

/** Curated goldens: uncommon ingredients (absent from the static table) with well-known swaps. */
const CURATED: SubInput[] = [
  { ingredient: "mascarpone", acceptable: ["cream cheese", "ricotta", "creme fraiche"] },
  { ingredient: "creme fraiche", acceptable: ["sour cream", "greek yogurt", "heavy cream"] },
  { ingredient: "shallot", acceptable: ["onion", "scallion", "leek"] },
  { ingredient: "fish sauce", acceptable: ["soy sauce", "tamari", "worcestershire", "anchovy"] },
  { ingredient: "tahini", acceptable: ["peanut butter", "almond butter", "sunflower", "sesame"] },
  { ingredient: "miso", acceptable: ["soy sauce", "tamari"] },
  { ingredient: "gochujang", acceptable: ["sriracha", "chili paste", "red pepper", "sambal"] },
  { ingredient: "harissa", acceptable: ["chili paste", "sriracha", "paprika", "sambal"] },
  { ingredient: "cotija", acceptable: ["feta", "parmesan", "ricotta"] },
  { ingredient: "leek", acceptable: ["onion", "shallot", "scallion"] },
  { ingredient: "capers", acceptable: ["green olives", "olives", "pickle"] },
  { ingredient: "dijon mustard", acceptable: ["yellow mustard", "mustard", "wholegrain"] },
  { ingredient: "oyster sauce", acceptable: ["hoisin", "soy sauce", "fish sauce"] },
  { ingredient: "ricotta", acceptable: ["cottage cheese", "mascarpone", "cream cheese"] },
  { ingredient: "arborio rice", acceptable: ["short grain rice", "sushi rice", "carnaroli"] },
  { ingredient: "smoked paprika", acceptable: ["paprika", "chili powder", "cayenne"] },
];

const cases: EvalCase<SubInput>[] = CURATED.map((c, i) => ({
  name: `sub:${c.ingredient.replace(/\s+/g, "-")}`,
  tags: ["curated", i >= CURATED.length - 2 ? "multi-word" : "single"],
  input: c,
}));

export const substitutionEval: MarginWorkflowEval<SubInput, SubOutput> = {
  workflowId: "grocerymanager-substitution",
  name: "substitution",
  spend: "low",
  about: "Suggest cooking substitutions for an ingredient not in the static table (cheap, 1 call).",
  cases,
  async run(input, client): Promise<SubOutput> {
    return getSubstitutions(input.ingredient, client);
  },
  grade(output, input): EvalScore {
    const detail: string[] = [];
    const usedLlm = output.source === "ai";
    if (!usedLlm) detail.push(`LLM not invoked (source=${output.source})`);

    const texts = output.substitutions.flatMap((s) => [s.text, ...(s.uses ?? [])]);
    const nonEmpty = texts.some((t) => t.trim().length > 0);

    // Recall against the curated acceptable set — one good swap is enough.
    const hit = input.acceptable.some(
      (acc) => namePresent(texts, acc) || texts.some((t) => t.toLowerCase().includes(acc.toLowerCase())),
    );
    if (!hit) detail.push(`no acceptable substitute (want one of: ${input.acceptable.join(", ")})`);

    const score = 0.6 * (hit ? 1 : 0) + 0.25 * (usedLlm ? 1 : 0) + 0.15 * (nonEmpty ? 1 : 0);
    return { score, ok: hit && usedLlm, detail };
  },
};

/** Exported for the deterministic test's fall-through assertion. */
export const SUBSTITUTION_INGREDIENTS = CURATED.map((c) => c.ingredient);
