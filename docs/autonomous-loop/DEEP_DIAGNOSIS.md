# Deep diagnosis — how to actually find and fix a production bug

A reusable method for debugging a real, reported failure (especially "it builds/deploys but the user
hits an error"). The goal is to reach the **root cause with evidence**, not a plausible guess. Adapt
the *tools* to your stack; the *method* is product-agnostic.

> Born from a real outage chain (GroceryManager, 2026-06-28): "Couldn't load your dashboard" on
> signup turned out to be **four stacked causes** — a non-UUID stale session, an uncaught `auth()`
> throw, `DIRECT_DATABASE_URL` unset (admin connection hit RLS), and missing migrations
> (`users.phone` + others). Each fix peeled a layer and revealed the next. Guessing would have
> "fixed" the wrong thing four times.

## The method

1. **Reproduce / observe the REAL environment — do not read code and theorize.** Replicate the user.
   Use every observability channel you have: production DB (e.g. Supabase MCP — `get_logs`,
   `execute_sql`, `list_tables`, `get_advisors`), deploy logs, the deployed app itself, a local run
   that mirrors prod. **The logs usually name the cause in seconds** (`invalid input syntax for type
   uuid "user-1"`, `column "phone" does not exist`). Read them FIRST.

2. **BUILDS ≠ WORKS — separate the three layers.** A green build only proves it compiles. A runtime
   failure lives in one of: **code** (a real bug), **data** (schema/migration drift, bad rows), or
   **config** (a missing/wrong env var, a connection as the wrong role). Decide which layer with
   evidence before touching anything. (Example: "no new user row + no DB error + no app→DB
   connection" → not a code bug, not data → **config**: the admin connection was unset.)

3. **Form ONE hypothesis, then PROVE it against the real system** — don't fix on suspicion. Examples
   that turned a guess into certainty: query the RLS policy and *test the exact insert under the
   restricted role*; **diff the code's schema against the live DB** column-by-column; confirm a fresh
   row is/ isn't created. If you can't prove it, you don't understand it yet.

4. **Trace the exact failure path in the code — find the UNCAUGHT throw.** Map which boundaries catch
   errors and which don't. A function wrapped in `try/catch` that degrades gracefully **cannot** be
   the source of a hard error screen — keep looking for the *unguarded* call (a bare `auth()`, a
   `loadEnv()`, an un-awaited-in-try DB call, an LLM call with no timeout). The error boundary copy
   tells you which route segment threw (root boundary vs a route's own `error.tsx`).

5. **Verify the fix against the real system, not the build.** "Tests pass" is necessary, not
   sufficient. Watch the actual effect: a new user row appears; the failing query now succeeds; the
   journey completes. If you can't click it yourself, verify in the data/logs and say so honestly.

6. **Fix the ROOT cause, add a regression test, and make it fail LOUD next time.** Don't paper over a
   config bug with a code workaround. After fixing, harden the trap that hid it (e.g. a silent env
   fallback → a loud error; an unbounded call → a timeout) so the *class* of bug can't recur silently
   — here or across the other factories. Each fix leaves a test behind.

7. **Peel the layers — persistence beats one clever fix.** Fixing one error commonly reveals the next
   (config → schema drift → LLM timeout). Keep going until the **real user journey works end to end**,
   not until the first error disappears. Don't declare victory early.

8. **Stay honest; update the diagnosis when evidence contradicts it.** It's correct to change your
   conclusion three times if the evidence moves — what's not OK is claiming "fixed" without proof, or
   inventing a cause to close the ticket. Report what you verified and what you didn't.

## Smell-test shortcuts (what the symptom usually means)

- **Generic error boundary + no DB error in logs** → the throw is upstream of the DB (auth/env/an
  uncaught call), or a function timeout. Find the unguarded call.
- **No new rows despite repeated attempts** → the write is failing before/at the insert (a throw, an
  RLS denial, or a missing column), not "the user didn't try."
- **Works locally, fails in prod** → config (env var) or data (migration drift) — the two things that
  differ between environments. Diff them.
- **`invalid input syntax for type X`** → a value reaching a typed column/cast at a trust boundary;
  validate it there and fail closed.
- **A user-facing dead-end from an LLM/3rd-party call** → the call has no timeout and the serverless
  function was killed before your graceful fallback ran. Bound every external call.
- **An `.optional()` env var that a critical path actually requires** → a latent outage. Make it loud.
