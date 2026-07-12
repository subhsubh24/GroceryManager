# Margin cost-per-outcome coverage — `@gm/core` AI workflows

The frontier map for Margin economics. Every AI workflow in `@gm/core` is enumerated with its metered
path and whether it has a **Margin cost-per-outcome eval** (real metered path → genuine grade →
`recordCall` + `recordOutcome` emitted). This is distinct from the older per-PR quality evals
(`llm/evals/*.eval.test.ts`), which grade output quality but do **not** emit economics to Margin.

All LLM access flows through `GeminiClient` (`llm/client.ts`); every call is metered via
`timedGenerate` → `recordLlmCall` (`llm/meter.ts`). A covered workflow's calls are attributed with the
correct `workflowId` via the `MARGIN_WORKFLOW_ID` env the runner sets per workflow.

## Status: 4 / 17 product workflows covered (~24%)

Covered now: **plan-week, receipt-extraction, recipe-import, substitution**.

| # | Workflow · what it does | Entry (file → func) | Metered call (file:line) | Genuine outcome grader | Margin eval? | Rel. spend / importance |
|---|---|---|---|---|:--:|---|
| 15 | **Plan-my-week** — select/sequence/narrate a weekly plan | `agent/plan-week.ts` → `planWeek` | `generateWithVerify` `agent/gemini-generator.ts:27` | `evaluateWeekPlan` (7-pt rubric) — app emits `recordOutcome` | ✅ `workflows/plan-week.ts` | **High** (mid→Pro verify loop) |
| 3 | **Receipt extraction (email)** — order email → line items | `ingestion/receipt-parse.ts` → `extractReceipt` | `generateWithVerify` `ingestion/receipt-parse.ts:49` | `scoreReceiptExtraction` (recall+retailer+total) + real fixtures | ✅ `workflows/receipt-extraction.ts` | **High** (verify loop + code-exec, high volume) |
| 11 | **Recipe import (text)** — pasted text → structured recipe | `recipe/import-llm.ts` → `importRecipe` | `generateStructured` `recipe/import-llm.ts:38` | `scoreRecipeImport` (title+ingredients+steps) + real fixtures | ✅ `workflows/recipe-import.ts` | Medium |
| 14 | **Ingredient substitutions** — swaps for an off-table ingredient | `recipe/substitute-llm.ts` → `getSubstitutions` | `generateStructured` `recipe/substitute-llm.ts:33` | **new** curated recall grader (acceptable-substitute goldens) | ✅ `workflows/substitution.ts` | Low (cheap, 1 call) |
| 16 | **"Ask your kitchen" chat agent** — function-calling agent over per-user tools | `chat/index.ts` → `answerKitchenChat` | `runChatWithTools` `chat/index.ts:303` | ❌ none (Zod on tool args only) | ⛰️ **frontier #1** | **Highest per-invocation** (up to 8 calls, code-exec) |
| 1 | **Vision pantry/fridge scan** — detect items from a photo | `vision/detect.ts` → `detectPantryItems` | `generateStructured` `vision/detect.ts:84` | inline recall/precision scorers (in `scan.eval.test.ts`) | ⛰️ frontier | High (mid tier + `mediaResolution:high`) |
| 13 | **Recipe remix** — swap ingredients along an axis | `recipe/remix-llm.ts` → `suggestRemix` | `generateWithVerify` `recipe/remix-llm.ts:132` | `verifyRemixDraft` + inline `scoreVegan`/`scoreHealthier` | ⛰️ frontier | Medium (verify loop) |
| 10 | **Meal idea generation** — invent meals from the pantry | `recipe/generate-llm.ts` → `generateMeals` | `generateStructured` `recipe/generate-llm.ts:129` | inline `scoreMealSet` (pantry/diet/timing) | ⛰️ frontier | Medium |
| 2 | **Quick-capture parse** — messy note → list items | `capture/parse-llm.ts` → `parseCaptureWithLLM` | `generateStructured` `capture/parse-llm.ts:34` | inline `scoreCaptureFixture` | ⛰️ frontier | Cheap, frequent |
| 4 | **Receipt extraction (photo)** — receipt image → items | `ingestion/receipt-parse.ts` → `extractReceiptImage` | `generateWithVerify` `ingestion/receipt-parse.ts:73` | `verifyReceipt` (shares scorer; no image fixture yet) | ⛰️ frontier | Cheap→escalate + vision |
| 5 | **Canonical name resolution** — messy name → canonical id | `ingestion/llm-normalizer.ts` → `createLlmNormalizer` | `generateWithVerify` `ingestion/llm-normalizer.ts:47` | inline verifier (rejects hallucinated ids) | ⛰️ frontier | Medium (last stage of §5.4 cascade) |
| 12 | **Recipe import (image)** — recipe photo → structured | `recipe/import-llm.ts` → `visionImport` | `generateStructured` `recipe/import-llm.ts:47` | Zod only (no image fixture) | ⛰️ frontier | Low (mid + vision) |
| 6 | **Meal-macro estimation** — estimate recipe macros (FDC fallback) | `nutrition/estimate.ts` → `estimateMealMacros` | `generateStructured` `nutrition/estimate.ts:106` | ❌ Zod only | ⛰️ frontier | Low |
| 7 | **Shelf-life labelling** — perishability for unknown items | `pantry/shelf-life-llm.ts` → `createLlmShelfLifeEstimator` | `generateStructured` `pantry/shelf-life-llm.ts:45` | Zod + sanity check | ⛰️ frontier | Low |
| 8 | **Onboarding turn** — adaptive 1-Q/turn, extract signals | `personalization/onboarding-llm.ts` → `nextOnboardingTurn` | `generateStructured` `personalization/onboarding-llm.ts:166` | ❌ Zod + post-hoc filter | ⛰️ frontier | Low (once, at signup) |
| 9 | **Free-text preference extraction** — answer → typed signals | `personalization/onboarding.ts` → `parseFreeTextPreferences` | `generateStructured` `personalization/onboarding.ts:85` | ❌ Zod only | ⛰️ frontier | Low |
| 17 | **Semantic-match embeddings** — embed names for pgvector cascade | `ingestion/db-ports.ts` → `deps.embed` | `embed` `ingestion/db-ports.ts:74` | ❌ vector, cosine match downstream | ⛰️ infra | Cheapest/call, **very high volume** |

`llm/evals/judge.ts` `llmJudge` is eval infrastructure (a semantic grader), not a product workflow.

## Why these 4 first (honesty)

- **Highest confidence:** receipt-extraction and recipe-import reuse the REAL harness scorers
  (`scoreReceiptExtraction` / `scoreRecipeImport`) over REAL golden fixtures — no new grading judgment.
- **Fills a gap genuinely:** substitution had **no** grader; we added a curated recall grader against
  human-verified acceptable substitutes, and the deterministic test asserts every chosen ingredient
  falls through the static table so the LLM path actually runs.
- **plan-week** was already covered; it's folded into the unified registry so run-all measures it too.

## Frontier — deliberately NOT faked

- **#16 kitchen-chat** is the top target (highest cost) but has **no output grader**. Grading it
  honestly needs either an `llmJudge`-based semantic rubric or a controlled `ToolContext` with a known
  answer to check for — a harness worth its own pass, not a rushed fake.
- **#1 scan / #4 receipt-photo / #12 recipe-image** need committed image fixtures.
- **#5 normalizer, #10 meal-gen, #13 remix, #2 capture** have inline graders that can be lifted into
  `workflows/` next; **#6–#9, #17** would need new graders (Zod-only today) — don't emit an outcome
  from a check that only proves "well-formed", not "correct".

## Extending

Add a workflow: create `workflows/<name>.ts` exporting a `MarginWorkflowEval` (real `run` + genuine
`grade`), register it in `workflows/registry.ts`, and add a deterministic grader test to
`workflows.test.ts`. See `README.md` for how to run.
