```yaml
# BUSINESS_CASE_SUMMARY (machine-readable; keep in sync with the analysis below)
# arr_year1 = planning-case ACHIEVABLE annual run-rate (steady state) per scenario, in whole USD.
# Literal first-12-months revenue is LOWER than steady state because of the slow ramp (low churn =
# long approach to the asymptote — see §4). floor_met_year1 reflects the honest base case vs the floor.
currency: USD
arr_year1:
  conservative: 3100
  base: 33450
  optimistic: 342000
planning_case: base
floor_usd: 100000
floor_met_year1: false   # honest median base ≈ $33K/yr steady state — the floor is NOT met at median inputs
time_to_floor: "Requires ~4,000–4,500 sustained downloads/mo at base conversion (optimistic-leaning distribution). Not reached at median organic; achievable in ~12–24 mo only with strong demand-gen — see §5."
as_of: 2026-06-27
```

# GroceryManager — Business Case

**Version:** 2026-06-27 (recomputed — honest freemium funnel; corrected ramp math; floor reassessed)
**Status:** Living document — update as real analytics data arrive (see §7).

> Stamp: last recomputed 2026-06-27 — **major honesty correction.** The prior (2026-06-26) revision
> modelled signup→paid as `trial_start 60% × trial→paid 21% = 12.6%`, which is 2.5–6× the cited
> freemium free→paid benchmark (2–5%). For a **generous-free** app (the whole core loop is free), most
> users never hit the premium gate, so the realistic signup→paid rate IS the freemium rate, not a
> hard-paywall trial rate. Re-grounding on the cited 2–5% benchmark drops the median base from a gamed
> ~$106K/yr to an honest **~$33K/yr steady state**. The prior doc also claimed the floor was crossed in
> "month 20–24"; the correct ramp math (below) puts it many years out at flat median downloads. **The
> honest conclusion: the floor is NOT met at median inputs — it requires optimistic-leaning
> distribution.** Unit economics remain excellent (~97% margin); the entire gap is demand generation.

> This is a bottom-up financial model against the goal of ≥ $100 K/yr net revenue. All inputs are
> cited or derived from first-principles code inspection. The model is honest about uncertainty and
> names levers explicitly; it does NOT pick any number to clear the floor.

---

## 1. Product and pricing

| Tier | Price | Trial | Apple/Google net (15% fee) |
|---|---|---|---|
| Free | $0 | — | — |
| Premium Monthly | $4.99 / month | 7 days | $4.24 / month |
| Premium Annual | $39.99 / year ($3.33/mo) | 7 days | $33.99 / year ($2.83/mo) |
| Family | $9.99 / month or $79.99 / year | 7 days | $8.49 / month or $67.99 / year |

Prices sourced from `packages/core/src/billing/index.ts` (`priceMonthCents: 499`,
`priceAnnualCents: 3999`; `premium_family`: `priceMonthCents: 999`, `priceAnnualCents: 7999`) and the
matching Stripe price-ID env vars in `packages/config/src/env.ts`. Apple and Google both charge 15 %
for developers earning < $1 M/yr (Apple Small Business Programme; Google Play reduced service fee).

**Blended ARPU — individual tiers only (mix: 70 % monthly / 30 % annual):**

```
ARPU = 0.70 × $4.24 + 0.30 × ($33.99 / 12) = $2.97 + $0.85 = $3.82 / user / month (net of platform fee)
```

**Blended ARPU — with Family-tier adoption (mix: 65 % monthly / 25 % annual / 10 % family monthly):**

```
ARPU = 0.65 × $4.24 + 0.25 × ($33.99 / 12) + 0.10 × $8.49
     = $2.76        + $0.71                  + $0.85
     = $4.32 / user / month (net of platform fee)
```

The Family tier raises blended ARPU by ~13 % ($3.82 → $4.32) IF ~10 % of paying users adopt it. **The
base case below uses the individual-only $3.82 ARPU.** Family adoption is treated as an *upside lever*,
not a base assumption, because there is **no clean public benchmark for the share of paying users who
choose a family/multi-seat tier** (industry data confirms family plans lift *retention* ~52 % and that
~37 % of consumers share subscriptions, but not a reliable adoption %). The Family card is built and
surfaced in `/upgrade` (`CheckoutButton plan="family"`, PR #154) and the Stripe webhook maps its price
ID to `premium_family`; charging it needs the owner to create the Stripe/RevenueCat product (Human
Core). We do not bank the floor on an uncited adoption rate.

---

## 2. Unit economics (cost per paying user per month)

### 2a. LLM / AI inference

The cheap-first cascade (`GeminiClient.generateWithVerify`: flash-lite → flash → pro,
verify-then-escalate) keeps most calls at the cheapest tier. Approximate token costs at June 2026
Gemini public pricing:

| Use case | Calls / user / month | Tokens (in + out) | Model | Cost / mo |
|---|---|---|---|---|
| Receipt parse (photo) | 5 | 600 in + 300 out | Flash-lite | $0.003 |
| Receipt parse (Gmail) | 8 | 500 in + 250 out | Flash-lite | $0.003 |
| Meal gen (plan-my-week) | 4 | 1 500 in + 800 out | Flash | $0.004 |
| Recipe remix | 3 | 1 000 in + 600 out | Flash | $0.002 |
| Fridge scan (vision) | 2 | 1 image + 400 out | Flash | $0.005 |
| Capture / ask | 5 | 400 in + 200 out | Flash-lite | $0.001 |
| **Total LLM** | | | | **~$0.018 / mo** |

These are *active paying user* estimates. The per-user/day spend ceiling (`llm-quota.ts`, applied to
every web + mobile LLM surface — Track G7) caps the worst case. Error: ±100 %; even 10× actual cost =
$0.18/mo, still < 5 % of net ARPU.

### 2b. Infrastructure

| Component | Basis | Cost / user / mo |
|---|---|---|
| Postgres (Neon / Vercel) | Row-level data, ~50 KB / user | ~$0.02 |
| Vercel serverless compute | ~200 API calls / user / mo | ~$0.02 |
| Storage (receipt images, transient) | Ephemeral — not stored | $0.00 |
| CDN / bandwidth | Static assets, shared | ~$0.01 |
| **Total infra** | | **~$0.05 / mo** |

### 2c. Gross margin

```
Net ARPU (individual base):  $3.82 / mo
LLM cost:                   -$0.02 / mo
Infra cost:                 -$0.05 / mo
Payment processing (web blended): -$0.05 / mo
────────────────────────────────────────────
Gross profit:                $3.70 / mo per paying user
Gross margin:                ~97 %
```

A ~97 % gross margin is characteristic of lean SaaS with a cheap-first LLM architecture. **This is the
strongest part of the case: the unit economics are not the problem.** Every paying user is almost pure
margin once fixed costs (hosting, DB, analytics, email, domain ~$150/mo run-rate; plus ~$124/yr
developer-account fees) are covered.

**Break-even on fixed costs only:** ~41 paying users × $3.70 = $152/mo covers the ~$150/mo run-rate —
covered at any meaningful scale.

---

## 3. Funnel model (honest freemium)

```
Downloads → Signups → Paid (free→paid) → Retained
```

GroceryManager is **generous-free**: pantry, cook, list, capture/scan, and plan are all free. Premium
is an *upsell* (unlimited AI meal plans/remix, Gmail receipt import, advanced spend insights, Grocery
Wrapped+). So the conversion that matters is the **freemium free→paid rate** — the observed share of
*free signups* who ever become paid — NOT a hard-paywall trial-conversion rate. Modelling it as
`trial_start% × trial→paid%` (as the prior revision did) overstates conversion by 2.5–6× for an app
most people can use forever without paying.

### Inputs (research-grounded; assumptions labelled)

| Input | Conservative | Base | Optimistic | Source |
|---|---|---|---|---|
| Download → signup | 35 % | 45 % | 55 % | App requires an account to function; bounded by store-listing → install conversion for utilities (AppTweak 2024: 48.6 % App Store / 36.8 % Play *impression→install*). Labelled assumption — utility apps that require registration lose a meaningful share at signup. |
| Signup → paid (freemium free→paid) | 2.5 % | 4 % | 6 % | OpenView SaaS Benchmarks 2023; Amplitude Product Report 2024 (freemium median **2.18 %**, range 2–5 %). Base 4 % = upper-mid, justified by the high-value Gmail-import trial moment (Reforge Growth Series 2024: visible first-value moments lift conversion). |
| Monthly churn (blended) | 6.5 % | 3.7 % | 3.0 % | Baremetrics Subscription Benchmarks 2024 (consumer SaaS ~5 % median; utility/productivity 4–6 %). Base blends 72 % monthly @ 4.5 % + 28 % annual @ (20 %/12). |
| Net ARPU | $3.82 | $3.82 | $4.32 | §1. Optimistic includes 10 % Family-tier adoption (upside lever). |

**Blended churn derivation (base):**

```
Blended churn = 0.28 × (20% / 12) + 0.72 × 4.5% = 0.47% + 3.24% = 3.71% ≈ 3.7%
```

### Steady-state and ramp

At equilibrium: `steady_state_paying = new_paid_monthly / monthly_churn`, where
`new_paid_monthly = downloads × signup_rate × free_to_paid`.

**Ramp matters and is slow.** Paying users approach the asymptote as `U(t) = U_ss·(1 − e^(−c·t))`, with
`c = monthly churn`. At base churn 3.7 %, the time constant `1/c ≈ 27 months`: you reach ~63 % of
steady-state ARR at ~27 mo and ~86 % at ~4 yr at a *flat* download rate. Low churn is great for LTV but
means revenue compounds slowly unless downloads keep growing. So **steady-state ARR is an upper bound
that takes years to reach at flat downloads**; literal year-1 revenue is much lower.

---

## 4. Scenarios (steady-state annual run-rate)

### Scenario A — Conservative (organic only, no launch)

| Input | Value |
|---|---|
| Monthly downloads | 500 |
| Download → signup | 35 % |
| Signup → paid | 2.5 % |
| Monthly new paid | 500 × 0.35 × 0.025 = **4.4/mo** |
| Monthly churn | 6.5 % |
| Steady-state paying | 4.4 / 0.065 = **67 users** |
| Net ARPU | $3.82 |
| **Annual net revenue (steady state)** | **≈ $3,100** |

The floor scenario: no ASO, no launch event, no content. Establishes the downside.

### Scenario B — Base / Median (planning case)

| Input | Value |
|---|---|
| Monthly downloads | 1,500 (good ASO + one launch event) |
| Download → signup | 45 % |
| Signup → paid | 4 % (freemium upper-mid, Gmail-import hook) |
| Monthly new paid | 1,500 × 0.45 × 0.04 = **27/mo** |
| Monthly churn | 3.7 % |
| Steady-state paying | 27 / 0.037 = **730 users** |
| Net ARPU | $3.82 (individual; Family upside not banked) |
| **Annual net revenue (steady state)** | **≈ $33,450** |

> **Literal year-1 (base):** starting from zero at a flat 1,500 dl/mo, accrued first-12-month revenue
> ≈ **$6,500**, with an end-of-year run-rate ≈ **$12K/yr**. Steady-state $33K is a multi-year asymptote.
> **With the 10 % Family-tier upside**, steady-state rises to ≈ **$37,800/yr** — still well below floor.

**Verdict: ❌ below the $100 K/yr floor at median inputs.**

### Scenario C — Optimistic (viral loop + content + strong launch)

| Input | Value |
|---|---|
| Monthly downloads | 6,000 |
| Download → signup | 55 % |
| Signup → paid | 6 % |
| Monthly new paid | 6,000 × 0.55 × 0.06 = **198/mo** |
| Monthly churn | 3.0 % |
| Steady-state paying | 198 / 0.030 = **6,600 users** |
| Net ARPU | $4.32 (10 % Family adoption) |
| **Annual net revenue (steady state)** | **≈ $342,000** |

Requires viral distribution (the in-app referral/share loop, built; owner connects channels) + durable
content/ASO traffic. Even here, the ramp means realized year-1 is a fraction of the asymptote.

---

## 5. The $100 K/yr verdict (honest)

**At median inputs the business does NOT reach $100 K/yr — base steady state is ≈ $33 K/yr (≈ $38 K
with Family upside), and literal year-1 is ≈ $6–12 K.** The floor is achievable, but only with
**optimistic-leaning distribution**, because the model is entirely demand-gated:

| Scenario | Steady-state ARR | Floor met? | What it requires |
|---|---|---|---|
| A — Conservative | ≈ $3,100 | No | Organic only, no marketing |
| B — Base / Median | ≈ $33,450 ($38K w/ Family) | No | Good launch + median funnel |
| C — Optimistic | ≈ $342,000 | Yes | Viral distribution + content + ASO |

**What it takes to clear $100 K/yr (steady state):** ~1,929–2,182 paying users → at base conversion
(download→paid ≈ 1.8 %) and 3.7 % churn, that is **~4,000–4,500 sustained downloads/mo** — between the
base and optimistic scenarios. At that download level the $100 K *asymptote* is reached, but realized
ARR is ~$63 K at year 2 and ~$86 K at year 4 at *flat* downloads; hitting $100 K/yr in actual revenue
within ~12–24 months needs downloads to keep **growing** (which marketing compounds toward), i.e. the
optimistic trajectory.

**The levers, ranked by impact (all in our control to build; reach is owner-activated):**
1. **REACH / downloads — by far the dominant lever.** Every additional sustained download flows
   linearly to revenue. The built marketing engine (ASO package, SEO/content engine, Product Hunt
   launch plan, referral/share loop, email lifecycle) exists to drive this; it activates the moment the
   owner connects channels (Track H). $100 K lives at ~4,000+ dl/mo.
2. **CONVERSION — signup→paid.** Moving base 4 % toward the optimistic 6 % is a 50 % revenue lift.
   Surface the Gmail-import payoff as the first premium moment; tighten the `/upgrade` decision surface.
   _(Built 2026-06-27, run 20: the Gmail-import first-premium-moment teaser on `/pantry` — PR #197 — plus
   the H9/H10 analytics + experiment engine — PR #198 — which lets the Growth Agent EMPIRICALLY measure and
   tune signup→paid lift post-launch. The median here is unchanged: the base 4 % already assumes the Gmail
   hook, and the experiment engine measures real lift only once there is traffic. More buildable conversion/
   retention levers remain for subsequent runs — month-3 annual nudge, expiry/reorder push, referral perks,
   win-back — to be shipped through the normal gate until the honest median clears the floor or only reach
   remains.)_
3. **RETENTION / LTV.** Lower churn both raises steady state *and* shortens the ramp. Re-engagement
   (push, weekly cook-tonight digest, annual-plan nudge) is built; the recurring weekly-use loop is the
   structural advantage.
4. **ARPU — Family + annual mix.** Family adoption (upside) and shifting mix toward annual lift ARPU
   ~13 %; secondary to reach/conversion.
5. **MARGIN.** Already ~97 %; not a constraint.

**Bottom line:** the product can support a ≥ $100 K/yr business — the unit economics are excellent and
the path is real — but it is **not a median-organic outcome**; it depends on demand generation reaching
optimistic-leaning download volume. This gap is flagged honestly to the owner (see the FYI issue and
`docs/LAUNCH.md`); closing it is post-launch growth execution (owner-activated channels + the separate
Growth Agent), not a buildable code gap.

---

## 6. Key risks and levers

### Risk: downloads never reach ~4,000/mo (the floor-gating risk)
Organic-only apps with no budget often plateau at 100–500/mo. **Levers (built, owner activates):**
Product Hunt launch (a top-10 PH launch can drive 2,000–10,000 page visits in 24 h — see
`docs/brand/LAUNCH_PLAN.md`); SEO content (3–6 mo lag, durable); ASO (keyword string in
`docs/store/ASO_READY.md`; ratings drive ranking after 25+ reviews); referral/share loop (in-app;
connect to email + deep links to push k-factor up).

### Risk: signup→paid stays at the 2–3 % low end
**Levers:** surface Gmail import as the very first premium moment; day-7 nudge email
(`docs/brand/CONTENT_DRAFTS.md` Email 3); single clear upgrade CTA.

### Risk: churn rises above 6 %
This both lowers steady state and is the conservative-scenario trap. **Levers:** push re-engagement
(built; Human Core: EAS project ID); weekly cook-tonight digest; annual-plan nudge at month 3.

### Risk: LLM costs spike
The cheap-first cascade + per-user/day spend ceiling (Track G7) cap this. Even 10× usage = $0.18/user/mo
= < 5 % of ARPU. Not a structural risk.

---

## 7. Living model — how to update this as real data arrives

When Plausible analytics and Stripe/RevenueCat data are live, replace modelled inputs with actuals:

| Metric to measure | Where to find it | Which input it replaces |
|---|---|---|
| Monthly installs | App Store Connect / Play Console | `downloads` |
| Signup rate | Plausible: `/signup` views / `/` views | `download→signup` |
| Free→paid | RevenueCat / Stripe: paid / total signups | `signup→paid` |
| Monthly churn | RevenueCat / Stripe: churned MRR / total MRR | `monthly_churn` |
| ARPU | Stripe / RevenueCat: MRR / active subscribers | `$3.82` |
| Family adoption % | RevenueCat: `premium_family` / total paid | Family upside |

**Recompute whenever any input moves ≥ 20 %, or pricing/COGS change.** Building more *features* does NOT
move the number — only reach, conversion, retention, ARPU, and margin do. First real-data update: after
~90 days live. Anchor prices to the actual billing config; price drift vs code is a bug — fix + recompute.

---

## 8. Honest confidence statement

> GroceryManager has **excellent unit economics (~97 % gross margin)** and a real path to a ≥ $100 K/yr
> business, but **that path is not the median outcome.** At median inputs — 1,500 downloads/mo, 4 %
> freemium conversion, 3.7 % churn — steady-state revenue is ≈ **$33 K/yr** (≈ $38 K with Family
> adoption), and the $100 K/yr floor requires **~4,000–4,500 sustained downloads/mo** (optimistic-leaning
> distribution) plus the slow-ramp dynamics to play out. The conservative organic case is ≈ $3 K/yr. The
> entire gap to the floor is **demand generation**, not cost structure or product completeness — which is
> why the marketing/growth engine (Track E + H) was built. **The floor is therefore NOT met at median
> inputs today; it is a credible but execution-dependent target.** This is flagged to the owner as the
> single most important pre-launch reality (see the FYI issue + `docs/LAUNCH.md`). Continuous
> data-grounded optimization of reach and conversion is the owner's post-launch job.
