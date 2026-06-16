# AI Engineering — Harness + Loop Engineering are our foundation

GroceryManager is built on two principles (Addy Osmani):

- **Agent Harness Engineering** — *"a decent model with a great harness beats a great model with a bad
  one."* The model is one input; reliability is engineered in the scaffolding around it.
- **Loop Engineering** — *"design the loop that prompts the agent, not the prompt."* Work is found,
  done, verified, and recorded by a system, with a separate small model deciding when it's "done."

This is **global and deliberate**: it's *why* we default to cheap Gemini Flash-Lite and still trust the
output. Two levels where it applies:

1. **Product AI layer** — the harness/loop wrapped around Gemini for domain tasks (receipt parsing,
   pantry inference, reorder, meal planning, personalization).
2. **Dev-time coding loop** — how we build the app (this `AGENTS.md` ratchet, hooks, CI back-pressure,
   planner/generator/evaluator splits).

## Harness Engineering → our architecture
| Harness concept | In GroceryManager | Where |
|---|---|---|
| System prompt / `AGENTS.md` rulebook | `AGENTS.md` + per-task system prompts | `/AGENTS.md`, `packages/core/llm` |
| Focused tools + descriptions | typed in-process tools over Postgres + Instacart/Amazon clients | PLAN §8.6, `packages/core/agent` |
| Semantic layer / typed interfaces | canonical ontology + `responseSchema`s the model fills | PLAN §8.2, `@gm/shared`, `packages/core/llm/semantic-layer.ts` |
| Context engineering (compaction, tool-output offloading, progressive disclosure) | retrieve top-k candidates; `cheerio` pre-clean; Gemini context caching; skills-on-demand | PLAN §8.3 |
| Hooks (deterministic; success silent, failures verbose) | Zod + bound checks (qty ≥ 0, unit dimension, totals reconcile) before any pantry mutation | `packages/core/ingestion/verify.ts` |
| Observability (tier, tokens, verification outcome) | logged per loop iteration; escalation-rate watched as a harness-gap signal | PLAN §8.4/§8.5 |
| Model routing | cheap-first ladder `flash-lite → flash → pro` | `@gm/config`, `packages/core/llm/models.ts` |
| Memory on disk / continual learning | append-only `StockLedger` + `PreferenceSignal` ledgers → projections | `@gm/db/schema.ts` |
| The ratchet | every correction → `IngredientMatchOverride` + golden eval case + `AGENTS.md` rule | PLAN §8.5, `AGENTS.md` |
| Sandbox / bash / worktrees | **not** in the product runtime (narrow typed tools); used for the dev coding loop + the isolated scraper | `services/amazon-mcp` |

## Loop Engineering → our architecture
| Loop concept | In GroceryManager | Where |
|---|---|---|
| Run-until-verified (`/goal`); a separate small model grades "done" | `generateWithVerify`: act → Zod-validate → cheap verifier → escalate a tier → Review inbox | `packages/core/llm/client.ts` |
| Maker ≠ checker (planner / generator / evaluator) | "plan my week": Flash generates, a cheap evaluator grades vs a rubric, Pro only on dispute | PLAN §8.6 |
| Automations = the heartbeat | BullMQ cron: daily watch-renew, hourly gmail-poll, nightly predict-recompute | `services/workers` |
| State outside the conversation | Postgres ledgers/projections; nothing critical lives in a prompt | `@gm/db` |
| Budgets / circuit breakers | `maxAttempts` + tier cap; trip → Review inbox (no runaway spend) | `packages/core/llm/client.ts` |
| Sub-agents / connectors | typed tools + integration adapters (Instacart / Amazon / recipe providers) | `packages/core/integrations` |

## Operating rules (the non-negotiables)
1. **Cheapest tier first; escalate only on failed verification.**
2. **The writer never grades itself** — a separate cheap verifier (or pure rules) checks every output.
3. **Determinism first** — parse/validate/match in code; the model only fills genuine gaps.
4. **Low confidence → Review inbox**, never a silent mutation.
5. **Every mistake ratchets the harness** (rule + hook + eval), so it can't recur.
6. **We never "just wait for a smarter model."** When a model improves, load-bearing scaffolding is
   removed; new ceilings get new scaffolding (harnesses move, they don't shrink).
