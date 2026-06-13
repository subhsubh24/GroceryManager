# AGENTS.md — GroceryManager

Conventions + the **ratchet** rulebook (PLAN §8.5; harness engineering). Keep this short — every
line is earned by a real failure or a hard constraint. **Success is silent; failures are verbose.**

## Stack / conventions
- TypeScript everywhere, ESM (`"type":"module"`). Node ≥ 20, pnpm 9, Turborepo.
- Business logic lives in `packages/core` (framework-agnostic). `apps/*` / `services/*` depend on
  `packages/*` — never the reverse (keeps the future React Native port cheap).
- DB access only via `@gm/db` (Drizzle). Quantities are `numeric(12,3)` — never floats. Money in
  integer cents. Times in UTC `timestamptz`.
- Env only via `@gm/config` (`loadEnv()`), never `process.env` directly.
- LLM only via `@gm/core/llm` (the model router). Pin model IDs in `@gm/config` — never inline a model string.

## AI / harness rules (PLAN §8)
- Cheapest tier first (`gemini-2.5-flash-lite`); escalate only on failed verification.
- Every LLM output is (1) Zod-validated, then (2) checked by a deterministic hook/verifier **before**
  it touches the pantry. The call that writes is never the call that grades.
- Low-confidence results go to the Review inbox; they never silently mutate state.
- Side-effects that spend money or message the user require an explicit user tap — never model-fired.
- Determinism first: parsing, validation, and matching are code; the model only fills genuine gaps.

## The ratchet
When a model call or agent slips: add a rule here, add a deterministic hook/guard, and add a golden
eval case so it cannot recur. Remove a rule only when a capable model makes it redundant.

## Tests / CI
- `pnpm -r run typecheck` and `pnpm -r run test` must pass. Add a test with every bug fix.
- Units conversion + depletion math are load-bearing — cover every new branch with deterministic tests.
