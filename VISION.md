# VISION — GroceryManager

The north star for every change. Read this first (the autonomous loop does too).

## The north star (why this exists)
This is being built to become a **real, sellable product** — shipped to the **App Store** as a
paid/subscription app that earns **reliable, consistent revenue** as a dependable side income.
Every decision serves that: it must be polished and trustworthy enough that a stranger pays for it
and keeps paying. That means a genuinely useful core loop, a professional bar (never "vibe-coded"),
honest behavior that earns trust, low/degrading run cost (margins matter), and a clean,
monetizable, multi-tenant foundation. "Good" = something people would happily pay for, every month.

## What it is
A personal **grocery + cooking autopilot** PWA (Next.js 15, mobile-first). It ingests
receipts (Gmail + photo), infers a pantry that depletes over time, predicts run-outs,
drafts the shopping list, suggests "cook what I have tonight," tracks cook macros, and
proactively nudges you (web push / SMS) when it's time to order — learning your taste and
cadence as you cook, buy, and waste.

## Who it's for
A busy person who doesn't want to think about groceries or meals. Personal-first, but
**SaaS-ready** (per-user auth, clean multi-tenant boundaries). Aesthetic target audience:
Gen-Z / millennial — it must feel like a polished, trustworthy product, not a demo.

## What "good" looks like
- **The pantry is the core.** It is the always-current log of what's in your home; keep it
  accurate as intelligently and hands-free as possible. Everything else (recipes, list,
  reorder, plan) reads from it.
- **Honest > flashy.** Show real, DB-derived values only — never fake/placeholder data. When
  uncertain, surface the uncertainty (confidence, "needs review") and *ask* rather than assume.
- **Hands-free where confident, ask where ambiguous.** Confident matches/decisions are
  automatic; genuine ambiguity prompts a quick one-tap confirmation.
- **The loop compounds.** Cooking decrements the pantry → sharpens consumption rates →
  improves reorder predictions → builds the list over time.

## Hard constraints (inferable; do not violate)
- **Multi-tenant via RLS.** Every per-user read/write runs inside `withTenant(getDb(), userId, …)`.
- **Pantry is a projection of an append-only ledger.** Never write `pantry_stock` directly — go
  through `appendLedgerAndReproject` / `reprojectStock`.
- **LLM is cheap-first + best-effort.** Use the cheapest tier that passes verification; any LLM
  call that can fail must `try/catch` and degrade — never block the user. Rules for
  money-/safety-adjacent or hot-path decisions; LLM for fuzzy world-knowledge tasks.
- **Everything degrades.** Missing key (Gemini / Instacart / Twilio / VAPID / FDC) → the feature
  no-ops gracefully; nothing breaks.
- **The gate is the verifier.** `pnpm -r run typecheck` · `pnpm -r run test` · production
  `next build` (with the missing-export grep). Keep it green; never relax a test to pass it.

## The DESIGN BAR (must NOT look vibe-coded) — a STANDING loop standard
Read every run. **Reviewer B enforces this on every UI change; the deep-audit ACCESSIBILITY & DESIGN
BAR lens applies it to the whole live UI.** The goal: an intentional, hand-crafted product — NOT a
generated-looking AI frontend.

**THE DESIGNER QUESTION (the test every UI diff must pass):** *"Would an experienced product designer
intentionally make this decision?"* If the answer isn't a confident **yes** for the layout, spacing,
type, color, and component choices, it does not ship — **Reviewer B rejects any UI diff that can't
answer yes.** "It renders / it's technically correct" is not the bar; "a designer would have chosen
this" is.

**AVOID BY DEFAULT (the AI-slop list — treat each as a smell to justify or remove):** cookie-cutter
SaaS layouts; default/un-themed Tailwind or shadcn straight out of the box; **card spam** (wrapping
everything in a bordered card); arbitrary/random spacing (use the scale, not eyeballed px); decorative
gradients, glows, and blobs; emoji used as icons; generic startup patterns (hero + 3 feature cards +
pricing table cloned from every landing page); centered-everything; rainbow accent colors; fake depth
(heavy drop-shadows everywhere). None of these are banned outright — but each is a default the
generator reaches for, so it must be a *deliberate* choice or it's removed.

**GENERATE BETTER (target instead):** a clear visual hierarchy (one focal point per screen, real
type scale, deliberate weight contrast); generous, *consistent* whitespace from the spacing scale;
restraint with the single accent (mostly solid, used to direct attention, not decorate); content-first
layouts shaped by the actual data (not a card grid by reflex); purposeful, calm motion that aids
comprehension; density that fits a mobile-first daily-use tool; bespoke touches that signal a human
made deliberate calls. Match the cohesion of a well-designed consumer app, not a template.

**Existing non-negotiables (unchanged):** design system only — the tokens + component classes in
`apps/web/app/globals.css` and `apps/web/tailwind.config.ts`; **no ad-hoc inline styles, no
rainbow/AI-flourish, no template-y look.** One typeface (Hanken Grotesk); a single garden-green accent
used sparingly + mostly solid; generous whitespace; calm motion; dark-mode aware; iPhone-aware (safe
areas, 16px inputs, visible focus rings); icons via the lucide registry (`components/icons.tsx`) —
**never emoji**; presentable formatting (`titleCase` / `humanize`, no raw slugs/enums in the UI).

**RECURRING TASTE AUDIT (hook into the periodic deep audit's design lens):** each deep audit, sweep the
live UI for **generated-looking surfaces** — screens/components that fail THE DESIGNER QUESTION or hit
the avoid-by-default list — and produce a PRIORITIZED list **ranked by design impact** (most-seen,
most-generic, most-conversion-relevant surfaces first: onboarding, paywall, home, the core loop). Turn
the top findings into value-bar-clearing UI work. A surface that reads as AI-generated is a design BUG.

**The standard, in one line:** *simplicity without blandness; functionality without visual clutter.*

## Out of scope (don't build)
Social feed, recipe-authoring CMS, full calorie/macro *tracking* app, bank/Plaid sync, anything
that makes the app feel like a generic dashboard. Truly tap-free ordering (ToS-violating browser
automation of consumer Instacart/Amazon accounts) stays out of the core.
