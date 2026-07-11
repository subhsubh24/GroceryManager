# Loop memory — lessons for the autonomous loop

Durable, cross-run lessons. The loop appends here each run; read it before picking work.
(Intentionally NOT under `.claude/` — see lesson 1.)

## Lessons
- **2026-07-11 (run 64) — SHIP-GATE UNBLOCKER: gave the native Expo app its first icon system + swapped the
  residual web glyph — 2 file-disjoint clears (#522 mobile icon system / #523 web ▾→ChevronDown); 4 Sonnet
  reviews (2/PR), 1 REQUEST_CHANGES fixed in a 2nd cycle; 0 abandons.** The independent QUALITY_SCORECARD
  (as_of 2026-07-11) graded the ship-critical `design_taste` dimension **B** — the ONLY thing blocking the
  ship gate — because `apps/mobile` (in active App Store/Play submission scope per `eas.json`) had **NO icon
  library at all**: ~110 raw Unicode glyphs (`← → › ✓`) stood in for icons across the shippable surface,
  while the web PWA has a full hand-built registry. Deep audit NOT due (run 63 ran one same day, <24h) → went
  straight to the named top_gap.
  **#522 (FLAGSHIP, design taste):** added `apps/mobile/lib/icons.tsx` — a centralized registry over
  `@expo/vector-icons`' Ionicons (crisp iOS/Android outline SVGs), mirroring the web's
  `apps/web/app/components/icons.tsx`; thin `{size?,color?}` wrappers so screens read by intent. Converted
  exactly the 5 scorecard-flagged surfaces: the 13 home-grid cards now carry a semantic leading icon
  (cube/Pantry, cart/list, restaurant/Cook-tonight, nutrition/Meals, wallet/Spend, trophy/Wrapped, …) + a
  trailing `ChevronRight` (dropped the `→` text glyph, restructured cards to a row layout via
  `<Link asChild><Pressable>`); recipes list-row `›`→ChevronRight; cook-mode `← Back`/`← Recipes`→ChevronLeft,
  `← Prev`/`Next →`→ArrowLeft/ArrowRight (deliberate chevron-for-nav vs arrow-for-step-paging distinction),
  `Logged ✓`→Check; onboarding done-mark `✓`→Check + `← Back`→ChevronLeft; upgrade perk `✓`→Check. Added
  a11y labels as a bonus. `@expo/vector-icons@^15.1.1` (SDK-56 compatible); package.json + package-lock in
  sync; `npm ci && npm run typecheck` clean. **#523 (design bar):** the web cook page's ingredient-swap
  `<details>` disclosure rendered a literal `▾` while `ChevronDown` ("disclosure indicator") was registered
  but unused → swapped, keeping `group-open:rotate-180` + `aria-hidden`.
  **SCOPE DISCIPLINE (both edges) — the run-59 house convention held:** inline text-link CTA arrows
  ("See plans →", "Continue →", "View cooked meals →", the web "Share →") are the established convention and
  were correctly LEFT as text; only the icon-role glyphs the scorecard flagged were converted. Nothing
  over- or under-converted (grep-confirmed: post-merge, every remaining `→/←/✓` is an intentional CTA link).
  **LESSON — mirror the web registry's DELIBERATE avoids, not just its icons:** Reviewer B's one
  REQUEST_CHANGES caught that I'd mapped Grocery Wrapped → `sparkles-outline`, but the web registry
  explicitly documents "avoid Sparkles — reads as an AI flourish" and reserves it for AI-generated content
  ("Planned by AI"), using PartyPopper for Wrapped. Reusing sparkles on mobile would read as an AI feature to
  a cross-surface user. Fixed → `trophy-outline` (celebratory year-in-review, no AI/invite collision) +
  documented the rationale AT THE SITE (the #372 pattern: encode the "why-not" in-code so a future "just use
  sparkles" pass can't recur). Also: Ionicons has NO `recycle` glyph (verified against the installed
  glyphmap), so UseItUp stays `leaf-outline` — the pragmatic keep, not a miss. When building a second
  surface's icon set, port the source registry's *comments and exclusions*, not only its glyph choices.
  **Readiness:** did NOT open the 'ready' issue — the sole DoD gap is unchanged (reach-gated business-case
  floor #190, base ≈ $33K < $100K at median = owner-GTM, no buildable lever). The `design_taste` fix is
  SHIPPED but the grade is the Quality Auditor's to re-assess (maker ≠ checker — the loop does NOT self-grade
  the scorecard). Confidence statement stays UNCHECKED. Validation 8/8, 0 unmet. A focused, converged run
  that removes the one buildable thing between the product and a met ship gate = success.
- **2026-07-11 (run 63) — DEEP AUDIT (4-Haiku lens) + 3 file-disjoint clears (#514 growth-auth throw-safety /
  #515 §11 media STAGING consumer / #517 LaunchGuard auth throw-safety); 6/6 Sonnet reviews APPROVE + 1
  reviewer-suggested hardening folded in; 0 abandons.** DEEP AUDIT was DUE (last standalone run 59, >24h) → ran
  it BEFORE scouting. Baseline gate green
  (typecheck 0, 977 core tests, prod build clean, self-validation 8/8). Highest-leverage takeaways:
  - **DEEP AUDIT 2026-07-11: 3 of 4 lenses CLEAN, 1 real correctness finding shipped.** SECURITY/ABUSE/RLS
    CLEAN (all 22 migrations' public tables RLS+policy; 41 routes rate-limited+zod-validated+error-hygienic;
    login lockout; per-user LLM quota; Turnstile fail-closed; Stripe/Gmail/RevenueCat webhooks signature/
    timing-safe; CSP/HSTS/headers; entitlements server-side; no hardcoded secrets). TEST/EVAL COVERAGE CLEAN
    (~977 tests; "untested" files are barrel re-exports). DESIGN/a11y/ARTIFACTS CLEAN (no generated-looking
    surface; BUSINESS_CASE prices/ARR byte-consistent with billing 499/3999/999¢, base $33,450, floor_met
    false; privacy disclosures match data flows). CORRECTNESS: 1 real finding → #514.
  - **(1) #514 — the "bare `auth()` outside try/catch" trap. `auth()` THROWS, it does not just return null.**
    Three growth admin routes (snapshot/analytics/email) read the session with `await auth()` placed BEFORE
    their try block; an undecryptable cookie (post-`AUTH_SECRET` rotation / stale cookie) raises a JWT error →
    uncaught 500 instead of the intended 403. Fix: swap to the repo's existing non-throwing `currentSession()`
    helper (app/lib/tenant.ts). **LESSON: this repo already learned once that `auth()` can throw (tenant.ts's
    whole reason to exist) and pages use `currentSession()`/`currentUserId()` — but three API ROUTES still
    called raw `auth()`. When a codebase has a non-throwing session wrapper, a bare `auth()` ANYWHERE is a
    latent 500; grep `await auth()` across routes/actions periodically. Reviewer B named a 4th site
    (`session-actions.ts:13` — `forceSignOutAction`, run by LaunchGuard on EVERY launch), which this run ALSO
    fixed as #517 (swapped the READ to `currentSession()` while leaving `signOut`'s NEXT_REDIRECT to propagate).
    PROCESS LESSON: I pushed the bookkeeping PR (#516) BEFORE fixing #517, so #516 merged mislabelling it a
    "later-run follow-up" → forcing a same-run correction. Sweep for ALL same-pattern sites (`grep 'await
    auth()'` over routes + server actions) in the FIRST batch, before opening bookkeeping.**
  - **(2) #515 — completing the BUILDABLE half of a two-owner-gate capability (the §11 staging consumer).**
    Run 62 built the media ADAPTER and left §11 `[ ]`, naming the follow-up. Built `stageCreative(brief)`: a
    batch orchestrator that turns a `CreativeBrief` into a reviewable metadata-only `StagingManifest` + raw
    results, preserving the adapter's degrade/never-throw contract. **LESSON (reinforces run 62): for a
    capability whose real execution is owner-key-gated, the loop can still ship the ORCHESTRATION + the
    keyless-testable contract (degrade, audit-first, manifest shape) and prove it with an injected fake
    provider — but be HONEST in the box status: the §11 OUTCOME needs BOTH the owner key AND an invocation
    site that authors a real brief on a schedule; neither is self-certifiable, so the box stays `[ ]`. Don't
    let "I built the library function" masquerade as "the marketing loop produces staged creative."**
  - **(3) A metadata-only manifest is the right persistence shape for owner-reviewed staged creative — no DB
    table.** The scout floated a DB table + migration for staged assets; deliberately did NOT add one. The
    manifest carries review metadata (status/model/mime/audit/bytes) with NO base64 payload (test asserts the
    payload never leaks into `serializeManifest`), and the raw byte-carrying results are returned separately
    for the caller's owner-gated edge. **LESSON: don't invent a storage schema before a concrete consumer
    needs it (premature structure = churn the value bar rejects); a returned manifest + raw results lets the
    (future) invocation site decide file/blob/DB. Reviewer B explicitly credited skipping the migration.**
  - **(4) Apply a reviewer's non-blocking hardening when it defends a contract YOU claimed.** Reviewer A
    (non-blocking) noted `toStagedItem` ran outside the try/catch and `generateForSpec` had no `default` arm,
    so a runtime off-type `format` (which my own docstring said briefs could be authored from JSON) would
    throw a TypeError out of the batch — contradicting the "NEVER throws" docstring. Folded in the exhaustive
    `default → error` arm + a test pre-merge (still within the ≤2 review-cycle budget). **LESSON: a
    "non-blocking" suggestion that directly falsifies a contract the diff's OWN comments assert is worth
    fixing now, not deferring — the docstring becomes a lie otherwise.**
  **Readiness:** did NOT open the 'ready' issue — sole DoD gap unchanged (reach-gated floor #190, base ≈ $33K
  < $100K, owner-GTM, no buildable lever). §11 box stays `[ ]` (staging consumer built + keyless-proven; real-
  key production + brief-authoring invocation site remain). Confidence stays UNCHECKED. Validation 8/8, 0 unmet.
  2 real clears (1 audit correctness + 1 lowest-buildable-track), 4/4 approvals, 0 abandons = a coherent run.
- **2026-07-11 (run 62) — Track-E §11 media-gen adapter FLAGSHIP (#509) + 3 file-disjoint LIVING-ARTIFACT/a11y
  clears (#510/#511/#512); the 3 small all 2/2 first-pass, the flagship 2/2 after ONE fix cycle; 0 abandons.**
  No DEEP AUDIT (run 59 standalone <24h). Advanced the LOWEST incomplete BUILDABLE track item (ROADMAP §11,
  #442) — a first this cadence: most recent runs had only converged Track-F/G polish, but a genuine unbuilt
  Track-E capability was sitting unchecked. Highest-leverage takeaways:
  (1) **FLAGSHIP #509 — the §11 media-gen adapter (`@gm/core/media`), built fresh against current main.** A
  thin, degrade-by-default adapter (image/video/music/voiceover on the existing Gemini key) that STAGES +
  audits only (publishing stays owner-gated, Track H/§13). Design mirrors the LLM cheap-first contract:
  AUDIT-FIRST (a deterministic FTC-disclosure + not-obviously-AI slop denylist runs BEFORE any paid call, so a
  bad request is `rejected` spending nothing), then DEGRADE (no key → `unavailable`, no network; error/timeout
  → `error`, never throws). **LESSON: for a "produces creative on a preview key we can't exercise in CI"
  capability, the load-bearing keyless half is (a) the pure pre-publish AUDIT gate and (b) the degrade paths —
  build those first-class + unit-test them, and register the capability on THAT keyless proof; the real
  preview-model call is owner-gated and needs no CI key.**
  (2) **An INJECTABLE provider seam turns an un-exercisable SDK path into keyless coverage.** Reviewer A's one
  blocking-adjacent gap was zero coverage of the success-mapping + error/timeout branches (all tests used the
  no-key degrade path). Fix: a `MediaProvider = Pick<GoogleGenAI,"models">` optional constructor param — tests
  inject a fake that returns/throws/hangs, exercising image-bytes/video-op-name/inline-audio mapping + the
  throw/empty/timeout→error paths. media-gen.ts coverage 46% → 90.6%, audit.ts 100%. **LESSON: when an adapter
  wraps an SDK you can't call in CI, add a minimal structural-type seam (not a DI framework) so every branch of
  YOUR logic is testable keyless; production still self-constructs the real client when no seam is injected.**
  (3) **Don't cite a doc as a source unless the doc actually says it (the false-attribution trap).** Reviewer B
  (correctly, blocking) caught `audit.ts` claiming its slop denylist WAS "the VISION avoid-by-default list" —
  but VISION's list is UI/frontend smells (card spam, un-themed Tailwind, rainbow accents), NOT image-gen
  prompt vocabulary. The terms (`octane render`, `8k`, `trending on artstation`…) were a reasonable but
  CURATED/invented list. Fix: describe it honestly as a curated media-gen denylist that operationalizes
  VISION's anti-slop PRINCIPLE. **LESSON: a docstring that attributes a curated list to a named standard is an
  unverifiable-claim bug the reviewers watch for; cite only the PRINCIPLE that genuinely traces, and label
  curated content as curated.**
  (4) **A stale same-named remote branch from an ABANDONED prior attempt blocks the push — rename, don't
  clobber.** `git push` of `claude/media-gen-adapter` was rejected (non-fast-forward): the remote branch already
  existed at a run-54 commit (an abandoned earlier §11 attempt under `content/media-gen.ts`, based on old main
  → 3900-line phantom-deletion diff vs current main). Renamed my local branch to `claude/gtm-media-gen` and
  pushed clean. **LESSON: on a non-fast-forward push to a `claude/<name>` branch, `git ls-remote` + inspect the
  remote branch FIRST — if it's a stale abandoned attempt, use a NEW branch name rather than force-clobbering
  history you didn't create; a factory branch name can collide with a prior run's leftover.**
  (5) **Rebase a flagship branch onto latest main before arming auto-merge when disjoint PRs merged mid-run.**
  Both re-reviewers flagged that `git diff origin/main..branch` showed the 3 already-merged small PRs as
  REVERSIONS — a 2-dot-diff artifact because the branch base predated them (a 3-way merge wouldn't actually
  revert them, since disjoint). Still rebased onto latest main so the diff is clean + the branch is up-to-date,
  re-ran the gate (969 tests, self-val 8/8), force-with-lease pushed. **LESSON (reinforces run-44): when small
  disjoint PRs merge while a flagship is in review, rebase the flagship onto origin/main before merge so a
  reviewer's 2-dot-diff read doesn't look like a regression and any "require up-to-date" branch rule is met.**
  **Readiness:** did NOT open the 'ready' issue — sole DoD gap unchanged (reach-gated floor #190, base ≈ $33K
  < $100K, owner-GTM, no buildable lever). §11 box stays `[ ]` (adapter built; end-to-end staged-creative wiring
  is the follow-up — EVIDENCE-BASED DONE, no over-claim). Confidence stays UNCHECKED. Validation 8/8, 0 unmet.
  1 real Track-E capability + 3 real clears, 8/8+2/2 approvals, 0 abandons = a productive coherent run = success.
- **2026-07-10 (run 61) — 5-Haiku scout sweep + 3 file-disjoint clears (#504 spend-integrity throw-path
  settlement / #505 + #506 Track-F coverage); 6/6 Sonnet reviews APPROVE first-pass; 0 abandons.** No DEEP
  AUDIT (run 59 ran one same day, <24h). Baseline gate green (typecheck 0, 939 core tests, prod build clean,
  self-validation 7/7). Highest-leverage takeaways:
  (1) **FLAGSHIP #504 closes the exact residual #482 (run 57) documented as deferred.** The "ask" agent's
  per-step spend settlement (`recordLlmUsage(llmCalls-1)`) only ran on the RETURN path; a mid-loop THROW
  (429/500/network on a later round, or the final-summary call) charged a flat `llmCalls: 1`, uncounting up to
  `maxSteps`× already-billed Gemini calls against the G7 ceiling (wallet-drain vector). Fix: `runChatWithTools`
  wraps its loop and rethrows a typed `ChatToolLoopError` carrying `stepsAttempted` (steps is bumped before
  each call); `answerKitchenChat`'s catch charges that count. **LESSON: when a prior run explicitly logs a
  "known residual … deferred," that residual is a PRE-QUALIFIED value-bar-clearing candidate for a later run —
  the scout sweep independently re-found it AND the quality scorecard had named it as the correctness A→A+ nit,
  a triple-confirm. Threading a partial count out of a loop = a typed error carrying the count, read in the
  caller's existing catch (no signature change).** Residual (still deferred, bounded): the code-exec retry call
  + post-cap final-summary call aren't in `steps` — a ≤1-call undercount symmetric with the success path,
  errs in the user's favor.
  (2) **Track-F coverage: two money/conversion decision paths pinned.** #505 `isTrialEligible` (the only
  untested `billing` export — keys on `subscription_renewal_at` PRESENCE, not value; post-churn + null-value
  cases guard plausible regressions). #506 `computeExperimentResult` decided-vs-running + zero-control edges
  (#470's named gap; the challenger-insufficient `leading_variant` branch and the `pControl===0` significant
  winner → null lift, not Infinity/NaN). Both coverage-only; impl already correct.
  (3) **BRANCH-ENTANGLEMENT trap RECURRED a THIRD time (runs 39/41).** Parallel Sonnet reviewers sharing the
  parent tree ran `git checkout` of another change's branch, so `claude/experiment-lift-edge-tests` got cut off
  Change A's commit instead of main → the pushed branch bundled 5 files (NOT disjoint). Caught by verifying
  `origin/<branch>` via `git diff --stat` (NOT the shared tree) + both reviewers flagging the stacked-branch
  artifact. Fixed: `git checkout -B <branch> origin/main && git cherry-pick <test-commit>` (single-file commit
  re-applies clean) + `--force-with-lease`. **LESSON (escalated): ALWAYS `git log --oneline -2 origin/<branch>`
  to confirm the parent + `git diff --stat origin/main origin/<branch>` to confirm disjointness BEFORE arming
  auto-merge; prefer worktree isolation for parallel agents that may checkout.**
  **Readiness:** did NOT open the 'ready' issue — sole DoD gap unchanged (reach-gated floor #190, owner-GTM,
  no buildable lever per run-41 adversarial re-test). Confidence statement stays UNCHECKED. Validation 7/7,
  0 unmet. 3 real clears (1 spend-integrity closing a documented residual + 2 Track-F), 6/6 approvals, 0
  abandons = a coherent converged run = success.
- **2026-07-10 (run 60) — 4-Haiku scout sweep (design/UX/taste · security/RLS/Track-G · monetization/revenue
  · mobile+artifacts+tests) + 1 file-disjoint clear (#495 mobile premium_family tier label); 2/2 Sonnet reviews
  APPROVE first-pass; 0 abandons; 0 verify-cycle failures.** Deep audit NOT due (run 59 ran a standalone 5-lens
  sweep the same day). Baseline gate green (HEAD==origin/main 9040ebb, 912 core tests pass, self-validation 7/7
  active 0 unmet). Four scouts, results triaged HARD against the anti-churn bar:
  (1) **DESIGN — nothing cleared.** Three candidates all churn on a converged UI: a legitimate
  `env(safe-area-inset-bottom)` inline style (standard iOS pattern, not slop), a cosmetic `.empty-emoji`→`.empty-icon`
  class RENAME (explicitly forbidden churn), and removing a deliberately-ignored `accent` prop across ~69 callsites
  (high-blast cosmetic). Correctly shipped none.
  (2) **SECURITY/Track-G — nothing NEW cleared.** In-memory rate-limit/LLM-quota/demo-quota are per-instance (won't
  share across serverless regions) — REAL but already parked as owner-gated `llm-quota-redis-upgrade` (needs an
  Upstash secret the loop can't supply); the scorecard already grades this the security A→A+ gap. Server-action
  per-MINUTE burst limits (ask/add-receipt have per-DAY LLM quota + auth but no per-min limit) — judged MARGINAL:
  the per-day quota already bounds wallet spend, endpoints are authed + RLS-scoped, and ~20 runs of auditors graded
  Track-G A/CLEAN; adding defense-in-depth here reads as padding. CORS omission is intentional same-origin design.
  (3) **MONETIZATION — no buildable lever (RE-CONFIRMED, ~21st run).** All conversion/retention/expansion/ARPU
  levers built (3 tiers, Gmail-import conversion moment, referral loop, month-3 annual nudge, win-back, Family
  multi-seat). A dedicated Haiku adversary tested each unbuilt candidate (higher tier / lite tier / annual-only /
  usage add-ons) against the model and every one nets negative or immaterial — the entire gap is REACH (owner GTM
  #190), which no product lever moves. base ≈ $33K < $100K floor, unchanged.
  (4) **MOBILE+ARTIFACTS+TESTS — 1 REAL bug shipped (#495).** `/api/mobile/profile` returns the full
  `@gm/core/billing SubscriptionTier` (incl. `premium_family`), but `apps/mobile/app/profile.tsx` typed `tier`
  with only 3 variants and `TIER_LABEL` had no `premium_family` entry → line 89 `TIER_LABEL[tier] ?? tier` fell
  back to displaying the raw slug `"premium_family"` to a Family subscriber (the HIGHEST-value paid tier). Added
  the member + `"Premium (family)"` label AND tightened `TIER_LABEL` to `Record<ProfileData["tier"], string>` so
  the mobile typecheck job now fails loud if any tier is ever left unlabeled (the compile-time regression guard —
  apps/mobile has no jest). Scout's "spend under-tested" (#4) was FALSE — analyze.ts/wrapped.ts each have a test;
  scout's "mobile typecheck broken" (#2) was FALSE — it just skipped `npm ci` (real `npm ci && npm run typecheck`
  = exit 0 clean). Both proven by direct verification.
  **LESSONS (durable):**
  (1) **A "type it as `Record<string, string>`" lookup map is a silent slug-leak trap when its keys mirror an
  evolving domain union.** The web/core `SubscriptionTier` gained `premium_family` and the mobile display map never
  followed, because `Record<string,string>` accepts any key and the `?? raw` fallback hid the miss. The durable fix
  is to type such maps as `Record<DomainUnion, string>` so the compiler enforces exhaustiveness — turning "add a
  tier, forget the label" from a production slug-leak into a red typecheck. Worth grepping other display maps for
  the same `Record<string, string>` shape over a domain enum.
  (2) **A Haiku scout's "X is broken / untested" claim on infra it may not have set up (npm ci, DB, keys) must be
  VERIFIED before it drives work OR is dismissed.** Two of this scout's six findings were false for a mundane
  reason (deps not installed); one was a real, valuable, paid-tier bug. Direct verification separated them in ~2min
  — cheaper than either trusting a false alarm or discarding a real bug.
  (3) **Stale LOCAL `main` bit the bookkeeping branch: `git checkout main` landed on a pre-run-47 commit while
  `origin/main` was 12 runs ahead.** Code branches were cut with `git checkout -b … origin/main` (correct); the
  bookkeeping branch used bare `git checkout main` and inherited the stale base — caught by a grep for the latest
  run number in the ledger BEFORE writing. Always base branches on `origin/main` explicitly and sanity-check the
  ledger head; never trust local `main`.
  **Readiness:** did NOT open the 'ready' issue — sole DoD gap unchanged (reach-gated business-case floor, base
  ≈ $33K < $100K; #190 = owner-GTM; the 4-scout sweep + a dedicated monetization adversary found no buildable
  floor-mover). Confidence statement stays UNCHECKED. Validation 7/7, 0 unmet. Tight coherent run: 1 real paid-tier
  bug fixed with a compile-time guard, 2/2 first-pass approvals, 0 abandons, 3 scout areas correctly shipped
  nothing (anti-churn held) = success.

- **2026-07-10 (run 59) — DEEP AUDIT (5-Haiku lens sweep, due since run 57) + 3 file-disjoint clears
  (#491 design glyph→registry icon / #492 privacy-disclosure IAP correction / #493 billing scaffold-comment
  correction); 6/6 Sonnet reviews APPROVE first-pass; 0 abandons; 0 verify-cycle failures.** Deep audit was
  due (last standalone run 57, >24h / ~4 runs ago). Baseline gate green (typecheck 0 all packages, 912 core
  tests, production build clean 0 missing-export, self-validation 7/7). Five read-only Haiku lenses over the
  whole repo:
  (1) **SECURITY/RLS/Track-G — CLEAN.** All public tables through 0021 RLS+policy; rate-limits on
  invite-redeem/parse-receipt/mobile-auth/token, 32KB body caps, generic-500 hygiene, 10-fail/15-min lockout +
  timing-safe compare, Turnstile captcha, Stripe constructEvent + timing-safe RevenueCat/Gmail/cron/site-gate
  HMAC, per-user/day LLM quota; AES-256-GCM at rest; CSP/HSTS/nosniff. No new hole since 0021.
  (2) **CORRECTNESS/FUNCTIONAL — CLEAN.** All server actions + API routes try/catch→degrade; the run-57
  pantry-mutation wraps hold; LLM withTimeout(8s) < Vercel budget; DATABASE_URL fails-loud; no uncaught throws
  / dead ends on critical paths; household "coming soon" intentional + flag-gated.
  (3) **TEST/EVAL COVERAGE + PERF — CLEAN above the marginal bar.** 912 tests, coverage 87/88/91 > thresholds;
  recent bug-fixes (#482/#480/#464/#465/#450) all landed WITH regression tests; #487 closed the RevenueCat
  event-map gap same-day. Perf: hot paths indexed (0001/0008/0020), the ingest/capture N+1 + sequential-insert
  candidates STILL rejected (LLM-bound flow, <2% on a correctness-sensitive core path — the run-38/41 verdict).
  rankRecipes `batchCook` weighting is untested but a dormant/never-applied feature (not a bug). Nothing cleared.
  (4) **DESIGN/A11Y/TASTE — 1 real customer-facing finding shipped (#491).** meal-generator.tsx:97 rendered a
  literal `▾` disclosure glyph — the lone remaining customer-facing glyph after the cook-mode cleanups
  (#479/#486) — → `<ChevronDown>` registry icon (added beside `ChevronRight`), preserving the group-open:rotate-180
  flip + aria-hidden. Demo/join/home/cook surfaces re-verified clean. The inline `→` text-link arrows were
  correctly NOT flagged (established typographic convention, unchanged across 59 runs; churn to touch ~10 files).
  (5) **ARTIFACTS/BUSINESS-CASE — 1 real store-risk finding shipped (#492) + 1 reviewer-surfaced follow-on (#493).**
  #492: privacy-disclosures.md §1.4 declared "NO in-app purchases or subscriptions" — FALSE (RevenueCat mobile +
  Stripe web subscriptions wired at 499/3999/999/7999 cents). A false store data-safety/App-Privacy declaration is
  a classic review-rejection trigger; corrected §1.4→YES (entitlement/tier + stripe_customer_id stored, NOT card
  data → §1.5 stays NO), + the matching Play data-map row + Apple checklist line. Prices byte-verified vs
  packages/core/src/billing. #493: while Reviewer A verified #492, it noticed the @gm/core/billing HEADER COMMENT
  still said "SCAFFOLD ONLY (no real payments yet)" — a living-artifact contradiction on wired, DoD-load-bearing
  billing; corrected to describe the module accurately + note the real FEATURE_BILLING-gated fail-open payment
  paths (comment-only). BUSINESS_CASE prices/ARR/floor all still byte-consistent (base $33,450, floor_met false).
  No DoD box completed (Track-F/G polish + artifact fixes, not new DoD items).
  **LESSONS (durable):**
  (1) **A reviewer verifying one artifact fix is a free second audit pass — mine it.** #493 came from Reviewer A
  reading the billing code to fact-check #492's price claims and noticing an adjacent stale comment. When a
  reviewer touches neighbouring code, its incidental observations are high-signal (it's already loaded the
  context); capture them as file-disjoint follow-ons rather than losing them.
  (2) **A false store-compliance declaration outranks a code nit on the value bar even though it's "just a doc."**
  privacy-disclosures.md becomes the literal Apple App-Privacy + Play Data-Safety labels; a subscription app
  declaring "no purchases" is a textbook rejection. LIVING ARTIFACTS isn't cosmetic here — a wrong store doc is a
  submission blocker. Correcting it advanced the store-acceptance gate, not just tidiness.
  (3) **The recurring #320 performance-B ask remains correctly deferred (5th run running): the CI perf-budget gate
  needs `.github` (forbidden blast-radius) and the middleware trim is a high-blast auth refactor for a
  NON-ship-critical A→A+ nit.** Not worth it on a converged product; leave for the owner / a dedicated slice.
  **Readiness:** did NOT open the 'ready' issue — sole DoD gap unchanged (reach-gated business-case floor, base
  ≈ $33K < $100K, #190 = owner-GTM, no buildable floor-mover; the 5-lens sweep found none). Confidence statement
  stays UNCHECKED. Validation 7/7, 0 unmet. Coherent converged run: 3 real clears (1 design, 2 store/artifact
  compliance), 6/6 first-pass approvals, 0 abandons, full deep audit = success.

- **2026-07-09 (run 58) — 2 file-disjoint QUALITY_SCORECARD A→A+ closures (#486 cook-mode arrow icons /
  #487 RevenueCat event-map extract + table tests); 4/4 Sonnet reviews APPROVE first-pass; 0 abandons; 0
  verify-cycle failures.** Deep audit NOT due (run 57 ran one same-day). Baseline gate green. No scout
  sweep — consumed the fresh scorecard (2026-07-09, overall A, ship_gate_met true) as the distilled
  discovery, verified each named gap against real code, shipped the two cleanly+safely buildable +
  file-disjoint ones. #486 closed the `design_taste` A→A+ nit (the two cook-mode step-nav arrow glyphs
  #479 left behind → `<ArrowLeft>`/`<ArrowRight>` registry icons). #487 closed the ship-critical
  `launch_readiness` A→A+ gap (uncorrected 3 cycles): extracted the RevenueCat webhook's inline,
  untested grant/revoke/ignore + product→tier mapping to pure exported `@gm/core/billing` fns
  (`rcEventAction`/`tierFromRevenueCatProduct`) + 25 table tests, byte-identical behaviour. No DoD box
  completed (A→A+ polish on already-A dims, not new DoD items).
  **LESSONS (durable):**
  (1) **When a deep audit ran within 24h, the fresh QUALITY_SCORECARD `top_gaps` list IS the run's
  distilled discovery — a full scout sweep would just re-derive it.** The right move on a converged
  product is: read the scorecard's named gaps, verify each against the actual code (don't trust the
  grade blindly — but here both were real), and ship the subset that is BOTH cleanly buildable AND
  safe AND file-disjoint. That kept this a tight 2-change run with zero churn.
  (2) **Not every scorecard-named gap is worth shipping this run — filter by blast radius, not just
  value.** The `performance` (B, the only sub-A dim) gap named two asks: a CI perf-budget gate (can't —
  `.github` is a forbidden blast-radius zone for a headless run) and an edge-middleware trim (moving
  NextAuth/jose off the edge runtime is a high-blast-radius AUTH refactor for a NON-ship-critical A→A+
  nit). Per the BRAKES ("when in doubt, STOP"), both were correctly deferred — a risky auth-middleware
  rewrite is not worth a non-blocking A+ cosmetic. The `security` A→A+ (in-memory→Redis quota) needs an
  owner secret (already in PENDING_OPS) → also deferred. Ship the safe closures, leave the risky/gated
  ones for the owner or a dedicated slice.
  (3) **Extract-and-table-test is the clean pattern for un-tested money-code decisions.** A grant/revoke
  or product→tier typo mis-grants entitlements silently. Lifting the inline sets/mapping verbatim into a
  pure exported fn (no behaviour change → Reviewer A can verify line-by-line vs the pre-diff) + a table
  test over every event class and precedence/edge case turns an untested critical path into a proven
  one without touching the route's auth/fail-closed path.
  **Readiness:** did NOT open the 'ready' issue — sole DoD gap unchanged (reach-gated business-case
  floor, base ≈ $33K < $100K, #190 = owner-GTM, no buildable floor-mover). Confidence statement stays
  UNCHECKED. Validation 7/7, 0 unmet. Coherent converged run: 2 real clears (1 design, 1 ship-critical
  correctness safety net), 4/4 first-pass approvals, 0 abandons = success.
- **2026-07-09 (run 57) — DEEP AUDIT (5-Haiku lens sweep, due since run 54 ~1 day) + 4 file-disjoint
  clears (#482 ask-quota-per-step G7 / #480 pantry degrade / #479 cook-mode Check icon / #481 business-case
  H14/H15 freshness); all 8 Sonnet reviews (2 per PR) APPROVE first-pass; 0 abandons; 0 verify-cycle
  failures.** Baseline gate green (typecheck 0 all packages, 912 core tests, production build clean 0
  missing-export, self-validation 7/7). Advanced hardening/quality/artifacts off the deep audit; no DoD box
  completed (these are Track-F/G + LIVING-ARTIFACT fixes, not new DoD items).
  **DEEP AUDIT verdict:** ONE real MEDIUM security finding (shipped as #482), the rest CLEAN or verified
  false-positives. Findings by lens:
  (1) **SECURITY/RLS/Track-G — 1 real MEDIUM shipped, rest CLEAN.** The FLAGSHIP #482: the "ask your
  kitchen" agent runs a Gemini function-calling loop of up to `maxSteps: 8` calls per ask, but
  `checkLlmQuota` (G7 per-user daily spend ceiling) charged a flat 1 per ask → a free user's 10/day quota
  permitted up to ~80 real Gemini calls/day, an up-to-8× breach unique to this endpoint (every other LLM
  surface is single-shot). Fix: `answerKitchenChat` now returns the loop's real step count (`llmCalls`,
  already computed by `runChatWithTools`); `ask/actions.ts` pre-charges 1 at the gate then settles the extra
  via a new `recordLlmUsage(userId, llmCalls-1)` — total charged = llmCalls. Keyless = 0 (never charged); a
  thrown agent = 1; a 1-step ask still costs exactly 1 (no over-penalty). +3 keyless assertions. RLS CLEAN
  (all public tables through 0021 have RLS+policy); rate-limit/captcha/HMAC/webhook-auth/headers/CORS all
  present, no new gaps.
  (2) **CORRECTNESS/FUNCTIONAL-REALITY — 1 real MEDIUM shipped, 1 dropped.** #480: the four pantry mutation
  server actions (remove/add/resolveExpiring/clearPantry) ran their `withTenant` mutation with NO try/catch —
  the only mutation actions left doing so — so a transient DB/RLS throw propagated uncaught and blew up the
  whole /pantry page via the error boundary, against the degrade-by-default convention. Wrapped each: log
  server-side + fall through to `revalidatePath` (kept OUTSIDE the try) so a failed op honestly re-reads
  unchanged state — no fake success (SIDE-EFFECT INTEGRITY). DROPPED: cron h14/h15 "missing outer try/catch"
  — verified they have the SAME per-item try/catch shape as the digest/gmail crons (whose outer candidate
  read is also unwrapped), so no real inconsistency, and the failure mode (rare transient DB blip on a weekly
  dormant cron → benign Vercel retry) doesn't clear the bar.
  (3) **DESIGN/A11Y/TASTE — 1 real shipped, 1 false-positive rejected.** #479: the cook-mode final-step
  primary CTA rendered a literal `✓` (U+2713) glyph instead of the `<Check>` registry icon every other
  "done" affordance uses (cooked-it-button/getting-started/staples) — a real convention violation (CLAUDE.md:
  icons via icons.tsx, never a glyph) on a prominent core-loop CTA; swapped to `<Check aria-hidden/>` (already
  imported). REJECTED the `alt=""` on recipe images finding: in all three sites (cookbook/cook-mode/swipe-deck)
  the recipe title is rendered as visible adjacent text, so per WCAG the decorative image correctly takes
  empty alt — adding `alt={title}` would cause REDUNDANT screen-reader announcements. The `← Back`/`Next →`
  arrows are established typographic punctuation (not text-as-icon) — correctly left as-is.
  (4) **ARTIFACTS/BUSINESS-CASE/MONETIZATION — 1 stale claim shipped, rest CLEAN.** #481: BUSINESS_CASE.md §5
  listed H14 (annual nudge) + H15 (win-back) as "remaining buildable retention levers" but both shipped run 23
  (PR #221) as the /api/cron/h14-annual-nudge + h15-winback routes (dormant until owner connects email) —
  LIVING-ARTIFACT drift, corrected to built/dormant. BODY-TEXT ONLY: the BUSINESS_CASE_SUMMARY YAML + all ARR
  figures untouched, no adoption banked → no gaming. Pricing byte-identical doc↔code (499/3999/999/7999); all
  named conversion/retention/expansion levers BUILT; reach-gated RE-CONFIRMED (base ≈ $33K < $100K = owner-GTM
  #190, no buildable floor-mover). README "870+" still a true floor claim (not touched = churn avoided).
  (5) **MOBILE/PERF/COVERAGE — nothing cleared the bar.** All mobile findings verified as defensive-against-
  IMPOSSIBLE: the mobile /plan route NEVER returns `{empty:false, plan:null}` (plan is null only when
  empty:true, which the render already guards) → the proposed plan.tsx null-guard guards a shape the server
  can't produce = churn; cooked.tsx `imageUrl?.startsWith()` is already optional-chain-safe. Perf: digest
  two-withTenant merge marginal; cook-tonight slice marginal. Coverage: vision/detect.ts branch 81% is low-
  value (adding an impossible-case test = churn). All rejected with the route/render code as evidence.
  **LESSONS (durable):**
  (1) **An agentic tool-loop defeats a per-invocation spend ceiling by its step multiplier.** A quota charged
  once per user-facing call under-counts an endpoint that fans out to N model calls internally. The fix
  pattern that stays clean: have the loop RETURN its real step count (`runChatWithTools` already did) and
  SETTLE the extra post-hoc (`recordLlmUsage`) — pre-charge 1 at the gate, add `steps-1` after — so typical
  1-step calls aren't over-penalized and the ceiling counts real API usage. Look for this multiplier on ANY
  endpoint whose quota gate wraps an agentic/retry/escalate loop.
  (2) **Known residual (minor, follow-up): the settlement still under-counts two edge cases** — a mid-loop
  throw charges 1 (can't see partial steps without changing client.ts), and a maxSteps-exhausted run makes one
  extra "final summary" call not counted in `steps` (reports 8 when 9 real calls fire). Both are bounded 1-call
  residuals, strictly better than the 8× hole; closing them needs `runChatWithTools` to expose partial
  progress on throw — deferred (out of the fix's file set, low value vs. the hole closed).
  (3) **A degrade-quiet swallow is only honest if the re-read reflects true state.** Wrapping a mutation
  server action in try/catch is safe ONLY when `revalidatePath` (the re-read) stays OUTSIDE the try, so a
  failed op shows the UNCHANGED projection — never an optimistic "done". A catch that also skipped the
  re-read, or a form that showed a success toast regardless, would be fake success (§ SIDE-EFFECT INTEGRITY).
  (4) **When an audit lens flags a "missing guard/try-catch", verify the sibling/peer code FIRST** — the cron
  h14/h15 "inconsistency" and the mobile plan.tsx "crash" both dissolved once the digest cron's identical
  shape and the /plan route's actual response contract were read. Two of five lenses' top findings were
  defensive-against-impossible; rejecting them with the peer/contract code as evidence kept the batch churn-free.
  **Readiness:** did NOT open the 'ready' issue — the sole DoD gap is unchanged (reach-gated business-case
  floor, base ≈ $33K < $100K at median, #190 = owner-GTM, no buildable lever). Confidence statement stays
  UNCHECKED. Validation 7/7 active, 0 unmet. A coherent converged run: 4 real clears (1 security, 1 reliability,
  1 design, 1 artifact) + a full 5-lens deep audit, 0 abandons, 8/8 first-pass approvals = success.
- **2026-07-09 (run 56) — Track E §34 Part B shipped: the gated-beta INVITE-CODE mechanism (PR #475)
  + 2 file-disjoint clears (#474 mobile plan array-guard / #473 a11y details-triangle); 6 Sonnet reviews
  across 3 PRs; 1 real security defect + 1 e2e locator bug caught and fixed; 0 abandons.** Deep audit NOT
  due (run 54 same-ish window). Advanced the LOWEST incomplete track: after run-55's public `/demo` (Part A),
  built waitlist → owner issues a code → `/join` redeem → past the site gate → `/signup`. Built:
  `@gm/core/security/invite-code` (pure, 16 keyless tests), migration 0021 (invite columns on the existing
  RLS-hardened `waitlist_submissions` — no new table), idempotent issue/redeem/stats queries, hardened
  `POST /api/invite/redeem`, on-brand `/join`, `invite:issue` owner script, `invite-code-redeem` capability.
  §34 box stays UNCHECKED (the invite MECHANISM is built + tested, but "yielding the first real PMF cohort"
  is owner-gated — needs the owner to set `SITE_GATE_INVITE_SECRET`, apply 0021, and issue codes to real
  traffic; no self-certification of an owner-gated outcome).
  **LESSONS (durable):**
  (1) **A gate-grant must NEVER hand out the master credential (Reviewer-A caught, load-bearing).** The first
  cut set the site-gate cookie to the literal `SITE_GATE_PASSWORD`, so any beta invitee could read the owner's
  admin override from devtools and leak it (→ forced password rotation for everyone). Fix: mint a DISTINCT,
  independently-rotatable `SITE_GATE_INVITE_SECRET` the gate ALSO accepts (constant-time), grant THAT; if the
  gate is on but the secret is unset, degrade 503 rather than fall back to the password. General rule: when a
  flow grants access by handing the client a shared secret, that secret must be a scoped, rotatable credential —
  never the admin/master one.
  (2) **The STALE-LOCAL-MAIN trap bit AGAIN — this time via detached HEAD.** Run-start
  `git reset --hard origin/main` ran on a DETACHED HEAD, so it did NOT advance the local `main` REF; then
  `git checkout -b <branch> main` cut from a stale `main` (behind origin, missing run-55's `/demo` middleware
  entries → looked like a regression). Durable fix: branch explicitly from `origin/main`
  (`git checkout -B <branch> origin/main`) or `git branch -f main origin/main` FIRST; never trust local `main`
  after a detached-HEAD reset.
  (3) **Reviewer subagents may create their OWN git worktrees on the branch under review — do NOT
  `git worktree remove` a path you didn't create while any reviewer of that branch is still running.** I removed
  a `review-wt` worktree believing it orphaned from a finished mobile reviewer; it actually belonged to the
  still-running flagship Reviewer B, breaking its review mid-flight (had to TaskStop + re-review). **Prevention
  that worked:** instruct reviewers to review DIFF-ONLY (`git diff`, read files), NOT create worktrees or run
  per-package installs — the cycle-2 pair did this and finished cleanly + faster, and it avoids both the
  branch-checkout contention AND the false cross-package typecheck errors an isolated worktree's `@gm/*`
  symlinks produce (Reviewer B's worktree reported a bogus "issueWaitlistInvite not exported").
  (4) **A loose `getByLabel(/regex/i)` can collide with a section `aria-label` (Playwright strict mode).**
  `getByLabel(/invite code/i)` matched both the input ("Invite code") and the wrapping section
  ("Redeem invite code") → 14/15 green, 1 strict-mode fail that only surfaced in CI (not local typecheck).
  Prefer `getByRole("textbox", { name: "Invite code" })`. CI's real-browser e2e is the gate that catches this
  class — local typecheck can't.
  (5) **db-never-imports-core stays clean by INJECTING the generator:** `issueWaitlistInvite(db, email,
  generateCode)` — the tested generation logic lives in `@gm/core`, the caller supplies
  `() => generateInviteCode(randomBytes)`, so `packages/db` keeps zero core dependency.
  **Business case DEEPLY re-confirmed reach-gated** (skeptical scout pass): pricing drift-free; ALL named
  conversion/retention/expansion levers already BUILT; constraint is REACH (owner-GTM #190), not loop-buildable —
  no buildable floor-mover. Base ≈ $33K < $100K. Readiness NOT opened; confidence statement stays UNCHECKED.
- **2026-07-08 (run 55) — Track E §34 Part A shipped: the public no-account "try the aha" receipt demo
  → waitlist (PR #471), ONE coherent flagship change, both Sonnet reviewers APPROVE after one fix cycle,
  0 abandons.** Deep audit NOT due (run 54 same day). Advanced the LOWEST incomplete track (Track E §34)
  with the highest-value buildable lever — a public, no-account demo of the core aha (paste/snap a receipt
  → pantry list) that grounds waitlist interest, directly targeting the business case's binding constraint
  (reach/conversion, #190). Built: `/demo` page+client, hardened `POST /api/public/parse-receipt` (per-IP
  rate limit + captcha + bounded input + per-IP AND global daily spend ceiling + cheap-tier `maxAttempts:1`),
  pure keyless-tested `@gm/core/security/demo-quota`, gate-aware hero funnel, scoped site-gate/middleware
  exemptions, `public-demo-spend-ceiling` capability. §34 box stays UNCHECKED (Part B gated-beta + full
  instrumentation still pending — no self-certification). §11 media-gen deferred (lower value; would
  conflict on capabilities.json/core package.json this run).
  **LESSONS (durable):** (1) **Public paid-LLM endpoint hardening** — the GLOBAL spend ceiling is the
  wallet-drain backstop (an anonymous IP-rotating caller defeats a per-IP cap), but an in-memory Map is
  per-Vercel-instance → effective cap is `cap × instances`. Be HONEST in the capability manifest ("per-instance
  bound; Redis for a true cross-instance cap") and make it the top-priority Redis-upgrade item; reserve the
  quota slot as LATE as possible (after validation, right before spend) so denied/invalid requests don't
  consume budget. (2) **Self-validation only credits CI-RUN specs** — `check-self-validation.mjs` matches
  `e2e <token>` in the ci.yml e2e job block; CI runs `journeys` + `email-roundtrip`, NOT `smoke`. A new
  capability's e2e proof must go in `journeys.spec.ts` (keyless, outcome-asserting), not smoke. (3) **Pre-launch
  site-gate front door** — `/signup` + `/signin` dead-end at the gate, so any hero leading with them is broken
  pre-launch; a `gateOn = Boolean(process.env.SITE_GATE_PASSWORD)` branch that leads with the working `/demo`
  is the coherent funnel (keeps the A/B signup primary post-launch). (4) **Scope namespace exemptions to the
  EXACT route** (`/api/public/parse-receipt`), never a bare namespace (`/api/public`), matching the repo's
  `/api/waitlist/confirm` / `/api/growth/snapshot` convention — a blanket namespace exemption silently makes
  future sibling routes public.
- **2026-07-08 (run 54) — DEEP AUDIT (6-Haiku lens sweep covering all 8 areas, due since run 53 ~2 days) + 4
  file-disjoint clears (#464 add-receipt quota-gate degrade / #465 scan quota-gate degrade / #466 scan radio
  fieldset a11y / #467 ask 7-read parallelize); ALL 8 Sonnet reviews (2/PR) APPROVE first-pass; 0 abandons.**
  Baseline gate green (typecheck 0, 872 core tests, production build clean 0 missing-export, self-validation 5/5
  0 unmet, scorecard **A**). Combined-tree gate run once before splitting to 4 branches; all 4 apps/web-only
  (no core/migration/mobile/capability change) so each subset also green. All 4 auto-merged through green CI.
  **DEEP AUDIT verdict — 0 CRITICAL, everything CLEAN or verified false-positive:**
  - SECURITY/RLS/Track-G **CLEAN** — 24 public tables all RLS+policy through 0020; rate-limit/captcha/HMAC/
    webhook-auth(timing-safe)/headers/CORS/validation all present. NO NEW FINDINGS.
  - COVERAGE **CLEAN** (core pure logic exhaustively tested); ARTIFACTS **CLEAN** (pricing byte-identical
    doc↔code; README "870+" is a still-true FLOOR claim, not drift — NOT touched = churn avoided).
  - MONETIZATION: pricing MATCHES, no correctness bugs; reach-gated RE-CONFIRMED (base ≈ $33K < $100K = owner
    GTM #190). The audit's annual-first-default + promo-code-winback levers are A/B-experiment territory —
    banking their adoption would GAME the number; NOT bankable pre-launch → **no buildable floor-mover**.
  - Shipped: **#464/#465** hardened the add-receipt+scan **pre-LLM quota-gate `loadPreferenceSignals` read** that
    sat OUTSIDE the try/catch → a DB blip threw uncaught to the page-level error boundary instead of the
    `{status:error}` inline state (the #436/#437/#448 G3 class, on 2 core-loop vision paths). **#466** grouped the
    scan-location radios in fieldset/legend (WCAG 1.3.1; Tailwind Preflight zeroes fieldset/legend defaults →
    pixel-identical). **#467** parallelized `buildBriefForFallback`'s 7 sequential independent tenant reads →
    `Promise.all` on the one tx (the #457 postgres.js-pipeline pattern, premium Ask path).
  **LESSON — verify EVERY scout finding against real code before selecting (3 false positives this run, killed by a
  code-read, 0 reviewer rounds burned):** (1) mobile `app/index.tsx` onboarding "res.ok not checked" is a NO-OP — the
  code already fails OPEN to `onboarded=true` in every failure path (`res.json()` on an error body → `?? true`;
  `.catch` → `true`), so a `res.ok` guard changes NOTHING = churn. "Every other file does X" is not a reason to add X
  where the existing behavior is already correct-by-design. (2) `upgrade/page.tsx` `aria-current="true"` on a perk card
  is NOT an ARIA misuse — `aria-current="true"` is valid for "the current item within a SET of related elements", not
  navigation-only; the auditor's "nav links only" claim was over-narrow. Know the actual ARIA spec before "fixing" an
  attribute. (3) `aria-disabled`+native `disabled` redundancy = harmless churn. The maker-verify guard (maker≠checker
  BEFORE coding) keeps paying off — same pattern as runs 42-45/47/53.
  **LESSON — same-class fix across 2 disjoint files is NOT padding when the paths are genuinely distinct:** #464
  (receipt-ingest) and #465 (fridge-scan) apply the identical degrade-guard but are separate core user journeys each
  independently valuable; Reviewer B was explicitly asked "is this count-padding?" and approved both on the
  distinct-path rationale. The line: ship the SAME fix on N files only when each file is a real, separately-reachable
  user path — and STOP at the marginal ones (deferred the pantry gmail-sync twin: premium secondary path, actual work
  already degrades, only the gate exposed; deferred 5 micro-parallelizations dominated by downstream LLM latency).
  **Readiness:** did NOT open the 'ready' issue — sole DoD gap unchanged (reach-gated floor #190, owner-GTM; base ≈
  $33K < $100K = downloads/mo, no buildable floor-mover surfaced this sweep). Confidence statement stays UNCHECKED.
  Validation 5/5, 0 unmet. Stale-local-main trap avoided (run-start `git reset --hard origin/main`, was 43 behind).
- **2026-07-06 (run 53) — DEEP AUDIT (8-Haiku lens sweep, due since run 50 ~24h/3 runs) + 4 file-disjoint
  clears (#456 billing repeat-trial-leak / #457 perf tenant-read parallelization / #458 docs test-count /
  #459 mobile array-field boundary normalization); ALL 8 Sonnet reviews (2/PR) APPROVE first-pass; 0
  abandons.** Baseline gate green (typecheck 0, 872 core tests, production build clean 0 missing-export,
  mobile typecheck 0, self-validation 5/5 0 unmet). Combined-tree gate run once before splitting to branches.
  **DEEP AUDIT verdict — 1 CONFIRMED revenue bug (fixed), everything else CLEAN or false-positive:**
  - SECURITY/RLS/Track-G **CLEAN**. Scout "content_schedule missing RLS" = FALSE POSITIVE (already covered
    by `0016_rls_waitlist_content.sql`; the scout only read 0014). In-memory rate-limit/LLM-quota not shared
    across Vercel instances = known owner-infra (Upstash Redis, PENDING_OPS), not a code fix. CSP
    `unsafe-inline` = known Next.js-15 hydration requirement. CORS-add-`ACAO:*` + AUTH_SECRET-module-throw =
    REJECTED (would weaken the lockdown / break the env-free `next build`).
  - MONETIZATION: **#456 CONFIRMED + FIXED** — both webhooks wrote the `subscription_renewal_at`
    trial-ineligibility marker only on the PAID transition (Stripe `status!=="trialing"`, RevenueCat
    `period_type!=="TRIAL"`), so a user who started the 7-day trial and cancelled before conversion was
    never marked → `isTrialEligible` stayed true → unlimited repeat free trials. Fix: write on `isActive`
    (Stripe — covers `trialing`) / any GRANT_EVENTS (RevenueCat). `subscription_renewal_at` is a
    presence-only marker (only `isTrialEligible` reads it via `.some()`; value never parsed as a date), so
    early + duplicate appends are safe. Deferred: checkout idempotency-key (the proposed `${userId}-${plan}`
    is too coarse — 24h Stripe dedup would reuse a stale session URL), annual-first paywall (an A/B-worthy
    conversion lever), portal customer-id fallback.
  - PERF: **#457 SHIPPED** — list/recipes/plan awaited independent tenant reads sequentially in an object
    literal; → `Promise.all` on the one tx (postgres.js pipelines; spend page is the in-prod precedent).
    pantry 7-transaction batch refactor DEFERRED (higher risk, correctness-sensitive).
  - COVERAGE: nutrition `estimateMealMacros` "confidence 0.3 on empty" = FALSE POSITIVE (empty/all-optional
    → `source==="none"` → confidence 0, not 0.3). Other edge-branch tests low-value, deferred.
  - DESIGN/A11Y: redundant-alt findings (swipe-deck img + 6 thumbnails) REJECTED — the recipe title is
    adjacent visible text, so `alt=""` is WCAG-correct; `alt={title}` would double-announce. `aria-current`
    on the filter tabs DEFERRED (file-conflicted with #457's recipes/plan; the perf win outranked it).
  - MOBILE: **#459 SHIPPED** — use-it-up/digest/wrapped `res.json() as T` casts give no runtime guarantee;
    a partial 200 would white-screen on `.length`/`.map`/`[0]`. Normalized the array fields to `[]` once at
    the fetch boundary (setData/setStats) — coherent, vs scattered per-site guards (wrapped derefs
    `topRecipes` at 4 sites; a single-site guard would be incomplete). discover "Skip/Like" a11y REJECTED
    (buttons have Text children — already announced).
  - ARTIFACTS: **#458 SHIPPED** — CLAUDE.md "~408" / README "780+" test counts were 2.2×/13% low vs 872
    passing → "~870". Pricing ($4.99/$39.99/$9.99) + BUSINESS_CASE YAML (base $33,450) CLEAN everywhere.
  **LESSON — STALE LOCAL MAIN trap (new):** local `main` was **36 commits behind** origin/main (`git fetch
  origin main` updates the remote-tracking ref, NOT the local branch). Branches cut from it showed PHANTOM
  diffs — the mobile branch's wrapped.tsx carried run-52 #451's `empty` reformatting as if it were mine.
  Caught by diffing the branch and recognizing #451's change. FIX: before cutting ANY branch, `git reset
  --hard origin/main` on local main (or assert `git rev-list --count main..origin/main == 0`). Recovered
  cleanly: reset main → recreate all 4 branches from the stash (only wrapped.tsx had changed upstream, and
  the stashed tree already contained #451, so `git checkout stash -- <files>` yielded exactly origin/main +
  my edit for all 10 files) → force-push; re-verified every branch's diff vs FRESH main was minimal before
  opening the PR.
  **LESSON — verify every scout finding against real code up front (maker≠checker before coding):** 3 of the
  sweep's headline findings were false positives (content_schedule RLS, nutrition confidence, redundant alt)
  that a quick code-read killed before any implementation — cheaper than burning a reviewer round.
  **Readiness:** did NOT open the 'ready' issue — sole DoD gap unchanged (reach-gated floor #190, owner-GTM;
  base ≈ $33K < $100K = downloads/mo, no buildable floor-mover surfaced this sweep). Confidence statement
  stays UNCHECKED. Validation 5/5, 0 unmet.
- **2026-07-05 (run 52) — 5 file-disjoint clears from a 5-Haiku scout sweep (#447 push {ok}-contract /
  #448 import save DB-degrade / #449 cook-mode aria-pressed / #450 spend week-period test / #451 mobile
  Wrapped empty-state); 10 Sonnet reviews (2 per PR), 9 APPROVE first-pass + 1 REQUEST_CHANGES (honored);
  0 abandons. No deep audit (run 50 ran a full 6-lens same day, <24h).** Baseline gate green (typecheck 0
  across all packages, 872 core tests after +1, scorecard **A** as_of 2026-07-05, self-validation 5/5 / 0
  unmet, production build clean, mobile typecheck 0). Five read-only Haiku scout lenses (web
  reliability/correctness, security/Track-G, mobile parity, design/a11y/taste, test-coverage+artifacts);
  security **CLEAN** (no new gaps since run 50); artifacts **CLEAN** (pricing matches everywhere). Verified
  every candidate against the code before selecting; correctly REJECTED several scout false positives.
  - **#447 — three push-subscription actions violated their own `{ok}` contract AND drove a fake success.**
    `savePush/removePush/sendTestPushAction` all declare `Promise<{ok}>` but the `withTenant`/DB (and
    `sendNotificationToUser`) calls sat outside try/catch → uncaught throw. Worse, `push-toggle.tsx` IGNORED
    the returned `ok`: the existing not-signed-in `{ok:false}` path (and any DB failure) still rendered
    "Notifications are on." — a fake success (SIDE-EFFECT INTEGRITY violation) — and `sendTestPushAction`
    throwing left the Test button stuck busy (rejected promise outside the client try/catch). Wrapped all
    three (return `{ok:false}` + server-side `console.error`) AND made enable()/disable() check `res.ok`
    and surface a real failure message. Reviewer A confirmed the disable() ordering is correct (local
    `sub.unsubscribe()` only after the server delete succeeds — no client/server desync).
  - **#448 — the one exit in `saveImportedRecipeAction` that DIDN'T degrade.** Every other exit (bad JSON,
    empty title) redirects with `?error=`, but the `saveImportedRecipe(getDb(),…)` DB write threw uncaught
    to the Next error boundary. Wrapped it → `redirect("/import?error=…")`; success `redirect(/cook/${id})`
    stays OUTSIDE the try (NEXT_REDIRECT not swallowed; `redirect()` is typed `never` so `id` is definitely
    assigned — no TS2454). Same #436/#437 class. NOT a fake success: on failure the user hits an explicit
    error redirect, never a false "saved". (Reviewer A note for a FUTURE audit: `saveImportedRecipe` uses
    plain `getDb()` not `withTenant` — pre-existing, out of scope; verify RLS/tenant-scoping of the recipe
    write in a later pass.)
  - **#449 — cook-mode's ×1/×2/×3 scale toggles were visually-selected-only.** They carry `tab-active`/
    `tab-idle` but exposed NO state to assistive tech — a screen-reader user couldn't tell which scale was
    active. Added `aria-pressed={factor===f}` (the single-select toggle-button semantic). **NOTE the run-51
    false-positive correction:** run 51 rejected a scout claiming these tabs "don't exist" and that they
    needed aria-LABELS — the tabs DO exist (cook-mode.tsx:93), and the missing piece was aria-PRESSED (state),
    not a label (the "×N" text already names them). Reviewer B (Sonnet) REQUEST_CHANGES'd my first cut for
    ALSO adding a redundant `aria-label="Scale ingredients by N"` (reintroduces the prior-rejected change +
    label/visible-text drift risk); honored — dropped the label, kept aria-pressed. **LESSON: a prior
    rejection can be RIGHT about the specific fix (no aria-label) while WRONG about the premise (tabs exist);
    separate the two — the real gap was the state semantic, and don't smuggle the rejected change back in.**
  - **#450 — spend `spendByPeriod` "week" branch had zero tests.** Only "month" was covered; the Monday-of-week
    math (`(getUTCDay()+6)%7`, incl. folding Sunday back to the prior Monday) was untested deterministic date
    logic. Added an exact-value test hitting the Sunday-boundary case the offset exists for (Sun 06-14 → Mon
    06-08 week). Two Sonnet reviewers independently hand-verified the calendar arithmetic (2026-06-01 is a
    Monday; all five date→week mappings + sums exact). Extends the module's "pure + exhaustively testable"
    pattern (the #430 UnitConverter precedent).
  - **#451 — mobile Grocery Wrapped (PREMIUM) hid an expired-items-only summary.** The `empty` guard tested
    cooked/spent/topRecipes but NOT `itemsExpired`, so a paying user who let items expire but hadn't cooked/
    spent/saved saw "Nothing yet" while the render path HAD a populated `itemsExpired` warning card it never
    showed. Added `&& stats.itemsExpired === 0`. Reviewer A verified `estSavedCents` needs no separate term
    (derived from cooked meals → 0 when cooked===0, via `Math.max(0, homeCookedMeals * perMealSaving)`); the
    state is reachable (pantry items added via manual/capture can expire with zero spend).
  **LESSON (grep-verdict extraction is a trap):** a shell `grep -oE "APPROVE|REQUEST_CHANGES"` over a
  subagent's raw JSONL transcript matched the PROMPT-ECHO (my own instructions quoting both verdict strings),
  not the final verdict — it falsely showed 3 REQUEST_CHANGES. The reliable read is the completion
  NOTIFICATION's `<result>` block, or a JSON parse of the LAST assistant text block. 4 of the 5 "rejections"
  were phantom; only the cook aria-label one was real.
  **Readiness:** did NOT open the 'ready' issue — the sole open DoD gap is unchanged (reach-gated
  business-case floor #190, base ≈ $33K < $100K at median inputs = downloads/mo = owner GTM, not a buildable
  lever). Confidence statement stays UNCHECKED. 5 real clears + honored 1 review + phantom-rejection lesson =
  a coherent converged run.

- **2026-07-05 (run 51) — 4 file-disjoint clears from a 6-Haiku scout sweep (#435 /support store-404 alias /
  #436 make-action DB-degrade / #437 household server-action uncaught-throw hardening / #438 mobile brand-color);
  all 8 Sonnet reviews (2 per PR) APPROVE first-pass; 0 abandons. No deep audit (run 50 ran a full 6-lens one
  same day, <24h).** Baseline gate green (typecheck 0 across all packages, 871 core tests, scorecard **A**
  as_of 2026-07-03, self-validation 5/5 / 0 unmet). Six read-only Haiku scout lenses (mobile parity,
  monetization/conversion UX, test/eval coverage, design/a11y/taste, artifact freshness, web
  reliability/correctness); pooled → selected the maximal file-disjoint value-bar-clearing set; verified every
  candidate against the code before selecting (two scout claims were REJECTED on verification — see lessons).
  - **#435 — /support was a live store-acceptance 404.** The App Store + Google Play listings publish
    `grocerymanager.app/support` as the Support URL (5 refs across `docs/store/`), but only `/help` existed —
    a reviewer following the link hit a 404 (rejection risk). Added a stable `/support` page that
    `redirect()`s to `/help` (which already carries the FAQ + support email). Fixing the ROUTE (not the docs)
    is correct: the URL is already submitted to the consoles, so the app must serve the path.
  - **#436 — a live premium path violated its own degrade contract.** `generateMealsAction`'s docstring
    promises "everything that can fail degrades to `{ ok: false, error }`", but the pantry+signals `withTenant`
    read sat OUTSIDE the try/catch (the `generateMeals` LLM call 3 lines below already had one) → a transient
    DB blip threw uncaught to the client. Wrapped it (declare-`let` / assign-in-try / return-in-catch idiom;
    reviewers confirmed no TS2454). Same "hunt the uncaught throw" class as #427/#429, now on a web server action.
  - **#437 — two household server actions threw uncaught, one contradicting its OWN comment.** `acceptInviteAction`'s
    doc literally says "any failure sends them back to the household page rather than throwing" yet the admin-DB
    write escaped the guards → error boundary; `createHouseholdAction` was the odd one out vs its already-wrapped
    sibling `createInviteLinkAction`. Both now degrade (redirect / no-op); `redirect()` kept OUTSIDE the try so
    NEXT_REDIRECT isn't swallowed; reviewer A confirmed the entitlement check still fails-closed (a caught throw
    never grants a household). Flag-gated (FEATURE_HOUSEHOLDS) but a docstring lying about behavior is a real
    defect regardless of flag state.
  - **#438 — the mobile nav header + launch spinner were off-brand.** `_layout.tsx` was the SOLE holdout at
    `#13a14a` while every other mobile surface (buttons/icons/logo/app.json) + the web `--brand-solid` use
    `#0c8a3e` (rgb 12 138 62). Visible on every screen + at launch. Aligned both occurrences; `grep 13a14a` →
    0 hits after. White-on-#0c8a3e contrast (~4.45:1) is the design system's documented, app-wide accepted
    ceiling (upgrade.tsx:279) — not a regression.
  **LESSON (verify scout claims against the code before selecting — two were wrong):** (1) the mobile-parity
  scout flagged `apps/mobile/app/index.tsx` `.then(res => res.json())` as an uncaught-crash — but it MISSED the
  `.catch()` two lines down that fail-opens (`setOnboarded(true)`); a non-JSON/5xx response is already handled.
  REJECTED. (2) the design scout flagged cook-mode scaling tabs (×1/×2/×3) as missing aria-labels — but
  cook-mode has no such tabs, and its timer buttons already carry aria-labels. REJECTED. A scout's "bug" is a
  CANDIDATE, not a finding; reading the actual surrounding lines (the catch, the sibling) is what separates the
  2 real clears from the 2 false positives.
  **LESSON (drop speculative conversion levers):** the monetization scout proposed a premium/trial CTA at
  onboarding-FINISH — but that pitches premium BEFORE the user has experienced the core loop (a conversion
  anti-pattern; grocery apps convert after value), and an annual-switch nudge duplicates the already-built H14
  annual-nudge. Dropped both as speculative/redundant rather than shipping churn. Conversion levers must be
  grounded in a real gap, not a plausible-sounding "highest-intent moment."
  **Readiness:** did NOT open the 'ready' issue — the sole open DoD gap is unchanged (reach-gated business-case
  floor #190, base ≈ $33K < $100K at median inputs, owner-GTM not a buildable lever). Confidence statement
  stays UNCHECKED. 4 real clears + 2 correctly-rejected false positives = a coherent converged run.

- **2026-07-05 (run 50) — DEEP AUDIT (6-Haiku lens sweep, due since run 47 ~24h/3 runs) + 2 file-disjoint
  clears (#429 mobile/v1 route error-hardening / #430 units multi-hop test coverage); all 4 Sonnet reviews
  (2 per PR) APPROVE first-pass; 0 abandons.** Baseline gate green (typecheck 0 across all packages, 867
  core tests, scorecard **A** as_of 2026-07-03, self-validation 5/5 / 0 unmet). Six read-only Haiku lenses
  over the whole repo:
  (1) **SECURITY/RLS/Track-G — CLEAN (NO REAL FINDINGS).** Re-verified: all public tables RLS-enabled
  (0002/0010/0016 + 0011–0020 enable at creation); rate limits on every paid/expensive/auth route (incl. the
  once-open discover POST swipe write, 30/60s — confirmed closed); every external `fetch()` carries an
  `AbortSignal.timeout` (the #422 sweep holds — 8 modules re-checked); timing-safe webhook sig verification
  (Stripe/RevenueCat/Gmail); server-side entitlements; captcha fail-closed in prod; DIRECT_DATABASE_URL the
  only optional env, with a loud fallback. No secret committed.
  (2) **CORRECTNESS/DEAD-CODE — CLEAN.** Quantity-parse siblings (cook/consume/import) consistent; EWMA
  repurchase-cadence rate + spoilage ceiling by design; reorder/nutrition/vision-reconcile/units all correct;
  no TODO/FIXME debt on live paths. (Re-confirmed the recurring by-design items so a future scout doesn't
  re-flag them.)
  (3) **ARTIFACTS/FRESHNESS — CLEAN.** Pricing matches billing config EXACTLY across every surface
  (499/3999 mo/yr, 999/7999 Family == BUSINESS_CASE == store metadata == landing page); PREMIUM_FEATURES
  matches docs; BUSINESS_CASE_SUMMARY YAML valid, arr_year1.base 33450 reconciles with the body (730 × $3.82
  × 12). No drift.
  (4) **PERF/DEPS — CLEAN.** Hot paths (home/digest/pantry) already `Promise.all`-parallelized; zero
  `as any`/`: any` on data boundaries; lint --max-warnings=0; lucide pinned 0.460.0. The 279KB edge
  middleware + missing CI perf-budget gate stay the sole below-A (perf, non-ship-critical) item — tracked in
  #320, correctly NOT re-litigated (the middleware auth-rewrite is break-the-whole-site risk for an
  unattended run; the CI gate is a `.github/` owner item).
  (5) **DESIGN/A11Y — only low-value internal-admin items (deferred).** admin/growth + admin/waitlist
  section-title `<p>`s (WCAG 1.3.1) + two raw `text-amber-600`/`text-green-600` tokens on admin/growth. All
  admin-only, owner-internal, never store-reviewed — historically deferred (run 45) as reasonably out of
  scope; skipped again (not a clear value-bar clear; a future dedicated admin design/dark-mode pass, not a
  per-element hack).
  (6) **MOBILE/FUNCTIONAL — 2 real findings, BOTH shipped as #429.** (a) three routes called the DB OUTSIDE
  any try/catch (mobile/recipes/[id], v1/pantry, v1/list) → a transient DB/upstream failure escaped as an
  uncaught HTML 500 to a JSON mobile client — the exact "hunt the uncaught throw" class #427 hardened for
  auth/profile/onboarding but these were missed; (b) six bare `catch {}` blocks (cooked/digest/discover-POST/
  push-token×2/v1-auth-token) returned a 500 with NO server-side log — the #427 "blind 500 = half the fix"
  G3 gap. Wrapped (A) + `serverError()` and logged (B) + `console.error`. Discriminated-union mobile-cast
  audit (the #426 class) came back CLEAN — discover/spend/plan/wrapped all guard both arms.
  **#429 — completing a hardening sweep is legitimate high-value work, not churn.** A prior run (#427) fixes
  the same class on SOME routes; the disciplined follow-up is to grep the WHOLE surface (`grep -rn catch
  apps/web/app/api/mobile apps/web/app/api/v1`) and finish it, distinguishing the routes that still need it
  from the ones deliberately left (fail-open tier degrade §32; JSON-parse-400 client errors; JWT-verify
  helpers that MUST stay silent-null — logging invalid tokens = enumeration/spam noise). Both reviewers
  independently confirmed the left-as-is set was correct. **LESSON (reusable): when hardening a class of
  route, enumerate EVERY handler + classify each (needs-wrap / needs-log / correctly-silent) — a
  "completed" sweep from a prior run can still leave siblings, and the silent-by-design cases (token verify,
  parse-400) are as important to NOT touch as the real gaps are to fix.**
  **#430 — a foundational pure engine can hold a genuinely-untested branch even in an 82%-covered module.**
  The UnitConverter's `item_base` 2-hop BFS chain (factor product + min-confidence + reverse-edge traversal)
  had zero tests; only identity/global/1-hop-item/heuristic/null were covered. Added 4 exact-value tests
  (forward chain, reverse-edge chain, direct-beats-indirect precedence, the `unit()` getter). Reviewer B's
  useful note: the two live callers (log-cook/ingest) currently pass no `itemConversions` (defaults `[]`) and
  no DB table backs `ItemConversion` yet — so item/item_base are **dormant-but-real** pure infrastructure
  (tested engine, not yet fed live data — the H11-cohort-builder pattern). Testing it extends the file's own
  documented "pure + dependency-free so it's exhaustively testable" pattern; NOT an impossible case.
  **Readiness:** did NOT open the 'ready' issue — the sole open DoD gap is unchanged (reach-gated
  business-case floor, base ≈ $33K < $100K = downloads/mo = owner GTM #190); the monetization/business-case
  lens re-confirmed no buildable floor-mover (prices/tiers/conversion/retention/referral levers all built).
  Confidence statement stays UNCHECKED. A full 6-lens deep audit (5 CLEAN, 1 design deferred, 1 mobile
  cluster shipped) + 2 real reviewed clears = a coherent, converged run.
- **2026-07-04 (run 49) — 5-Haiku scout sweep + 2 file-disjoint clears (#426 mobile Discover paywall
  dead-end / #427 mobile-route uncaught-throw hardening); 0 abandons; 6 Sonnet reviews (4 first-pass +
  2 re-review) all APPROVE.** No deep audit (run 47 same day). Baseline green (typecheck 0, 867 core
  tests, scorecard A, self-validation 5/5). Five lenses. Security **CLEAN** (only known/owner items:
  Redis rate-limit, Next.js CSP constraint, CORS-lockdown-by-omission). Monetization **reach-gated
  reconfirmed** — the mobile Family-tier "parity gap" is owner-config-gated via a RevenueCat OFFERING
  (native IAP), not a Stripe code change, so forcing a Family button that maps to nothing would be a
  broken path; correctly skipped. Artifacts clean.
  **#426 — a discriminated-union API response cast to just its happy arm silently swallows the other.**
  `discover.tsx` cast `/api/mobile/discover`'s response to `{ recipes: DeckCard[] }`, but the route
  returns `{ recipes } | { upgradeRequired: true }`. For a free user `data.recipes` was undefined → `[]`
  → the screen showed the "All caught up / add pantry items" EMPTY state instead of the paywall — a dead
  conversion funnel where the free→paid moment was invisible. Fix types the response as the full union
  (so `tsc` forces both arms) + renders the upgrade prompt like the sibling premium screens
  (plan/spend/wrapped). **LESSON (reusable): when a client consumes a discriminated-union API, TYPE it as
  the union, never `as HappyPathShape` — the cast compiles but drops every other arm at runtime. A
  "premium feature is unreachable on mobile" bug hides as a cheerful empty state.**
  **#427 — mirror the FULL reference route, not just its try/catch skeleton.** Three mobile routes
  (auth/profile/onboarding) called the DB outside any try/catch → an uncaught 500 on a transient DB
  failure, the exact thing the repo's "hunt the uncaught throw" rule forbids and which the sibling routes
  (discover, v1/auth/token) already guard. Wrapped each to a controlled 503. **Reviewer B's non-blocking
  should-fix earned its keep:** the first cut used bare `catch {}` — a clean 503 but ZERO server-side
  trace on the auth/onboarding paths most worth diagnosing, unlike the `serverError()` G3 convention +
  the `discover` route which both `console.error` before returning the generic message. Applied it
  (cycle 2): `catch (err)` + `console.error("[mobile/<route>]", err)`. **LESSON: copying a reference's
  ERROR SHAPE (generic message + status) without its LOGGING trades an uncaught-500 for a blind-503 —
  half the fix. The repo's error-hygiene bar is: log full context server-side, return a generic message
  to the client. Bind the catch and log.** Also reconfirmed the recurring **admin dark-mode brand-text
  trap** (run 48 #424): the design scout re-flagged admin `text-brand-solid` stat-cards/links; still the
  SAME surface-token-as-foreground issue (`brand-solid`/`-hover` darker = worse on the near-black admin
  bg), correctly deferred to a dedicated dark-mode foreground pass, not a per-link swap.
  **Readiness:** did NOT open 'ready' — sole open DoD gap unchanged (reach-gated floor #190, owner-GTM);
  confidence statement stays UNCHECKED. **Housekeeping note:** #426 merged mid-run, so branch #427 was
  rebased onto latest main (force-with-lease) before auto-merge to avoid a stale two-dot diff showing a
  phantom discover.tsx revert (GitHub's three-dot PR diff was already correct; the rebase is belt-and-braces).
- **2026-07-04 (run 48) — 4-Haiku scout sweep + 2 file-disjoint clears merged (#422 fetch timeouts /
  #423 mobile README freshness); 1 candidate (admin contrast #424) correctly ABANDONED on an adversarial
  reviewer catch. No deep audit (run 47 same day).** Baseline gate green (typecheck clean, 865 tests,
  scorecard A, self-validation 5/5). Four lenses (design/a11y, correctness/coverage, mobile+artifacts,
  security/Track-G+monetization). Security **CLEAN**, monetization **reach-gated reconfirmed** (no
  buildable floor-mover, #190 owner-GTM), design mostly clean.
  **#422 — the LAST bare external `fetch()` calls got timeouts (documented hard rule).** The correctness
  scout found four modules calling `fetch()` with NO `AbortSignal.timeout`: `nutrition/fdc.ts` (FDC macro
  lookup, cook-log request path), `recipe/provider.ts` (TheMealDB discovery), `email/index.ts`
  (Resend/SendGrid/Postmark), `content/scheduler.ts` (Twitter/Buffer/Typefully). A hung upstream could
  stall the serverless fn / job past the platform budget — the exact failure the repo rule ("every
  external call needs a timeout SHORTER than the serverless budget") forbids. Added
  `signal: AbortSignal.timeout(N)` to each (5s user paths, 8s background) + 2 keyless guard tests
  asserting the signal is passed. Reviewer B verified EVERY `fetch(` site in the repo now carries a
  timeout — this closes the invariant. **LESSON (reviewer-caught, load-bearing): a timeout value must be
  UNDER the smallest serverless budget, not AT it.** First cut used 10_000ms for the background paths —
  Reviewer A (correctly) blocked it: Vercel Hobby is 10s and `sendEmail` has call paths with NO
  `maxDuration` override (growth/email route, the landing waitlist action), so a 10s in-process abort
  RACES the platform's uncatchable 504 and may lose. Dropped to 8_000ms to match the codebase's own
  standard (`llm/client.ts` `DEFAULT_LLM_TIMEOUT_MS = 8_000`, "comfortably under the smallest function
  limit"). Fix → 2/2 approve. When adding a fetch timeout, copy the 5s/8s tier from the existing
  `integrations/*` + `llm/client.ts` constants; never pick the raw budget number.
  **#423 — mobile README was a stale living-artifact.** `apps/mobile/README.md` still said "typecheckable
  skeleton" whose "screens below are placeholders" + an `index.tsx` that "demonstrates scaleMeasure" + a
  "Placeholder pantry screen" — all false since Track B shipped 2026-06-24 (18 real API-backed RN screens;
  index.tsx no longer imports scaleMeasure; pantry.tsx is a full screen). Rewrote to reality (real
  status, lib/ layout, `/api/mobile/*` + RevenueCat IAP, npm/own-lockfile note). Both reviewers verified
  the NEW text doesn't over-claim (IAP correctly framed as degrade-to-"coming-soon", not live payments).
  **#424 — the ABANDON was the run's discipline.** Admin `/admin/growth` had two `text-sm text-brand-solid`
  "View all" links at 4.45:1 (< AA 4.5:1 on 14px). Swapping to `text-brand-solid-hover` fixes LIGHT mode
  (→6.4:1) but Reviewer A caught a DARK-mode REGRESSION: `--brand-solid`/`-hover` are documented SURFACE
  tokens (darker = correct as a *background* under white text). Used as `text-*` FOREGROUND on the dark
  near-black page bg, darker = LESS contrast — `brand-solid-hover` computes 2.94:1 vs `brand-solid`'s
  3.82:1 (both already fail AA in dark). So the swap trades a light-mode fix for a dark-mode regression;
  a proper mode-aware foreground token over-scopes two internal admin links. Closed #424, clean tree.
  **LESSON (extends the recurring #0a6e33 trap): `brand-solid`/`brand-solid-hover` are SURFACE tokens —
  correct for `bg-*` (button/badge) where hover=darker, WRONG as `text-*` foreground in dark mode where
  darker=worse. A `text-brand-solid*` contrast "fix" must be checked in BOTH themes (the `.dark` var set
  + near-black bg), not light-only. Dark-mode brand-text contrast is a real app-wide question for a
  dedicated pass, not a per-link hack.** Also: the marginal candidate of a run is exactly where an
  adversarial reviewer earns its keep — abandoning it (partial batch) is a SUCCESS, not a miss.
  **Readiness:** did NOT open 'ready' — sole open DoD gap unchanged (reach-gated floor #190, owner-GTM);
  confidence statement stays UNCHECKED. **Housekeeping note:** the proxy `git push --delete` is still
  flaky ("Everything up-to-date" no-op) — `origin/claude/admin-link-contrast-aa` (+ ~14 older merged
  branches) linger with CLOSED/merged PRs; harmless (cannot auto-merge), delete when the proxy cooperates.
- **2026-07-04 (run 47) — DEEP AUDIT (6-Haiku lens sweep, due since run 45 ~24h) + 3 file-disjoint clears
  (#418 a11y contrast / #419 experiment-stats sign-bug guard / #420 mobile cook-log parity); all 7 Sonnet
  reviews (incl. 1 re-review) APPROVE; 0 abandons.** Baseline gate green (scorecard **A**, self-validation
  5/5, 0 unmet). Six read-only lenses over the whole repo — security/RLS+Track-G **CLEAN**,
  correctness/functional **CLEAN**, artifacts **NO DRIFT**, monetization **REACH-GATED reconfirmed** (no
  buildable floor-mover; base ≈ $33K < $100K = downloads/mo = owner GTM #190), design/a11y 1 real finding
  (→ #418), mobile+perf+test 2 real findings (→ #419, #420) + 2 false positives rejected.
  **#418 — the brand-solid-on-white AA sweep is now complete.** `text-brand-solid` (4.45:1 on white, UNDER
  AA 4.5:1) → `text-brand-solid-hover` (6.4:1) on the last four white-bg CTA outliers (onboarding finish, two
  home CTAs, blog CTA). Same calibrated class as #372/#390/#406; cook-mode + share/recipe already used the
  fixed token. Reviewer B independently recomputed 4.448:1 (a genuine FAIL, not borderline). Remaining bare
  `text-brand-solid` are admin stat-numbers/links (not bg-white CTAs) — correctly out of scope.
  **#419 — earn a regression guard for previously-buggy pure math via a PROPERTY, not just point values.**
  stats.ts had a documented past inverted-sign bug in zFromAlpha's non-tabulated quantile path but zero tests.
  The load-bearing guard is `minSampleSizePerArm` MONOTONICITY (higher statistical power ⇒ MORE samples), with
  power 0.85 chosen deliberately to force the approximation path (1−0.85=0.15 ∉ the lookup table). Under the
  old sign the buggy n85≈75 < n80=684, so the monotonicity assertion fails deterministically. LESSON (reusable):
  when guarding numeric code with a history of a subtle bug, assert an INVARIANT the bug violates (monotonicity,
  symmetry Φ(z)+Φ(−z)=1, clamp bounds) in addition to pinned point values — a point value can accidentally
  match a bug, an invariant can't. Reviewer A reimplemented the module + simulated the bug to confirm.
  **#420 — mobile cook-log parity: the app-layer side-effect endpoint mirrors the proven web action.** Mobile
  had cook-mode (view) but no way to LOG a cook, while cooked.tsx promised the button — a broken promise on a
  ticked-[x] "full parity" track (Track B). The fix reuses the SAME core `logCook` inside `withTenant` that the
  web `logCookedRecipe` server action uses, wrapped in the established mobile-route pattern (verifyMobileToken +
  rateLimit + parseJsonBody/requireString + serverError). LESSON: a "full parity" aggregate box can hide an
  action-level gap inside an existing screen — a deep-audit functional lens catches these; the fix is cheap
  because the core engine is shared (`@gm/core`), so the new transport is thin glue over already-tested logic.
  **Two Reviewer-B design catches worth keeping:** (a) placement matters for irreversible side-effects — web
  deliberately gates "I cooked this" at the BOTTOM (after the step-through) because a tap writes an
  append-only ledger drawdown that's unrecoverable in the UI; the first cut put it under the title, removing
  that friction gate. Mirror the sibling web surface's *interaction design*, not just its data call. (b) a
  server param the client never sends is a silent-wrong scope gap — the route clamped `servings` but the client
  hardcoded 1, so batch macros were always wrong; wire the real input (a 1–12 stepper) OR drop the param.
  **Two false positives rejected (recurring Haiku-scout failure modes):** (1) recipe `alt=""` next to an
  adjacent title is the CORRECT decorative choice — `alt={title}` would be redundant SR noise, NOT a WCAG fix.
  (2) mobile "771 TS errors" was deps-not-installed — a scout ran `tsc` without `npm ci` (mobile is out of the
  pnpm workspace); the CI mobile job installs first + is green on main. ALWAYS `cd apps/mobile && npm ci` before
  trusting a mobile typecheck, and let a green CI mobile job on main override a phantom "hundreds of errors."
  **Readiness:** did NOT open the 'ready' issue — the sole open DoD gap is unchanged (reach-gated business-case
  floor, owner-GTM #190); monetization lens re-confirmed no buildable floor-mover. Confidence statement stays
  UNCHECKED. A full 6-lens deep audit + 3 real, reviewed clears = a coherent, converged run.
- **2026-07-04 (run 46) — 3 file-disjoint clears (open-issue backlog + a lean 3-Haiku scout sweep), all
  2/2 first-pass, 0 abandons. No deep audit (run 45 <24h).** Converged repo; worked the highest-value
  concrete candidates rather than a full 8-scout sweep (run 45 deep-audited same-day-1). Baseline gate green
  (scorecard A, self-validation 5/5).
  **#404 (closes #370) — made the §32 signup guarantee TESTABLE.** Run 45's deep audit had already found the
  §32 failure mode absent-by-construction on the signup path, but named the one gap: no regression test,
  because the best-effort referral attribution was inline in a server action and `apps/web` has no unit-test
  runner. Fix = the pattern the issue itself prescribed: extract the contract into `@gm/core`
  (`attributeReferralBestEffort`, packages/core/src/personalization/referral.ts) with the DB I/O
  DEPENDENCY-INJECTED (core must not import @gm/db), so the never-throw guarantee is provable by 8 unit tests
  that force each injected dep to reject AND throw synchronously → helper resolves `{attributed:false,
  reason:"error"}`, never propagates. LESSON (reusable): to earn a regression guard for an app-layer
  best-effort/side-effect contract that `apps/web` can't test, move the PURE contract into `@gm/core` with
  injected I/O closures — the app passes the real `getAdminDb()` closures, core stays DB-free + covered. A
  discriminated-union result (`no-code`/`invalid-code`/`unknown-referrer`/`error`/attributed) the caller
  IGNORES is still worth it: it lets the test assert WHICH branch fired, not just "didn't throw."
  **#406 — a11y file-input labels (WCAG 3.3.2 Level A).** `/add-receipt` + `/scan` file inputs had sibling
  `<label>`s with no htmlFor/id → unlabeled file picker for SR users on the two first-value capture surfaces.
  Explicit htmlFor/id (not wrapping) preserves the exact CSS box model. Same calibrated class as #383/#385/#390.
  **#407 — §28 Stripe-webhook fail-loud on an unrecognized price.** The webhook matched FAMILY→ANNUAL then
  SILENTLY defaulted every other active price to `premium_monthly` — so if STRIPE_PRICE_ANNUAL/FAMILY were
  unset (`.optional()` env) or a sub hit the webhook against an unknown price, an annual/family buyer was
  mislabeled monthly with the misconfig hidden. Now matches all 3 prices explicitly + LOUD `console.error`s
  the anomaly (userId/priceId/which envs set — booleans, no secret values), still grants base premium (§32:
  paid → never deny) at the lowest tier (never over-grant). NOT impossible-case: the Customer-Portal
  plan-switch path (Reviewer B found this) bypasses the checkout price-guard entirely. Mirrors #380
  captcha-fail-loud / #378 HMAC-fail-closed — the standing §28 "unrecognized → visible, never silent".
  **Gate value:** #404 Reviewer A raised a conditional REQUEST_CHANGES ("is `referrerUserId` read after the
  extracted block?") — resolved by pasting the VERBATIM source (it was `const`, block-scoped, discarded; the
  only following code is `signIn`, which reads username/password only). LESSON (reinforced): when a reviewer
  flags a possible extraction regression, answer with the real source, not an argument. Also added A's suggested
  recordReferral sync-throw test. Both #407 reviewers independently confirmed no secret leakage + fail-safe
  entitlement direction.
  **Readiness:** did NOT open the 'ready' issue — the sole open DoD gap is unchanged (reach-gated business-case
  floor, base ≈ $33K < $100K, owner-GTM #190). Confidence statement stays UNCHECKED. Validation 5/5, 0 unmet.
  A focused, coherent, converged run (3 real clears, all reviewed) = success.
- **2026-07-03 (run 45) — DEEP AUDIT (5-scout lens sweep, due since run 41 >~24h) + 1 file-disjoint a11y
  clear (#390 heading semantics). Both Sonnet reviewers 2/2 first pass; 0 abandons. 2 scout findings
  correctly REJECTED on verification.** Deep audit due (last run 41; runs 42/43/44 same-day folded, this
  is the 4th run since). Baseline gate green (typecheck clean, tree clean, scorecard **A** as_of 2026-07-03,
  self-validation 5/5, 0 unmet). Five read-only Haiku lenses over the whole repo:
  (1) **SECURITY/RLS/Track-G — CLEAN (NO REAL FINDINGS).** Scout re-verified: all 33+ public tables
  RLS-enabled with correct policies (0002/0010/0016_rls); rate limits on auth/signup/mobile/growth;
  timing-safe webhook sig verification (Stripe `constructEvent`, RevenueCat, Gmail HMAC); server-side
  entitlements via `isPremium(signals)` (DB-written by webhooks only, never client-supplied); mobile JWT
  HMAC-SHA256 timing-safe + expiry; captcha fail-closed in prod; no schema/stack leakage; CSP/HSTS/X-Frame/
  nosniff headers; parameterized queries throughout. Prior #378/#379/#380 fixes confirmed still on main.
  (2) **CORRECTNESS/FUNCTIONAL — 1 finding, REJECTED (plausible-but-wrong on a deliberate model).** Scout
  claimed `ewmaConsumptionRate` (depletion.ts:76-92 + persist.ts:98) "inflates the rate 3.3× when a recipe
  consumption is logged, because it learns from purchase intervals and ignores the explicit −delta consumption
  events." FALSE — this misreads the intended design, documented at persist.ts:94-97 + depletion.ts:88: the
  forward-projection rate is DELIBERATELY learned from **repurchase cadence** (qty bought ÷ days to next
  purchase) because it captures TOTAL consumption incl. the large unlogged tail (users under-log cooks); the
  EXACT on-hand (`estimateOnHand`, `onHandAtLast = events.reduce(+delta)`) ALREADY subtracts every logged −delta,
  and the learned rate is applied ONLY to project forward AFTER the last event — so there is no double-count and
  no inflation in the actual on-hand. Switching the rate to "logged −deltas only" would REGRESS the common
  under-logging case. **LESSON (recurring, runs 42/43/44): a Haiku correctness scout will produce a plausible
  "bug" against a deliberate, commented modeling choice — VERIFY the design intent (read the doc-comment at the
  site + trace how the value is actually USED) before treating it as real. The repurchase-cadence-as-consumption
  assumption is intentional here, not a defect.**
  (3) **MONETIZATION — REACH-GATED re-confirmed (no buildable floor-mover), consistent with runs 38–42.** The
  scout surfaced ~5 "unbuilt levers" (Instacart Impact affiliate, higher-freq expiry nudge, quarterly tier,
  lifetime deal, per-serving cost) but its OWN honest math lands them at ~$50–68K stacked — still below the
  $100K floor — and each is speculative pre-launch AND either owner-dependent (Instacart Impact account, Stripe
  price IDs, Appsumo campaign) or scope-creep against the owner's locked subscription-only v1 (lifetime/add-on).
  The built levers (good-better-best + annual, context paywall, trial-eligibility, referral trial-days,
  H14/H15 retention, experiments) are complete; the ~$67K gap is downloads/mo = owner GTM (#190), NOT code.
  No lever cleared the value bar this run.
  (4) **DESIGN/A11Y — 2 findings, BOTH shipped as one coherent PR #390.** Three visually-present section titles
  were non-heading elements (WCAG 1.3.1 Level A): landing pricing `Free`/`Premium` tiers were `<p>` → `<h3>`
  (nested under the pricing `<h2>`); cook-page `Made it?` log-cook title was `<div>` → `<h2>` (sibling of the
  already-`<h2>` `Out of something?`). Reviewer A confirmed ~30+ other `.section-title` usages are ALREADY
  `<h2>` — these 3 were the remaining outliers on the two highest-traffic surfaces (conversion landing + core
  cook loop); zero visual change (`.section-title` is a plain typographic utility, no element selector).
  (5) **ARTIFACTS/COVERAGE — CLEAN (NO REAL FINDINGS).** Pricing strings match billing config (499/3999/999/7999
  == BUSINESS_CASE == upgrade page); feature-gating docs match `PREMIUM_FEATURES`; ~828 core test cases; only
  genuinely-untested files are a thin LLM wrapper (logic tested via a fake generator) + a types-only module.
  **Non-blocking follow-up (recorded, not shipped):** Reviewer B noted `admin/growth`, `admin/waitlist`, and
  `help/page.tsx:378` still have `<p className="section-title">` outliers — low-value (internal admin panels +
  tertiary help), reasonably out of scope for the high-traffic PR; a future fast-follow if a design pass revisits.
  **Readiness:** did NOT open the 'ready' issue — the sole open DoD gap is unchanged (reach-gated business-case
  floor, base ≈ $33K < $100K, owner-GTM #190); the monetization lens re-confirmed no buildable lever moves it.
  Confidence statement stays UNCHECKED. Closed #359 (all three §28 fixes #378/#379/#380 verified on main). A
  quiet, coherent, converged run (full 5-lens deep audit + 1 real a11y clear + 2 findings correctly rejected) = success.
- **2026-07-03 (run 44) — 1 file-disjoint clear (#386 vision anti-hallucination eval); the load-bearing
  work was a git-hygiene catch + refusing a padding change. No deep audit (run 41 <24h).** Lessons:
  - **STALE local `origin/main` manufactures phantom regressions — always `git fetch origin main` FIRST.**
    The env cloned the repo and checked out the run-43 tip (`d48c0dd`/#385) as a DETACHED HEAD, but the local
    `main`/`origin/main` refs still pointed at `#369` (14 commits behind, pre-runs-42/43). I branched my feature
    branch from `main` → it was based on stale #369. Reading `services/workers/src/index.ts` on that branch showed
    the OLD `stub()` (pre-#379), which looked EXACTLY like #379's merged "fail-loud notImplemented()" fix had been
    reverted — a scary phantom "synthetic-green regression." The tell: `git merge-base --is-ancestor 7dcabe9 main`
    = NO and `git branch -a --contains d48c0dd` = EMPTY (a dangling detached tip no branch contained). `git fetch
    origin main` fast-forwarded origin/main #369→#385, `--is-ancestor` then confirmed #379 IS on main (no
    regression); `git branch -f main origin/main` + `git rebase main <branch>` fixed the base (clean — file-disjoint).
    **RULE: at run start, `git fetch origin main && git branch -f main origin/main` (or cut branches from
    `origin/main`, never local `main`) BEFORE trusting local main or diagnosing any "a merged fix is missing" —
    a stale ref fabricates the regression. Confirm a suspected revert with `--is-ancestor <commit> origin/main`
    (after fetch), NOT by reading a file on a possibly-stale-based branch.**
  - **A Haiku scout's severity framing must be re-verified, not trusted (the run-43 lesson, again).** The
    reliability scout flagged 3 server actions (capture, applyScan, addNamesToList) that call `captureToList` /
    `applyVisionScan` without a try/catch as "silent data loss / leaves the pantry inconsistent." Both framings
    are FALSE: (a) `apps/web/app/error.tsx` (+ per-route `error.tsx`) is a graceful boundary — a throw surfaces a
    friendly error page, never silent loss; (b) `applyVisionScan` runs inside `withTenant(...tx...)`, so a mid-way
    throw ROLLS BACK the whole apply — no partial/inconsistent state. The deliberate inline-`{status:"error"}`
    pattern exists ONLY in `add-receipt/actions.ts` because receipt PARSING fails often (LLM/photo quality) and
    earns a rich `friendlyError` mapper; deterministic capture + a transactional DB write fail rarely, so the
    error-boundary fallback is a reasonable, deliberate choice — NOT a defect. Passed as modest polish with
    core-flow regression risk (headless, no browser verify). VERIFY the boundary/transaction context before
    treating a "no try/catch" as a bug.
  - **Two more scout candidates PASSED on judgment (not padding, not scarcity):** (i) CSP `script-src`
    `'unsafe-inline' 'unsafe-eval'` (`next.config.mjs`) — a real hardening gap, but removing it needs a
    nonce-based CSP + middleware rework + a REAL-BROWSER hydration check; the break-the-whole-site risk is too
    high for an unattended run with no e2e verify. Legit future work (own scoped run w/ browser verification).
    (ii) mobile hex-color centralization (18 `StyleSheet.create` files → a `colors.ts` theme) — real
    maintainability, but a large cosmetic churn touching the native app, whose CI only typechecks (the run-39
    BUILDS≠WORKS Expo-config trap). Not a clean unattended clear. Web UI + Track-G both re-confirmed CLEAN.
  - **The shipped clear (#386):** the vision scan eval measured only RECALL; it never measured PRECISION, even
    though `detect.ts`'s whole design (per-item presence + 2D bounding boxes: "it can't box something that isn't
    there") exists to suppress hallucination, and a phantom item silently pollutes a real user's pantry. Added a
    conservative human-verified `absent` list per golden fixture (large produce that can't be occluded in a
    drawer, so a detection is a true phantom — I READ both fixture jpgs to author it; skipped ambiguous items like
    the door-shelf eggs / pale bottles that could be milk) + a second live-Gemini `it` asserting no-hallucination
    pass-rate>=0.8, mirroring the recall test + harness. RUN_EVALS-gated (scheduled evals workflow).
- **2026-07-03 (run 43) — 3 file-disjoint clears (non-AI quota bug #382 + a11y labels #383 + mobile fetch
  timeouts #384), all 2/2 Sonnet, 0 abandons. No deep audit (run 41 ran one <24h ago).** Lessons worth
  keeping:
  - **A daily-*AI*-quota gate on a *non-AI* endpoint is a real bug, not a paywall.** discover + cook-tonight
    call only TheMealDB + deterministic ranking, yet `checkLlmQuota` was charging them and returning "Daily
    AI limit reached. Upgrade" — falsely blocking a free journey. When auditing quota/spend gates, verify the
    gated path ACTUALLY invokes the expensive resource (grep the handler body for the LLM client / generator);
    a gate that protects nothing but blocks the user is a bug. The per-minute `rateLimit` is the correct tool
    for bounding a fan-out of free external calls — the daily AI quota is not.
  - **Don't move a rate-limit increment to "after success" to make it a consumption meter.** A scout proposed
    it; rejected — charging on admission is the abuse protection. Moving it after the LLM call lets an attacker
    hammer the endpoint and only be charged on success. Admission-gating is by-design, not a bug.
  - **Verify every scout claim against the code before building — Haiku scouts mix real finds with false
    positives.** The same reliability scout that surfaced the genuine #382 bug also claimed "discover/cook-
    tonight don't pass allergens to rankRecipes" (FALSE — line 107/87 pass `allergens: model.allergens`). One
    clear false positive in a report is a signal to independently re-verify ALL of its claims, not to trust
    the rest.
  - **On mobile (Hermes), prefer AbortController + setTimeout over `AbortSignal.timeout()`.** The static
    `AbortSignal.timeout` has spotty Hermes support and typecheck won't catch a runtime gap; the manual
    controller+timer pattern is universally supported. Default a caller-supplied `signal` to opt out, and
    `clearTimeout` in `finally`.
  - **Deferred, verified-real for a future run:** the reorder `minIntervalDays` throttle is inert in prod —
    `queries.ts:1574` hardcodes `lastSuggestedAt: null` (no `reorder_policies.last_suggested_at` column), so
    `predict.ts:81` never throttles. Needs a migration + a decision on WHEN to stamp the column; unclear
    user-facing severity (cosmetic if suggestions are on-demand display, real spam if they drive push). Its
    own scoped run.
- **2026-06-23 — Never edit `.claude/` or `.github/` in an unattended run.** Files under those
  paths are treated as "sensitive" and trigger a permission prompt a headless cron run can't
  answer, which hangs the whole run. Keep loop memory at `docs/autonomous-loop/LOOP_MEMORY.md`
  (here), `IMPROVEMENT_LOG.md` + `PENDING_OPS.md` at repo root, and never recreate/edit the CI
  workflow (it already exists). Set branch protection via `gh api` (a CLI call), never by editing
  workflow files.
- **The gate is `pnpm -r run typecheck` · `pnpm -r run test` · production `next build`** (with the
  missing-export grep). `next build` needs `NODE_ENV=production` + a dummy `DATABASE_URL`.
- **Default branch is `main`** (protected, requires the `verify` check). Branch
  feature work off it; PRs auto-merge once `verify` is green + both reviewers approve.
- **2026-06-23 — Check sister modules for consistency before declaring a bug fixed.** The unicode
  fraction bug in `cook.ts` only showed up because `consume.ts` already had the correct wider set.
  When a module handles something correctly, grep for analogous code in related modules that might
  have drifted — `parseMeasure` vs `scaleMeasure`/`parseQtyToken` was the canonical example.
- **2026-06-23 — IPv4-mapped IPv6 is a silent SSRF bypass in URL guards.** Node's WHATWG URL parser normalizes `::ffff:127.0.0.1` → `[::ffff:7f00:1]` (all-hex), so text guards checking for `127.` / `10.` / `169.254.` never fire. Always add `host.startsWith("[::ffff:")` alongside the IPv4 range blocks in any SSRF guard.
- **2026-06-23 — Mixed-number + unicode fractions are a recurring blind spot.** All three modules (`cook.ts`, `consume.ts`, `import.ts`) handle the same set of quantity formats, but only `cook.ts`'s `NUM` regex originally had `\d+\s*[½¼…]`. When adding or auditing unicode fraction handling, always check all three modules. The pattern to look for: a character class like `[½⅓⅔¼¾⅛⅜⅝⅞]` used alone without an adjacent `\d+\s*` prefix to handle the mixed-number case.
- **2026-06-23 — Keyword rules need whole-word guards when a substring could match a food.** `matchShelfLifeRule` uses `n.includes(k)` on a space-padded name. A keyword like `"batter"` matches "batteries" (intended) AND "pancake batter" (wrong). Fix: wrap keywords in spaces — `" battery "` / `" batteries "` — so they require whole-word boundaries. When auditing keyword tables, check each keyword against common food terms that share its substring.
- **2026-06-23 — Space-padding both sides does NOT prevent false positives when the keyword is a leading word in a food name.** `"pad "` (trailing space) matched "pad thai" because `" pad thai sauce "` contains `"pad "` at position 1. Switching to `" pad "` (both spaces) ALSO matches because the word boundary still fires: `" pad thai "` starts with `" pad "`. The fix for this class of problem is (a) switch to a more specific longer phrase (`"heating pad"`, `"nursing pad"`), or (b) use the plural form (`" pads "` doesn't match "pad thai" since there's no "s"). Audit: a short keyword that is also the first word of a common dish is the highest-risk pattern in the shelf-life table.
- **2026-06-23 — Range-drop regex must handle unicode fraction high-ends.** `parseMeasure` in `consume.ts` has a range-drop step that strips the high end of ranges like `1-2`, `1/2-3/4`. The old regex `(?:\d+\s+)?\d+(?:[\/\.]\d+)?` missed unicode fractions (`¾`, `1½`) as high-ends, causing the unit to be silently dropped. Fix pattern: add `(?:\d+\s*)?[½⅓⅔¼¾⅛⅜⅝⅞]` as the first alternative before the numeric-only alternative. When any regex handles the low-end of a range via a leading-quantity match, always audit the range-drop for matching high-end coverage.
- **2026-06-23 — Diet-keyword false positives on plant-based compound foods.** `dietExclusions(["vegan"])` returns single-token keywords like `"butter"` and `"milk"`. The token-subset matcher (`{"butter"} ⊆ {"peanut","butter"}`) causes `"peanut butter"` to trigger the butter exclusion, wrongly filtering vegan-safe recipes. Fix: add a separate `dietKeywords` field to `RankPrefs` with a `PLANT_BASED_COMPOUND_TOKENS` allowlist; use token-subset for the allowlist check too so qualified strings like `"2 tbsp peanut butter"` are also exempt. True allergens use the unchanged `allergens` field so peanut-allergy safety is unaffected. Tracking: `use-it-up/page.tsx` currently passes no `prefs` to `rankRecipes`, so diet/allergen filtering is completely absent there — separate fix needed.
- **2026-06-23 — Always audit all callers of `rankRecipes` when adding prefs support.** When a prefs-related fix lands on `recipes/page.tsx`, grep for all other callers and verify each also passes prefs. `use-it-up/page.tsx` was the known straggler (now fixed in #16). If new pages call `rankRecipes`, verify prefs are threaded through.
- **2026-06-24 — Parallel agents sharing a filesystem cause git lock conflicts.** When multiple background agents all `git checkout`, `git add`, and `git commit` on the same working directory simultaneously, they collide on `.git/index.lock`. A stuck agent's output file stops growing — if it hasn't grown in 10+ minutes it's safe to take over its branch (reset to `origin/main`, re-apply the edits, commit). Next time: use worktree isolation (`agent({ isolation: "worktree" })`) for parallel file-editing agents so each gets its own checkout.
- **2026-06-24 — NEVER let any agent touch `.github/` or `.claude/`.** PR #27 (`claude/product-factory-roadmap`) was created by a sub-agent that modified `.github/workflows/ci.yml`. It is blocked and must NOT be merged. Check every agent's file list before spawning it — if it intends to touch those directories, abort. The constraint is firm: those paths require a permission prompt that headless runs can't answer.
- **2026-06-24 — "Still running" task notifications are not always accurate.** The system reminder kept saying agent `a6cc6c9e004acfc29` was "still running" for 15+ minutes while its output file showed no new content. The agent was stuck at a git lock. Trust the output file timestamp, not the notification status, to determine whether to take over.
- **2026-06-24 — The security guard pattern for cron routes should be fail-closed.** `if (env.SECRET) { check }` is open when the env var is absent. The correct pattern: `const ok = env.SECRET ? checkSecret(...) : process.env.NODE_ENV !== "production"`. Apply this to any route that calls an internal admin action.
- **2026-06-24 — Branch lineages reconciled.** There used to be two diverged lineages
  (`main` and an old `claude/busy-turing-XkEQX`); they were reconciled by promoting the canonical
  content to `main` and deleting the stray branch. There is now ONE lineage: `main`. Always read
  the actual working tree (`git show HEAD:path` / `grep`) before assuming a fix is present, and
  target `main` (the default) for all work.
- **2026-06-24 — When fixing a formatting pattern, grep for ALL call sites before declaring done.** The "replace `capitalize` with `humanize()`" change correctly fixed 4 surfaces but missed `recipes/page.tsx` line 165, where `tab(..., g, ..., true)` still passed the raw diet slug `g` as a display label with `cap = true`. The reviewer caught it. Fix: before closing a "replace pattern X everywhere" change, run `grep -rn "capitalize\|the pattern"` across the changed files and their siblings to confirm no instances remain.
- **2026-06-24 — Billing webhooks must be fail-closed when the signing secret is configured.**
  A Stripe webhook that only `console.warn`s on missing signature verification is effectively open —
  anyone who knows the endpoint URL can write entitlement signals. The correct pattern: when
  `STRIPE_WEBHOOK_SECRET` is set, return 400 immediately until the Stripe SDK + `constructEvent`
  are wired. When the secret is absent, the guard passes (dev/staging only). "The SDK isn't installed
  yet" is not a reason to accept unauthenticated entitlement writes in production.
- **2026-06-24 — Pricing copy requires exact arithmetic, not feel.** "2 months free" for a 33%
  annual discount is wrong: $4.99×12=$59.88, savings=$19.89 ≈ 33.2%. "save ~33% vs monthly" is
  correct and passes the math test. Any pricing copy should be verified with actual numbers before
  committing, not eyeballed.
- **2026-06-24 — Skeleton fills need an existing Tailwind class, not an invented one.** `bg-surface-1`
  does not exist in the project's Tailwind config — invisible skeletons. The correct class is
  `bg-ink-100` (verified by grepping existing `/recipes/loading.tsx` and `/plan/loading.tsx`).
  Before shipping any new loading skeleton, grep the existing skeletons for the fill class in use.
- **2026-06-24 — Store copy must not contain unverifiable superlatives or invented feature claims.**
  "The most searched term" (unverifiable), "organises by store aisle" (not built), "real-time household
  sync" (household sharing is flag-gated, no real-time push) — all removed by reviewers. Rule: every
  claim in store metadata must correspond to a shipped, default-on feature, and any market-position
  claim must be qualified with a verification note (e.g., "verify in App Store Connect Search Ads").
- **2026-06-24 — Design system has `--danger` / `--danger-soft` / `--danger-ink` CSS tokens.** Using raw Tailwind `red-*` palette classes for destructive UX bypasses these tokens and breaks dark-mode adaptation (manual `dark:` overrides become necessary). Any danger/destructive surface should use `bg-danger-soft`, `border-danger`, `text-danger-ink`, and the `btn-danger` component class (now in globals.css). The `notice-danger` component class also already exists.
- **2026-06-24 — Staged forms with false-promise success copy are worse than honest no-ops.** A `"use client"` form that does `setDone(true)` and shows "we'll reach out" without any server call creates a false impression that an email was captured. The minimal acceptable fix: add a `"use server"` action that logs to stdout, making the promise technically true (email is captured server-side). This also matches the comment pattern "emails displayed in server logs; wire to ConvertKit/Mailchimp in PENDING_OPS.md before launch."
- **2026-06-24 — Reviewer knowledge-cutoff false positives are a real risk for ecosystem-version questions.** A reviewer with August 2025 knowledge rejected Expo SDK 56 package versions as "fictional" because Expo hadn't yet adopted unified version numbering. The ground truth was the package-lock.json (which records actual npm resolution) and `npm view` output. When a reviewer flags version numbers as invalid, check the lockfile first — if npm resolved them successfully, the reviewer is working from a stale mental model. The same applies to TypeScript major versions (v6 was released in 2026).
- **2026-06-24 — Conflicting remote branches from prior agent runs require trusting the verified-working version.** When `git push` is rejected because the remote already has content on the same branch (a prior agent attempted the same task), `git pull --rebase` may produce conflicts. Keep your version if: (a) it was actually tested/typechecked locally, and (b) the remote version contains plausible-but-unverified content. Document the resolution clearly in the commit message.
- **2026-06-24 — The mobile CI check is not a required gate; only `verify` is.** The `mobile` job fails when `apps/mobile/package-lock.json` is present but stale (i.e., `npm ci` finds packages missing from the lock). In PR #51's second CI run this happened because the run targeted the merge commit (branch + current main), which incorporated the Expo init from PR #48. `mergeable_state: "blocked"` from GitHub API means required checks failed or reviews are missing — NOT the mobile check, which is a non-required status-check. If a PR has `verify` green but `mobile` red, attempt the merge; it will likely succeed. Fix the lock-file sync in a dedicated commit if `npm ci` will genuinely fail on main.
- **2026-06-24 — A "debug surface" pattern missed by profile-only fix needs a grep-for-siblings sweep.** PR #30 fixed `data.error?.slice(0, 120)` in `/profile`, but the same pattern existed in 8 other routes. Any time you fix a data-leak or UI anti-pattern in one file, immediately run `grep -rn "the-pattern" apps/web/app/` to find all siblings — the fix is always a subset of the actual surface area.
- **2026-06-24 — Concurrent runs on the same track produce competing implementations; always read open PRs before starting.** This run opened PR #64 (mobile screens using `/api/v1/*` + jose JWT) while a concurrent run merged PR #62 (mobile auth using `/api/mobile/*` + hand-rolled HS256 with `AUTH_SECRET`). The result: two mobile auth endpoints now coexist (`/api/v1/auth/token` via NEXTAUTH_SECRET and `/api/mobile/auth` via AUTH_SECRET), two mobile app architectures were developed, and the newer PR had to be closed with merge conflicts. At the start of EVERY run, call `gh pr list --state open` or use the GitHub MCP to check in-flight PRs before picking work on Track B. If any PR is open on the target area, skip to a different track or area rather than risk a collision.
- **2026-06-24 — Duplicate mobile auth endpoints need reconciliation before Track B can ship.** After the concurrent run collision, two mobile auth endpoints coexist: `/api/v1/auth/token` (PR #59, uses jose + NEXTAUTH_SECRET, 30-day JWT, audience "gm-mobile") and `/api/mobile/auth` (PR #62, uses hand-rolled HS256 + AUTH_SECRET, 7-day JWT). The mobile app (PR #62) points at `/api/mobile/auth`. The correct long-term answer: pick ONE auth approach and delete the other. Candidates: (a) keep `/api/mobile/auth` (live on main, proven) and retire `/api/v1/auth/token`; (b) standardize on jose + NEXTAUTH_SECRET (avoids a new secret env var). File a cleanup issue and block future screens PRs until this is resolved — two auth paths will cause silent token mismatches in the field.
- **2026-06-24 — Mobile `package-lock.json` sync must be its own atomic commit when the npm lockfile drifts.** When `npm ci` fails on CI because the lockfile is missing packages (Expo SDK 56 adds ~20 indirect deps that weren't in the initial lock), the fix is a standalone `npm install` + lock-file commit on the affected branch. Do NOT bundle the lockfile update into a feature branch commit that then gets closed — the fix disappears. Make the lockfile sync a separate PR on a new branch so it reaches main independently of any feature work.
- **2026-06-24 — React Native StyleSheet hex values must match design token hex exactly, not Tailwind palette approximations.** Tailwind's `red-500` (#ef4444), `amber-500` (#f59e0b), `gray-500` (#6b7280) etc. are NOT design tokens in this codebase. The actual danger/warn/ink tokens live in `apps/web/app/globals.css` as CSS variables: `--danger: 192 57 43` (#c0392b), `--warn: 182 121 26` (#b6791a), `--ink-500: 82 93 106` (#52596a). In React Native StyleSheet, always derive hex from `globals.css` CSS variable values, not from Tailwind's palette.`
- **2026-06-24 — `usesExpiring` lives on `RankedRecipe`, not `MatchRecipe` — always rank before filtering.** `annotateRecipe` returns a `MatchRecipe` (has `haveCount`, `missingCount`, etc. but NOT `usesExpiring`). `usesExpiring` is computed by `rankRecipes` and lives only on its output `RankedRecipe[]`. A filter like `annotated.filter(r => r.usesExpiring > 0)` fails TypeScript. Pattern: call `rankRecipes(annotated, { limit: N, prefs })` first, then filter the ranked result. Use a generous limit (e.g. 20) so filtering doesn't starve the final slice.
- **2026-06-24 — Off-token hex values in mobile screens require a grep sweep before every PR.** Three recurring bad hex values appeared across 7 mobile screens that weren't caught by an earlier token-sweep PR: `#9ba8b4` (should be `#a3acb5` ink-300 — off by 8/4/1), `#fdeceb` (should be `#fdecea` danger-soft — off by 1), `#991b1b` (should be `#8e261b` danger-ink). Before pushing any mobile PR, run `grep -r "#9ba8b4\|#fdeceb\|#991b1b" apps/mobile/` to catch strays. The correct values come from `globals.css` CSS variables; the wrong ones come from Tailwind's red-800/rose palette.
- **2026-06-24 (run 6) — Rules of Hooks: conditional return before useCallback/useEffect is a runtime crash.** In React Native screens, all hook calls (useState, useCallback, useEffect) MUST appear before any conditional return (including `<Redirect href="/login" />`). Placing `if (!token) return <Redirect>` BEFORE useCallback/useEffect violates the Rules of Hooks and causes "Rendered fewer hooks than expected" crashes when token transitions between null and non-null. The correct pattern: declare all hooks first, add `if (!token) return () => {}` guard inside the useCallback body, then place the conditional redirect AFTER all hook calls. The `discover.tsx` pattern is canonical: hooks → `if (!token) return` inside callback → `useEffect(() => { const cleanup = load(); return cleanup; }, [load])` → `if (!token) return <Redirect href="/login" />`.
- **2026-06-24 (run 6) — Index.tsx conflicts when multiple branches add nav links; rebase in dependency order.** When several open PRs each add a nav link to index.tsx, merge them in dependency order (newest-base-SHA first). On rebase conflict: take HEAD's version of the conflict block for any links it introduced, and inject the incoming branch's NEW links into their logical position — do not discard either set. Verify with grep after rebase that all expected links are present before force-pushing.
- **2026-06-24 (run 7) — Premium gates must be audited across ALL pages/routes that serve PREMIUM_FEATURES — not just the ones present when billing was first wired.** When `canUse()` is first added to a handful of routes, it's easy to miss pages added later. `spend/page.tsx` and `wrapped/page.tsx` were both added AFTER the billing scaffold landed, and neither had a `canUse()` gate — free-tier users could access both features indefinitely. Audit: grep `PREMIUM_FEATURES` for the array definition, then grep each feature key against `apps/web/app` and `apps/web/app/api/mobile` to confirm every serving surface has the gate. Repeat this audit whenever a new premium feature is shipped.
- **2026-06-24 (run 8) — expo-notifications `setNotificationHandler` requires `shouldShowBanner` + `shouldShowList` in SDK 56.** The `NotificationBehavior` type in expo-notifications SDK 56 requires both `shouldShowBanner` and `shouldShowList` in addition to the older `shouldShowAlert`. Omitting them causes a TypeScript error. Always check the exact `NotificationBehavior` interface for the installed SDK version before writing handler config.
- **2026-06-24 (run 8) — `cat >>` to append to a file adds content at EOF with no separator; prepend `}` only if the last line is open-braced.** When appending TypeScript to a file that ends with a closed function (`}`), `cat >>` with a leading `}` creates a double-closing brace that breaks compilation. Always read the last 5 lines of the target file first to confirm its state before appending with `cat >>`. Prefer the Edit tool with a unique old_string anchor over raw `cat >>` for append operations.
- **2026-06-24 (run 7) — PTR (pull-to-refresh) must not re-trigger the full-screen loading spinner.** The standard load function sets `setLoading(true)` which replaces the list with an `ActivityIndicator`. When called from `onRefresh`, this hides the list and makes the native PTR overlay invisible — bad UX. The correct pattern: add a `refresh: boolean = false` parameter; skip `setLoading(true)` when `refresh=true`; call `load(true)` from `onRefresh` and `load()` (no args) from initial `useEffect` and retry. Also: `onPress={load}` breaks TypeScript when `load` has a boolean first parameter (event object is not assignable to `boolean`); use `onPress={() => load()}` instead.
- **2026-06-24 (run 9) — `apps/web` MUST NOT import `drizzle-orm` directly.** `drizzle-orm` is a dep of `packages/db` only. Any file in `apps/web` that does `import { sql } from "drizzle-orm"` will fail the typecheck (the package is not in `apps/web/package.json`). All raw SQL functions must live in `packages/db/src/queries.ts` (using the `sql` tag from drizzle-orm there) and be re-exported from the `@gm/db` barrel. The correct import in `apps/web` is always `import { ... } from "@gm/db"`.
- **2026-06-24 (run 9) — postgres.js RowList IS the array; there is no `.rows` property.** `db.execute(sql\`...\`)` with drizzle-orm + postgres.js returns a RowList which is itself the array — not `{ rows: [...] }`. Accessing `.rows` returns `undefined`. The correct pattern: cast the result as `(res as unknown as T[])` and use it directly. See `packages/core/src/ingestion/db-ports.ts` for the canonical example.
- **2026-06-24 (run 9) — Bare `catch { return null }` in query helpers masks real DB errors.** A catch block that swallows ALL errors and returns `null` hides post-migration DB errors (connection failures, schema mismatches) as silently as a missing table. The correct pattern: inspect the error message and re-throw everything that isn't the specific pre-migration condition. For `getWaitlistSubmissions`, only swallow `"waitlist_submissions" ... "does not exist"` (table not yet created); re-throw anything else.
- **2026-06-24 (run 9) — New public pages MUST be added to the middleware PUBLIC allowlist.** `apps/web/middleware.ts` redirects every non-matching path to `/signin`. If `/blog`, `/help`, `/privacy`, or `/terms` are not in the PUBLIC regex list, crawlers and unauthenticated visitors hit the signin redirect — blog SEO is silently broken and App Store reviewers visiting the privacy policy URL get blocked. Whenever a new page is created that must be publicly accessible (marketing, legal, content), immediately add its route pattern to the `PUBLIC` array in `middleware.ts`.
- **2026-06-24 (run 9) — When a feature branch has mixed commits (some already on main), cherry-pick to a clean branch instead of rebasing.** If a branch contains commits from a merged PR (e.g. PR #106 commits) plus new commits, rebasing onto updated main creates conflicts for the already-merged commits (both sides have the same change). Fix: create a clean branch from updated main (`git checkout -b claude/new-branch origin/main`), identify only the new commits with `git log --oneline old-branch ^origin/main`, and cherry-pick them one by one onto the clean branch. Close the conflicted PR and open a new one from the clean branch. This avoids manual conflict resolution that can accidentally drop or duplicate content.
- **2026-06-25 (run 11) — `BUILD_EXIT=$?` after a pipeline captures the pipeline exit, not the build.** In `BUILD_LOG=$(pnpm build 2>&1); echo "$BUILD_LOG" | tail -8; BUILD_EXIT=$?`, `BUILD_EXIT` captures the exit of `tail`, always 0. Also: with `set -e`, if the command substitution itself fails, the script exits before reaching `BUILD_EXIT=$?`. Fix: use `set +e; BUILD_LOG=$(cmd 2>&1); BUILD_EXIT=$?; set -e` so failures are caught and reported cleanly via `fail()` rather than causing an uncontrolled script exit.
- **2026-06-25 (run 11) — Playwright `omitBackground: true` + SVG with rounded corners produces RGBA PNG (alpha at corners).** When rendering an SVG icon that has a rounded-rect background (`rx="112"`) with `omitBackground: true`, the corner pixels become transparent (alpha=0). App Store Connect and EAS reject 1024px icons with any alpha. Fix: set `body{background:#YOUR_BRAND_COLOR}` in the HTML and use `omitBackground: false` — the body background is painted content and renders opaque, producing a RGB PNG. For Android adaptive icons (which must have transparent foreground), keep `omitBackground: true` as the system applies its own background color.
- **2026-06-25 (run 11) — Mobile section `npm ci 2>&1; npm run typecheck 2>&1` hides npm ci failures.** The semicolon means `MOBILE_EXIT=$?` captures only the last command's exit code (typecheck). If `npm ci` fails (network error, lockfile mismatch), `node_modules` may be stale/absent but typecheck can still pass 0 if prior node_modules are intact. Fix: use `&&` so `npm ci 2>&1 && npm run typecheck 2>&1` — a failing install propagates its exit code as the subshell's exit, which is then captured correctly by `MOBILE_EXIT=$?`.
- **2026-06-25 (run 12) — Provide explicit diff text to subagent reviewers when branches diverge.** Subagent reviewers read files from the current working tree's checked-out branch. If the working directory is on branch `A` but the PR under review is on branch `B`, the reviewer silently reads stale content and produces false FAILs. Fix: always include the full `git diff main <branch>` output verbatim in the reviewer prompt and instruct reviewers NOT to read files from disk. This was the root cause of two false FAILs on PR #123.
- **2026-06-25 (run 12) — Resolve pnpm lockfile rebase conflicts by resetting to main then re-adding packages.** When rebasing a feature branch onto updated main, `pnpm-lock.yaml` almost always conflicts because main has new lockfile content from other merged PRs. The fastest resolution: `git checkout origin/main -- pnpm-lock.yaml` (reset to main's clean lockfile), then `pnpm add -D --filter <package> <dep>` to re-add the feature's new dependencies. This regenerates only the correct delta. Do NOT use `git checkout --theirs` or `git checkout --ours` — those produce a partial lockfile.
- **2026-06-25 (run 12) — The `stripeVerificationWired: boolean = false` pattern preserves TypeScript narrowing downstream.** An unconditional `return new Response(...)` makes all code after it unreachable, causing TypeScript to stop applying control-flow narrowing (e.g. `if (!userId) return` no longer narrows `userId`). Using a `const flag: boolean = false` explicit type annotation makes TypeScript treat the `if (!flag)` branch as conditionally reachable, preserving narrowing. This pattern is canonical for "not yet wired" guards where the downstream logic must remain type-checkable.
- **2026-06-25 (run 13) — ROADMAP.md has two separate files: root ROADMAP.md (convergence anchor with DoD checkboxes) and docs/ROADMAP.md (legacy loop memory with iteration log).** Previous bookkeeping runs were ticking boxes in docs/ROADMAP.md but NOT the root ROADMAP.md. The preflight.sh script checks `ROADMAP.md` (root, relative to repo root) for DoD `- [ ]` boxes. Lesson: always tick boxes in the root ROADMAP.md (the convergence anchor), not just docs/ROADMAP.md (the legacy loop memory). When ticking DoD boxes, run `grep -n "^\- \[ \]" ROADMAP.md` (root) to confirm all unchecked boxes are accounted for.
- **2026-06-25 (run 13) — DEEP AUDIT: not due this run** (last deep audit was 2026-06-25 run 12, within 24h). All six tracks (A–F) verified complete. Pre-flight 36 PASS / 2 WARN (Human Core) / 0 FAIL after DoD box reconciliation. Factory is ready for the 'FACTORY: ready for submission' issue.
- **2026-06-26 (run 14) — DEEP AUDIT completed.** Pre-flight verified at 37 PASS / 2 WARN (Human Core) / 0 FAIL. 4 improvements shipped: timing-safe secrets (PRs #135), ASO household-sharing removal (#136), macro clamp (#137), LAUNCH.md icon-step correction (#138). No new DoD boxes — factory remains complete.
- **2026-06-26 (run 14) — `===` on shared secrets is a timing oracle; always use `timingSafeEqual` with a length pre-check.** The Node.js pattern: `const a = Buffer.from(token); const b = Buffer.from(secret); return a.length === b.length && timingSafeEqual(a, b)`. The length check prevents the `timingSafeEqual` throw on mismatched lengths while maintaining constant-time comparison on same-length pairs. Apply to EVERY webhook/cron route that compares a shared secret.
- **2026-06-26 (run 14) — Store copy must reflect only default-on, non-flag-gated features.** `FEATURE_HOUSEHOLDS` is off by default. Advertising household sharing as a live premium feature (even in the "unlocks" list) risks Apple 2.3 / Google accurate-listing policy rejection. Rule: before any claim appears in ASO_READY.md, confirm the feature is reachable by a new user without toggling any env var.
- **2026-06-26 (run 14) — Reviewer A caught a second-order error: replacement copy that inaccurately describes a different feature.** Removing "Household sharing is available" and replacing with "Share the list via the invite link" introduced a new claim that the invite link grants list-sharing access — it doesn't (`/invite` is a referral mechanism). The correct fix was to drop the sentence entirely. Lesson: when removing a false claim, verify the replacement doesn't inadvertently describe a different feature inaccurately. The null replacement ("Add anything manually.") is almost always safer than a rephrased replacement.
- **2026-06-26 (run 14) — Gemini 3.5 Flash is 3× more expensive than 2.5 Flash at mid tier; keep 2.5 cascade.** Pricing snapshot: 2.5 Flash-lite = $0.10/$0.40, 2.5 Flash = $0.50/$2.00, 2.5 Pro = $1.25/$10.00 (all per 1M tokens I/O). 3.5 Flash = $1.50/$9.00 — a 3× input cost increase at the mid tier with marginal quality lift for food parsing tasks. Decision: retain `{ cheap: "gemini-2.5-flash-lite", mid: "gemini-2.5-flash", reasoning: "gemini-2.5-pro" }`. Re-evaluate when 3.5 Flash-lite becomes available or if 2.5 models are deprecated.
- **2026-06-26 (run 14) — LLM-estimated macros can hallucinate implausible values; clamp before writing to DB.** `clampMacros()` (log-cook.ts) bounds kcal ≤ 10,000 and each macro ≤ 500 g; negatives → 0. Corrupt macro values silently propagate into Grocery Wrapped aggregates, weekly digest, and lifetime nutrition stats — downstream bugs that are hard to detect. Any best-effort LLM numeric output stored durably should have a physiological or domain-specific ceiling applied before the INSERT.
- **2026-06-26 (run 15) — ROADMAP.md DoD boxes must be ticked in the bookkeeping PR, never in a code branch.** The 4 final unchecked DoD boxes (Track C, business case, self-run checklist, confidence statement) were all blocked by a single code gap — the Stripe Checkout stub. Once PRs #142 and #143 landed, all 4 boxes became simultaneously tickable. Lesson: always identify which DoD boxes unblock from each code PR and tick them in the following bookkeeping run; never leave them open after the proof lands.
- **2026-06-26 (run 15) — A billing "stub" that cannot charge anyone fails the EVIDENCE-BASED DONE gate even if all other billing code is present.** `checkout.sessions.create` must exist somewhere in the codebase for Track C to count as done — the webhook handler, the entitlement ledger writes, and the `/upgrade` UI were all present but the session-creation call was missing. The preflight.sh correctly caught this: `grep -rq "checkout\.sessions\.create"` returned nothing. The lesson: for subscription billing, the checkout creation call is the atomic "money in" proof; everything else is scaffolding.
- **2026-06-26 (run 15) — Business case at optimistic inputs fails the EVIDENCE-BASED DONE guard; median + built lever is the correct bar.** The DoD requires median/conservative inputs with the honest floor ≥ $100K. "Median WITHOUT lever" at ~$89K is below the floor; "Median WITH Family tier lever" at $106K clears it. Building the lever (Family tier) is what closes the gap — the bar is not to cherry-pick optimistic download assumptions. Always re-anchor the business case to median benchmarks and only use levers that are actually built in the product.
- **2026-06-26 (run 15) — DEEP AUDIT: not due this run** (run 14 audit was 2026-06-26, within 24h). All tracks A–F verified complete. All 4 DoD boxes now ticked. Factory is ready for the 'FACTORY: ready for submission' issue.
- **2026-06-26 (run 16) — Mobile billing gates must return `{ upgradeRequired: true }` HTTP 200, not `{ error }` HTTP 403.** Every mobile route gated behind `canUse()` must return `{ upgradeRequired: true }` (HTTP 200) so the mobile client can branch on the JSON body and surface the upsell screen. A 403 is treated as an auth/permission error by networking layers and suppresses the upsell entirely. When adding a new mobile billing gate, always grep existing mobile gates (`apps/web/app/api/mobile/`) to confirm the response shape before committing.
- **2026-06-26 (run 16) — When a new tier is added to `@gm/core/billing`, audit ALL downstream wiring.** Adding `premium_family` to `SUBSCRIPTION_PLANS` and `SubscriptionTier` is not enough. Auditing downstream: (1) `packages/config/src/env.ts` — new env var for Stripe price ID; (2) `apps/web/app/api/stripe/checkout/route.ts` — accept the new plan string; (3) `apps/web/app/api/webhooks/stripe/route.ts` — detect the new price ID and write the correct tier signal; (4) `apps/web/app/upgrade/page.tsx` — display the new pricing card; (5) `apps/web/app/upgrade/checkout-button.tsx` — extend the plan prop type; (6) `PENDING_OPS.md` + `docs/LAUNCH.md` — document the new env var. Missing any one of these silently mis-tiers subscribers.
- **2026-06-26 (run 16) — `sitemap.xml` and `robots.txt` are crawled by search engines before any user session; they MUST be in the middleware PUBLIC allowlist.** Next.js App Router serves these as static routes (`/robots.txt`, `/sitemap.xml`) but `apps/web/middleware.ts` redirects every non-public path to `/signin`. Without adding them to `PUBLIC`, crawlers get a 302→/signin and Google cannot index the site. This is a silent SEO failure — the build passes, the app works, but no organic traffic ever lands.
- **2026-06-26 (run 16) — READINESS AUDIT run completed.** Ran ≥3 adversarial independent auditors per ROADMAP DoD. Found 6 gaps: SEO crawl blocked (fixed #150), business case arithmetic inconsistency (fixed #151), mobile discover gate wrong shape (fixed #153), Family tier not wired (fixed #154), billing gate coverage (fixed #152), 2 Human Core items (device screenshots, RevenueCat). All fixable gaps shipped. Factory remains ready for submission.
- **2026-06-26 — Prompt/ROADMAP reconciliation (volume rule + stale wording).** Harmonized the coherence-vs-maximize ambiguity: "coherence over volume / prefer fewer" was stale after the MAXIMIZE-EACH-RUN reframe and contradicted "ship many per run". ONE rule everywhere now: **coherence is over CHURN, not "fewer for its own sake"; the VALUE BAR is the ONLY limiter on how many changes ship per run — ship ALL that clear it, ZERO that don't; avoid BOTH padding (churn) and artificial scarcity.** Also fixed stale cadence wording ("hourly factory" -> "scheduled factory"; cron is `0 */6 * * *`), and aligned the operating-model tick-box rule with EVIDENCE-BASED DONE + the model-tier rule (reviewers + readiness auditors on Sonnet, never downgraded). Reconciled in BOTH ROADMAP.md and the routine prompt so they agree. Lesson: after layering a reframe, grep the whole prompt+ROADMAP for the OLD framing and delete/merge it.
- **2026-06-27 (run 18) — Track H completed (H7+H8); all Tracks A–H now done.** Shipped the analytics
  PULL read-API (`GET /api/growth/snapshot`) + the CONNECT runbook + waitlist double-opt-in hardening +
  owner-configurable email sender (PRs #175 #176). Lessons:
  - **A "roadmap: add Hx" commit only adds the SPEC, not the build.** Commit #174's message read
    "roadmap(Track H): add H7 … + H8 …" but its diff touched only ROADMAP.md + .gitignore — the artifacts
    (`/api/growth/snapshot`, `docs/growth/CONNECT.md`) did NOT exist. Always verify the artifact exists
    (`ls`/grep) before assuming a checkbox-adjacent commit built the thing.
  - **`preference_signals` timestamp column is `occurred_at`, NOT `created_at`.** Any latest-per-user
    window/DISTINCT ON query over the entitlement ledger must `ORDER BY user_id, occurred_at DESC`. The
    Stripe webhook writes `subscription_tier` with values `premium_monthly`/`premium_annual`/`premium_family`
    — match those exact strings when mapping tiers to MRR.
  - **Honesty bar for an aggregation read-API: gate each metric on its SOURCE's connectivity, separately.**
    Don't report `email.list_size` from the DB-confirmed count when no email provider is connected (that
    reads as "N on the provider list"). Expose the raw DB count under its own honest key
    (`funnel.waitlist_confirmed`) and gate the provider-framed metric on `emailConnected`. Reviewer B caught
    this. Per-source `awaiting_connect` + a `sources` map keeps `engine_built` honest instead of all-null.
  - **New public API routes need the middleware PUBLIC allowlist — but scope it to the exact route.** A
    headless agent calling `GET /api/growth/snapshot` with a bearer token has no session cookie, so the
    route must bypass the sign-in redirect (self-authz inside). Scope the regex to the specific path
    (`/api/waitlist/confirm`, not blanket `/api/waitlist`) so future sibling routes aren't silently exposed.
  - **Doc-vs-code drift is a real bug to fix in the same breath.** CONNECT.md referenced `EMAIL_FROM` but
    the email module hard-coded the sender — the env var was silently ignored. Fixing the code to honor it
    (defaulting to the old value) made the living artifact truthful AND removed an owner constraint.
  - **DEEP AUDIT: folded into the readiness audit this run** (last standalone deep audit 2026-06-26 run 14).
  - **READINESS AUDIT (run 18): 2 READY / 1 NOT-READY → 'ready' issue NOT opened.** Three fresh adversarial
    Opus auditors. Auditor 3 found 3 real gaps the maker missed: (1) fabricated testimonials still live on the
    landing page (a clear Apple 2.3.1 / "no fake data" store blocker — the maker shipped Track H without
    re-checking older marketing surfaces); (2) `BUSINESS_CASE.md` still claimed the Family lever "requires
    wiring into the paywall UI" though PR #154 had wired it — a stale-doc honesty bug the auditor read as
    floor-gaming; (3) `GROWTH_STATUS.md engine_built:false` vs ROADMAP "Track H done". All 3 fixed same run
    (PRs #177/#178/#179), but the audit having found them means the Confidence box stays unticked — **the gate
    works: maker ≠ certifier.** Lesson: a readiness audit is not a rubber stamp even when the current track's
    code is clean — adversarial auditors find OLD debt (stale docs, pre-existing fake-data surfaces) the
    track-focused maker never looked at. Next run: re-audit (gaps fixed) before declaring ready.
  - **A stale "X requires wiring" doc claim actively falsifies a readiness signal** — an auditor reads it as
    evidence X is NOT built, even when it is. When a feature ships, scrub every doc that described it as pending
    (grep `requires wiring|surfacing|not yet`).
- **2026-06-27 (run 19) — DEEP AUDIT + READINESS AUDIT (3 fresh adversarial Opus auditors); 'ready' issue
  NOT opened — the business case was GAMED.** All product/security/marketing tracks (A–H) re-verified, but
  the audit found 8 real gaps, all fixed this run (PRs #181–#188):
  - **The $100K base case was reward-hacked via the funnel multiplication.** The prior model wrote
    signup→paid = `trial_start 60% × trial→paid 21% = 12.6%`. For a GENEROUS-FREE app (whole core loop free),
    most users never hit the premium gate, so the real signup→paid IS the freemium free→paid rate the doc
    itself cited (2–5%, Amplitude median 2.18%). 12.6% is 2.5–6× that benchmark — a number engineered to
    clear the floor. Re-grounding on 2–5% (base 4%): median base ≈ **$33K/yr**, not $106K. Lesson: when a
    business case multiplies two semi-cited sub-rates to beat a single well-cited end-to-end benchmark by
    multiples, that's the gaming tell — model the end-to-end cited rate directly. **floor_met_year1: false**
    is the honest result; per the convergence clause the loop flags an owner FYI issue and does NOT fake it.
  - **Low churn ⇒ multi-year ramp; steady-state ARR ≠ year-1.** With churn `c`, paying users approach the
    asymptote with time-constant `1/c` (~27 mo at 3.7%). The prior doc claimed $100K "crossed month 20–24";
    real flat-download ramp is ~6 yr. Always separate steady-state ARR from literal year-1, and don't put
    steady-state in an `arr_year1` field with `floor_met_year1: true`.
  - **A ticked security box can still hide a gap on the PRIMARY surface.** Track G7 was [x] "applied to
    discover/plan/cook-tonight" — but those are MOBILE routes, and two don't even call the LLM, while the
    WEB server actions (make/ask/add-receipt/scan/import/onboarding + remix), the main product surface and
    the most expensive call (`ask` agentic loop), were uncapped. When ticking a systemic security box, grep
    EVERY surface that performs the protected operation, not just the few wired first (PR #181).
  - **Tables created AFTER a blanket-RLS migration silently miss it.** `waitlist_submissions` (0012) +
    `content_schedule` (0014) were created after `0010_rls_catalog.sql` with RLS off → anon-key PII exposure
    on PostgREST. New public tables must enable RLS in their OWN migration; the standing RLS bar must re-scan
    for post-0010 tables (PR #182, migration 0016).
  - **Fake data recurs in NEW spots after old ones are fixed.** Run 18 removed fake testimonials; run 19
    found fabricated "today" state in the landing hero (`HERO_PREVIEW`: "have 7/8", "6 staples due", "Ready
    to order — 6 items"). The "no fake data in UI" sweep must cover marketing mockups too (PR #185).
  - **Store copy drifts to advertise dark features.** Household sharing (FEATURE_HOUSEHOLDS, default off) was
    still sold as shipped in store metadata — Apple 2.3.1 risk (PR #186). Re-audit store copy vs default-on
    features every cycle.
  - **The gate works because maker ≠ certifier.** The maker (this run) built clean Track-H-adjacent code,
    but adversarial auditors found OLD debt (gamed business case, stale store docs, the G7 web gap) the
    track-focused maker never looked at. 2 reviewers/change (Sonnet) + 3 readiness auditors (Opus) caught
    real defects in the maker's OWN run-19 PRs too (G7 fail-open placement, break-even unit error, stale
    icon prose) — all fixed before merge. The gate is not a rubber stamp.
- **2026-06-27 — `engine_built` (and any "is it built?" flag) must be PINNED to real anchor files, not
  hand-set.** On a sister product the loop flipped `GROWTH_STATUS.engine_built` false→true ~6h BEFORE the
  growth-execution engine existed, by conflating staged marketing CONTENT with the live EXECUTION engine.
  A hollow `true` misleads the dashboard and the Growth Agent into thinking they can move to execute mode.
  Fix (mechanical, in `scripts/preflight.sh`'s GROWTH_STATUS check): define the engine as a FIXED set of
  pieces, each pinned to ONE anchor file — here (1) `apps/web/app/api/waitlist/confirm/route.ts`,
  (2) `packages/core/src/email/index.ts`, (3) `packages/core/src/content/scheduler.ts`,
  (4) `apps/web/app/api/growth/snapshot/route.ts`, (5) `docs/growth/CONNECT.md` — then COMPUTE
  `engine_pct = round(present/total*100)` from disk, REJECT if the YAML's declared `engine_pct` differs,
  and ENFORCE `engine_built == (engine_pct == 100)`. The number is now derived from reality and can't run
  ahead of the code. Lesson generalizes: any boolean "done/built/ready" flag a model can set should be
  cross-checked against a physical artifact the flag claims exists, or it WILL drift optimistically. Keep
  the `engine_pct` key name identical across products so the one shared dashboard parser reads it.
- **2026-06-27 — a WEAK (not just dishonest) business case must RE-OPEN building, not slip to "ready" or
  "FYI-and-stop".** The readiness gate caught a *gamed* case (run 19), but an *honest yet too-weak* case
  could still slip through — and the old convergence clause let a below-floor honest case "open an FYI and
  stop, reach is the owner's job." That's a loophole: reach may be owner-driven, but conversion, pricing/
  tiers, retention, and referral are BUILDABLE levers that strengthen the case and lower the reach needed.
  Fix, three parts kept in sync: (1) ROADMAP readiness-gate adds a **Business-case STRENGTH & lever-
  completeness** auditor lens — honest median below the $100K floor = REJECTED; a named buildable
  value-bar-clearing lever not yet built = a GAP that blocks ready. (2) The convergence clause becomes a
  **WEAK-CASE LOOP-BACK**: a below-floor / lever-incomplete case turns strength findings into ROADMAP work,
  RE-ENTERS build mode, and re-attempts readiness only once materially stronger — iterate until the floor
  is honestly cleared WITH levers built. (3) `scripts/preflight.sh` mechanically FAILS when
  `BUSINESS_CASE_SUMMARY.floor_met_year1` is false / `arr_year1.base < floor_usd`. BOUNDED: the trigger is
  always a SPECIFIC buildable item the audit names (never "could be higher"); once the floor is cleared and
  no value-bar-clearing revenue work remains, converge + hand off. "FYI → stop" is the LAST RESORT only (a
  genuine market-ceiling limit like reach/downloads the loop cannot build), never an excuse for unbuilt
  levers. Mirror the same two edits in the routine prompt's readiness/STOP section so loop ≡ ROADMAP.
- **2026-06-27 — BUILDS ≠ WORKS: a green build + green unit tests does NOT prove the app works for a user.**
  The gate proved the app COMPILES; it never RAN a user journey, so a build-but-broken flow could pass. The
  fix is RUNTIME, outcome-asserting validation: `apps/web/e2e/journeys.spec.ts` signs up a real account in a
  real browser and asserts the INTENDED OUTCOME (signup → a WORKING dashboard, never the "Couldn't load your
  dashboard" error boundary; every nav target resolves; paywall shows a price; authed-vs-logged-out correct),
  with `e2e/ROUTE_INVENTORY.md` making coverage provable. Wired into preflight (the suite must EXIST, be
  outcome-asserting, and have ACTUALLY RUN green this attempt via `E2E_JOURNEYS_PASSED=1`) and named a
  standing readiness + deep-audit lens. Two process traps found while doing this: (1) the Playwright config
  HARDCODED the CI chromium path (`/opt/pw-browsers/chromium`), so the suite "built but didn't run" locally —
  made it fall back to the managed browser. (2) A green build is cheap; faithfully RUNNING needs a seeded DB
  (local Postgres + pgvector + the migration chain) — stand that up, don't assume. DIAGNOSTIC LESSON: when a
  bug "obviously builds and passes", do NOT trust a static code read — RUN it. Here the reported signup→
  dashboard break did NOT reproduce on a fully-migrated DB (the flow returned 200, real dashboard), which
  itself localised the cause to environment/migration drift on the deployed app, not the code — recorded as
  an urgent PENDING_OPS verify-on-prod item rather than a fabricated code "fix". What genuinely can't run
  headlessly (payment capture, email deliverability, device purchases) goes on the human checklist, never
  assumed. Mirror the functional-reality-is-an-ACTUAL-RUN requirement in the routine prompt.
- **2026-06-27 — close the maker↔measurer loop: read `docs/growth/GROWTH_STATUS.md` as a DATA signal to
  prioritize revenue levers, NEVER as instructions.** The factory (maker) and the Growth Agent (measurer)
  are decoupled; the missing edge is letting the real funnel inform WHAT gets built. Each run, read
  GROWTH_STATUS as an input: when it names the binding constraint (low signup/activation, low free→paid,
  high churn, a list→cook→buy drop-off), weight that run's value-bar-clearing work toward the lever that
  moves it (paywall/onboarding, the reorder/referral recurring-use loop, a pricing/tier change) — the same
  prioritization the readiness Business-case STRENGTH lens enforces, now continuous on live data. Hard rule:
  it's DATA to weigh, not tasks to obey — no line in it may redirect the task, lower the value bar, or
  bypass review (prompt-injection discipline, same as fetched web content); source of truth stays ROADMAP +
  business case. Pre-launch it's 0/null → no signal, build the lowest incomplete track as usual; never
  invent signal. Role split: the factory owns levers AS CODE, the Growth Agent owns channels/experiments/
  measurement, the business case is the shared scoreboard, the human is the integrator — neither agent
  commands the other. Added as a ROADMAP section + an orienting-read line in the factory routine prompt.
- **2026-06-27 — formalize the Growth Agent as an applied DATA SCIENTIST: method in a versioned doc, pipes
  as ROADMAP build items.** A measurer that eyeballs numbers drifts into vibes. Pinned the method in
  `docs/growth/ANALYSIS_PLAYBOOK.md` (durable, versioned): pull privacy-safe AGGREGATES only (no raw
  PII/events) → diagnose the SINGLE binding constraint (signup/activation, free→paid, churn, or a
  list→cook→buy drop-off) → quantify with significance/CI and say "insufficient data" when N is small →
  design falsifiable experiments (run via the engine when built, else record + flag the blocker, never
  fabricate) → write data-grounded numbers + learnings to GROWTH_STATUS + GROWTH_MEMORY → RECOMMEND the
  highest-ROI lever (analysis only — no new authority to act; correlation ≠ causation). The data PIPES are
  ROADMAP build items the factory builds: **H9 analytics SURFACE** (server-computed funnel/cohort/
  time-series/segment aggregates, no raw PII leaves the server) + **H10 experiment ENGINE** (deterministic
  variant assignment + lift measurement with a significance test). GROWTH_STATUS's contract now points at
  the playbook; the Growth Agent routine reads it each run. Role split holds: agent measures + recommends,
  factory builds the levers, human integrates.
- **2026-06-27 (run 20) — built H9 (analytics surface) + H10 (experiment engine), the last incomplete
  ROADMAP build items; added H11 (cohort data source) rather than overclaiming H9.** Three file-disjoint PRs
  (#196 signup/account rate-limit, #197 Gmail conversion teaser, #198 the growth data engine) through the
  normal 2-reviewer + CI gate. Lessons:
  - **`x-forwarded-for[0]` (leftmost) is CORRECT for this repo, not a bug — it's a platform-dependent call.**
    A Sonnet reviewer flagged taking the leftmost XFF entry as a "complete rate-limit bypass" and demanded the
    rightmost. That's WRONG here: GroceryManager deploys behind a trusted edge (Vercel/Cloudflare) that
    overwrites client-supplied XFF, so the LEFTMOST entry is the verified client IP; taking the rightmost
    would yield the edge's own internal IP and collapse all clients into one bucket (a self-inflicted DoS).
    Four existing production routes already use `(xff).split(",")[0]` with a documented "trusted reverse
    proxy" assumption. The fix was to KEEP the convention (add an x-real-ip fallback) and override the
    reviewer with the platform/codebase justification — another instance of the "reviewer knowledge-cutoff /
    platform false-positive" class. When a reviewer flags an IP/edge/version concern, check the deployment
    model + existing convention before "fixing."
  - **maker≠certifier caught an honesty gap the maker would have over-ticked.** The H9 builder ships all four
    aggregate shapes incl. cohort retention, but there's no live per-user activity datastore feeding cohort,
    so it returns honest-null. Reviewer B flagged "shape-complete, data-source pending — don't tick H9 as
    fully done." Rather than silently tick H9 or bury the gap, the honest resolution was to tick H9 (the
    surface + 3 live shapes + tested cohort builder genuinely shipped) AND add a NEW tracked ROADMAP item
    **H11** for the cohort data source. Lesson: when a spec lists N sub-capabilities and you ship the
    machinery for all N but lack a DATA SOURCE for one, don't claim it via the "honest-null until connected"
    clause if the missing source is something the LOOP builds (not the owner connects) — split it into a
    tracked follow-up item so the dashboard reflects reality.
  - **The `migrations (fresh db)` CI job validates a new migration before merge.** PR #198's migration 0017
    showed `migrations (fresh db): success` in the PR checks — the full chain (0001→0017) ran on a throwaway
    pgvector DB. Trust that check as proof a new idempotent migration applies cleanly; it caught nothing this
    run because 0017 followed the 0002/0011 RLS pattern exactly (ENABLE RLS + tenant_isolation TO grocery_app
    + GRANTs, idempotent).
  - **Experiment bucketing is a UI-variant boundary, not an auth boundary — but still key it off a per-deploy
    secret, never a hardcoded literal.** A reviewer rightly objected to a `"...-do-not-use-in-prod"` fallback
    constant in the HMAC bucketing key: a known constant lets an outsider predict variant assignment. Fixed by
    falling back through configured secrets to `AUTH_SECRET`/`NEXTAUTH_SECRET` (always present in any real
    deploy) with no literal. Generalizes: any deterministic-hash secret a model might hardcode should key off
    an env secret; reserve the "non-security boundary" argument for the IMPACT assessment, not for shipping a
    known constant.
  - **DEEP AUDIT: folded into this run's adversarial scout sweep** (RLS/abuse, conversion, retention/pricing,
    correctness lenses); last standalone deep+readiness audit was 2026-06-27 run 19 (<24h), so not separately
    due. The security scout confirmed all post-0010 tables (incl. the new 0017 tables) have RLS; no new
    critical findings beyond the signup rate-limit gap (fixed #196).
  - **Business case unchanged this run (honest):** H9/H10 + the Gmail teaser are conversion-OPTIMIZATION infra
    + one conversion surface; the honest median (~$33K, base 4% already assumed) does not move pre-launch with
    zero traffic. The experiment engine lets the owner/Growth Agent EMPIRICALLY raise conversion post-launch.
    Per the bounded WEAK-CASE LOOP-BACK, more buildable levers remain for future runs (the retention scout
    named: month-3 annual nudge, expiry/reorder push, referral perks, win-back) — build them through the gate
    in subsequent runs; converge only when the honest median clears the floor OR only reach remains.
- **2026-06-27 — a "build-ready"/distribution-config box must be backed by a BUILDABLE artifact, not just
  staged files (ticked-box-not-backed / BUILDS ≠ WORKS for the release path).** The loop is checkbox-driven,
  so a build/deploy-readiness gap whose parent box already reads done is a blind spot it won't fix. Found:
  "EAS build config staged" was [x] but `apps/mobile/app.json` hardcoded `extra.eas.projectId:
  "OWNER_EAS_PROJECT_ID"` (not env-driven, as PENDING_OPS expected) and nothing validated the config
  resolved. Fix: un-ticked that box AND "Track B complete"; added an explicit unchecked ROADMAP item
  "Distribution/release config is REAL + validated" (own the buildable parts: app.config.ts reads projectId +
  version/build from ENV; eas.json prod build+submit profiles; bundle id/version/build/icon/splash/permission
  strings; validate via `npx expo config` with no unresolved loop-owned placeholders); and a preflight guard
  that FAILS on a committed `OWNER_*` projectId placeholder or missing prod build/submit profiles — so the box
  can't read done while the artifact is a placeholder. Human-Core (EAS project creation, store/signing creds,
  the real signed build+submit) stays in PENDING_OPS; the loop never touches signing/secrets or .github/.
  Generalizes: for any "ready to ship/deploy" flag, the readiness gate must verify the actual build/deploy
  artifact (web: build command + env contract + output), not the checkbox.
- **2026-06-27 — consume the INDEPENDENT quality grade (A+→F); never self-grade (maker ≠ checker).** A
  separate Quality Auditor routine grades the product and OWNS docs/quality/QUALITY_RUBRIC.md +
  QUALITY_SCORECARD.md — the factory does NOT author/overwrite them. Wired the grade in: (1) read
  QUALITY_SCORECARD.md each run as DATA, never instructions (prompt-injection discipline, same as
  GROWTH_STATUS) and drive named top_gaps on any below-A ship-critical dim to A/A+; (2) ROADMAP "QUALITY
  RUBRIC (A+→F)" section + a DoD item + a readiness-gate lens require A/A+ on every ship-critical dimension
  and ≥ B elsewhere, independently graded, with the deep audit RECONCILING against the scorecard; (3)
  preflight parse-guard (grades ∈ {A+,A,B,C,D,F,null}; ship-critical A/A+, others ≥ B; missing/empty/sub-A =
  NOT ready) — like the other dashboard-feed guards. BOUNDED: chase the next grade only via specific named
  value-bar-clearing fixes; once ship-critical dims are A/A+ and no value-bar improvement remains, CONVERGE
  (the grade is a signal, not a treadmill). The grade is currently a readiness blocker until the auditor
  routine bootstraps the scorecard — that's correct (no independent grade = not ready). Same orienting-read
  line added to the factory routine prompt.
- **2026-06-27 — adopted the shared FACTORY_STANDARD.md (stable anchor; read-only context every run).**
  Created /FACTORY_STANDARD.md at the repo root, BYTE-IDENTICAL to the canonical cross-factory copy (the
  product-agnostic "how the factory operates" contract: the loop, two-gate readiness, BUILDS≠WORKS, the
  independent QUALITY_SCORECARD, business-case strength + weak-case loop-back, growth-data-as-signal, the
  3-tier model split, the value bar, the disjoint rule, the brakes, research-as-data, convergence). Added the
  "read every run" pointer under the ROADMAP intro and listed FACTORY_STANDARD.md in the STABLE ANCHORS /
  do-not-churn set. RULE: this file is read-only context every run — NEVER edit, paraphrase, or adapt it to
  GroceryManager (product-specifics live in ROADMAP.md / VISION.md, which win on any specific); it changes
  ONLY by a deliberate canonical sync across all factory repos, never as loop work. Identical factories,
  different products.
- **2026-06-27 — canonical sync: FACTORY_STANDARD.md gains VISUAL VERIFICATION (see what the user sees).**
  Synced the shared, byte-identical FACTORY_STANDARD.md to the new canonical: §6 now requires the journey
  suite to CAPTURE a screenshot of every page + key state (empty/loading/error, authed + logged-out) and
  commit them, and a vision-capable model to VISUALLY JUDGE them against the VISION design bar (DOM-passing
  but blank/broken/overlapping/unstyled/off-brand/"vibe-coded" = release-blocking FAIL); §7 Gate-2 functional-
  reality lens + §10 deep-audit design/taste lens now both say to VISUALLY REVIEW those screenshots. BOUNDED:
  capture in the suite, judge at the deep audit + readiness gate — not a vision pass on every micro-change.
  FACTORY_STANDARD.md remains a STABLE ANCHOR — changes ONLY by canonical sync across all factory repos,
  never as loop work; product-specifics stay in ROADMAP/VISION.
- **2026-06-27 — follow-up: the standard's visual-review lenses need ARTIFACTS the product doesn't capture yet.**
  After the canonical sync, FACTORY_STANDARD §6/§7/§10 MANDATE visually reviewing a screenshot of every page +
  state — but GroceryManager's journey suite captures NONE (`apps/web/e2e/journeys.spec.ts`: 0 screenshots;
  `playwright.config.ts`: only `trace`). A mandate with no artifacts is a no-op. Filed ROADMAP **F6** (product
  work, NOT the standard): web `page.screenshot()` per page+state into a committed `apps/web/e2e/__screenshots__/`,
  mobile component snapshots, then wire "visually review the journey screenshots" into the deep-audit + readiness
  lenses. LESSON: when a canonical sync adds a verification REQUIREMENT, immediately check the product can PRODUCE
  what it asks to verify, and file the capture work separately — keep the byte-identical standard untouched.

- **2026-06-28 (run 21) — DEEP AUDIT (folded scout sweep) + 3 file-disjoint changes shipped.** Last
  standalone deep+readiness audit was run 19 (2026-06-27, ~24h prior); this run folded the deep-audit lenses
  into the parallel scout sweep (security/abuse, design/taste, correctness/dead-code, monetization/business-
  case, artifact-freshness — Haiku). Shipped (all gate-green + 2 Sonnet reviewers each, file-disjoint, auto-
  merged):
  - **PR #207 — env-driven mobile distribution config (Track B gate "Distribution/release config is REAL").**
    Removed the hardcoded `extra.eas.projectId: "OWNER_EAS_PROJECT_ID"`; `app.config.ts` now extends `app.json`
    and reads projectId + version + iOS buildNumber + Android versionCode from env. Ticked the two distribution
    boxes.
  - **PR #206 — Track G: rate-limited 12 authenticated mobile/v1 API routes** that had none (recipes, recipe
    detail, profile, digest, list, cooked, capture, onboarding, push-token, pantry, v1/list, v1/pantry); reuses
    the existing per-user limiter. Reads 60/min, writes 30/min, capture 20/min.
  - **PR #205 — design-bar: fixed a broken `bg-ok`/`text-ok` Tailwind token** (undefined in the palette; the
    `success` token is the real one) on the paywall + manage-subscription — the conversion-surface badges were
    rendering unstyled.
  - **LESSON — SDK-version type drift bites config files that were previously JSON.** Moving `app.json` →
    a standalone typed `app.config.ts` literal failed CI: Expo SDK 56's freshly-resolved `@expo/config-types`
    rejects `newArchEnabled` and top-level `splash` as typed `ExpoConfig` properties (TS2353), even though a
    STALE local `node_modules` accepted them (my first local typecheck passed; CI's `npm ci` was stricter).
    The robust fix is the idiomatic Expo pattern: keep the static identity in `app.json` (NOT typechecked) and
    have `app.config.ts` EXTEND it (`config` = app.json contents), overriding only env-driven fields — spreads
    don't trigger excess-property checks. Generalize: when converting a JSON config to a typed `.ts`, expect
    excess-property friction against the installed type version; prefer extend-the-JSON over a hand-typed
    literal, and trust CI's fresh install over a possibly-stale local one.
  - **LESSON — a reviewer's "ExpoConfig has a catch-all index signature" claim was version-specific.** Both
    the maker's local typecheck AND Reviewer A asserted the standalone literal was type-safe; both were reading
    a different `@expo/config-types` than CI resolved. When a type claim hinges on a dependency's `.d.ts`,
    the binding source of truth is the version the GATE (CI) installs, not a local read.
  - **DEEP-AUDIT findings queued (not shipped this run):** (a) Track G — `mobile/discover` POST (swipe
    recording) still lacks a per-user rate limit on its write path (Reviewer A flagged; out of scope of #206);
    (b) weak-case loop-back — the honest median ARR (~$33K) remains below the $100K floor; the monetization
    scout named buildable levers (referral-reward tiering, surfacing the already-built Family tier, a month-3
    annual nudge, win-back/churn sequences) — added as tracked ROADMAP items for future runs to build through
    the gate. Business case unchanged this run (no revenue lever shipped → no honest movement).
  - **Verified-real (not gaps):** RLS on all public tables; Stripe `checkout.sessions.create` + webhook
    `constructEvent` exist (not stubs); the CORS "missing Access-Control-Allow-Origin" scout flag was a FALSE
    POSITIVE (omitting ACAO is the secure default — browsers block cross-origin reads). The independent
    QUALITY_SCORECARD (docs/quality/) does not yet exist → quality-grade DoD box correctly stays a readiness
    blocker (no self-grade; that artifact is the separate Quality Auditor routine's to author).
- **2026-06-27 — marketing maturity gate + pre-launch SITE GATE (market autonomously, never expose a half-baked app).**
  Built a deployment-level guarantee that the Growth Agent markets but NEVER before the product is ready: (1)
  ANALYSIS_PLAYBOOK gains a **marketing maturity gate** with phases (pre_launch → launching → post_launch) gated on
  the SAME evidence the factory uses (independent QUALITY_SCORECARD + readiness, never eagerness); pre_launch is
  WAITLIST-ONLY with a HARD BLOCK — execute-mode public outreach FORBIDDEN until BOTH a channel is connected AND
  `GROWTH_STATUS.site_gate_up: true`. (2) GROWTH_STATUS adds machine-tracked `site_gate_up: false` near
  `awaiting_connect`. (3) Factory builds the **pre-launch SITE GATE** — env-driven middleware (`SITE_GATE_PASSWORD`;
  ON whenever set) that password-protects the deployed app but EXEMPTS the public marketing routes (waitlist/landing
  + `/api/waitlist/confirm` + legal) so people can still join; pure logic in `@gm/core/security/site-gate` (33 tests),
  wiring in `apps/web/middleware.ts`; password VALUE owner-applied (PENDING_OPS: set `=deepster` pre-launch, UNSET at
  launch). ROADMAP H13 carries the BLOCKING note. (4) Growth routine reinforcement (belt-and-suspenders) added to the
  EXECUTE-mode condition via /schedule. LESSON: a "don't expose it yet" rule needs a HARD enforcement surface (env
  middleware) + a machine-tracked precondition (`site_gate_up`) + the playbook + the routine — defense in depth, not
  just a doc. The code gates the app; the human applies the password; the data field unblocks the agent. LLM-Quant
  is exempt (no public marketing/waitlist).
- **2026-06-27 — canonical sync: FACTORY_STANDARD.md gains §6b DESIGN TASTE (eliminate generic-AI frontend).**
  Inserted the shared, byte-identical §6b verbatim between §6 (BUILDS ≠ WORKS) and §7 (Readiness). It sets a
  product-agnostic design bar: before ANY UI decision run THE DESIGNER QUESTION ("would an experienced product
  designer intentionally make this decision?") as a kill-switch; a list of generic-AI slop to AVOID (cookie-cutter
  SaaS dashboards, default/unstyled Tailwind/shadcn, weak type, random spacing, decorative noise, emoji-as-icons,
  3 competing accents, centered-everything hero) and what to GENERATE instead (strong hierarchy, exceptional type,
  deliberate spacing, premium aesthetics, meaningful motion, cohesive system); audit lenses ranked first-impression-
  first (onboarding/paywall/landing/core loop); ENFORCED via Reviewer B on every UI diff + the §10 deep-audit design
  lens (hunts the live UI via §6 screenshots) + the §7 readiness visual review — a generated-looking/"vibe-coded"
  surface is a release-blocking FAIL equal to a red test. Product brand/voice/tokens stay in VISION.md. FACTORY_STANDARD
  remains a STABLE ANCHOR — changes ONLY by canonical sync across all factory repos, never as loop work.
- **2026-06-27 — prod incident: "dashboard not available" = a non-UUID session id, NOT migration drift (found by RUNNING prod, not reading code).**
  Used the Supabase MCP to inspect prod directly (the right move — replicate/observe the real env, don't guess). Two
  separate issues surfaced: (1) MIGRATION DRIFT — prod was missing 0011–0017 (push_tokens, waitlist_submissions +
  UTM/confirm cols, content_schedule, experiment tables); applied via MCP apply_migration (idempotent, additive, all
  RLS-enabled, advisor clean). This had silently broken the PUBLIC WAITLIST in prod but was NOT the dashboard break.
  (2) THE DASHBOARD BREAK — prod postgres logs showed recurring `invalid input syntax for type uuid: "user-1"` in
  bursts of 5; the authed home (`apps/web/app/page.tsx`) runs 5 reads in ONE `withTenant(userId)` tx, and a session
  whose JWT uid is the non-UUID string "user-1" makes the RLS uuid-cast throw → the whole home subtree 500s. "user-1"
  is NOT a real user (all real ids are UUIDs; the normal signup/login path can only set a UUID via `token.uid =
  user.id`) — it's a stale/forged/legacy session cookie. So a real NEW signup works; only that one polluted session
  saw the error. FIX (defense in depth, via gate/PR): added `@gm/core/security/uuid` `isUuid`; `currentUserId()` now
  treats a non-UUID session as signed-out (clean logged-out render instead of 500); `withTenant()` fails CLOSED on a
  non-UUID id (cron/workers too) — inlined regex since `@gm/db` must not import `@gm/core`. LESSONS: (a) BUILDS≠WORKS
  and "didn't reproduce locally" → inspect the REAL prod env; logs named the cause in seconds. (b) Any value that
  reaches an RLS GUC cast to a typed column must be validated at the trust boundary — a malformed identity should fail
  closed (signed-out), never crash a page. (c) A green build hid a broken waitlist (missing table) — runtime/prod
  inspection caught what the build couldn't.
- **2026-06-27 — prod follow-up: "Couldn't load your dashboard" was an UNCAUGHT `auth()` throw, not the DB.**
  After fixing the migration drift + the non-UUID session, the error boundary STILL showed on the deployed app.
  Live prod logs were decisive: NO postgres error and NO app→DB connection for the failing requests — so the throw
  happened BEFORE the DB. Traced the home render (`apps/web/app/page.tsx`): `loadHomeData()` swallows all errors
  (returns EMPTY), so it can't trip the boundary — but `const session = await auth()` (line 232) is UNCAUGHT, and
  `auth()` THROWS (not just returns null) when a session cookie can't be decrypted — e.g. after an AUTH_SECRET
  rotation, or a stale/corrupt cookie. That crashes the whole Server Component into the route error boundary, and a
  cookie-less (incognito) request works because there's nothing to decrypt. FIX: added `currentSession()` in
  `app/lib/tenant.ts` (wraps `auth()` in try/catch → null) and used it in `page.tsx` + `admin/layout.tsx`; a bad
  cookie now degrades to the logged-out view instead of a 500. LESSONS: (a) `auth()`/`cookies()` reads in a Server
  Component must be treated as throwable and wrapped — same as `currentUserId()` already does. (b) READ THE LOGS
  FIRST: "no DB error + no DB connection" instantly ruled out the database and pointed upstream to auth. (c) A
  remediation I suggested (rotate AUTH_SECRET) can itself trigger this class — invalidating cookies must pair with
  code that fails OPEN to logged-out, never crashes. (d) Immediate user unblock for this class: incognito / clear
  cookies (no cookie = no decryption = no throw).
- **2026-06-27 — THE signin/signup outage: `DIRECT_DATABASE_URL` unset in prod → getAdminDb falls back to the RLS-restricted role.**
  After ruling out migrations (#0011–0017 applied), the non-UUID session (#211), and the auth() throw (#212), signup
  STILL failed for fresh accounts. Proven via the Supabase MCP: zero users created since 06-23 despite repeated attempts
  → signup throws BEFORE creating the row. The `users` table has RLS ON (policy `tenant_isolation: id =
  app_current_user_id()`, role `grocery_app`), owner `postgres`, FORCE RLS off (owner bypasses). `getAdminDb()` =
  createDb(DIRECT_DATABASE_URL ?? DATABASE_URL) and runs BOTH signup's INSERT and signin's username lookup. With
  DIRECT_DATABASE_URL `.optional()` and UNSET in prod, getAdminDb silently fell back to the RLS-restricted DATABASE_URL
  (grocery_app) → provisioning + lookup DENIED (no tenant session) → signin AND signup both broken, no user created.
  A direct INSERT under an owner/RLS-bypassing connection succeeds (verified + cleaned up). FIX: owner sets
  DIRECT_DATABASE_URL to the Supabase owner connection (port 5432, role postgres) in Vercel; redeploy. Shipped a
  safeguard: getAdminDb now logs a LOUD error when DIRECT_DATABASE_URL is unset (the silent fallback cost hours).
  LESSONS: (a) An `.optional()` env var that is actually REQUIRED for a critical path in production is a latent outage —
  provisioning/auth must fail LOUD, not silently degrade into RLS denials. (b) When "it works locally but not in prod"
  and the symptom is a generic error boundary, READ PROD: the data (no new users) + the RLS policy + the connection
  fallback logic pinpointed it without ever seeing Vercel logs. (c) Diagnose to certainty before "fixing" — three prior
  defensive PRs (#211/#212) were real hardening but none was THE cause; the cause was deployment config.
- **2026-06-28 — onboarding "Hmm, that didn't go through" = an unbounded LLM call timing out the serverless function.**
  After signup/signin were fixed, the AI taste step dead-ended. Deep trace: the action's try/catch already converts
  LLM errors into a GRACEFUL reply, so the client-only "didn't go through" could ONLY mean the server action
  REJECTED — i.e. the function was KILLED before its catch ran. Cause: `GeminiClient.generateStructured`/`chat` call
  `ai.models.generateContent` with NO timeout/abort (and the SDK retries with backoff), and `onboarding/page.tsx` set
  no `maxDuration` — so a slow/rate-limited (free-tier) key runs past the function limit → kill → client dead-end
  (instead of the graceful fallback). FIX: bound every Gemini call with `withTimeout` (`LLM_TIMEOUT_MS`, default 8s,
  under Hobby's 10s) so a stuck key fails FAST → the action returns its graceful fallback; added `maxDuration=30` to
  the onboarding route for headroom; hardened the client catch to advance with generic chips instead of dead-ending;
  +2 regression tests. OWNER follow-up: enable billing on `GEMINI_API_KEY` (free-tier rate limits are the likely
  trigger) — but the app now degrades gracefully either way. LESSON: bound EVERY external/LLM call with a timeout
  shorter than the function budget; a graceful try/catch is useless if the runtime kills the function first. Wrote the
  reusable method in `docs/autonomous-loop/DEEP_DIAGNOSIS.md` (observe-the-real-env → prove-the-hypothesis →
  find-the-uncaught-throw → verify-in-prod → fix-root-cause+fail-loud → peel-the-next-layer).
- **2026-06-28 — SIDE-EFFECT INTEGRITY: a "success" the user can't verify is a LIE (canonical-sync + P0 fix).**
  A sibling product shipped signup showing "confirmation email sent" while the provider was dry-run/unconfigured —
  BUILDS≠WORKS missed it because it asserts on the SCREEN and email is a side-effect. Closed the blind spot here:
  (1) FACTORY_STANDARD §6 gains the verbatim SIDE-EFFECT INTEGRITY paragraph (no fake success; verify the EFFECT
  end-to-end in sandbox; narrow escape hatch = gate with honest messaging or PENDING_OPS, never a silent dead-end).
  (2) ROADMAP BUILDS≠WORKS bullet + new enforced item F4.1 (email round-trip via Mailpit/sandbox: dispatch→retrieve
  →follow link→confirmed; assert the provider client was invoked with the right recipient/payload; assert no success
  state unless the op truly succeeded). (3) preflight gains a "Side-effect integrity" section: a regression guard
  (waitlist must return a REAL result + the form branches on it) PASSES, and the F4.1 round-trip guard FAILS until
  built (blocks readiness). P0 FIX: `submitWaitlistEmail` returned `void` on EVERY path and the form set success
  UNCONDITIONALLY — so a failed capture (captcha/RLS/missing-table) or a skipped confirm-email (no provider key) still
  showed "you're on the list." Now it returns `WaitlistResult` ("error" | "saved" | "confirm_sent"): success is shown
  ONLY when the row was actually persisted, and "check your email" ONLY when the email truly left (sendEmail.sent ===
  true); failure shows an honest error. Audited the rest — cookbook save is optimistic-WITH-rollback (reconciles to the
  real DB state, honest) and profile redirects only on success (honest). LESSON: every user-facing "sent/saved/charged/
  done" must be causally downstream of the real op; a graceful try/catch that swallows the failure and still returns
  success is the bug. Generalizes to any side-effect (trading "order placed", job "submitted") — prove the effect, not
  the message.
- **2026-06-28 — DECISION COROLLARY: never gate on a dependency loop that doesn't exist (audited; GM clean).**
  A sibling product dead-ended every new user: signup required email verification ("Check your email") but no email
  send was wired — the bug-under-the-bug was a DECISION (introducing a hard gate whose loop was never built). Adopted
  the standing rule in FACTORY_STANDARD §6 verbatim (DECISION COROLLARY: wire the dependency and prove the loop
  end-to-end, OR don't gate on it — a gate on an unbuilt loop is a self-inflicted outage, worse than a bug because it
  was chosen). AUDITED GroceryManager's auth: NO email-verification gate on signup (username+password → immediate
  sign-in → /onboarding), no reset/forgot/verify route, no "check your email" anywhere outside the waitlist (which was
  made honest last run). So the correct call ("don't gate on the unbuilt loop") was already the design — recorded the
  decision in PENDING_OPS (re-enable verification ONLY with a real provider + the F4.1 round-trip test). Added a journey
  assertion (`VERIFY_DEADEND`) so a future "check your email" wall on signup fails the suite. LESSON: when a feature
  needs a loop (email/SMS send, notification sender, share backend, checkout, an emitted trade confirmation), either
  BUILD+PROVE the loop or DON'T gate the flow on it — decide explicitly up front and record the call; a gate on an
  unbuilt loop is the worst kind of failure because it's self-inflicted by a decision.

- **2026-06-28 (run 22) — H13 referral-reward loop shipped (weak-case loop-back: the first of the named
  revenue levers built).** DEEP AUDIT: not due (run 21's folded deep-audit sweep was 2026-06-28, within
  24h) → went straight to the lowest incomplete gate. The binding constraint is the below-floor business
  case (honest median ~$33K), and the ROADMAP's "Revenue levers to BUILD" names H12–H15 as buildable
  value-bar-clearing levers that re-open building. Selected **H13** (referral-reward loop) as the highest-ROI
  clean, self-contained lever: the `?ref=` attribution loop already existed but had NO incentive, so nothing
  drove referrals. Shipped (PR #217, gate-green + 2 Sonnet reviewers, auto-merged):
  - Pure milestone ladder `@gm/core/referral/rewards` (1 friend→1mo, 3→3mo, 5→6mo; INCREMENTAL months sum
    to a hard `MAX_REWARD_MONTHS`=6 ceiling; `earnedRewardMonths`/`referralProgress`/`referralBonusTrialDays`;
    12 tests, 100% cov).
  - New `referral_credits` table (`0018_referral_credits.sql`): RLS tenant-isolation (grocery_app +
    `app_current_user_id()`) + explicit GRANT (mirrors 0017). `grantReferralCredits` idempotent on
    (user_id, reason); `sumReferralCreditMonths`. Wired into migrate.ts + schema.ts.
  - `@gm/db` stays free of `@gm/core` (forbidden cycle) — the caller (`apps/web/app/lib/referral.ts`)
    resolves the ladder and passes (months, reason) grants down. Reconcile-on-read is idempotent.
  - Redemption is REAL + honest (side-effect integrity): earned months convert to bonus free-trial days at
    the user's FIRST Stripe checkout (intrinsically one-time via `isTrialEligible`, best-effort/never blocks
    checkout). Copy on `/invite` (progress ladder + earned months) + `/upgrade` (conversion banner) matches
    the behavior — credits persist AND do work; nothing overpromises.
  - NO adoption % banked — the business case median is deliberately UNMOVED; referral-driven install +
    conversion lift is left to live experiment data (anti-gaming). BUSINESS_CASE lever #3 records the build.
  REVIEW LESSON: Reviewer A's one blocker was a missing explicit `GRANT ... TO grocery_app` on the new table.
  0002's `ALTER DEFAULT PRIVILEGES` normally covers same-owner tables (0011/0012 ship without explicit grants
  and work), but the NEWEST table migration (0017) established the explicit-GRANT convention as defense-in-
  depth against the migration running as a different role — mirror the latest convention for new tables.
  CONVERGENCE CALL: shipped ONE excellent, fully-verified lever rather than rushing H14/H15 (lifecycle emails
  — a comparable-size subsystem needing audience queries + cron + experiment gating + templates). Per
  coherence-over-churn + the value bar, a quiet coherent run that advances the binding constraint is the
  right outcome; H14/H15/H11 remain for the next run.

- **2026-06-28 (run 23) — built H14 + H15 (the remaining named lifecycle revenue levers) + 2 CRITICAL
  hardening fixes; DEEP AUDIT folded into the scout sweep (last standalone run 19; runs 20–22 folded, within
  the cadence).** 3 file-disjoint PRs (#219 #220 #221), each gate-green + 2 Sonnet reviewers, auto-merged.
  The 'ready' issue was NOT opened (honest median ~$33K < $100K floor, reach-gated; QUALITY_SCORECARD absent).
  - **H14/H15 as ONE coherent lifecycle-email subsystem (PR #221).** Migration 0019 `lifecycle_email_sends`
    (RLS tenant-isolation + explicit GRANT, unique (user_id, email_type)); candidate queries off the
    `preference_signals` ledger; pure tested `@gm/core/lifecycle/emails`; two CRON_SECRET cron routes via a
    shared runner; CAN-SPAM `/api/email/unsubscribe` + opt-out filter. The `migrations (fresh db)` CI job
    validated 0019 on the full chain.
  - **LESSON — when two ROADMAP items share infra (table/cron/registry/runner), build them as ONE coherent
    subsystem, not two colliding PRs.** H14 + H15 share `lifecycle_email_sends`, `runLifecycleCampaign`,
    migrate.ts/schema.ts/index.ts, and the experiment registry — so they CANNOT be file-disjoint separate PRs
    in one run. Building both together (with the second lever's marginal surface ≈ one query + one builder +
    one ~20-line route + one registry entry) maximized the run without violating the disjoint rule. The
    migration-bearing files (migrate.ts/schema.ts/index.ts) are a SHARED RESOURCE: only ONE migration-bearing
    change can ship per run — H11 (also needs a new table) was correctly deferred rather than colliding on
    those files.
  - **LESSON — write the test that catches the XSS, then fix the bug it finds.** My own `emails.test.ts`
    escape-assertion FAILED on first run: the user-set `name` was interpolated into the email HTML unescaped
    (the builders escaped some fields but not the greeting). The test caught a real stored-XSS-class bug
    before review. Any builder that puts user-controlled DB values into HTML must escape at EVERY
    interpolation point; a shell() that takes raw `bodyHtml` must document that the CALLER escapes its dynamic
    values (and the test must prove it).
  - **LESSON — SIDE-EFFECT INTEGRITY on a fan-out sender: record the idempotency row BEFORE counting "sent",
    and only count a true provider send.** Reviewer A (correctly) caught that `sent++` ran before
    `recordLifecycleEmailSent`, with the record failure swallowed → an email counted sent but unrecorded →
    re-sent next run. Fix: `await record` first, `sent++` only on success, a record failure → `failed++`
    (honest report; ON CONFLICT-safe retry re-records). And a recipient is recorded ONLY when the provider
    returns sent=true — a dry-run (no provider) is `skipped` and NOT recorded, so the campaign retries once
    connected (no fake success). Generalizes: for any batched side-effecting job, "count it done" must be
    downstream of the durable record, and the durable record downstream of the real effect.
  - **LESSON — don't promise an offer you didn't build.** The H15 spec mentioned an "optional one-time
    discount", but no coupon is wired into Stripe checkout — so the win-back email promises NO discount
    (variants change FRAMING only), with a test asserting the output contains no "discount"/"coupon"/"% off"/
    "promo". Honest copy beats a real-looking promise the checkout can't honor.
  - **VERIFIED-REAL (not a bug):** on cancellation the Stripe webhook writes `entitlement = NULL` (and
    `subscription_tier = NULL`); entitlement is BINARY (`premium`|`null`, never an intermediate string), so
    the win-back churn check `entitlement IS DISTINCT FROM 'premium'` + an `ever_premium` join is correct.
    The security scout's "account DELETE missing parseJsonBody" was a FALSE POSITIVE (already guarded). The
    `/api/cron` prefix is already in the middleware PUBLIC allowlist (CRON_SECRET is the limiter); no
    vercel.json exists (cron scheduling is an owner/deploy step, like the digest cron — documented, not
    committed).
  - **DEFERRED FINDINGS → next run (from the folded deep-audit sweep):** (a) DESIGN/STORE-COMPLIANCE (HIGH) —
    the `household` perk is shown in `PREMIUM_PERKS` on `/upgrade` while `FEATURE_HOUSEHOLDS` defaults OFF
    (Apple 2.3.1 "advertise only shipped features" risk); ENTANGLED with the Family tier value prop ("up to 5
    members"), so it needs a product decision (enable the flag + prove household sharing works, OR gate the
    perk + reframe Family) rather than a quick edit — investigate + fix next run. (b) H12 onboarding
    "cook together" Family moment (the /upgrade Family card already exists since PR #154 — only the onboarding
    surface remains; marginal). (c) H11 cohort-retention data source (needs the next migration). (d) F4.1
    email round-trip (needs Mailpit/docker) + F6 visual screenshots (need a live seeded e2e run to produce
    REAL committed artifacts — can't honestly commit empty screenshots). (e) minor: log swallowed errors on
    the best-effort onboarding profile/taste saves (silent data-loss observability). NOT actioned (churn):
    the unused PageHeader `accent` prop across 20+ call sites.
- **2026-06-28 — PMF is the leading indicator behind the number (canonical sync + product wiring + routine read-list).**
  Adopted PMF-as-the-leading-indicator. REPO: (1) FACTORY_STANDARD §9 gains the verbatim PRODUCT-MARKET FIT paragraph
  (revenue FOLLOWS PMF; interpret live activation/RETENTION/organic-pull/engagement continuously; PRE-PMF the priority
  is the PRODUCT — fix activation/retention/the core loop/the "aha" — NOT scaling acquisition into a leaky bucket;
  reconcile the business case against real cohort data — if metrics contradict the model, METRICS win; honest measurement
  only). (2) Product-specific: ANALYSIS_PLAYBOOK gains a "Product-market fit — the leading indicator" section that GOVERNS
  the RECOMMEND step (defines activation = a non-empty app-derived pantry + first suggestion; RETENTION = weekly-cohort
  return on the list→cook→buy loop, a flattening curve = the signal; pre-PMF → product/retention fixes, not acquisition).
  (3) ROADMAP GROWTH SIGNAL→BUILD PRIORITY gains a "PMF FIRST" bullet. (4) GROWTH_STATUS gains a machine-tracked `pmf`
  block (activation_rate, retention_d1/d7/d30 + weekly w1/w4 + curve_flattening, organic_share_rate, signal:
  none|weak|emerging|strong; 0/null pre-launch; valid YAML). Also fixed a pre-existing red gate: the `experiment-secret`
  OWNER_ACTION had priority `low` (not in the dashboard contract's urgent|high|normal) → set to `normal` so OWNER_ACTIONS
  parses again. ROUTINE: added `Read FACTORY_STANDARD.md FIRST` to the orient read list of the GroceryManager factory +
  growth routines (model/cron/sources/tools/MCP preserved); pure digest/dashboard reporters left untouched (they don't
  follow the operating standard). LESSON: pre-PMF, pouring growth into a leaky bucket wastes spend + the run — let the
  live retention/activation read GOVERN what gets built and marketed; revenue follows PMF, never the reverse.
- **2026-06-28 — STRATEGIC OUTREACH for the Growth Agent: curated, human-reviewed Gmail DRAFTS only (repo + routine).**
  Added a high-leverage but tightly-railed channel: the Growth Agent MAY draft a FEW deeply-personalized 1:1 outreach
  emails to genuinely strategic targets (press/partners/overlapping communities/newsletter curators) as Gmail DRAFTS for
  the OWNER to review + send — it NEVER sends (its Gmail tool is create_draft only). Curation, NOT cold-email at scale.
  REPO: created docs/growth/OUTREACH.md (the playbook; RAILS verbatim — draft-only/human-sends; high-confidence + name
  recipient+why+anticipated-reply or don't draft; a few/run max, zero is fine; real PUBLISHED contacts via WebSearch,
  never invent/scrape/harvest PII; honest + opt-out + CAN-SPAM/GDPR-clean; pre-launch links to the waitlist; maker≠checker
  review — target-type examples adapted to GroceryManager's food/cooking/grocery/personal-finance space); added a
  "Strategic outreach" pointer to ANALYSIS_PLAYBOOK; added a machine-tracked `outreach` block to GROWTH_STATUS
  (drafted_7d, owner_sent_7d, replies_7d owner-reported-never-fabricated, signal: none; 0/null pre-launch; valid YAML).
  ROUTINE: added docs/growth/OUTREACH.md to the Growth Agent's ORIENT read list; added a (3b) STRATEGIC OUTREACH
  (DRAFT-ONLY) step; reconciled HARD BOUNDARIES to note the ONE drafting exception (create Gmail DRAFTS for the owner to
  review+send; still NEVER auto-send). Preserved model (Sonnet) / cron (0 14 * * *) / sources / allowed_tools / Gmail MCP.
  LESSON: outreach is curation, not volume — a quiet run with zero drafts is success; a pile of generic cold drafts is
  failure; the human always sends.
- **2026-06-28 — outreach drafts surface on the factory dashboard via OWNER_ACTIONS.** Added a "Surfacing on the
  factory dashboard" note to docs/growth/OUTREACH.md: when strategic-outreach drafts await the owner, the Growth Agent
  files/refreshes ONE OWNER_ACTIONS item in PENDING_OPS.md (id: review-outreach-drafts, "Review + send N strategic
  outreach drafts (Gmail)") and decrements/closes it as the owner sends (honest counts, never stale) — that's what makes
  the review surface on the dashboard, which already renders OWNER_ACTIONS; the GROWTH_STATUS outreach block stays current
  for the tile. No routine change needed (the routine already reads OUTREACH.md for the full rails).
- **2026-06-28 — canonical sync: visual verification goes DUAL-AXIS (prove the app WORKS *and* looks right).**
  Replaced FACTORY_STANDARD §6's "SEE WHAT THE USER SEES" paragraph (verbatim) so the vision-capable judge reviews each
  journey screenshot on TWO axes: (1) FUNCTIONAL REALITY — does the screen VISIBLY show the intended outcome (a populated
  working screen / the REAL produced artifact / correct data-state), catching a visibly wrong/empty/placeholder/spinner/
  broken/dead-end result the DOM "passed" over; and (2) DESIGN — on-brand, clears the VISION bar (not blank/broken/
  overlapping/unstyled/vibe-coded). A FAIL on EITHER axis is release-blocking even if DOM assertions pass. Now captures at
  every page AND every key STEP of every end-to-end journey, mobile + desktop widths. Sharpened ROADMAP F6 DoD to BOTH:
  (1) ARTIFACTS — committed NON-ZERO screenshot for every route/state + every journey STEP (web Playwright →
  apps/web/e2e/__screenshots__/ at mobile+desktop; screenshot the CORE-PRODUCT OUTPUT — rendered pantry/dashboard,
  cook-suggestion, parsed-receipt→pantry, paywall — so the judge sees the real deliverable); (2) DUAL-AXIS VISION VERDICT —
  the deep audit + readiness gate OPEN each image and RECORD a per-screenshot FUNCTIONAL + DESIGN verdict (loop-memory for
  the audit, readiness-issue evidence for the gate); capture-and-forget does NOT satisfy it. Added a preflight honest-tick
  guard: F6 [x] but <5 non-zero images in apps/web/e2e/__screenshots__/ → FAIL; no-op while [ ] (verified no-op now).
  BUILD ORDER: this harness is captured BY the functional journey suite, so it comes AFTER that suite is wired — harden the
  spec + gate now (this change), build the capture/vision code when F6 is reached; the guard keeps the tick honest.
- **2026-06-28 — made "self-improving" MEASURABLE: LOOP_HEALTH metric + classify abandoned changes + META self-check.**
  We measured product quality (QUALITY_SCORECARD) but not whether the LOOP itself improves vs. just gets busier, and
  abandoned build-changes weren't classified (so dead-ends got re-attempted). Fixed: (1) seeded
  docs/autonomous-loop/LOOP_HEALTH.md (contract + fenced YAML: this_run shipped/abandoned + abandoned_reasons enum adapted
  to the GM stack [gate_tsc/gate_test/gate_build/gate_mobile/review_*/circuit_breaker/conflict/dead_end/blocked_owner],
  verify/review failures, circuit-breaker trips; rolling_7d merged/reverts/readiness + recurring_failures +
  harness_proposals_open; signal bootstrapping|improving|steady|churning|stuck) — updated EVERY bookkeeping run with REAL
  git/gh counts, honest-only, observability NOT a ship gate. (2) FACTORY_STANDARD §10b verbatim (loop health: classify
  every abandoned change so the loop never re-attempts the same dead-end; churning/stuck → open ONE harness improvement
  proposal — the ONLY channel to improve the loop's OWN rules since it can't edit its routine/.claude). (3) ROADMAP: a
  LOOP HEALTH bullet in the bookkeeping note + LOOP_HEALTH added to the LIVING-ARTIFACTS list. (4) META self-check of the
  last ~10 runs: the SAME wall recurred — the loop can't enforce its functional-E2E / lint / (soon F6 visual) gates in CI
  because it can't edit .github/ (tracked only as owner actions wire-e2e-journeys-ci + ci-workflow-scope, never as a
  harness proposal). Opened the first `loop: harness improvement proposal` issue #232 and recorded it in LOOP_HEALTH
  (harness_proposals_open: 1). LESSON: a recurring wall that never raises a harness proposal is a DEAD signal — the loop
  improves the product autonomously, but improving the loop's OWN rules only happens if it escalates the signal.
- **2026-06-29 — META channel closed end-to-end: harness proposal #232 → enforced functional/lint gates in CI (#234).**
  The loop-health META self-check raised #232 (the loop's quality gates weren't enforced as blocking CI checks because the
  loop can't edit .github/). RESOLVED from an interactive session (which HAS workflow scope; the headless cron correctly
  can't): added two CI jobs in #234 — `lint` (eslint --max-warnings=0) and `e2e functional journeys` (build → migrate a
  throwaway pgvector Postgres → `next start` → replay the outcome-asserting journeys). The FIRST CI run failed and caught
  two REAL gaps the local runs hid: (1) next-auth v5 refused the untrusted localhost host (no AUTH_TRUST_HOST) so the
  credentials sign-in callback couldn't redirect → signup hung; (2) the 5/hour signup limiter throttled the self-seeding
  suite from one runner IP. Fixed: AUTH_TRUST_HOST/AUTH_URL in the e2e job + a test-only RATE_LIMIT_DISABLED bypass (gated
  on an env var prod NEVER sets). Re-ran → both green (~2m). Then set branch protection required_status_checks =
  verify, mobile, migrations (fresh db), lint, e2e — so a build-but-broken / lint-failing change CANNOT auto-merge.
  Updated LOOP_HEALTH (harness_proposals_open 1→0, recurring_failures cleared). LESSONS: (a) the META channel WORKS —
  a recurring wall, escalated as a proposal, got resolved; (b) "verify in CI before marking required" caught a real
  red gate (don't hand the loop a broken/flaky required check); (c) wiring functional E2E in CI surfaces env-config bugs
  (auth trust-host, rate-limit-per-IP) that single-run local tests never hit. F6 dual-axis visual extends the same e2e
  job when built.
- **2026-06-29 — deploy-time automation reference doc + the auto-migrate recoverability rail (Part A/B follow-up).**
  GroceryManager already has Part A (required lint + e2e functional-journey CI checks — #234, verified green before
  marking required, with AUTH_TRUST_HOST + the RATE_LIMIT_DISABLED test-only bypass) and Part B (migrate-prod job —
  #236, forward-only, default-branch + post-gate, gated on a secret) LIVE. This follow-up added the two pieces the
  deploy-automation directive calls for that I'd skipped: (1) docs/ci/PROPOSED_CI.md — the canonical record of the LIVE
  gate + auto-migrate jobs (with the two gotchas) + the required-checks list, doubling as the cross-factory reference
  template; (2) the Part-B SAFETY RAIL I glossed: an OWNER_ACTION enable-db-pitr-backups (enable Supabase PITR/daily
  backups FIRST as the recoverability net) + a stated TRADEOFF on enable-auto-migrate-secret (auto-migrate removes the
  human schema checkpoint — the fresh-DB validation + 2-reviewer/RLS review + PITR are the conscious replacement).
  LESSON: auto-applying migrations to prod is safe ONLY with the net in place — name the tradeoff and require backups
  before the convenience, don't smuggle it in.
- **2026-06-29 — quality gate is now ENFORCED for admins too (enforce_admins) + the loop waits for CI (--auto, never --admin).**
  GroceryManager already had lint + the functional E2E journey suite as required CI checks (#234). This adds the teeth the
  directive calls for: (1) enforce_admins=true on main branch protection — without it, requiring checks is toothless for the
  loop (its --admin would bypass); WITH it, even an admin/the loop must merge via --auto and wait for green. strict=false
  keeps file-disjoint PRs auto-merging. (2) The RATE_LIMIT_DISABLED test bypass now FAILS CLOSED: rateLimitBypassActive
  (@gm/core/security/rate-limit-guard, +5 tests) THROWS at boot if the flag is set in a real production runtime
  (VERCEL_ENV=production, or NODE_ENV=production && !CI) — so the CI-only abuse-protection bypass can never silently disable
  rate limiting on the live platform; CI (CI=true) is the only allowed prod-mode runtime. (3) ROADMAP gains a SHIPPING
  PROTOCOL note + the routines' MERGE sections get the explicit "--auto, NEVER --admin, a red required check blocks → fix
  ≤2 or abandon" rule. (4) LOOP_HEALTH.enforced_in_ci: true. ORDER (don't lock out): repo+routine changes + verify-green
  FIRST, then enforce_admins. LESSON: a required check is only real if admins (the loop) can't bypass it — pair required
  checks with enforce_admins AND the --auto protocol so the loop doesn't get stuck and reach for --admin.
- **2026-06-28 — enforce_admins flipped LIVE + end-to-end validated (the loop now genuinely WAITS for CI).**
  Closing the loop on the prior entry: after #241 merged GREEN (all 5 required checks SUCCESS — verify, mobile,
  migrations (fresh db), lint, e2e functional journeys), turned on the teeth in the directive's safe order
  (repo+routines first, verify-green, THEN protection): `enforce_admins=true`, `strict=false`, contexts = the exact
  5 job names. Confirmed `allow_auto_merge=true`. This very PR is the end-to-end VALIDATION: shipped via
  `gh pr merge --auto` — it sits BLOCKED on the required checks and only squash-merges once they go green, proving
  (a) every required context name matches a real job (a typo'd context would hang the PR forever) and (b)
  enforce_admins doesn't break `--auto` for the loop. The three routines (factory/growth/auditor) now carry the
  "--auto, NEVER --admin" merge rule. LESSON: don't trust a protection config until a real PR has both BLOCKED on it
  and then auto-merged through it — validate the gate with the gate, not by reading the settings JSON.
- **2026-06-29 (run 24) — DEEP AUDIT (folded scout sweep + a LIVE functional run) + 3 file-disjoint PRs:
  H11 + F6 cleared, a store-compliance bug caught BY the F6 screenshots and fixed.** Last standalone deep
  audit was run 19; runs 20–24 fold it into the scout sweep + (this run) an actual end-to-end app run, which
  is the strongest form (FUNCTIONAL REALITY = an ACTUAL RUN, not a code read). Stood up the full e2e env
  locally: docker daemon started, but the **pgvector docker image pull is BLOCKED by the org egress policy
  (403)** — so used the locally-installed Postgres 16 + `apt-get install postgresql-16-pgvector` + a `postgres`-
  user cluster, ran the migration chain + `db:seed` (the keyless pantry add needs the seeded `units`/`each`
  base unit — a fresh DB without the seed throws "seed missing base unit 'each'"), built `web` in production,
  `next start`, and replayed Playwright. THREE merged/merging PRs, all file-disjoint:
  - **H11 (PR #240, MERGED)** — cohort-retention data source (see ROADMAP H11 done-note). Aggregates-only,
    admin/cron-gated, honest-null; migration 0020. 2 Sonnet reviewers APPROVE.
  - **F6 (PR #243, MERGED)** — `apps/web/e2e/screenshots.spec.ts` + 22 committed non-zero PNGs (mobile+desktop)
    of the real app, incl. the core-product OUTPUT. **DUAL-AXIS VISION VERDICT (I opened every image):**
    `01-marketing-home` FUNCTIONAL=intended-outcome-visible (full landing: hero, features, trust, pricing
    $0/$4.99/$39.99, waitlist) / DESIGN=PASS (clean, on-brand green, strong type). `02-signup` FUNC=visible /
    DESIGN=PASS. `03-onboarding-profile` FUNC=visible (step 1 of 4, progress bar) / DESIGN=PASS. `04-pantry-
    populated` FUNC=**populated output** (Olive Oil/Eggs/Spaghetti/Canned Tomatoes/Parmesan, each "in stock"
    + real run-out dates "runs out ~2026-…") / DESIGN=PASS. `05-dashboard` FUNC=real ("5 items tracked",
    activation checklist with step 2 auto-completed, "You're all stocked up") / DESIGN=PASS. `06-list`
    (Reorder "Nothing due right now" — correct: freshly stocked) / `07-recipes` ("No suggestions yet") /
    `08-plan` ("No weekly plan yet") / `09-discover` ("Nothing to discover yet") — all FUNC=honest on-brand
    EMPTY states (no recipe corpus/LLM locally — correct degradation, not defects) / DESIGN=PASS. `10-profile`
    FUNC=full settings incl. the account-deletion danger zone (Apple 5.1.1(v)) / DESIGN=PASS. `11-upgrade-
    paywall` FUNC=real pricing ($4.99/$39.99, honest "preview — billing turns on once Stripe is connected";
    Family card correctly ABSENT per PR #227 gating) / DESIGN=PASS. **Every surface PASS on BOTH axes; zero
    release-blocking visual failures.** 2 Sonnet reviewers APPROVE.
  - **Store-compliance fix (PR #244)** — the F6 screenshots CAUGHT a real bug the DOM tests missed: the
    logged-out marketing landing (`apps/web/app/page.tsx`) advertised "Family / household sharing" in its
    Premium pricing card while `FEATURE_HOUSEHOLDS` defaults off — the exact Apple 2.3.1 / Google accurate-
    listing risk PR #227 fixed on `/upgrade` but MISSED on the landing. Mirrored `/upgrade`'s
    `householdsEnabled()` gate; live-verified the landing now lists 0 "household sharing" while everything else
    renders. 2 Sonnet reviewers APPROVE. LESSON: a visual artifact pass earns its keep — it found a
    store-rejection-class inconsistency that 408 unit tests + the DOM-asserting journey suite all passed over.
  - **NOT shipped this run (honest):** (a) **H12** (surface Family/household at paywall+onboarding) stays
    `[ ]` — a scout confirmed it's BLOCKED on a product DECISION (ship `FEATURE_HOUSEHOLDS=1` live, reverting
    part of PR #227's gating + building the household sharing surface, OR keep it dark and accept zero Family
    adoption). The billing tier + checkout + the household feature (RLS-tested) are built but flag-dark; an
    onboarding "cook together" moment doesn't exist. Honest-advertising it without shipping households live
    would re-introduce the PR #227 violation. Filed as an OWNER decision in PENDING_OPS. (b) **F4.1** (email
    side-effect round-trip) stays `[ ]` — the email client sends via provider HTTP APIs (Resend/SendGrid/
    Postmark), NOT SMTP, so Mailpit (an SMTP sink) won't intercept it without adding an SMTP transport to
    `packages/core/src/email/index.ts` + a dep; AND the Mailpit docker image is egress-blocked here; AND the
    CI wiring is a `.github/` change the headless loop can't make. Next focused run: add an SMTP transport path
    (gated on a test env var), prove the waitlist double-opt-in round-trip against a local SMTP catcher, file
    the CI-service wiring as an owner/interactive action.
  - **DEEP AUDIT verdict:** no new CRITICAL findings beyond the landing store-compliance bug (now fixed).
    Security/RLS: H11's admin-bypass query is aggregates-only (verified by Reviewer A). Functional reality:
    every core surface renders its real screen or an honest on-brand empty state — zero dead-ends/error
    boundaries across 22 captures. Remaining DoD gaps: F4.1 + H12-decision (both above) → factory is NOT yet
    submission-ready; did NOT open the 'ready' issue. LESSON: when egress blocks the canonical infra (docker
    images), reach for the local equivalent (apt postgres + pgvector) rather than abandoning the live run —
    the live run is what produced the real artifacts AND found the real bug.
- **2026-06-29 (run 25) — F4.1 side-effect round-trip CLOSED with a file-capture transport (no Mailpit/SMTP).**
  F4.1 had been deferred twice on the same wall: the email client sends over provider HTTP APIs (not SMTP),
  Mailpit's docker image + SMTP egress are both blocked here, and the CI wiring is a `.github/` edit the
  headless loop can't make. The unlock was to stop trying to intercept at the SMTP layer and add a TEST/CI
  **file-capture transport** to the email module itself, gated on `EMAIL_CAPTURE_DIR`: `sendEmail` writes
  the payload to a JSON file in that dir and reports a real send. A Playwright spec submits the waitlist,
  reads the captured file from the SHARED filesystem (server writes, test reads — no env handshake needed
  beyond both seeing the same dir), extracts the confirm link, and proves dispatch→retrieve→confirm
  (`?confirmed=1`, DB `confirmed_at` set) PLUS the negative (a tampered token → `?confirmed=0`). Ran it
  GREEN against a built app + apt-postgres/pgvector (same local-infra trick as run 24). Two safety rails
  that earned reviewer approval: (1) the capture guard **fails closed** in prod (throws if EMAIL_CAPTURE_DIR
  is ever set in a Vercel/NODE_ENV=production-non-CI runtime) — mirrors the rate-limit bypass guard so the
  sink can never silently swallow live customer email; (2) the throw is DELIBERATELY outside sendEmail's
  provider try/catch (fail-closed = crash, not swallow) with a comment so no one "fixes" it. LESSONS:
  (a) when the canonical test double (Mailpit/SMTP catcher) is unreachable, a tiny in-app file sink at the
  transport boundary is a legitimate, zero-dependency equivalent — capture where YOUR code emits, not where
  the protocol delivers; (b) any test/CI behavioral bypass (rate-limit OFF, email-to-disk) MUST fail closed
  in a prod runtime, or it's a latent outage/abuse hole — make the guard a reused pattern, not a one-off;
  (c) wire the new proof into preflight as a RAN-GREEN flag (E2E_ROUNDTRIP_PASSED=1), not a mere file-exists
  grep, so the tick can't be faked. Two scouts found zero other value-bar work → a deliberately quiet,
  coherent run (one real gate closed). Still NOT submission-ready: business-case floor (reach-gated, #190)
  + missing QUALITY_SCORECARD keep the DoD open; did not open the 'ready' issue.

- **2026-06-29 (run 26) — converged quiet run: orchestrator verification dissolved a full scout sweep down to
  one real fix (PR #250, paywall a11y).** Ran the full ~5-Haiku-scout sweep. The run's value was the FILTER, not
  the fan-out: 4 of ~6 surfaced candidates were scout errors that would have been churn if shipped —
  (a) "experiment-stats untested" (it's fully covered in the consolidated `growth/experiments.test.ts`; scout
  looked for a co-located `stats.test.ts`); (b) "Gmail banner bait-and-switch" (hallucinated copy — the real
  banner is an honest "See Premium" upsell); (c) "surface the invisible /invite loop" (already registered in
  `lib/sections.ts`); (d) "pantry/waste/capture untested" (thin DB-bound wrappers whose pure cores are already
  tested — testing them needs a brittle Drizzle mock). Security/RLS + Track G CLEAN (only a fail-closed CORS
  doc nit); artifacts CLEAN (BUSINESS_CASE pricing + summary reconcile with billing config). The empty-state
  emoji + profile danger-zone "design" findings were already DESIGN=PASS in run 24's F6 dual-axis review, so a
  25-file sweep against that fresh verdict would be churn. Shipped the ONE genuine value-bar clear: PR #250 —
  `/upgrade` plan titles `<p>`→`<h3>` (AT heading navigation, WCAG 1.3.1/2.4.6) + `aria-disabled`/`aria-label`
  on the three identical disabled "Coming soon" CTAs. No visual/logic change; gate green (669 core tests);
  2 Sonnet reviewers APPROVE. Did NOT open the 'ready' issue — unchanged non-buildable blockers: the
  QUALITY_SCORECARD (separate Quality-Auditor routine; not authored here), the honestly reach-gated business
  case (all named buildable levers H13/H14/H15 already built; only owner reach remains), and the H12 owner
  product decision. LESSON: in a converged product, cheap high-recall scouts over-report; the load-bearing step
  is the Opus orchestrator dissolving false positives against real code before selection. A converged sweep's
  honest output is usually ONE real fix + "the rest didn't clear the bar" — padding the batch is the failure
  mode the value bar forbids. (Within 24h of run 24's deep audit, so no fresh standalone DEEP AUDIT stamp due;
  this sweep doubled as discovery and found no new CRITICALs.)
- **2026-06-29 (run 27) — a converged sweep can still hide a CRITICAL: the captcha had no client half.**
  Ran the full ~5-Haiku scout sweep (deep audit folded — last standalone run 24, within 24h). Unlike the
  prior two quiet runs, this one found a genuine **CRITICAL** plus 5 clean disjoint value-bar clears, all
  shipped (6 PRs, each 2-Sonnet-reviewer-approved, auto-merged through the required CI checks; #257 + #255
  merged directly once their checks went green). **The CRITICAL (#252):** signup + waitlist verify a
  Cloudflare Turnstile `cf-turnstile-response` token server-side, but NO widget ever rendered the token —
  so once the owner sets `CLOUDFLARE_TURNSTILE_SECRET_KEY` in prod (PENDING_OPS instructs it at launch),
  `verifyTurnstile(null)` rejects EVERY signup/waitlist submit (self-DOS), and G5 bot protection was a
  no-op regardless. Built a `<Turnstile>` client component (renders nothing + server fail-opens when the
  SITE key is absent → CI/dev unaffected; renders the challenge + threads the token via a single
  React-controlled hidden input AND an onToken callback when present). The other 5: two WCAG-Level-A
  form-label fixes (#253 /import, #254 /capture) and three 0-test→tested pure-logic modules (#255 scheduler
  channel guardrail — the security-relevant "never post to undisclosed channels" invariant incl. the
  casing/whitespace bypass; #256 the FDC macro parser; #257 the LLM tier-escalation cost terminator).
  **LESSONS:** (a) a green gate is NOT coverage of a two-sided contract — the captcha sat behind 408 unit
  tests + a DOM-asserting E2E for many runs because every test ran key-absent (fail-open), so nothing ever
  exercised the enforced path. When code "verifies a token/signature/nonce," check the PRODUCER exists,
  not just that the verifier is wired — this is the BUILDS≠WORKS failure mode at the integration seam.
  (b) Convergence is not monotonic: runs 25/26 were honestly quiet (1 fix each), but a fresh adversarial
  security lens still turned up a launch-blocker run 27 — keep running the full sweep, don't assume "nothing
  left." (c) When the loop builds what a doc said was an owner step, fix the doc in the SAME run
  (PENDING_OPS turnstile-keys: "add the widget script" → reduced to "set the two env vars") — a stale
  owner-action is a living-artifact bug. DEEP AUDIT: folded into this sweep (no new CRITICALs beyond #252,
  now fixed); RLS/Track-G otherwise CLEAN per the security scout (rate limits, spend ceiling, headers,
  error hygiene, double-opt-in all verified present). Still NOT submission-ready (FYI #190 floor + absent
  QUALITY_SCORECARD).

- **2026-06-29 (run 28) — consumed the first independent QUALITY_SCORECARD (overall B) as the run's
  work-list; drove both ship-critical B dimensions toward A in 4 file-disjoint PRs (#263–#266).** The
  Quality Auditor's baseline grade (PR #259) named two ship-critical gaps with file:line precision —
  the maker's job was simply to build them (consume the grade, never self-author it). Lessons:
  - **A native dep CAN be added in the headless env when egress allows it.** `npm install
    react-native-purchases@10.4.0` succeeded (RN ≥0.73 supports the mobile RN 0.85; it AUTOLINKS under
    Expo prebuild — NO `app.json` config-plugin entry needed, which removed the biggest risk). The
    mobile CI job only runs `npm ci && npm run typecheck`, so the SDK's bundled types are enough for
    green; a full native build is the owner's EAS step. Verify reachability with `npm view <pkg>
    version` before committing to the change.
  - **Mobile IAP is only "done" when the purchase LOOP closes server-side (side-effect integrity).**
    A `purchasePackage()` that charges the card but never unlocks server premium is a fake-success
    dead-end. Built the RevenueCat → `/api/webhooks/revenuecat` → `appendPreferenceSignal` path writing
    the SAME `preference_signals` the Stripe webhook does, so `isPremium()` works regardless of origin.
    `Purchases.logIn(userId)` pins RevenueCat `app_user_id` to the DB user so the webhook maps back.
  - **Webhook auth: hash both sides (SHA-256) before `timingSafeEqual`, don't length-precheck.** A
    Sonnet reviewer caught that `a.length === b.length && timingSafeEqual(a,b)` leaks length and mishandles
    multi-byte UTF-8; `timingSafeEqual(sha256(header), sha256(secret))` is always 32 bytes, constant-time,
    no leak. ALSO: a `400 "not configured"` returned BEFORE the auth check is a config-state ORACLE
    (400=no secret vs 401=wrong token) — collapse both to an identical 401 so the response can't be probed.
    (The Stripe/gmail webhooks still use the older length-precheck; the sha256 form is the better pattern
    for new webhooks.)
  - **The ledger-only-invariant fix was SMALLER than it looked because reproject already did the work.**
    `reprojectStock` computes `lastConfirmedAt` from the `vision_confirmed` ledger event (max of confirm
    timestamps), so the direct `db.update(pantryStock).set({ lastConfirmedAt, source })` was redundant
    except for `source`. Fix = thread one optional `source` param; `...(source ? { source } : {})` in the
    upsert `values` means a new row defaults to `derived` and an existing row's source is PRESERVED on a
    routine reprojection (Drizzle omits undefined keys from the SET). When fixing an "extra write", first
    check whether the canonical path already produces the same effect — often it does.
  - **Captcha fail-OPEN on a network error is an attacker-inducible bypass; fail CLOSED in prod.** The
    catch returned `{success:true}` in ALL envs even with the key configured — induce a 3s timeout and bot
    protection is gone. Made it `NODE_ENV==="production" ? reject : allow`, matching the repo's fail-closed
    posture (cron secret, email-capture, webhooks). Both reviewers weighed the availability tradeoff
    (a brief Cloudflare siteverify outage blocks a few signups) and approved — signup/waitlist are
    low-frequency, high-value-to-attacker flows.
  - **DEEP AUDIT: folded into this run** (last standalone run 24, within ~24h via runs 25–27). The
    adversarial security + functional/artifact Haiku scouts found NO new CRITICALs beyond the scorecard's
    named gaps; the only fresh item was the captcha fail-open (shipped #265). The in-memory rate-limit/
    LLM-quota "multi-instance bypass" the security scout raised is the already-tracked owner Redis upgrade
    (PENDING_OPS llm-quota-redis-upgrade), not a new finding.
  - **Did NOT open the 'ready' issue.** Quality grade is still B until the Quality Auditor re-grades (a
    box stays ticked only when an independent checker confirms — and the maker never self-awards the grade);
    business-case floor remains reach-gated (FYI #190). A quiet, honest "built the named gaps, grade not
    yet re-earned" is the correct converged state.
- **2026-06-29 — self-validation tripwire: the loop can't merge a capability CI can't PROVE (#268).**
  Found a real silent-green hole: apps/web/e2e/email-roundtrip.spec.ts did `test.skip(!EMAIL_CAPTURE_DIR)`,
  and CI never set EMAIL_CAPTURE_DIR — so the waitlist email round-trip SKIPPED and the suite passed without
  ever validating the side-effect. Fix has two parts: (1) wired EMAIL_CAPTURE_DIR (a temp dir, NOT a secret)
  into the e2e job + ran `e2e email-roundtrip` (resolves wire-e2e-roundtrip-ci; the round-trip now validates
  green in CI). (2) A general TRIPWIRE so this can't recur: packages/config/capabilities.json declares each
  active capability + how it's proven KEYLESS in CI (an e2e spec the job runs, or a unit/degrade test, + any
  requiresCiEnv); scripts/check-self-validation.mjs (pure evaluator in packages/core/src/self-validation/,
  unit-tested) is a REQUIRED, enforce_admins CI check that goes RED when an active capability isn't
  keyless-validatable, when a declared spec isn't actually RUN by CI, when a needed non-secret env isn't wired
  (the skip hole), when an env-gated test.skip is UNDECLARED, or when an OWNER SECRET it needs isn't wired —
  in which case it must be surfaced as an OWNER_ACTION (blocks: validation) and the PR stays blocked until the
  owner wires it. CONTRACT FOR THE LOOP (also in CLAUDE.md): when you add/extend a capability, REGISTER it in
  capabilities.json with its keyless validation, or (if it truly needs an external sandbox secret) set
  requiresOwnerSecret + ownerActionId AND open the OWNER_ACTION — never ship behind an undeclared env-gated
  skip. Degrade-by-default (LLM/captcha/SMS/Stripe no-op without keys) means a degrade test is almost always
  possible — prefer it over needing an owner secret. LESSON: "the suite is green" ≠ "the capability is
  validated" — a skipped test is an unproven capability; make skips DECLARED + blocking, not silent.

- **2026-06-30 (run 29) — DEEP AUDIT (folded, 6 lenses) + 4 file-disjoint value-bar clears.** Full
  6-Haiku scout sweep (security/RLS+Track-G, web reliability/functional-reality, design/a11y/taste,
  test-coverage, monetization+artifact-freshness, native mobile). Shipped #273 (vision resolve unit
  test, 11.5%→96%), #274 (rate-limit the growth/email batch-send route — the one real Track-G gap),
  #275 (waitlist email-input a11y label), #276 (mobile plan.tsx res.ok guard). Each gate-green + 2
  Sonnet reviewers APPROVE; #274/#275/#276 merged on green required-check status; #273 via --auto.
  LESSONS:
  - **A green vitest run is NOT a green tsc.** #273's first push passed `pnpm --filter @gm/core test`
    (vitest transpiles, doesn't strict-typecheck) but `tsc --noEmit` failed TS2554: `vi.fn(() => …)`
    infers a ZERO-arg call signature, so every mock factory that forwards args errored. The per-change
    verify MUST run the package typecheck on the ACTUAL branch (not just the test runner) — `pnpm -r run
    typecheck` was run on a sibling branch, not the test branch, so the hole slipped to CI. Type each
    mock with its real arity: `vi.fn<(a: A, b: B) => R>()`.
  - **A boundary mock that drops an arg stops being a contract test.** Reviewer A caught that the
    `normalizeLineItem` mock forwarded only `input`, not `ports` — a regression that stopped threading
    the DB/embedder/llm ports into the cascade would have passed silently. Forward ALL args through the
    spy and assert them. A mock should mirror the real signature exactly.
  - **In a converged product the orchestrator's FILTER is load-bearing, not the fan-out.** The mobile
    scout reported "zero accessibilityLabel → store-blocking a11y gap"; on inspection every mobile
    Pressable has a Text child (RN exposes that to screen readers automatically) and there are no
    icon-only buttons — a false positive that would have been churn. Cheap high-recall scouts over-report
    in a mature repo; the Opus orchestrator dissolving false positives against real code is the value.
    (The web design scout did find the one genuine a11y gap → #275.)
  - **DEEP AUDIT verdict:** no new CRITICALs. RLS clean across all migrations; webhooks signature-verified;
    timeouts + fail-loud env + ledger-only invariant clean; billing code complete. The only monetization/
    artifact items were post-launch OWNER rituals (Family-tier listing sync when FEATURE_HOUSEHOLDS flips;
    90-day metrics sync to keep BUSINESS_CASE living) → folded into LAUNCH.md Step 12, not code.
  - **Still NOT submission-ready (unchanged non-buildable blockers):** quality grade is B until the
    independent Quality Auditor re-grades the run-28 #260/#261 fixes (maker never self-awards the grade);
    business-case floor is honestly reach-gated (FYI #190, all named buildable levers already built).
    Did NOT open the 'ready' issue. A quiet, coherent 4-gate run is the correct converged state.
- **2026-06-30 (run 30) — 5 file-disjoint clears (DEEP AUDIT folded): the two named scorecard coverage
  gaps + a latent paywall bypass.** Full 6-Haiku sweep; security clean. Shipped #282 (applyVisionScan unit
  test, 0.86%→100%), #286 (logCook unit test, 7.97%→99%/100% fns), #284 (gate household creation behind
  premium — a latent Family-tier paywall bypass), #283 (scan checkbox a11y labels), #285 (Instacart
  external-API try/catch). Each gate-green + 2 Sonnet reviewers; #284/#286 took a 2nd review cycle.
  LESSONS:
  - **A `skipIf(!TEST_DATABASE_URL)` integration test is NOT CI coverage.** persist.ts (0.86%) and
    log-cook.ts (7.97%) were the two ship-critical gaps quality issue #261 named, yet both ALREADY had
    integration tests — which always SKIP in CI (the var is never set). To close a CI-coverage gap, write a
    MOCK-level UNIT test that RUNS keyless; keep the integration test as the real-DB column-mapping proof.
    Same silent-green family as the self-validation tripwire ("a declared spec must actually RUN"). When a
    coverage report shows ~0% on a module that "has a test", check whether that test is skipIf-gated.
  - **Mock the boundary, replay the query SHAPES, leave the pure composition real.** Both unit tests mock
    only the module boundaries (the ledger writer, the @gm/db helpers, the AI builders) + pass a thin
    chainable Drizzle-shaped fake `db`; planConsumption/UnitConverter/signalFromCooked/clampMacros run for
    real. A Sonnet reviewer correctly noted the fake ignores column aliases (so a rename wouldn't be caught)
    — that's the inherent unit-vs-integration tradeoff, acceptable BECAUSE the integration test covers the
    column mapping. The genuinely-actionable half of that review (the lookup→reuse dedup branch was
    untested) was worth fixing → added the dedup-HIT case.
  - **A security reviewer's "bypass" can be a design-model misread — resolve, don't override.** Reviewer A
    rejected the household gate reading ungated JOIN as a bypass. But join only accepts a SECRET invite
    minted by a now-premium-gated owner, and membership grants only the shared list (every other premium
    feature stays independently canUse-gated) — the correct Family-plan model (Reviewer B endorsed it).
    Gating join would BREAK the Family tier (each invited member would have to pay). Resolution: record the
    decision in `join/[token]/actions.ts` + reword comments for accuracy (`household` is unlocked by ANY
    paid tier via `isPremium`, not exclusively `premium_family`); a FRESH Reviewer A then APPROVED. Two A
    bullets were outright misreads (the entitlement load IS inside the existing try/catch). The fix was to
    make the design INTENT explicit, not to change behavior.
  - **The household premium gate is the run-7 lesson recurring on a LATE-added surface:** "audit canUse
    across ALL serving surfaces." `/household` (and its create/invite actions) was added after the billing
    scaffold and never got the gate — dormant only because FEATURE_HOUSEHOLDS defaults off. Gate CREATION +
    invite (owner actions), not membership; when FEATURE_BILLING is off canUse() fails open so dev is
    unaffected. No new owner action (the gate is automatic once FEATURE_BILLING/FEATURE_HOUSEHOLDS are set,
    both already in LAUNCH).
  - **DEEP AUDIT: folded into this sweep** (last standalone run 29, within 24h). Security lens CLEAN (RLS
    complete; rate limits / spend ceiling / webhooks / captcha / headers / error hygiene all present). The
    scorecard (as_of 2026-06-29) is STALE: its launch_readiness gap (mobile IAP) was fixed by #266 (run 28)
    and its correctness/coverage gaps by #263/#264/#273 + this run's #282/#286 — re-grade pending.
  - **Still NOT submission-ready (unchanged):** quality grade B until the independent Quality Auditor
    re-grades; business-case floor reach-gated (FYI #190). Did NOT open the 'ready' issue. A coherent
    5-gate run is the correct converged state.
- **2026-06-30 (run 31) — 5 file-disjoint clears (DEEP AUDIT folded): 3 CI silent-green coverage holes +
  a conversion lever + a REAL production bug a reviewer surfaced.** Full 6-Haiku scout sweep; security
  lens CLEAN (Track G fully covered — RLS complete across 29 tables, rate limits / spend ceiling /
  webhooks / captcha / headers / error-hygiene all present; only the non-exploitable CORS-ACAO nit + the
  already-tracked in-memory limiter). Shipped #288 (context-aware `/upgrade` paywall — reads `?feature=`,
  leads with the gated feature the user tried to unlock + rings its perk card; the 6 bare upgrade
  redirects now pass their feature; FYI #190's named conversion lever, no number-gaming), #289
  (captureToList unit test 4.76%→100%), #290 (recordWaste unit test 1.61%→100%), #291 (pantry persist.ts
  upsert-SET assertion polish), #292 (**fix**: zFromAlpha sign error). Each gate-green + 2 Sonnet
  reviewers, all APPROVED first pass; 3 Reviewer-A polish notes applied pre-merge.
  LESSONS:
  - **A coverage report at ~70-95% is NOT proof of coverage — check WHO covers it.** The stats.ts
    "coverage gap" (72% branches) the tests-scout flagged was a TRAP: experiments.test.ts already
    exercised every stats export, so a fresh stats.test.ts duplicated ~10 assertions. Reviewer B
    (value-first) correctly REQUEST_CHANGES'd it as churn. The right move was ABANDON (1 of 6), not
    churn a trimmed re-review for marginal net-new cases. The inverse of run 30's lesson: there, ~0%
    meant "skipIf-gated, never runs"; here, 72% meant "already well-covered elsewhere." Read the
    coverage SOURCE, not just the %.
  - **A rejected change can still pay off — the maker≠checker reviewer found a PRODUCTION bug.** While
    rejecting the duplicative stats test on value, Reviewer A (correctness) independently found a real
    sign error in `zFromAlpha` (stats.ts:155): for non-tabulated p≤0.5 it returned −z instead of +z, so
    `minSampleSizePerArm` under-sized A/B experiments ~10x (power 0.85 → 241 instead of 2528) whenever
    alpha or power was non-tabulated. Tabulated registry defaults (0.05/0.02) were silently correct, so
    it was latent. Turned the dead test into a one-line fix + a loud monotonicity regression test
    (higher power must need MORE samples) that fails on the old code. Adversarial review earns its cost.
  - **Conversion levers beat features for a converged product.** With product/security/coverage mature,
    the highest-value user-facing change was UX plumbing the funnel already implied: the gates redirected
    to a generic paywall and threw away the user's intent. Context-aware `/upgrade` (validate `?feature=`
    against PREMIUM_FEATURES, never echo raw → no XSS; degrade to generic on unknown) is the exact
    "tighten the /upgrade decision surface" lever FYI #190 named. Honest UX, zero pricing change.
  - **Polish that catches a real false-green is worth applying; polish that doesn't is churn.** Applied
    3 Reviewer-A notes (assert the insert TABLE + active-list args; assert the upsert SET carries the
    projection not just updatedAt; assert the waste delta sign relationally since −0===0) because each
    closes a path where a regression would pass silently. Declined the "extract a shared drizzle-fake"
    suggestion (no current second caller — speculative).
  - **DEEP AUDIT: folded into this sweep** (last standalone run 30, within 24h). No new CRITICALs. The
    QUALITY_SCORECARD (as_of 2026-06-29) is now doubly STALE: its named ship-critical gaps (mobile IAP,
    vision persist direct-write, vision/logCook coverage) were all fixed by runs 28/30, and this run adds
    pantry persist/waste/capture coverage + the stats correctness fix — re-grade pending (Quality Auditor
    owns it; the loop does not self-grade).
  - **Still NOT submission-ready (unchanged):** quality grade B until the independent Quality Auditor
    re-grades; business-case floor reach-gated (FYI #190, all named buildable levers already built). Did
    NOT open the 'ready' issue. A coherent 5-clear + 1-honest-abandon run is the correct converged state.
- **2026-06-30 (run 32) — 5 file-disjoint clears (DEEP AUDIT folded): completed the run-19 "cap EVERY LLM
  surface" sweep + the FACTORY §6 timeout convention + error-hygiene + auth a11y.** Full 6-Haiku scout
  sweep (H12 feasibility, CI coverage holes, security/Track-G, reliability/correctness, design/a11y/taste,
  artifact freshness). Shipped #294 (cap web /plan LLM behind checkLlmQuota — a CRITICAL uncapped wallet-drain
  the security scout found: the force-dynamic /plan page ran planWeek's Gemini generator gated only by
  canUse(), never the quota — degrades to the deterministic floor over quota), #297 (cap the 3 remaining
  best-effort web LLM surfaces — capture parse, cook macros LLM fallback, cook swap long-tail), #295 (sanitize
  the recipe-import catch-all that leaked raw e.message — error hygiene), #296 (AbortSignal.timeout on the
  Gmail/Instacart/Google-OAuth clients + regression tests, lifting gmail 26%→cov & oauth 0%→cov), #299
  (accessible name on the icon-only /signin + /signup logo link — WCAG 2.4.4/4.1.2). Each gate-green + 2 Sonnet
  reviewers; #297 took a both-reviewer polish + a 3rd fresh confirm. LESSONS:
  - **The run-19 "cap EVERY LLM surface" rule recurs on the surfaces added/triggered AFTER the first sweep.**
    The expensive web actions (ask/make/scan/import/onboarding) were capped in run 19, but the force-dynamic
    /plan PAGE (expensive agentic plan gen) and three best-effort web calls (capture parse on every quick-add,
    cook macros LLM fallback, cook swap long-tail) were never gated. A page that's `dynamic = "force-dynamic"`
    re-runs its LLM call on every refresh — an unbounded-spend surface as real as an API route. The cheap
    flash-lite ones still matter (the bar is "cap every surface", not "cap the expensive ones"). When ticking a
    systemic security box, re-grep EVERY surface — incl. server-component PAGES + best-effort/fallback LLM calls,
    not just the obvious actions.
  - **`checkLlmQuota` consumes on check — only call it when an LLM call WILL happen.** It increments the daily
    counter on every allowed call, so the gate must sit right before the intended LLM call AND behind a key
    check: `hasLlmKey && checkLlmQuota(...).allowed`. Both #297 reviewers caught the same nit — askSwap/cook
    were loading preference signals + burning a quota unit even with NO key configured (wasted DB read on the
    cook-log hot path + pointless quota depletion on keyless deploys). Fix: gate the signals-load behind
    hasLlmKey first, matching capture + every other surface. Graceful-degrade is the right product call for all
    of them (deterministic parse / null macros / no AI suggestion — never an error or dead-end).
  - **A vitest-green test is NOT a tsc-green test (run-30 lesson, recurring).** #296's first push passed
    `pnpm --filter @gm/core test` but `tsc --noEmit` failed: under `noUncheckedIndexedAccess`, `calls[0]` is
    `T | undefined`. Fix: a `call(i)` accessor that throws if absent (narrows away undefined). Also a real test
    bug: asserting the Gmail query via `encodeURIComponent` mismatched URLSearchParams' encoding (`+` for space,
    `%28`/`%29` for parens) — parse the param with `new URL(...).searchParams.get("q")` instead of a brittle
    string compare. The per-change verify (tsc on the ACTUAL branch + run the new tests) caught both before CI.
  - **The 2-reviewer gate earns its cost even on "boring" hardening.** A Sonnet reviewer ran an adversarial
    MUTATION test on #296 (deleted one fetch's signal, re-ran the suite, confirmed it failed, restored the
    file) to prove the assertions aren't vacuous — and another verified #297 in an ISOLATED git worktree off
    origin (immune to the maker's branch-switching). Process trap noted: reviewer subagents read the WORKING
    TREE, so do NOT switch the main checkout to the next branch while a reviewer is still reading the current
    one (it sees the wrong file). Sequential review per change, or pass the full diff + tell them to verify the
    COMMIT via worktree (as the #297 confirmer did unprompted).
  - **H12 (surface the Family/household tier) is genuinely BLOCKED on an owner decision, not code.** The
    `premium_family` tier + Stripe checkout + the household feature are all BUILT; the upgrade-page Family card
    is written but flag-gated behind FEATURE_HOUSEHOLDS (default OFF). There is NO honest store-safe slice of
    H12 to ship — advertising a flag-dark feature is an Apple 2.3.1 risk. Already tracked
    (PENDING_OPS decide-ship-households-family-tier). Correctly left untouched — not churned.
  - **DEEP AUDIT: folded into this sweep** (last standalone run 30, within 24h). Security lens found the one
    real CRITICAL (the uncapped /plan, #294) + the error-hygiene leak (#295); reliability lens found the missing
    integration-client timeouts (#296). RLS clean across all migrations (0001→0020); the artifact scout found
    ZERO doc-vs-reality contradictions (pricing matches billing config, store copy doesn't sell flag-dark
    features). The design scout's recipe-`alt=""` + social-share-emoji findings were dissolved as false
    positives (decorative thumbnails adjacent to visible titles are correctly empty-alt; share-copy emoji isn't
    UI iconography) — the genuine design finding was the auth-logo a11y gap (#299).
  - **Still NOT submission-ready (unchanged):** quality grade B until the independent Quality Auditor re-grades
    (the scorecard's named ship-critical gaps were already fixed runs 28/30/31); business-case floor honestly
    reach-gated (FYI #190, all named buildable levers built). Did NOT open the 'ready' issue. A coherent
    5-clear, 0-abandon, 0-revert run is the correct converged state.
- **2026-07-01 (run 33) — 3 file-disjoint clears (#304 LLM-fallback tests, #305 scan G3 error hygiene,
  #306 README drift); 1 abandoned (DEEP AUDIT folded, 5 lenses).** Highest-leverage takeaways:
  - **The DUPLICATE-COVERAGE TRAP bit TWICE (runs 32 + 33) — the concrete fix.** Both runs abandoned a fresh
    `growth/experiments` math test suite because the assertions already live in the AGGREGATE
    `packages/core/src/growth/experiments.test.ts` (one level up from the per-module sources), not in adjacent
    `stats.test.ts` / `bucketing.test.ts` / `lift.test.ts` files. Root cause: the coverage-gap check greps for
    *adjacent* `<module>.test.ts` and reports "NONE" when an aggregate suite covers the functions. **RULE for
    the next run:** before writing tests for `packages/core/src/growth/experiments/*` (or ANY dir with an
    aggregate `<dir>.test.ts`), grep the whole directory's `*.test.ts` for the target function NAMES
    (`assignVariant`, `twoProportionZTest`, `wilsonInterval`, `minSampleSizePerArm`, `computeExperimentResult`
    are all already covered) — do not scout by adjacent filename alone. If it recurs a 3rd time, raise a
    harness proposal.
  - **The 2-reviewer gate keeps paying for itself.** The abandoned suite was correct (Reviewer A verified the
    math numerically) but LOW-VALUE (Reviewer B caught the duplication). The split verdict → abandon is the
    both-approve rule working exactly as intended; not reworking it into a trimmed re-review avoided churn.
    The two SHIPPED test files (#304, capture-parse + shelf-life-llm) were independently confirmed genuinely
    untested by both reviewers — so "add tests" is fine; the discipline is verifying the target isn't already
    covered elsewhere first.
  - **The QUALITY_SCORECARD (2026-06-29) is STALE — its named ship-critical gaps are already fixed.** Mobile
    RevenueCat IAP (upgrade.tsx now calls a real `purchase(pkg)` → `Purchases.purchasePackage`, degrading to
    an honest "coming soon" only when no key) landed in PR #266; the vision persist ledger-only write landed
    in PR #263. Both `launch_readiness` and `correctness_reliability` B-gaps are closed in reality; the loop
    can't re-grade (maker≠checker — the independent Quality Auditor owns the scorecard). Do NOT re-attempt
    those as "gaps"; the only true blockers to 'ready' are the re-grade + the reach-gated business-case floor.
  - **Several run-19/21 security follow-ups are already closed — verify before re-fixing.** The discover-POST
    `discover-write` limiter, recipes-GET `recipes-read` limiter, and cook-tonight/ask `checkLlmQuota` are all
    present. A Haiku security scout flagged them as gaps (false positives); always grep the actual route before
    treating a scout finding as real. The one REAL find this run was the scan-action raw-`e.message` leak (#305).
  - **Still NOT submission-ready (unchanged):** quality grade B pending the independent re-grade; business-case
    floor honestly reach-gated (FYI #190). H12/Family stays owner-flag-blocked (advertising a FEATURE_HOUSEHOLDS
    dark feature = Apple 2.3.1 risk — no honest store-safe slice to ship). Did NOT open the 'ready' issue.
- **2026-07-01 (run 34) — 4 file-disjoint clears, 0 abandons, 0 reverts (#308 mobile paywall on-brand
  color, #309 web deprecated-palette removal, #310 store-copy premium-feature completeness, #311 db-ports
  keyless unit coverage). DEEP AUDIT folded (6-lens scout sweep).** Highest-leverage takeaways:
  - **A color-token swap is NOT "pure style" when other rules depend on the base color via alpha.** #308
    replaced the paywall's off-brand purple (#4a1d96, 8×) with brand-solid green (#0c8a3e). Reviewer A caught
    a real regression: the featured card's SECONDARY labels used semi-transparent white (rgba .7–.75) that
    composited toward the OLD dark purple at ~8:1 but toward the new lighter green at only ~2.95:1 (sub-AA).
    The fix: solid white for those labels (~4.45:1 — the design system's DELIBERATE ceiling for white-on-green;
    no white value can reach 4.5 on this accent, and the web brand-solid cards accept exactly this) + a
    DARK-translucent 'Best value' pill (white text jumps to ~5.7:1, vs ~3.2:1 on the old translucent-WHITE
    pill — a translucent-white pill LIGHTENS toward the bg and kills white-text contrast). RULE: when a diff
    changes a surface's base/background color, re-check every alpha-blended foreground rule layered on it —
    those untouched rules silently inherit the new contrast.
  - **The duplicate-coverage trap (runs 32–33) did NOT recur — the run-33 rule worked.** Before proposing a
    coverage test, grep the target FUNCTION NAMES across ALL *.test.ts (not adjacent filenames). db-ports.ts's
    createDbNormalizationPorts is referenced in 6 test files but every one MOCKS the ports (vi.mock / hand-rolled
    fakePorts) or is a skipIf(!url) integration test that never runs in CI — so the real slug-conflict-reuse /
    degrade-guard branching was genuinely CI-uncovered. Reviewer B independently mutation-verified it as new,
    not dup, coverage. Streak broken; no harness proposal needed.
  - **A fake that returns default-empty on the happy path gives FALSE test confidence — spy on the call, not
    just the result.** #311's first cut asserted `findOverride(null,null)` returns null, claiming it tested the
    `if(!rawText&&!upc) return null` short-circuit. Reviewer A's mutation test (delete the guard) still passed:
    the fake Querier's default-empty selectResults made the malformed query ALSO resolve to null. Fix: count
    select() calls in the fake and assert `selectCount()===0`, so removing the guard now fails loud. When a
    test claims "does X WITHOUT doing Y", assert Y did not happen — a value check alone can be satisfied by the
    fake's defaults.
  - **The security scout's "add a per-request rateLimit to the web LLM actions" was correctly SKIPPED, not
    shipped.** checkLlmQuota is fully synchronous (atomic get→check→increment, no await between) so it already
    prevents burst within a process AND caps daily spend; the web-action rateLimit would only smooth burst
    within an already-bounded per-user daily budget (the mobile routes' rateLimit keys per-user too, same as the
    quota — not a multi-account/IP vector). 6 near-identical PRs for marginal defense-in-depth = padding. The
    value bar, not the scout count, decides — shipped 0 of the 6.
  - **Two stale artifacts confirmed (do NOT re-attempt as gaps): QUALITY_SCORECARD (2026-06-29) + issue #260.**
    The scorecard's two ship-critical B gaps are fixed in reality — mobile RevenueCat IAP (upgrade.tsx calls a
    real Purchases.purchasePackage, degrading to "coming soon" only when no key; PR #266) and the vision
    ledger-only write (#263) — and vision now shows ~100% coverage, not the ~0% the scorecard cites. Issue #260
    (filed 2026-06-29, "mobile can't accept payment") is stale for the same reason. The loop CANNOT re-grade
    (maker≠checker — the independent Quality Auditor owns the scorecard); the ONLY true blockers to 'ready'
    remain the re-grade + the reach-gated business-case floor (#190). Did NOT open the 'ready' issue.

- **2026-07-01 (run 35) — DEEP AUDIT (folded 5-scout sweep) + 2 file-disjoint clears; converged quiet run.**
  Ran a full Haiku scout sweep across 5 lenses (security/RLS+Track-G, correctness/tests, design/a11y,
  living-artifacts, monetization/business-case-strength). The run's value was the FILTER: 5 of 7 surfaced
  candidates were rejected on verification, TWO of them would have shipped active regressions —
  (a) "CORS Access-Control-Allow-Origin missing" (adding `ACAO:*` weakens security; native mobile ignores
  CORS, web PWA is same-origin → the locked-down default is correct), and (b) "cook-mode hardcoded
  `#0a6e33` → `text-brand-solid`" (brand-solid `#0c8a3e` is ~4.0:1 on white and FAILS AA for small bold text;
  the darker hardcode is a deliberate ~5.5:1 contrast choice). Also rejected: wrapped share-text emoji
  (genre-appropriate social copy, not UI iconography), the stale QUALITY_SCORECARD mobile-IAP drift (real, but
  owned by the separate Quality Auditor — maker≠checker), and the monetization scout's "unbuilt levers"
  (trial-expiry/dunning/activation/paywall-cap) — the scout HONESTLY concluded none closes the 2.7× reach gap
  (floor stays ~$33K, reach-gated owner GTM), billing-lapse handling is already complete (Stripe/RevenueCat
  webhooks revoke entitlement on past_due/canceled/deleted; Stripe Smart Retries = owner-dashboard dunning),
  and these are traffic-dependent post-launch TUNING = the owner's job. **Shipped (2, both 2/2):** #316 fixed
  a real money-math bug in `computeMrrUsd` (per-sub `Math.round(3999/12)`=333¢ baked a 0.25¢/sub bias →
  understated MRR by $1 at 56 annual subs; now amortizes on the aggregate + regression test); #315 raised the
  cook-mode timer + step-nav buttons to the 44px WCAG/Apple touch-target minimum + timer aria-labels on the
  app's most hands-busy surface.
  **DEEP AUDIT verdict:** no CRITICAL findings. Security/RLS/Track-G CLEAN (all ~35 routes auth-enforced, RLS
  deny-by-default with correct per-table policies, rate limits + spend ceiling + captcha + OWASP headers +
  timing-safe webhook/mobile-token verification all present). Functional/monetization reality: the full mobile
  IAP loop is wired end-to-end (purchase → RevenueCat webhook, timing-safe + fail-closed → server entitlement →
  isPremium gating) and the vision ledger-only invariant holds — confirming the 2026-06-29 scorecard's two
  ship-critical B gaps remain closed in code (fixed prior in #266/#263). Artifacts consistent (pricing↔billing,
  BUSINESS_CASE YAML valid, F4 perf-budget claim already reconciled). **LESSON:** verify you're on the intended
  commit before reading state — a stale local `main` (a failed `git pull` left it 6 merges behind) briefly made
  already-fixed gaps look open and already-added deps look absent; `git fetch && git reset --hard origin/main`
  at run start is non-negotiable. Still NOT submission-ready: reach-gated floor (#190) + pending independent
  re-grade (scorecard STALE). Did NOT open the 'ready' issue.

- **2026-07-01 (run 36) — H12 built (last unbuilt buildable revenue lever) + pantry a11y; 2 DoD boxes closed.**
  (Recorded via run-37 housekeeping — run 36's bookkeeping PR #324 hit a shared-ledger merge conflict and never
  auto-merged; its code #323/#325 is on `main`.) No DEEP AUDIT (run 35 ran one same-day). Shipped #323 (H12
  onboarding "cook together" moment, gated on `householdsEnabled()`, sibling `finishOnboardingHouseholdAction`
  so no one is stranded mid-flow; NO adoption % banked) and #325 (pantry Remove button → ≥44px touch target).
  Ticked 2 DoD boxes on evidence — both blocked ONLY by an absent artifact: H12's onboarding surface now exists;
  the independent QUALITY_SCORECARD now exists (PR #318, overall A). **LESSON (carry forward): a token that is
  theme-variable can silently break a fixed-background surface.** `brand-700` is dark in light mode, light in
  dark mode; on a hardcoded `bg-white` element (the blog Back button) swapping `brand-solid`→`brand-700` fixes
  light mode but breaks dark mode — a fixed-white surface needs a token dark in BOTH themes (the cook-mode
  `#0a6e33` pattern), not the theme-flipping `brand-700`. That contrast fix was DEFERRED rather than trade one
  a11y bug for another.
- **2026-07-02 (run 37) — converged run: 2 disjoint coverage clears + relanded the stuck run-36 bookkeeping.**
  DEEP AUDIT not due (folded run 35/36, within 24h). Full 4-Haiku scout sweep: design/artifacts, Track-G
  security/abuse, and functional-reality ALL returned NO REAL FINDINGS; monetization confirmed NO buildable
  lever left (H12–H15 shipped; floor reach-gated, #190). Shipped 2 pure-logic coverage clears (both 2/2 Sonnet):
  #330 (`recipeHtmlToText` real cheerio logic + import prompt-builder contract, 13→20 tests) and #331
  (`buildCombinedInstacartPayload` null-when-empty one-cart safety contract, 4→7 tests). **LESSONS:**
  (a) **the value of a converged sweep is the orchestrator FILTER, not the fan-out** — 4 scouts, 3 clean lenses,
  4 raw candidates, only 2 survived verification against real code; padding the batch would have failed the bar.
  (b) **#319 (vision-quality eval) — I judged it un-doable keyless, but a CONCURRENT run shipped it (#332)** via a
  RUN_EVALS-gated `scan.eval.test.ts` over the real detectPantryItems→Gemini path against a committed SYNTHETIC
  labeled-shelf fixture (`shelf-bootstrap.png`); real-photo fidelity remains a ratchet. Lesson: "the loop can't
  source real photos" ≠ "the eval can't exist" — a committed synthetic fixture proves the image pipeline keyless
  (same insight as the email file-capture transport); don't declare an eval impossible before trying a synthetic
  fixture. (Also a concurrency lesson: check `git log origin/main` for concurrent merges before writing ledger
  claims — I nearly shipped a stale "can't be done" note the same hour #332 did it.)
  (c) **#320 (perf B→A) is half-forbidden** — its CI perf-budget gate is a `.github/` edit + the edge-middleware
  trim is auth-critical surgery on every request; out-of-proportion risk for a non-ship-critical dim → deferred.
  (d) **a prior run's bookkeeping PR can get stuck on a shared-ledger conflict (PR #324)** — fold its ledger +
  ROADMAP ticks into the current run's housekeeping (fresh main) and close the stuck PR, don't leave ticks
  unlanded. Readiness: did NOT open the 'ready' issue — unchanged converged state; the Confidence statement
  correctly stays UNCHECKED (reach-gated floor, #190).
- **2026-07-02 (run 38) — DEEP AUDIT (standalone, 5-Haiku lens sweep): NO CRITICAL findings; converged quiet
  run, ZERO changes shipped.** Deep audit was due (last standalone run 35, >24h). Baseline gate green
  (typecheck clean). Five read-only lenses over the whole repo: (1) SECURITY/RLS/Track-G — CLEAN (every public
  table RLS-enabled with correct per-user/`app_current_user_id()` or grocery_app-scoped policy; rate limits on
  signup/auth/user APIs + account lockout + captcha + per-user/day LLM ceiling; timing-safe secret compares on
  all webhooks/cron; OWASP headers; no leaked secrets; entitlements server-side). (2) DESIGN/A11Y/ARTIFACTS —
  NO REAL FINDINGS (zero raw hex in TSX, ≥44px targets, icon-buttons aria-labelled; pricing↔billing↔BUSINESS_CASE
  consistent; privacy/store copy matches shipped features + Family tier correctly flag-gated). (3) MONETIZATION —
  NO BUILDABLE LEVER LEFT: H12–H15 all shipped, pricing/tiers/Stripe/RevenueCat/entitlement complete; the honest
  ~$33K median→$100K floor gap is reach-gated (~4–4.5k dl/mo, owner GTM), NOT a buildable feature. (4) COVERAGE/
  PERF — 2 perf candidates, BOTH REJECTED on verification: parallelizing the review-bulk (`review/actions.ts`)
  and receipt-ingest (`ingestion/ingest.ts`) loops would race on `appendLedgerAndReproject`'s per-canonical
  read-modify-write reprojection when two items in one batch map to the SAME canonical (common: duplicate lines /
  duplicate review groups) — the sequential design is deliberate; and ingest is an async/small-N job, not a
  user-blocking hot path. (5) CORRECTNESS — 2 candidates, BOTH REJECTED: `auth.ts` null-token-when-`TOKEN_ENC_KEY`-
  absent is intentional degrade-by-default and already documented REQUIRED in `docs/GMAIL_SETUP.md` (tokens stored
  null, never plaintext — no security hole); `db-ports.ts` "seed missing base unit" throw is a deploy-seeding
  concern caught at the batch level, not a runtime logic bug. **LESSON:** a scout's "N+1 / sequential-await" perf
  flag must be verified against the write's concurrency semantics before shipping — where the loop body does a
  per-key read-modify-write (ledger reprojection), parallelizing is a correctness regression, not a speedup;
  "sequential" here is the fix, not the bug. Readiness: did NOT open the 'ready' issue — converged state unchanged,
  Confidence statement correctly stays UNCHECKED (reach-gated floor, #190). No code PRs this run (nothing cleared
  the value bar) — a quiet coherent run is a success.
- **2026-07-02 (run 39) — converged quiet run: every QUALITY_SCORECARD-named gap was ALREADY closed on `main`;
  the one apparent remaining fix was a REGRESSION, caught before merge. ZERO code shipped.** Selected work off
  the independent QUALITY_SCORECARD (as_of 2026-06-29, overall B) — its three ship-critical/coverage gaps:
  (a) direct `pantry_stock` write in `vision/persist.ts`, (b) untested vision pipeline, (c) mobile IAP "Payments
  coming soon" stub. **All three are already resolved on `origin/main`** and verified via `git show origin/main:…`:
  (a) `source` is threaded through `appendLedgerAndReproject`/`reprojectStock` and the confirm loop is ledger-only
  (no direct write); (b) `vision/detect.test.ts` covers `detectPantryItems`/`scanModelFor` via a fake client;
  (c) `apps/mobile/lib/purchases.ts` has a real `Purchases.purchasePackage`/`getOfferings`/`restore` flow with an
  honest keyless degrade, and `upgrade.tsx` wires it. The scorecard is a LAGGING signal (runs 36–38 closed these
  after it was graded) — the next Quality-Auditor grade should re-verify and likely lift `correctness_reliability`
  + `launch_readiness` to A (unblocking DoD "independent QUALITY GRADE = A/A+"). **THE TRAP (carry forward): a
  mobile change can pass `npm ci` + `tsc` and still break the native build.** A builder subagent proposed adding
  `"react-native-purchases"` to `apps/mobile/app.json` `plugins` to "wire the native module" — it passed
  `npm ci` + `npm run typecheck`, but `react-native-purchases` ships NO Expo config plugin (no `app.plugin.js`),
  so `npx expo config` FAILS: `PluginError … SyntaxError: Unexpected token 'typeof'` (Expo loads the SDK's main
  entry as if it were a plugin). RN native modules like this AUTOLINK from the dependency alone — `main` is already
  correct (dep present at `^10.4.0`, `plugins: ["expo-router"]`, `expo config` exits 0). Adding the plugin entry is
  a REGRESSION, not a fix. **LESSONS:** (i) validate mobile/Expo config changes with `npx expo config --type public`,
  NOT just `tsc` — the mobile CI job only runs `npm ci` + typecheck, which is BLIND to a broken `plugins` array
  (a BUILDS≠WORKS hole at the Expo-config seam); (ii) a dependency being autolinked ≠ needing a `plugins` entry —
  only libraries that ship `app.plugin.js` (extra native config) belong there; (iii) a builder subagent that shares
  the parent's git working tree can entangle branch pointers (its `checkout -B`/commit moved HEAD onto my branch) —
  reconcile via `git reflog`/`branch -f` and re-verify, or prefer worktree isolation for parallel mutating agents.
  CLEANUP: the subagent pushed `origin/claude/mobile-iap` (contains the regression + a cosmetic `^10.4.0→^10.4.1`
  caret bump) — its delete-push kept hitting a proxy `send-pack: unexpected disconnect`; it has NO PR and cannot
  auto-merge, so it's harmless — a future run should delete it when the proxy cooperates. Readiness: did NOT open
  the 'ready' issue — DoD unchanged (quality grade still B pending re-grade; reach-gated floor #190). Deep audit
  not due (run 38 ran one same day). Nothing cleared the value bar → shipped nothing but this memory. A quiet,
  coherent run is a success; the load-bearing work was the orchestrator REFUSING a green-gate regression.

- **2026-07-02 (run 40) — 2 file-disjoint clears (a11y + business-case accuracy); a design-bar rework caught in
  review; every "coverage gap" was already covered.** Deep audit not due (run 38 same day). 4-Haiku scout sweep
  (coverage, design/a11y, living-artifacts, security/Track-G). **Shipped 2, both 2/2:** #354 (cookbook save-heart
  → 44px, high-traffic icon-only control on every recipe card) and #355 (BUSINESS_CASE freemium split: `plan` was
  wrongly listed FREE but `plan_week` is a hard PREMIUM feature — corrected free/premium lists to match
  `billing/index.ts`, +Family `FEATURE_HOUSEHOLDS` gate note; NO number/YAML change). **The FILTER was the run's
  value:** the coverage scout's 5 candidates were ALL already covered — `experiments/stats.ts` is directly tested
  by the *barrel* `experiments.test.ts` (incl. the `zFromAlpha` sign-regression guard), `merge-order.test.ts`
  covers the instacart merge, `par-tuning`/`bucketing` have 6 tests each — all rejected as duplication. Security
  CLEAN. **LESSONS:** (a) the correct 44px fix for a *bordered/visible* control is negative-margin hit-slop
  (`-my-2 -mr-2` on a BARE icon, the #325 pattern), NOT `min-h` on a `btn-ghost` box (which inflates it to a
  visible 44px square) — Reviewer B caught this on attempt 1, reworked, then 2/2. (b) a Haiku coverage scout
  over-claims "no test": verify sibling AND barrel test files before writing a coverage test. (c) the quality
  scorecard re-graded to **A** (as_of 2026-07-01) → run 39's pending blocker is CLEARED, ship gate MET; the two
  residual B dims are non-blocking (#320 perf = half-forbidden `.github/` gate; #319 tests_evals = ALREADY
  satisfied by #332's `scan.eval.test.ts`, scorecard lags a day). **Readiness:** did NOT open 'ready' — sole DoD
  gap is the reach-gated floor (base ≈ $33K < $100K, owner GTM, #190); no buildable lever moves the honest
  pre-launch median. Confidence statement stays UNCHECKED. Quiet, coherent, converged run = success.

- **2026-07-03 (run 41) — DEEP AUDIT (5-Haiku lens sweep, due since run 38) + 2 file-disjoint clears
  (README design-accuracy #371 + raw-hex→token discipline #372). Both 2/2. Zero abandons.** Deep audit was
  due (last standalone/folded run 38, >24h). Baseline gate green (typecheck clean, tree clean, scorecard A
  as_of 2026-07-01). Five read-only lenses over the whole repo:
  (1) **SECURITY/RLS/Track-G — CLEAN.** All 29 public tables RLS-enabled with correct per-user
  (`app_current_user_id()`), transitive-child, household command-specific, or grocery_app-scoped policies;
  full Track-G matrix verified (rate limits on signup/auth/mobile/growth/confirm, 32KB body + field caps,
  generic-500 error hygiene, 10-fail/15-min lockout + timing-safe compare, Turnstile captcha, Stripe
  `constructEvent` + timing-safe Gmail/unsub/confirm HMAC, per-user/day LLM quota 10-free/100-premium);
  secrets env-only + AES-256-GCM at rest; entitlements server-side; CSP/HSTS/X-Frame/nosniff headers.
  (2) **CORRECTNESS/FUNCTIONAL — CLEAN.** Signup→working dashboard (no email-verify gate, EMPTY_HOME_DATA
  fallback), receipt→pantry, cook-log, paywall→Stripe all try/catch + degrade; LLM calls `withTimeout(8s)`
  < Vercel budget; DATABASE_URL required/fails-loud; `.optional()` envs degrade cleanly; no dead branches /
  bare throws on critical paths; household "coming soon" is intentional + flag-gated.
  (3) **MONETIZATION — REACH-GATED CONFIRMED, no buildable lever.** Adversarial re-test of the floor gap:
  pricing/tiers (Free / $4.99 mo / $39.99 yr / $9.99 Family) good-better-best + annual discount; paywall
  context-aware + trial-eligibility + referral bonus-trial-days (H13); retention loops H14 annual-nudge /
  H15 win-back / streaks / experiments all built; the ONE buildable lever found (premium-collections
  one-time add-on) is ~$1-3K/yr AND collides with the owner's locked subscription-only v1 decision → scope
  creep, not a floor-mover. Floor gap = ~4-4.5k downloads/mo = **owner GTM**, not code.
  (4) **PERF/COVERAGE — 3 perf candidates, ALL REJECTED; coverage clean.** ingest.ts N+1 (per-line
  `baseUnitId` read) + sequential line inserts + capture/add.ts sequential inserts: real round-trips, but the
  ingest path is dominated by multi-second Gemini vision + per-line normalize cascade (trigram→embed→LLM), so
  batching shaves <2% off an LLM-bound flow while restructuring a correctness-sensitive core path (the
  per-canonical `appendLedgerAndReproject` read-modify-write must stay sequential — the run-38 lesson). Poor
  risk/reward. capture/add is trigram-bound per item; insert-batching marginal. 102 test files, no real gaps
  (verified sibling+barrel before rejecting).
  (5) **DESIGN/A11Y/ARTIFACTS — 2 real findings shipped, 1 churn skipped.** #371 README "Design & experience"
  bullet described a dead visual direction (Inter+Fraunces, aurora hero, bento, accent-themed pages, frosted
  tab bar) — the code ships Hanken Grotesk single family, `aurora: none`, `bg-cream` solid nav, PageHeader
  ignores `accent`; corrected to reality (LIVING ARTIFACTS). #372 the 4 raw-hex `text-[#0a6e33]` buttons (the
  ONLY raw hex left in TSX) → `text-brand-solid-hover` token + a contrast comment at each site. Skipped the
  redundant `disabled`+`aria-disabled` on upgrade/page.tsx as churn.
  **THE RECURRING #0a6e33 TRAP — now documented in-code to STOP the churn:** `#0a6e33` = `rgb(10 110 51)` =
  exactly `--brand-solid-hover`, deliberately the DARKER green because `--brand-solid` (`rgb 12 138 62`) fails
  WCAG AA as text on white (4.45:1 vs 6.38:1). A design scout has now flagged "use brand-solid" in runs 35 AND
  41; run 35 correctly rejected it as a contrast regression. #372 resolves it permanently by using
  `brand-solid-hover` (byte-exact color, contrast preserved) + inline comments stating the 4.5:1 rationale, so
  a future "simplify to brand-solid" pass is pre-empted. LESSON: when an audit keeps re-flagging a deliberate
  hardcode, the fix isn't to argue it down each run — encode the rationale AT THE SITE (token + comment) so the
  re-flag can't recur.
  **BRANCH-ENTANGLEMENT trap RECURRED (run-39 lesson):** a review subagent sharing the parent working tree ran
  a `git checkout` of the OTHER change's branch, leaving my working tree a MIX (readme-branch README + reverted
  token-branch hex) on top of the correct pushed commit. Harmless because both commits were already committed +
  pushed (origin branches verified correct + disjoint before any merge); `git reset --hard HEAD` restored the
  tree. LESSON (reinforced): verify `origin/<branch>` contents via `git show`, NOT the shared working tree,
  before trusting review state; prefer worktree isolation for parallel agents that might checkout. Both
  reviewers independently caught the dirty tree and correctly reviewed the COMMITTED diff, not the tree.
  **Readiness:** did NOT open the 'ready' issue — the sole DoD gap is unchanged: the reach-gated business-case
  floor (base ≈ $33K < $100K at median inputs, #190), which the monetization lens re-confirmed is owner-GTM,
  not a buildable lever. Confidence statement correctly stays UNCHECKED. Validation 5/5 active, 0 unmet. A
  coherent converged run with 2 real clears + a full 5-lens deep audit = success.

- **2026-07-03 (run 42) — 3 file-disjoint synthetic-green / fail-open hardening clears from the open backlog
  (issue #359), all 2/2, 0 abandons. No deep audit (run 41 ran one same day, <24h).** Worked the filed
  backlog rather than re-scouting: #359 named three real §28 gaps, split into three DISJOINT PRs, each
  reviewed by 2 Sonnet reviewers (A correctness/security + B value), auto-merged through green CI.
  **#378** — the unsubscribe + waitlist double-opt-in HMAC secrets fell back to a PUBLIC repo constant when
  their env var was unset → forgeable tokens in prod. Extracted `resolveUnsubscribeSecret`/`resolveOptinSecret`
  as pure env-injected classifiers mirroring the `isProdRuntime` guard (`rate-limit-guard.ts`,
  `resolveEmailCaptureDir`): throw in a real prod runtime, keep the dev/CI fallback (CI carve-out). +10 keyless
  tests. **#379** — `vision-scan`/`predict-recompute` BullMQ queues were wired to a no-op `stub()` (jobs marked
  COMPLETED doing nothing; a nightly cron even enqueued `predict-recompute` — a LIVE nightly synthetic-green).
  Replaced with `notImplemented()` that THROWS (job → FAILED, visible) and dropped the false cron. **#380** —
  `verifyTurnstile` fail-opened SILENTLY without the captcha key → invisible prod bot-protection bypass. Added a
  keyless `captchaEnforcement` classifier in `@gm/core`; a missing key in prod now logs LOUDLY, still fail-OPEN
  per §32 (never hard-block signup). LIVING-ARTIFACT touch in the same housekeeping: PENDING_OPS now flags
  `EMAIL_UNSUBSCRIBE_SECRET`/`WAITLIST_OPTIN_SECRET` as REQUIRED (fail-closed) in prod, and the turnstile-keys
  action notes the new loud-in-prod log.
  **LESSONS:** (1) canonical fix for a "silent public fallback" hole = a pure env-injected `isProdRuntime`
  classifier in `packages/core/src/security/` + keyless test; mirror the `CI=true` carve-out or the
  e2e-under-`next start` job breaks. (2) fail-closed vs §32: a security key guarding a CORE action (captcha →
  signup) fails LOUD-but-OPEN; only BYPASS flags whose presence IS the misconfig boot-throw. (3) `apps/web` +
  `services/workers` have NO unit-test runner — testable decision logic goes in `packages/core` to earn
  coverage. (4) reviewer nit (non-blocking, pre-launch moot): deleting a BullMQ `add({repeat})` doesn't
  deregister an already-persisted repeatable; the worker isn't deployed, so `predict-nightly` was never in a
  prod Redis — if ever deployed, `removeJobScheduler("predict-nightly")` once. **Readiness:** did NOT open the
  'ready' issue — the sole DoD gap is unchanged (reach-gated floor #190, owner-GTM). Confidence statement stays
  UNCHECKED. Validation 5/5, 0 unmet. A focused backlog-clearing run = success.
