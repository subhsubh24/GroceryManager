# GroceryManager — Self-Improving Build Loop (memory)

This file is the **durable memory** for the autonomous build loop (`/loop ... every one hour`).
Each iteration: (1) build one feature or tune one, for **wow / stickiness / monetization**;
(2) code-review it; (3) run the test + eval harness; (4) re-assess all features and pick the next.
It's committed so the loop survives session/container loss — on resume, read this first and continue.

> **Environment note:** this runner has **no scheduler tool** (no cron / wakeup). The hourly cadence
> is driven by a best-effort heartbeat while the session is alive; if the container is reclaimed,
> re-trigger `/loop` and continue from the "Next up" section below.

## North star
Be the one app that quietly handles groceries + cooking — and is delightful enough that a
Gen-Z/millennial user *wants* to open it daily, shows friends, and converts (affiliate ordering +
future premium). Stickiness = daily habit + personalization flywheel + social. Monetization =
Instacart/Amazon affiliate on real orders, plus a future premium tier.

## Feature inventory (as of 2026-06-16)
**Ingestion / pantry:** receipts→pantry (Gmail), fridge **scan** (vision), manual/quick-add,
depletion + confidence, **review** inbox.
**Cooking:** **cook tonight** (ranked by pantry), **plan my week** (LLM agent), **cook mode**
(timers/wake-lock/scaling), **import** recipe (URL/photo), **substitutions** ("cook it anyway"),
**use-it-up** (expiring), batch-cook, guest mode.
**Shopping:** smart **list** + Instacart deep-link, **staples** autopilot, household & personal-care,
supplements.
**Intelligence/personalization:** **onboarding** taste interview, user-model (preference ledger),
**spend** intelligence, **digest** + web push, **Grocery Wrapped** (shareable recap).
**Platform:** email/password auth + profile, RLS multi-tenant, offline PWA, full design system
(light + **dark mode**, bento landing, accent page headers, mobile tab bar).

## Assessment vs. wow / sticky / monetization
- **Strong already:** automation (receipts→pantry), planning, Wrapped (shareable), design polish.
- **Gaps that cap stickiness:** no **daily-habit surface** (a reason to open it every day), no
  **personal recipe collection** (you can cook a recipe but not keep it), no **social/multiplayer**
  (the biggest viral + retention lever), thin **discovery** (no "for you" feed).
- **Gaps that cap monetization:** no shareable *collection* (only single-recipe share), no referrals,
  no premium surface.

## Iteration log
- **iter 0 — Design 10/10 loop (done):** vivid landing + bento + motion, cohesive accent headers
  app-wide, mobile tab bar, magazine share page, full dark mode. (commits `db0c62b`..`fc6315e`)
- **iter 1 — My Cookbook (DONE):** save/favorite recipes → `/cookbook`, with a heart Save control on
  recipe cards + cook mode + a landing bento entry. Rides the `preferenceSignals` ledger (no
  migration); saving also appends a `cuisine:<x>` positive signal → feeds the personalization
  flywheel; `saved_recipe` topic routes to the projection's `default` case (no taste pollution).
  Gates green: typecheck, 246 core tests (+8 `cookbook.test.ts`), `next build` (`/cookbook`).
  Tenant-scoped + parameterized unsave. *Commit:* see git log. *Known follow-on:* `RankedRecipe`
  doesn't carry `cuisine`, so the recipes-list Save omits the cuisine flywheel (cook page fires it).

- **iter 2 — AI Recipe Remix (DONE):** one-tap transform any recipe — **healthier / cheaper / faster /
  vegan** → ingredient swaps + note, at `/remix/[id]` (axis tabs, "add replacements to list" =
  monetization). Keyless deterministic table floor + optional LLM enrichment (verify-then-escalate),
  mirroring substitutions. RUN_EVALS-gated golden eval. *Code review caught + fixed* an over-strict
  vegan verifier (it false-flagged legit plant swaps like "oat milk"/"coconut cream"/"flax egg",
  silently discarding LLM vegan enrichment); now allows plant-source qualifiers while still blocking
  "buttermilk"/"clarified butter"/bare dairy. Gates: typecheck, 270 core tests (+24 remix unit
  tests), `next build` (`/remix/[id]`). Links added on recipe cards + cook page.

- **iter 3 — Shareable Cookbook (DONE):** opt-in public share of a user's saved collection via an
  unguessable token. Owner gets a "Share my cookbook" button (`/cookbook`) → `getOrCreateCookbookShareToken`
  (tenant-scoped) → absolute URL; public route `/share/cookbook/[token]` (already public via the
  `/share` middleware matcher) resolves token→userId with `getAdminDb()` (RLS-bypass, strictly
  `eq(userId)`-scoped — same posture as the public recipe share), renders a read-only magazine grid
  (title/image only, **no PII**), each card → public `/share/recipe/[id]` (shop via Instacart), + a
  signup CTA. Token = `randomBytes(18)` base64url; validated by pure `isValidShareToken` before any DB
  hit. *Code review:* security requirements verified (parameterized, scoped, no-PII, public-only links)
  — clean, no fix needed. Gates: typecheck, 274 core tests (+4), `next build` (`/share/cookbook/[token]`).

## Next up (prioritized backlog — re-rank each iteration)
> Selection rule under blind QA (no screen in this runner): prefer **data/AI/copy** wow (verifiable
> via tests/build) over **gesture-UI** wow until a visual pass is possible.
1. **Cooking streak + weekly cook stats** on the home/digest dashboard (tasteful habit reinforcement
   from `mealLogs` — current streak, meals cooked this week; pure date-bucketing core + small UI).
   Blind-safe, sticky. *Next pick.*
2. **Referrals** (invite a friend → both get a perk; builds on the share surfaces; tracking + reward).
3. **Discover — swipeable "for you" recipe feed** (daily-habit surface; every swipe trains the user
   model). *Highest stickiness + wow,* but UI-heavy (gestures) → schedule when visual QA is possible.
4. **Shared household pantry/list** (multiplayer = top retention + viral inside a home). Larger.
5. **Premium surface** (gate power features; affiliate + subscription monetization).

## Conventions
- Keyless-first (features degrade gracefully without API keys). Presentation/additive; never break
  existing flows. Reuse design system + existing patterns. Every iteration: typecheck + core tests +
  `next build` green, plus the LLM eval harness when the feature touches the model.
