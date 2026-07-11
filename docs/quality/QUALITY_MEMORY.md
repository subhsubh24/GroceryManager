# GroceryManager — Quality Memory

Durable memory for the independent Quality Auditor (maker ≠ checker). Read FIRST each run and diff the
new grade against the last entry. Append-only; newest entry on top.

---

## 2026-07-11 — SHIP GATE NOW NOT MET (overall A → B): design_taste A → B (re-assessment, not a regression)

**Overall: B. Ship gate: NOT MET.** Mechanical gate this run: typecheck PASS (exit 0), `@gm/core`
tests PASS (99 files pass / 10 skipped; **977 tests pass** / 26 skipped — up from 912; coverage lines
87.73 / branches 87.83 / functions 91.21 — thresholds 70/84/76/70 met), production `next build` PASS
(no missing-export warnings; 102 kB shared; middleware 88.6 kB = gzip of a **280,299-byte** raw edge
bundle, **byte-identical** to 07-09), self-validation PASS (8 capabilities, 8 active, all keyless;
--readiness unmet []). Graded by 9 fresh adversarial per-dimension subagents, none having written the
code.

**The one dimension that moved down: design_taste A → B (ship-critical → breaks the gate).** THIS IS A
RE-ASSESSMENT OF A LONG-STANDING CONDITION, NOT A FRESH CODE REGRESSION. A more thorough design grader
surfaced — and the auditor independently verified — that the native Expo app (`apps/mobile`, in ACTIVE
App Store/Play submission scope per `eas.json` submit block) has **NO icon system at all**: `package.json`
has zero icon-library deps (no lucide / @expo/vector-icons / react-native-svg), there are no local
SVG/icon components (only app-icon PNGs), and ~110 raw Unicode-glyph affordances stand in for icons —
`← Back`/`← Recipes`/`← Prev`/`Next →` (`cook/[id].tsx:101,119,160,174`), 12 card labels
(`index.tsx:43-91`), `›` list chevron (`recipes.tsx:117`), `✓` checks (`cook/[id].tsx:229`,
`onboarding.tsx:256`, `upgrade.tsx:158`). Plus a residual web nit: `cook/[id]/page.tsx:182` still renders
a raw `▾` while `ChevronDown` is registered-but-unused for exactly that (`icons.tsx:53`). Per the scale
this is a real, named, non-blocking gap on a ship-critical surface = **B** (not the A bar's "trivial nits
only"). Verified NOT a code regression: only #512 (a11y labels) + #495 (tier label) touched `apps/mobile`
since 07-09, neither adding/removing glyphs — prior cycles simply under-weighted the native surface while
grading the (genuinely A+) web PWA.

**Everything else improved or held — the code got better this cycle:**
- **functional_reality A → A+.** Fake-data grep over `apps/web/app/**/*.tsx` = ZERO hits; #517 throw-safe
  auth (`tenant.ts:13,31` catch `auth()` throwing → signed-out; `loadHomeData` → `EMPTY_HOME_DATA`) means
  the dashboard can't fall to the error boundary; all journeys trace to real server actions + DB writes;
  e2e assertions are real outcomes. Zero findings → A+.
- **Three standing A→A+ nits genuinely CLOSED:** (1) launch_readiness — the 3-cycle RevenueCat event→tier
  map was EXTRACTED to exported pure fns + table-tested (#487, `billing/index.ts:209,221` +
  `index.test.ts:131-188`, route now imports them); (2) design — cook-mode arrow glyphs → registry icons
  (#486, `cook-mode.tsx:5,168,192`); (3) correctness — #504 ask-quota throw-path under-count fixed +
  regression test (`client.ts:515` `stepsAttempted` → `ask/actions.ts:77-79`, `client.test.ts:210-227`).
- **NEW §11 media-gen adapter (#509/#515) audited HONEST.** The 8th manifest capability
  `marketing-media-gen` genuinely exercises its code via injected fake providers (`media-gen.test.ts:104-185`,
  `staging.test.ts:76-226`) — audit-first ordering, success mapping, and throw/empty/timeout/no-key degrade
  all real; not a gamed-green stub. (A→A+ nit: no product-reachable caller yet — staging-only, disclosed.)

**Grades:** functional_reality **A+** (↑from A), correctness_reliability **A**, security **A**,
design_taste **B** (↓from A, SC — breaks gate), launch_readiness **A** (SC), tests_evals **A**,
artifact_integrity **A**, business_case **A**, performance **B**.

**performance held at B (unchanged from #320, 5th cycle).** Both gaps re-confirmed: no CI perf-budget
gate (grep = 2 prose comments only); edge middleware 280,299 bytes raw, byte-identical (NextAuth→jose on
the edge, broad matcher). Non-ship-critical — does not affect the gate; the gate is blocked solely by
design_taste.

**Issues this run:** FILED a NEW `quality` issue for design_taste (ship-critical below A: mobile has no
icon system + residual web `▾`, with the fix = add `@expo/vector-icons` + swap the glyph chrome). #320
(performance) left open + accurate (byte figure unchanged). **Ship-critical dimension dropped below the
ship bar → OWNER NOTIFIED** (dashboard = this scorecard + the new issue).

**What "re-close the gate" looks like next run:** add an icon system to `apps/mobile` and replace the
`←/→/›/✓` glyph chrome with real icons (+ swap the web `▾` → `ChevronDown`) → design_taste back to A →
ship gate MET. Then the perf-budget gate + edge-middleware trim (#320) closes the last B → overall A+.

---

## 2026-07-09 — HELD: overall A, ship gate MET, 8/9 dims at A (no change from 07-05)

**Overall: A. Ship gate: MET.** Mechanical gate this run: typecheck PASS (exit 0), `@gm/core` tests
PASS (96 files pass / 10 skipped; **912 tests pass** / 26 skipped — up from 871; coverage lines 87.19
/ branches 87.79 / functions 90.88 — thresholds 70/84/76/70 met), production `next build` PASS (no
missing-export warnings; 102 kB shared first-load; middleware reported 88.6 kB = gzip of a
**280,299-byte** raw edge bundle). Graded by 9 fresh adversarial per-dimension subagents, none having
written the code.

**No dimension moved.** functional_reality **A**, correctness_reliability **A**, security **A**,
design_taste **A**, launch_readiness **A** (all SC), tests_evals **A**, artifact_integrity **A**,
business_case **A**, performance **B**. 39 commits since 07-05: the **§34 pre-launch funnel** (public
no-account receipt demo #471 + gated-beta invite codes #475), hardening (pantry-mutation degrade
#480, ask/scan/add-receipt quota-gate degrade #464/#465/#482), a11y (#466/#473), a partial design fix
(#479), and docs — all verified genuine improvements, **none a regression, none closed the
performance gap**.

**The two NEW public attack surfaces graded HARD, both layered.** security grader audited
`/api/public/parse-receipt` (per-IP rateLimit + captcha + `checkDemoQuota` dual per-IP/global ceiling
reserved after validation + keyless 503 degrade) and `/api/invite/redeem` (per-IP rateLimit + bounded
input + keyless `normalizeAndValidate` before DB + idempotent COALESCE redeem + generic
non-enumerating errors, grants only the DISTINCT `SITE_GATE_INVITE_SECRET` cookie that opens ONLY
`/signup`, no full-app bypass). **The two NEW self-validation manifest capabilities verified HONEST**
(manifest grew 5→7): artifact_integrity grader confirmed `demo-quota.test.ts` + `invite-code.test.ts`
genuinely exercise `checkDemoQuota` / invite generation+redeem (not stubs), and `journeys.spec.ts`
demo/invite assertions are real outcomes (status codes, generic-reject, POST-only 405) not
page-loads. No capability parked planned/retired to dodge the tripwire.

**performance held at B (the ONLY below-A dim, unchanged from #320).** Both standing gaps re-confirmed
by an independent grader: (1) no CI perf-budget gate (grep of workflows = only two prose comments); (2)
edge middleware still ~280 KB raw (NextAuth→jose on the edge, broad matcher). **NEW this cycle: the raw
bundle CREPT 279,931 → 280,299 bytes** — a small ungated regression, exactly what a perf budget would
have failed. It is the only thing keeping overall off A+.

**Grader nits kept at A (second-order, non-blocking A→A+ polish):** launch_readiness — RevenueCat
event→tier map (`revenuecat/route.ts:32-49`) STILL inline+unexported, no unit test, no capabilities
entry (**3rd cycle uncorrected**); design_taste — #479 fixed only the cook-mode `✓` Done CTA but LEFT
raw `←`/`→` arrow glyphs on the same file's two primary nav buttons (`cook-mode.tsx:168,191`) despite
the registry having `ArrowLeft`/`ArrowRight` (used correctly on /demo + /join) — so the flagged nit is
only HALF fixed; security — rate-limit + demo ceiling in-memory per-process, "global" cap becomes
500×instances under horizontal scale (needs the PENDING_OPS Redis backing); correctness — #482 ask-quota
settles per-step only on the return path, so a mid-run THROW under-counts up to ~7x G7 spend;
tests_evals — line/stmt/func floors carry ~15-17pt slack (only branches=84 ratchets); business_case —
`arr_year1` header field holds STEADY-STATE ($33.45K) not literal year-1 (~$6.5K), a disclosed naming
nit; artifact_integrity — keyless demo e2e lands on the 502 catch branch so `checkDemoQuota` reserve is
proven only by unit test end-to-end (honestly disclosed in the manifest note). All non-blocking.

**Issues this run:** #320 (performance) left open + accurate (both gaps re-confirmed, byte figure
refreshed 279,931→280,299 via a comment) — no refile needed. No ship-critical regression → no owner
notification (dashboard = this scorecard).

**What "raise to A+" looks like next run:** the perf-budget gate + edge-middleware trim (#320) closes
`performance` → overall A+. Three bounded A→A+ polish items on already-A ship-critical dims remain
optional gold-avoidance (RevenueCat event-map test; cook-mode arrow-glyph swap; Redis-backed
demo/rate-limit ceiling).

---

## 2026-07-05 — HELD: overall A, ship gate MET, 8/9 dims at A (no change from 07-03)

**Overall: A. Ship gate: MET.** Mechanical gate this run: typecheck PASS (exit 0), `@gm/core` tests
PASS (94 files pass / 10 skipped; 871 tests pass / 26 skipped — up from 844; coverage lines 87.04 /
branches 87.63 / functions 90.66 — thresholds 70/84/76/70 met), production `next build` PASS (no
missing-export warnings; 102 kB shared first-load; middleware reported 88.5 kB = gzip of an
**unchanged** 279,931-byte raw edge bundle, re-verified byte-identical to last cycle). Graded by 9
fresh adversarial per-dimension subagents, none having written the code.

**No dimension moved.** functional_reality **A**, correctness_reliability **A**, security **A**,
design_taste **A**, launch_readiness **A** (all SC), tests_evals **A**, artifact_integrity **A**,
business_case **A**, performance **B**. 48 commits since 07-03 (bookkeeping runs 46-51 + hardening:
uncaught-throw→degrade #427/#429/#436/#437, store-404 alias #435, a11y contrast #418, mobile brand
color #438, new unit tests #419/#430) — all verified genuine improvements, **none a regression, none
closed the performance gap**. Security grader now enumerates **39** api routes (was 38), all with
server-side auth; correctness grader confirmed the #437 acceptInviteAction keeps `redirect()` OUTSIDE
the try/catch (avoids swallowing Next's redirect throw) — a correct hardening.

**performance held at B (the ONLY below-A dim, unchanged from #320).** Both standing gaps CONFIRMED
still open by an independent grader: (1) no CI perf-budget gate — grep of `.github/workflows/*.yml`
for `bundlesize|lighthouse|size-limit|budget` = only two prose comments about e2e per-request
timeouts (`ci.yml:186`, `evals.yml:28`), no real gate; (2) `.next/server/middleware.js` = 279,931
bytes, byte-identical to last cycle (`middleware.ts:1,6` next-auth/jose on the edge, broad matcher
`:112-114`). It is the only thing keeping overall off A+.

**Grader nits kept at A (second-order, non-blocking A→A+ polish):** launch_readiness — RevenueCat
event→tier map (`webhooks/revenuecat/route.ts:32-49`) still inline+unexported with no unit test (same
carried nit); design_taste — two raw Unicode glyphs (`✓`, `→`) as UI chrome in `cook-mode.tsx:181,190`
instead of registry icons; security — two parallel mobile-token schemes (AUTH_SECRET HMAC vs
NEXTAUTH_SECRET jose), avoidable surface, independently confirmed NOT exploitable (HMAC verifier
ignores JWT alg, always recomputes HS256); tests_evals — line/stmt/func floors carry ~17pts slack
(only the branches=84 floor ratchets); artifact_integrity — mobile README says "18 screens" but one
is `_layout.tsx` (17 screens). All non-blocking.

**Issues this run:** #320 (performance) left open + accurate (both gaps re-confirmed this cycle) — no
refile needed. No ship-critical regression → no owner notification (dashboard = this scorecard). #190
(honest revenue FYI) unchanged.

**What "raise to A+" looks like next run:** the perf-budget gate + edge-middleware trim (#320) closes
`performance` → overall A+. Two bounded A→A+ polish tests on already-A ship-critical dims (RevenueCat
event-map, cook-mode glyph swap) remain optional gold-avoidance.

---

## 2026-07-03 — tests_evals B → A; 8/9 dims at A (overall A, ship gate MET)

**Overall: A. Ship gate: MET.** Mechanical gate this run: typecheck PASS (exit 0), `@gm/core` tests
PASS (93 files pass / 10 skipped; 844 tests pass / 26 skipped; coverage lines 86.82 / branches 87.46
/ functions 90.39 — thresholds met), production `next build` PASS (no missing-export warnings, 102 kB
shared first-load; middleware reported 88.5 kB = gzip of an unchanged 279,931-byte raw edge bundle).
Graded by 9 fresh adversarial per-dimension subagents, none having written the code.

**tests_evals B → A — the one dimension that moved.** Last cycle's SOLE named gap (no vision-quality
eval on the scan-detection stage) is genuinely CLOSED by `scan.eval.test.ts` (#386, commit ff20651).
Adversarially verified: it calls the REAL `detectPantryItems` (live Gemini, `detect.ts:76`) against two
committed genuine JPEG fridge photos (`fixtures/images/*.jpg`, Wikimedia CC BY-SA/BY — not synthetic),
asserting BOTH recall (passRate≥0.8) AND a separate anti-hallucination precision bar over conservative
`absent` items — the exact failure mode `detect.ts`'s per-item bounding-box prompt suppresses. Wired
into the nightly `evals.yml` → `run-evals.sh` (RUN_EVALS=1), `describe.skipIf(!RUN)` gated, transient
429/503 → `ctx.skip()` not a false pass. That was the last first-order gap → B → A. Issue #319 closed.

**Grades:** functional_reality **A**, correctness_reliability **A**, security **A**, design_taste **A**,
launch_readiness **A** (all SC), tests_evals **A** (↑from B), artifact_integrity **A**, business_case
**A**, performance **B**. **8 of 9 at A — the highest the product has held.**

**The sole remaining B — performance (non-ship-critical, ≥ B, doesn't block the gate) — is UNCHANGED
from #320:** still no CI perf-budget gate (grep of `.github/workflows/*.yml` for
`bundlesize|lighthouse|size-limit|budget` = 0 real matches) and the edge middleware is still 279,931
bytes raw (`middleware.ts:1,6` next-auth/jose on the edge, broad matcher `:114`). The grader re-confirmed
the apparent 88.5 kB is only the Next 15.5 gzip figure of the SAME bundle — no trim happened. Held at B.
It is now the ONLY dimension below A and the only thing keeping overall off A+.

**Grader nits kept at A (second-order, not first-order for their dimension):** security — two parallel
mobile-token schemes (`AUTH_SECRET` HMAC vs `NEXTAUTH_SECRET` jose), avoidable surface area, no
exploitable hole; design_taste — dead legacy gradient/`shine`/`aurora` tokens + stale `.empty-emoji`
class name, none render slop; launch_readiness — RevenueCat event→tier map still unit-untested (the
carried A→A+ polish gap); correctness — escalate-loop only indirectly tested. All non-blocking.

**Issues this run:** closed #319 (tests_evals, gap verified closed by #386). #320 (performance) left
open + accurate. #190 (honest revenue FYI) unchanged. No ship-critical regression → no owner
notification (dashboard reflects the improvement).

**What "raise to A+" looks like next run:** the perf-budget gate + edge-middleware trim (#320) closes
`performance` → overall A+ within reach. Two bounded A→A+ polish tests on already-A ship-critical dims
(RevenueCat event-map, direct escalate-loop) remain optional gold-avoidance.

---

## 2026-07-01 — SHIP GATE NOW MET (overall B → A)

**Overall: A. Ship gate: MET (was NOT met at baseline).** Mechanical gate this run: typecheck PASS,
`@gm/core` tests PASS (92 files pass / 9 skipped; 817 tests pass / 24 skipped; coverage lines 86.42 /
branches 87.24 / functions 89.82 — thresholds met), production `next build` PASS (no missing-export
warnings, 102 kB shared first-load). Graded by 9 fresh adversarial per-dimension subagents, none having
written the code.

**Both baseline ship-critical B's driven to A — the two blockers are fixed and regression-guarded:**
- **launch_readiness B → A.** The mobile IAP stub is gone. `apps/mobile/app/upgrade.tsx:82-103` now has a
  real `onBuy → purchase(pkg) → res.status==="active"` flow; `apps/mobile/lib/purchases.ts:103-113` calls
  real `Purchases.purchasePackage()` + reads `hasPremiumEntitlement`, `restore()` wired (App Store req).
  Degrades without key via `isPurchasesConfigured()`; the inert "coming soon" state survives only in the
  unconfigured branch (mirrors web Stripe). Server-side entitlement: `webhooks/revenuecat/route.ts` fails
  closed (timing-safe), maps GRANT/REVOKE into the same `appendPreferenceSignal` ledger as Stripe. Issue
  #260 resolved → closed this run.
- **correctness_reliability B → A.** (1) `vision/persist.ts` now references `pantryStock` only in a
  `.select()` read; every mutation routes through `appendLedgerAndReproject`, and 5 tests assert
  `db.update` is never called (`persist.unit.test.ts:97-100`) — the ledger-only invariant is tripwired.
  (2) The vision pipeline + `generate-llm` are now genuinely covered (vision 98.84% lines; logCook
  7.97% → 99.27%). Independently re-verified EWMA / spoilage-ceiling / LLM-degrade — no bug found.

**Grades:** functional_reality **A**, correctness_reliability **A** (SC, ↑from B), security **A**,
design_taste **A**, launch_readiness **A** (SC, ↑from B), tests_evals **B**, artifact_integrity **A**
(↑from B — F4 perf-budget tick was retracted, manifest honest), business_case **A**, performance **B**.

**Two non-ship-critical B's remain (both ≥ B, don't block the gate):**
- **tests_evals B** — baseline's two structural gaps (vision + logCook coverage) are CLOSED; the sole
  remaining gap is **no vision-quality eval**: `detect.ts` is only unit-tested with a stubbed client, so
  the flagship "pantry fills itself" scan stage has no LLM-judge on real fixture images. The dimension
  grader assigned "A−"; mapped to **B** (scale has no minus grades, and a missing eval on a flagship LLM
  stage is a real named gap, not a trivial nit — anti-inflation → the lower whole grade). Still ≥ B.
- **performance B** — good hygiene (indexes, no N+1, cheap-first LLM ladder) but **no CI perf-budget
  gate** and a **276 KB uncompressed edge middleware** (next-auth/jose on the edge). The grader caught
  that the apparent middleware 276→88.5 kB "drop" is only Next 15.5 now reporting the *gzipped* size —
  the bundle is unchanged. This is the same standing gap as baseline; held at B.

**Grader-vs-auditor adjustments (transparency):**
- tests_evals: grader said "A−"; the scale has no minus grades. Held at **B** because a missing quality
  eval on a flagship LLM stage is a real, named, non-blocking gap (the B definition), not a trivial nit
  (the A definition). Noted in the scorecard that it is high-B/near-A with baseline gaps closed.
- Several A dims carry a small named nit (RevenueCat event-map unit test; indirect escalate-loop test;
  CSP/CORS tradeoffs) — kept at A because those are second-order nits within their dimension, whereas a
  coverage gap is first-order for tests_evals specifically.

**Issues this run:** closed #260 (launch_readiness, now A); no open correctness quality issue remained
(the baseline one was already closed). Filed/updated non-ship-critical gap issues for tests_evals
(vision eval) and performance (perf-budget gate). #190 (honest revenue FYI) left open — unchanged.

**What "raise to A+" looks like next run:** add the vision-quality eval (closes tests_evals) and a CI
perf-budget gate + edge-middleware trim (closes performance) → overall A+ within reach. Two bounded
A→A+ polish tests on already-A ship-critical dims (RevenueCat event-map, direct escalate-loop) are
optional gold-avoidance.

---

## 2026-06-29 — BASELINE GRADE (first run)

**Overall: B. Ship gate: NOT met.** Bootstrapped `QUALITY_RUBRIC.md` (9 dimensions, 5 ship-critical)
and `QUALITY_SCORECARD.md` from the rubric standard, adapted to this stack (Next 15 PWA + Expo,
Postgres/Drizzle RLS, Gemini cheap-first). Mechanical gate this run: typecheck PASS, `@gm/core` tests
PASS (86 files, vitest thresholds met), production `next build` PASS (no missing-export warnings,
102 kB shared first-load). Graded by 9 fresh adversarial per-dimension subagents, none having written
the code.

Grades: functional_reality **A**, correctness_reliability **B** (SC), security **A**, design_taste
**A**, launch_readiness **B** (SC), tests_evals **B**, artifact_integrity **B**, business_case **A**,
performance **B**.

**Why the ship gate is blocked (two ship-critical B's):**
- **launch_readiness B** — mobile RevenueCat IAP is a disabled "Payments coming soon" stub
  (`apps/mobile/app/upgrade.tsx:71`), no `Purchases.purchasePackage()`. The web Stripe path is fully
  wired; the mobile payment path is not. An App-Store-targeted app that can't accept payment on device
  is not submittable. This is the single hard blocker.
- **correctness_reliability B** — (1) `packages/core/src/vision/persist.ts:110-112` writes
  `pantryStock` directly after `appendLedgerAndReproject`, violating the ledger-only invariant
  (semantically harmless but real); (2) vision ingestion path (detect/persist/resolve) +
  `recipe/generate-llm.ts` ship at ~0% coverage.

**Cross-cutting:** correctness + tests gaps share a root cause — the vision-scan ingestion path is
real shipping logic that is untested and contains the invariant violation. Fixing it closes both.

**Grader-vs-auditor adjustments (transparency):**
- artifact_integrity: the dimension grader proposed B citing two *unchecked* DoD boxes (the quality
  grade box itself + the confidence statement). Those are *correctly* unchecked (good discipline), not
  integrity defects — so that reasoning was set aside. Held at **B** on a *different*, valid finding:
  ROADMAP Track F4 ticks "performance budgets" while the performance audit found no CI budget gate
  exists — a ticked claim without its artifact.
- performance: grader said "B+"; mapped to **B** (scale has no B+). All findings positive except the
  missing CI perf-budget gate and a heavy (~276 KB uncompressed) middleware bundle.

**Issues filed this run:** quality issues for the two ship-critical-below-A dimensions
(launch_readiness, correctness_reliability). No prior quality issues existed (only #190, the honest
revenue FYI). No duplicates.

**What "raise to A" looks like next run:** mobile IAP wired (degrading w/o keys like web); the direct
`pantryStock` write removed + vision/logCook tests added; then re-grade. Non-ship-critical B's
(tests, artifact, performance) are ≥ B and don't block — close them opportunistically.
