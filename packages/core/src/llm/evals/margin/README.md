# Margin cost-per-outcome eval suites — `@gm/core` AI workflows

Repo-specific eval suites + a runner that give Margin an **accurate, statistical** cost-per-outcome
for GroceryManager's AI workflows: real, varied inputs → the **real metered path** → graded by a
**genuine evaluator**, emitting real per-call economics + graded outcomes to Margin. One suite per
workflow, run individually or all at once. See **`COVERAGE.md`** for which workflows are covered vs the
frontier.

## What's here

| File | Role |
| --- | --- |
| `workflows/types.ts` | The `MarginWorkflowEval` abstraction + `emitEvalOutcome` (awaited, flush-safe). |
| `workflows/runner.ts` | Generic runner: attribute workflow → run real metered path → grade → emit outcome. |
| `workflows/registry.ts` | Registry of covered workflows + `selectWorkflows(spec)` (name / id / all). |
| `workflows/plan-week.ts` · `receipt-extraction.ts` · `recipe-import.ts` · `substitution.ts` | The covered workflow suites — each a matrix + real `run` + **genuine** `grade`. |
| `cases.ts` | The plan-week input matrix (~48 cases; consumed by `workflows/plan-week.ts`). |
| `fuzz.ts` | Deterministic (seeded) FUZZ generators — self-labelled synthetic receipts + recipes. |
| `run.ts` | Plan-week-specific helpers (`pickRepresentative`, fallback runner used by `cases.test.ts`). |
| `cases.test.ts` · `workflows.test.ts` | **Deterministic, CI-safe** guards (no Gemini): matrix shape/variety, the graders on good/bad outputs, fuzz determinism, substitution fall-through, registry, runner. |
| `margin.eval.test.ts` | **Gated live runner** (`RUN_EVALS=1` + a Gemini key): runs selected workflows for real and emits economics. Skipped in CI. |

## Genuine graders — reused, not weakened

Each suite grades with a REAL evaluator: `evaluateWeekPlan` (plan-week), the harness scorers
`scoreReceiptExtraction` / `scoreRecipeImport` over REAL golden fixtures, and — for substitutions,
which had no grader — a new **curated recall grader** against human-verified acceptable substitutes.

## How the economics are emitted

Running the **real** path is what measures spend: `GeminiClient` emits a metered `recordCall` (tokens +
latency) per LLM call via the shared fail-safe meter (`llm/meter.ts`); the runner emits the graded
`recordOutcome` (plan-week emits its own). The runner sets **`MARGIN_WORKFLOW_ID`** per workflow so
each call is attributed to the workflow it exercised (default = plan-week), and **`MARGIN_SESSION_ID`**
so the whole batch is separable from real users (`sessionId="eval:<runId>"`). Both env vars are set
ONLY by the runner — unset in prod, so they're inert on the app path.

## Run it (on demand — never in CI)

```bash
RUN_EVALS=1 \
GEMINI_API_KEY=<key> \
DATABASE_URL=postgres://x/x \            # only has to PARSE; these tasks never touch the DB
MARGIN_INGEST_URL=<url> MARGIN_INGEST_KEY=<key> \   # omit → emits no-op (dry run, still grades)
pnpm --filter @gm/core eval:margin
```

### Config / cost knobs (all optional)

| Env | Default | Effect |
| --- | --- | --- |
| `MARGIN_EVAL_WORKFLOW` | `all` | Which suites: `all`, or a comma list of names/ids (e.g. `receipt-extraction,plan-week`). |
| `MARGIN_EVAL_MAX_CASES` | `8` | **Per-workflow** cost cap — a representative spread across each matrix. `=999` runs all. |
| `MARGIN_EVAL_TIER` | `mid` | Plan-week starting model tier: `cheap` \| `mid` \| `reasoning`. |
| `MARGIN_EVAL_RUN_ID` | timestamp | Batch id → `sessionId="eval:<id>"`. |
| `MARGIN_EVAL_DRAIN_MS` | `5000` | Post-run wait so in-flight non-blocking call-emits flush before exit. |

Re-run with a different `MARGIN_EVAL_TIER` (and a fresh `MARGIN_EVAL_RUN_ID`) to compare
cost-per-outcome across models on the identical matrix.

## Guard: no real Gemini in CI

`margin.eval.test.ts` is `describe.skipIf(RUN_EVALS !== "1")`, so `pnpm test` / the CI gate collects it
but **skips** it — no model spend, gate stays green. Only the deterministic `cases.test.ts` /
`workflows.test.ts` run there.

## Honest gaps (not faked)

- **Grader scope.** Structural/coverage rubrics + recall against fixtures — not full semantic judgment.
  `evaluateWeekPlan` doesn't verify diet/allergen compliance; receipt/recipe grade item recall (+ retailer
  / steps), not perfect fidelity; substitution grades recall of ONE acceptable swap. Documented, not silent.
- **Frontier.** Only 4 / 17 workflows are covered — see `COVERAGE.md`. The most expensive (kitchen-chat,
  #16) has **no** output grader yet and is deliberately deferred rather than faked.
- **Outcome tagging.** The SDK's `recordOutcome` has no `sessionId`; outcomes correlate to a batch by
  `workflowId` + time window. Only **calls** carry `sessionId`.
- **Statistical power.** Enough cases for a stable central estimate per workflow, not tight per-segment
  confidence intervals. Grow the matrices (the ratchet) to tighten.
- **Cost realism.** Cost is priced server-side by Margin from the emitted tokens; this suite emits the
  measured tokens/latency, it does not itself price the calls.
