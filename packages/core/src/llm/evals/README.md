# LLM eval harness — the ratchet (PLAN §8.5 / §12)

Golden fixtures + scorers that gate the cheap-first LLM tasks (receipt extraction, recipe import)
against quality regressions. The exact-field scorers are **deterministic + unit-tested**
(`harness.test.ts`, part of the normal suite); the **live suites** (`*.eval.test.ts`) run the real
model through them and assert a pass-rate floor.

## Run

The default `pnpm test` runs the deterministic scorer tests and **skips** the live suites (they hit
the network + cost money). To run the live evals you need a Gemini key:

```bash
RUN_EVALS=1 GEMINI_API_KEY=<key> DATABASE_URL=<any valid url> pnpm --filter @gm/core eval
```

(`DATABASE_URL` only has to parse — the eval tasks don't touch the DB.)

## The ratchet

When a real receipt/recipe is mis-parsed in the wild:

1. Add a case to `fixtures.ts` capturing the input + the **correct** expected output.
2. Run the evals — it should **fail**, proving the gap is real.
3. Fix the prompt / cascade / schema; re-run until green. The case stays forever as a regression
   guard, so the harness only tightens — never silently regresses.

Each suite gates on **pass-rate ≥ 0.8** and reports the **escalation rate** (how often a task needed
`mid`/`pro` instead of `cheap`) — a rising escalation share is the signal to tighten a prompt or add
context, per the cost-first strategy.

## Files

- `harness.ts` — pure scorers (`scoreReceiptExtraction`, `scoreRecipeImport`) + aggregation. Unit-tested.
- `judge.ts` — a cheap LLM-as-judge for semantic checks exact-field matching is too brittle for.
- `fixtures.ts` — golden inputs + expected outputs (the corpus to grow via the ratchet).
- `extraction.eval.test.ts`, `recipe-import.eval.test.ts` — gated live suites.
