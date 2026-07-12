# Margin cost-per-outcome eval suite — `grocerymanager-plan-week`

A repo-specific eval suite + runner that gives Margin an **accurate, statistical** cost-per-outcome
for GroceryManager's "plan my week" workflow: real, varied inputs → the **real metered path** →
graded by the **real evaluator**, emitting real per-call economics + graded outcomes to Margin.

## What's here

| File | Role |
| --- | --- |
| `cases.ts` | The **input matrix**: ~50 real `PlanWeekInput` cases — varied pantries × diets/allergens × target dinner counts × household sizes, including hard cases (sparse pantry, everything-expiring, conflicting constraints). Data-only + deterministic. |
| `run.ts` | The **runner**: drives each case through the real `planWeek` + an injected `PlanGenerator`, grades with `evaluateWeekPlan`, and reports LLM-vs-fallback source counts. `pickRepresentative` spreads a cost cap across the matrix. |
| `cases.test.ts` | **Deterministic, CI-safe** guard (runs in the normal gate, **no Gemini**): asserts the matrix stays real + varied, and grades every case on the fallback path to prove runner + grader + cases integrate. |
| `plan-week.eval.test.ts` | **Gated live runner** (`RUN_EVALS=1` + a Gemini key): runs the metered path for real and emits economics to Margin. Skipped in CI. |

## The grader is genuine — reused, not weakened

Grading uses the existing **`evaluateWeekPlan`** (`packages/core/src/agent/evaluate.ts`) unchanged —
the same rubric the production verify-then-escalate loop uses: valid/known picks, target count,
variety, pantry coverage, expiring-first, no invented buys, narrative → `{ ok, score(0..1) }`.

## How the economics are emitted

Running the **real** path is what makes this measure spend: `GeminiClient` emits a metered
`recordCall` (tokens + latency) per LLM call, and `planWeek` emits a graded `recordOutcome` — both via
the shared, fail-safe meter (`llm/meter.ts`). A live run therefore populates Margin's
cost-per-successful-plan for `workflowId="grocerymanager-plan-week"`. The batch's **calls** are tagged
`sessionId="eval:<runId>"` (via the `MARGIN_SESSION_ID` env var, which only an eval run ever sets) so
eval traffic is separable from real users.

## Run it (on demand — never in CI)

```bash
RUN_EVALS=1 \
GEMINI_API_KEY=<key> \
DATABASE_URL=postgres://x/x \            # only has to PARSE; the task never touches the DB
MARGIN_INGEST_URL=<url> MARGIN_INGEST_KEY=<key> \   # omit → emits no-op (dry run, still grades)
pnpm --filter @gm/core eval:margin
```

### Config / cost knobs (all optional)

| Env | Default | Effect |
| --- | --- | --- |
| `MARGIN_EVAL_MAX_CASES` | `10` | Cost cap — a representative spread across the matrix. Set `=999` to run all. |
| `MARGIN_EVAL_TIER` | `mid` (the prod wrapper) | Starting model tier: `cheap` \| `mid` \| `reasoning`. |
| `MARGIN_EVAL_RUN_ID` | timestamp | Batch id → `sessionId="eval:<id>"`. |
| `MARGIN_EVAL_DRAIN_MS` | `5000` | Post-run wait so in-flight non-blocking emits flush before exit. |

Re-run with a different `MARGIN_EVAL_TIER` (and a fresh `MARGIN_EVAL_RUN_ID`) to compare
cost-per-outcome across models on the identical matrix.

## Guard: no real Gemini in CI

The live suite is `describe.skipIf(RUN_EVALS !== "1")`, so `pnpm test` / the CI gate collects it but
**skips** it — no model spend, gate stays green. Only `cases.test.ts` runs there (deterministic).

## Honest gaps (not faked)

- **Grader scope.** `evaluateWeekPlan` scores the *structural* rubric + pantry coverage. It does **not**
  verify diet/allergen compliance; diet/allergen prefs here exercise the model's selection + narrative,
  and candidate pools are pre-filtered as the app's §7.2 matcher would deliver. Diet-compliance grading
  is a deliberate gap, not a silent pass.
- **Outcome tagging.** The SDK's `recordOutcome` has no `sessionId` field, so **outcomes** aren't
  session-tagged; they're correlated to a batch by `workflowId` + time window. Only **calls** carry
  `sessionId`.
- **Statistical power.** ~50 cases × the escalation loop is enough for a stable central estimate, not
  tight per-segment confidence intervals. Grow the matrix (the ratchet) to tighten per-diet/per-size
  estimates.
- **Cost realism.** Cost is computed server-side by Margin from the emitted tokens; this suite emits
  the measured tokens/latency, it does not itself price the calls.
