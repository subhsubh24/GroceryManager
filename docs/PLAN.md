# GroceryManager — "Never stress about groceries or cooking" — Full Build Plan

## Context

You're too busy to think about meals and groceries, and you want one app that
quietly handles both: understand what you already have at home, tell you when and
what to reorder, build the shopping list, and suggest recipes you can actually cook
with what's on hand — learning your habits over time. The repo is currently empty
(a true greenfield), so this plan defines the whole thing from scratch. Long-term
goal: if it works for you, it should be cleanly monetizable as a product.

Three findings from researching your two requested data sources **reshape the
original idea** — none are blockers, but they change the architecture:

1. **Instacart's official API is output-only.** The Developer Platform API + its MCP
   expose exactly 3 tools — `create_shopping_list_page`, `create_recipe_page`,
   `get_nearby_retailers`. They can deep-link you *into* Instacart to order, but they
   **cannot read your order history**. So Instacart powers the "order this" button,
   not the "what did I buy" picture. (Docs: https://docs.instacart.com/developer_platform_api/guide/tutorials/mcp/)
2. **Amazon order data = scraping, and it's brittle.** No official buyer API exists.
   A from-scratch MCP must log in via a real browser (Playwright), reuse cookies, and
   scrape order-history HTML. It works but breaks when Amazon changes pages and is
   against their ToS. Treated as an **optional, isolated module**.
3. **Whole Foods in-store receipts are the hard part.** WFM *online* orders show in
   Amazon history; *in-store* purchases generally **don't** — they arrive as **emailed
   digital receipts**.

**The robust answer to all three:** make **Gmail email-receipt parsing the primary,
reliable feed** (one read-only integration captures Amazon + Whole Foods digital
receipts + Instacart confirmations), backed by **manual/barcode** entry, with the
**Amazon scraper** as an optional power-user add-on and **Instacart used purely for
ordering**. "What's in my pantry" then comes from a **depletion model the app learns
over time**.

### Locked decisions (from you)
- **Platform:** start as an installable **PWA** (Next.js + React, mobile-first),
  structured so logic ports to native (Expo) later. **TypeScript end-to-end.**
- **Ingestion priority:** ① Gmail receipts → ② Amazon-orders scraper MCP (optional) →
  ③ manual + barcode, **plus a vision fridge/pantry scan as a ground-truth confirmation layer** (§5.6). (No Plaid for now.)
- **This deliverable is the plan only — no code yet.**
- **Audience:** personal-first, but **SaaS-ready** (per-user auth, clean multi-tenant
  boundaries).
- **Design:** **Instacart-*inspired*** — an original implementation (do NOT copy their logos, icons,
  or trade dress; that's infringement). Borrow the *aesthetic*: clean, green, card-based, generous
  whitespace, big tap targets, mobile-first. (Exception: the **official "Shop with Instacart" CTA button +
  logo** are used as-is per Instacart's brand guidelines — required for API approval — sanctioned asset use, not copying.)
- **Brain:** **Gemini** (cheap-first ladder: Flash-Lite → Flash → Pro), made reliable by a strong
  **harness** — semantic layer + context/loop/harness engineering (§8). Per loop/harness-engineering:
  a small model in a great harness beats a big model in a bad one.

---

## 1. Product in one paragraph + the flagship "signal" features

A personal grocery + recipe autopilot. It ingests your receipts, infers your pantry,
predicts run-outs, drafts a smart shopping list you push to Instacart in one tap, and
proposes "cook what I have tonight" recipes that prioritize what's about to expire —
all improving as you confirm/correct. Everything else is supporting cast.

**The three flagships (the "wow"):**
1. **A pantry that fills itself** from your email receipts (zero manual entry).
2. **"You're about to run out of X"** reorder nudges → one-tap Instacart order.
3. **"Cook what I have tonight"** recipes that respect what's expiring and your diet.

Plus a **ground-truth pantry scan**: snap a photo of your fridge/pantry and Gemini vision
reconciles what's *actually* there against what it inferred — and the app **intelligently asks**
for a fresh photo only when its confidence has drifted, so it confirms rather than assumes (§5.6).

Plus a **weekly autopilot**: a Gemini agent that plans the week's dinners around what
you have + what's expiring, computes the gap, and drafts the order — so a normal week
needs ~zero thought from you.

Plus it **learns *you*** over time: an agentic onboarding interview seeds a typed **user model**
(diet, loves/hates, cuisines, **kitchen equipment**, household, busy days, budget), refined forever from
what you actually cook, skip, reorder, and waste — with the occasional high-signal question (§8.7). And
it's **effort- *and cleanup*-aware**: on a busy/low-energy day it favors one-pan, low-cleanup, or no-cook
meals — a 15-min meal that dirties three pans isn't actually easy (flag a "busy day," or it infers one; §7.4).

Plus it covers **all your recurring needs, not just food**: a second **Household & Personal Care** section
(cleaning supplies, skincare, toiletries) that learns *your* replenishment cadence and reorders from
**Amazon** — one-tap cart or **Subscribe & Save** — so the boring stuff never runs out either (§7.5).

---

## 2. Architecture

### 2.1 Stack (opinionated, pragmatic — a modular monolith, not microservices)

| Concern | Choice | Why |
|---|---|---|
| App framework | **Next.js 15 (App Router) + React 19**, `next-pwa` | PWA + SSR + API routes (the BFF). |
| Language | **TypeScript** everywhere | Locked; one language across UI, core, workers. |
| UI | **Tailwind + shadcn/ui + Radix**, custom Instacart-*inspired* theme tokens | Fast path to a clean, green, card-based aesthetic — original, not copied. |
| Data/cache | **TanStack Query** + Server Actions | Identical patterns reusable in RN later. |
| DB | **Postgres** (Neon/Supabase managed; Docker in dev) + `pgvector` + `pg_trgm` | Relational integrity for the units math; vector + trigram for ingredient matching. |
| ORM | **Drizzle ORM** | Typed SQL, transparent for the quantity math, great migrations. |
| Auth | **Auth.js (NextAuth v5)** w/ Google provider | We need Google OAuth for Gmail anyway — reuse for login. |
| Jobs/queue | **BullMQ on Redis** (Upstash in prod) | Receipt processing, Gmail polling, prediction recompute = async + retryable. The ingestion backbone. |
| Object storage | **S3-compatible** (R2 / Supabase Storage) | Raw receipt EML/HTML blobs, barcode images. |
| LLM | **Google Gemini via `@google/genai`** — `gemini-2.5-flash-lite` (cheap default: classify/extract/vision/normalize), `gemini-2.5-flash` (mid + stable fallback), `gemini-2.5-pro` (planning/hard reasoning); cheap-first **escalation ladder** (§8.1). | Reliability is engineered in the harness, not bought from the model. |
| LLM I/O | **Structured output** (`responseMimeType:"application/json"` + `responseSchema`, from Zod via `zod-to-json-schema`; re-validate with Zod); **Batch API** (50% off) for high-volume extraction; **explicit context caching** (25% input) for the semantic-layer/system prefix; `thinkingBudget` per tier (Flash can disable `=0`). | Schema-shaped JSON at minimal cost. |
| Agent | **`@google/genai` function calling** (auto tool-calling) for "plan my week", run as a **generator/evaluator loop** with a **cheap separate verifier** (§8.4/§8.6). | Verified tool-loop in the harness; in-process typed tools over Postgres + Instacart. |
| Embeddings | **`gemini-embedding-001`** (3072-dim) **MRL-truncated to 1536** to fit the pgvector index limit — powers the §5.4 matching cascade. | Single provider end-to-end. |
| Validation | **Zod** as the single source of truth (runtime + LLM JSON Schema) | One schema definition drives both. |
| Email parse | `mailparser` (EML→struct) + `cheerio` (HTML→clean text) before the LLM | Cuts tokens; deterministic pre-pass. |
| Scraper | **Playwright + cheerio** (TypeScript) in an isolated service | Keeps the monorepo single-language; see §9. |

### 2.2 The MCP question, answered concretely
MCP servers are normally **local stdio subprocesses** — a hosted web app can't "use" one
the way a desktop client does. So we treat every external integration as an **adapter
behind a narrow TypeScript interface**, and the default is to call the REST directly:

- **Instacart → call the 3 REST endpoints directly.** No subprocess, no agent needed —
  a tiny typed client in `packages/core/integrations/instacart`. **Output/deep-link only** — no cart,
  order, checkout, payment, or order-status endpoint exists (that's the "fully auto-order" ceiling; see §7.1).
- **Amazon-orders → run the from-scratch scraper as an isolated, opt-in worker service**
  (`services/amazon-mcp`), exposed to the app as a plain `OrderSource` interface
  (`fetchOrders(sinceDate) → OrderDTO[]`). Whether its internals "are MCP" or just a
  scraping lib is irrelevant behind that boundary. This quarantines all ToS/brittleness risk.
- **Gemini's agentic tools** (for "plan my week") are registered as **in-process typed
  functions** (hitting Postgres / the Instacart client), not external MCP subprocesses —
  simplest hosted deploy.

### 2.3 Component map (logical)
```
PWA (React UI + TanStack Query)
  └─ Next.js API routes / Server Actions  (BFF)
        └─ packages/core  (ingestion · pantry · reorder · recipe · agent · units · llm)
              ├─ packages/db (Drizzle → Postgres + pgvector + pg_trgm)
              └─ Gemini API (Flash-Lite / Flash / Pro) via @google/genai
  BullMQ workers (separate always-on Node service):
     gmail-poll · receipt-parse · predict-recompute · watch-renew
        ├─ Gmail API (read-only watch + history.list)
        ├─ Instacart REST (3 output tools)
        ├─ services/amazon-mcp  (optional Playwright scraper, feature-flagged)
        └─ Recipe provider (Spoonacular primary · TheMealDB fallback)
```

### 2.4 Deployment topology
- **Next.js PWA → Vercel** (confirmed). Hosts the UI + API routes/Server Actions + the fast
  `/api/webhooks/gmail` endpoint (it just enqueues, so it stays well under Vercel's function limits).
  **It's a normal responsive website** — works in any mobile browser with no install; "Add to Home
  Screen" is optional and is what unlocks web push on iOS 16.4+.
- **Workers → a separate always-on Node service** (Railway/Render/Fly) running BullMQ + the queues.
  *These can't live on Vercel serverless* — Gmail watch-renewal, polling, and nightly recompute need a
  persistent process. (Vercel Cron can *ping* a worker endpoint, but the long-running work stays off Vercel.)
- **`services/amazon-mcp` → its own container** with Playwright, scaled-to-zero, feature-flagged.
- **Postgres + Redis → managed** (Neon/Supabase + Upstash). **Cron** via BullMQ repeatable jobs
  (daily watch-renew, hourly gmail-poll fallback, nightly predict-recompute).

---

## 3. Monorepo layout

**pnpm workspaces + Turborepo.** Dependency rule: `apps/*` and `services/*` depend on
`packages/*`; `packages/*` never depend on `apps/*`. This is what makes the future
Expo/native port cheap — the UI is replaceable, the engines in `core` are not.

```
grocery-manager/
├─ apps/web/                      # Next.js 15 PWA (UI + BFF + Server Actions)
│  ├─ app/                        # (auth) (dashboard) pantry recipes list settings
│  └─ public/manifest.json        # PWA manifest + service worker
├─ packages/
│  ├─ core/                       # ALL business logic — framework-agnostic, RN-portable
│  │  ├─ ingestion/  pantry/  reorder/  recipe/  agent/  units/
│  │  ├─ integrations/ gmail/  instacart/  recipe-providers/  order-source/
│  │  └─ llm/                     # Gemini (@google/genai) wrapper, model router, verifier, semantic layer, evals
│  ├─ db/                         # Drizzle schema, migrations, seed (units, FoodKeeper, catalog)
│  ├─ shared/                     # Zod schemas + TS types shared UI↔core↔workers
│  └─ config/                     # env (zod), constants, seed data
├─ services/
│  ├─ workers/                    # BullMQ processors + cron
│  └─ amazon-mcp/                 # OPTIONAL Playwright scraper (feature-flagged)
├─ infra/                         # docker-compose (pg+redis), Dockerfiles
└─ turbo.json · pnpm-workspace.yaml
```

---

## 4. Data model (the heart of the system)

Prior art: **Grocy** (base-unit stock + unit conversions + append-only stock log +
min-stock/par reorder) — we mirror all four. The single most important modeling decision
is the **Product ↔ CanonicalFoodItem split**: receipts/UPCs are messy SKUs; recipes and
pantry reason about *foods*. Many noisy inputs converge on one clean food node.

### 4.1 The units/quantity model (design this first — everything depends on it)
Purchases come in retail units ("2 lb chicken", "1 dozen eggs", "32 fl oz milk"); recipes
consume in cooking units ("200 g chicken", "2 eggs", "1 cup milk"); depletion is in yet a
third frame. Solve it Grocy-style:
- **`UnitOfMeasure`** — global registry (`g,kg,oz,lb,ml,l,fl_oz,cup,tbsp,tsp,each,dozen,bunch,clove,can,pinch`), each with a `dimension` (`MASS|VOLUME|COUNT|DISCRETE`). Same-dimension conversions are global constants.
- **`ItemUnitConversion`** — *item-specific* cross-dimension conversions (density "1 cup flour = 120 g"; count "1 egg = 50 g", "1 clove = 5 g"; pack "1 can tomatoes = 400 g"). `source` ∈ `fdc|usda|heuristic|user|llm`, with `confidence`.
- Each `CanonicalFoodItem` declares a **base/stock unit**; all `PantryStock` and ledger math happen in base units. A `convert(qty, from, to, item?) → {qty, confidence}` service tries global → item-specific → heuristic fallback, and **confidence propagates** into pantry math. Store quantities as `numeric(12,3)` — never floats.

### 4.2 Core entities (key fields; every user-owned row carries `userId`)
- **User / Account / Session** (Auth.js) + **`OAuthCredential`** (encrypted Gmail tokens, `historyId`, `watchExpiresAt`).
- **`CanonicalFoodItem`** (really a `CanonicalItem` with `domain(grocery|household|personal_care)` — "Food" is historical) — `name, slug, domain, category, baseUnitId, shelfLifeDays{pantry,fridge,freezer}, perishability, embedding vector(1536) (gemini-embedding-001, MRL-truncated), aliases[], isStaple, fdcId?`. Non-grocery domains skip recipe ties but reuse the whole inventory/depletion/reorder spine (§7.5).
- **`Product`** — purchasable SKU → one canonical: `canonicalFoodItemId, upc?, brand, displayName, retailer, packageQty+packageUnitId, packCount, instacartProductId?, asin?, subscribeSaveEligible?, lastSeenPriceCents`. (Decodes "2 lb chicken" deterministically; `asin`/S&S power the Amazon vertical, §7.5.)
- **`Purchase`** — one receipt/order: `source(gmail_amazon|gmail_wfm|gmail_instacart|amazon_scrape|manual|barcode), retailer, externalOrderId?, gmailMessageId?(unique per user), purchasedAt, totalCents, rawBlobUrl, status(parsed|needs_review|confirmed), parseConfidence`.
- **`PurchaseLineItem`** — `purchaseId, productId?, canonicalFoodItemId?, rawText, parsedQty, parsedUnitId, baseQty (the number pantry math uses), lineTotalCents, matchConfidence, matchMethod(upc|trigram|embedding|llm|manual), needsReview`.
- **`PantryStock`** — current on-hand per (user, canonical): `baseQtyOnHand, confidence, lastPurchaseAt, lastConfirmedAt, estimatedRunOutAt, estimatedConsumptionRatePerDay, openedAt?, status(in_stock|low|out|expired_likely), source(derived|user_confirmed)`.
- **`StockLedger`** — append-only event log (the training table + audit): `canonicalFoodItemId, eventType(purchase|consume_recipe|consume_inferred|vision_confirmed|manual_adjust|spoilage|correction|open), baseQtyDelta, confidence, refType+refId, occurredAt`. **PantryStock is a materialized projection of this ledger.**
- **`ConsumptionEvent`** — inferred/declared depletion (`method: decay_model|cadence|user_reported`).
- **`PantryScan`** — a fridge/pantry photo session: `userId, capturedAt, location(fridge|pantry|freezer|other), imageBlobUrls[], model, status(processing|reviewed), detectionConfidence, summary`.
- **`PantryScanDetection`** — one recognized item: `pantryScanId, canonicalFoodItemId?, rawLabel, qtyEstimate?, unitGuess?, boundingBox?, presenceConfidence, qtyConfidence, matchMethod(trigram|embedding|llm|manual), action(confirm_present|new_item|qty_adjust|ignored), userConfirmed`.
- **`Recipe`** + **`RecipeIngredient`** — provider-sourced or user; ingredients normalized to canonical items (`rawText, qty, unitId, baseQty?, isOptional`). **Effort/cleanup dimension** on `Recipe`: `readyMinutes, handsOnMinutes, cleanupLoad(low|med|high ≈ #pans/dishes), effortScore, flags{onePan,sheetPan,noCook,leftoverFriendly}, equipmentNeeded[]` — cleanup/effort inferred once by Flash-Lite from instructions+equipment and cached (§7.4).
- **`MealLog`** — a logged cook (`recipeId?, servingsMade, cookedAt`) → writes `consume_recipe` ledger deltas.
- **`ShoppingList`** + **`ShoppingListItem`** — `generatedBy(reorder_engine|recipe_plan|agent|manual), instacartPageUrl?`, item `reason(predicted_runout|recipe_need|low_stock|manual)`.
- **`ReorderPolicy`** — per staple: `targetParQty, reorderPointQty, leadTimeDays, minIntervalDays, preferredProductId?, enabled`.
- **`ReorderPrediction`** — nightly output: `predictedRunOutAt, consumptionRatePerDay, recommendQty, recommendByDate, confidence, rationale`.
- **`UserModel` (typed taste profile; projection of `PreferenceSignal`)** — `diets[], allergens[], dislikedCanonicalItems[], lovedItems[], cuisineAffinity{cuisine→score}, spiceTolerance, cookingSkill, kitchenEquipment[] (dishwasher/air-fryer/instant-pot/sheet-pan…), household{size,kids,pickyEaters}, effortToleranceBaseline, qualityPrefs(organic/grass-fed/store-brand), mealTimesByType{breakfast/lunch/dinner}, eatsVsTakeoutByDay, seasonality, busyDays[]/schedule hints, weeklyBudgetCents?, healthGoals[], brandPrefs, defaultRetailer, confidencePerField`. Read/written by the personalization agent (§8.7).
- **`PreferenceSignal`** — append-only **preference ledger** the `UserModel` is projected from (mirrors `StockLedger`): `userId, topic, value, polarity(+/−), source(onboarding_q|meal_log|skip|reorder|waste|rating|chat|correction), confidence, occurredAt`. Makes learning auditable + improvable — the ratchet applied to *you*, not just parsing.
- **`IngredientMatchOverride`** — user corrections (`rawText|upc → canonicalId`) consulted first on future matches (closes the learning loop).

**Indexes/extensions:** `pg_trgm` GIN on names/aliases/displayName; `pgvector` HNSW on the 1536-dim embeddings (≤2000 keeps the index valid); unique `(userId, gmailMessageId)` on Purchase (idempotent ingest); unique `(userId, canonicalFoodItemId)` on PantryStock/ReorderPolicy; B-tree on `Product.upc`.

---

## 5. Ingestion

### 5.1 Gmail receipts (primary, reliable feed)
```
[daily cron] watch-renew → Gmail users.watch(topic) → Pub/Sub push → /api/webhooks/gmail
   → (push carries historyId ONLY) → enqueue gmail-poll(userId, historyId)
[hourly cron fallback] ────────────────────────────────────────────────┘ (resilience)
gmail-poll worker: history.list(startHistoryId) → new messageIds → classify (rules first,
   Flash-Lite on ambiguous) → for each receipt: enqueue receipt-parse
receipt-parse worker:
   1 fetch full msg → store raw EML to S3
   2 dedup on (userId, gmailMessageId) → skip if exists
   3 pre-clean: mailparser + cheerio → compact text
   4 EXTRACT (Flash-Lite + responseSchema; verify-then-escalate §8.4) → ReceiptExtraction JSON
   5 NORMALIZE each line → CanonicalFoodItem (cascade §5.4)
   6 resolve quantities → baseQty via units service + Product packageQty
   7 upsert Purchase + PurchaseLineItems (status parsed|needs_review)
   8 write StockLedger purchase deltas → project PantryStock (+confidence)
   9 enqueue predict-recompute (debounced)
```
**Gmail mechanics (confirmed):** `users.watch` must be renewed ≤7 days → **daily
watch-renew cron**; Pub/Sub push delivers only a `historyId`, so the webhook just
enqueues and the worker pulls via `history.list(startHistoryId)`; notifications can drop
and are rate-limited to 1/s → keep the **hourly history.list poll fallback**; persist
`historyId` per user. Scope: **`gmail.readonly`** only. (SaaS later requires Google's
**CASA / restricted-scope security assessment** — real timeline cost; flag now.)

### 5.2 Amazon scraper (optional power-user module) — see §9 for the build spec
Feeds the same pipeline via the `OrderSource` interface at step 5; captures online Amazon/WFM orders
(not in-store WFM, which come through Gmail). **Note:** Amazon now strips item details from its order
emails, so **item-level Amazon history (incl. the household/personal-care vertical, §7.5) relies on this
scraper or manual/barcode**, not email; Gmail still gives order-level signal (date/total). WFM digital
receipts + Instacart confirmations remain itemized via email.

### 5.3 Manual + barcode (always-works baseline)
Quick-add and **in-browser barcode scan** (UPC → `Product` → canonical). Also the
correction surface; every fix writes an `IngredientMatchOverride` + a `correction` ledger event.

### 5.4 Normalization cascade (per line item; stop at first confident hit)
1. **Override** (`IngredientMatchOverride`) → exact. 2. **UPC** → `Product.upc`. 3. **Trigram**
(`pg_trgm` on name/aliases). 4. **Embedding** (`pgvector` cosine, top-k). 5. **LLM tiebreak/create**
(Flash-Lite→Flash, structured): pick the canonical id or propose a new canonical (category + base unit;
compute + store its embedding). 6. else → `needsReview` → surfaced in a **Review inbox** for
one-tap correction.

### 5.5 Where the AI fits (Gemini cheap-first + verify-then-escalate)
Every call uses the cheapest tier that passes verification; the **loop escalates only on low
confidence or a failed check** (§8.4). Deterministic work (HTML pre-clean, schema validation,
trigram/UPC match) stays out of the model entirely.

| Step | Model (default → escalate) | Mode |
|---|---|---|
| Is-this-a-receipt classification | rules → **Flash-Lite** | structured `{isReceipt,retailer,confidence}` |
| Receipt → line items | **Flash-Lite** → Flash on low-confidence/verify-fail | `responseSchema`; **Batch API** for backfills (50% off) |
| Hard normalization / new-canonical proposal | **Flash-Lite** → Flash | structured; only the candidates retrieved for *this* line in context (context-cached catalog) |
| Unit-conversion gap-fill ("1 bunch kale = ? g") | **Flash-Lite** | structured (ask once, persist to `ItemUnitConversion`) |

A **cheap separate verifier** (Flash-Lite or pure rules — never the same call that produced the
output) checks each extraction against the semantic layer (valid canonical ids, qty ≥ 0,
unit-dimension sanity, totals reconcile); failures retry with more context, then escalate a tier,
then land in the Review inbox.

`ReceiptExtraction` Zod schema (drives the grammar): `retailer, externalOrderId?, purchasedAt?,
currency, totalCents?, lineItems[]{ rawText, name, brand?, upc?, quantity?, unitText?, packageSize?,
unitPriceCents?, lineTotalCents?, confidence }`. **Confidence gating:** low-confidence purchases land
in the Review inbox rather than silently mutating pantry — trust is the product.

### 5.6 Vision pantry/fridge scan — ground-truth reconciliation (not assumption)
The receipt + cadence pipeline *infers* your pantry; a periodic photo **grounds** it in reality
(catches consumption, spoilage, gifts, and cash/other-store buys the receipts never saw). You snap
one or more photos of a fridge/pantry/freezer shelf; Gemini **vision** + structured output returns
a detection list; we reconcile it against `PantryStock`. It is explicitly a **confirmation layer,
not a source of truth** — **presence is a strong signal, absence is weak** (items hide behind
others, sit in opaque containers, or live in the freezer).

- **Capture:** in-PWA camera, multi-photo per scan (door, shelves, drawers) → stored to S3
  (encrypted, §11) → enqueues a `vision-scan` worker job.
- **Recognize (Gemini vision + structured output):** **Flash-Lite** at `media_resolution: low/medium`
  for routine shelves; **Flash** (and `media_resolution: high`) for dense/ambiguous shelves and the
  first bootstrap scan; **Pro** only if Flash's detections fail verification. Schema:
  `{ location, detections[]{ label, canonicalGuess?, qtyEstimate?, unitGuess?, boundingBox?,
  presenceConfidence, qtyConfidence } }`. Normalize each label → `CanonicalFoodItem` via the §5.4
  cascade (skip UPC; rely on trigram → embedding → LLM).
- **Reconcile (the important part):**
  - Detected **&** in pantry → **confirm**: write a `vision_confirmed` ledger event → raise
    `PantryStock.confidence`, set `lastConfirmedAt`, optionally nudge qty toward the estimate
    (qty at *lower* confidence than presence).
  - Detected **&** not in pantry → **new-item** proposal (adds to pantry on confirm; may create a
    new `CanonicalFoodItem`).
  - In pantry (believed in-stock) **&** not detected → **do NOT zero it.** Mark `unconfirmed`,
    slightly lower confidence, and — only for plausibly-visible, non-opaque, non-freezer staples —
    queue a single targeted question. **Absence ≠ depletion.**
  - Present a fast, Instacart-styled **review card**; taps write confirmations/corrections to the
    ledger and recalibrate consumption rates (§6).
- **Why vision + receipts are complementary:** receipts say what *entered*; vision says what's
  *actually there now*. Vision closes the gap receipts miss and re-grounds the depletion model.

**When the app asks for a scan (intelligently, never naggy).** Driven by a **pantry-confidence
score** — an aggregate of per-item `PantryStock.confidence`, weighted by staple importance and how
many pending decisions depend on each item. The agent requests a scan only when **expected
information gain is high** — uncertainty is high *and* a scan would change reorder/recipe decisions:
  1. **Bootstrap** — at onboarding, before purchase history exists, ask for an initial fridge +
     pantry scan to seed the pantry (solves cold-start — so it never starts by guessing).
  2. **Confidence drift** — score < threshold (≈0.5) and ≥ K staples are stale/low-confidence or
     `expired_likely`.
  3. **Staleness** — > N days since the last scan with significant *inferred* (unconfirmed)
     consumption accrued.
  4. **Pre-plan** — just before "plan my week," if confidence is low, suggest a quick scan so the
     plan is accurate.
  Rate-limited (≤ ~once / few days), always dismissible, and the user can scan on demand anytime.
  The agent surfaces it as a friendly prompt ("I've lost track of what's in your fridge — mind
  snapping a quick photo so I don't guess?"), never as a silent mutation.

---

## 6. The "learning pantry" / depletion engine

`PantryStock` is a projection over `StockLedger`. On-hand at time *t*:
`onHand(t) = Σ(purchases ≤ t) − Σ(explicit consumes ≤ t) − inferredConsumption(lastEvent→t)`.

**v1 (pragmatic, no ML):**
- **Cadence model:** maintain `estimatedConsumptionRatePerDay` as an **EWMA over observed
  purchase intervals** (`packageQty / interval`) — robust, updates each purchase. Gives a
  usable run-out for staples (milk, eggs, coffee).
- **Shelf-life ceiling (USDA FoodKeeper):** seed `shelfLifeDays`; perishables can't outlive
  shelf life regardless of cadence (`status → expired_likely` once past). Catches "you bought
  spinach 3 weeks ago, it's gone" with no consumption signal.
- **Combine:** `inferred = max(rate·Δt, spoilageDepletion)` for perishables; `rate·Δt` for shelf-stable.

**Confidence** decays with time-since-last-known and conversion uncertainty
(`baseConfidence(source) · exp(-Δt/τ) · conversionPenalty`, clamped). When it drops below a
threshold, the UI asks **one** high-signal question ("Still have olive oil?"); the answer is a
`user_confirmed` ledger event that resets confidence and **recalibrates the rate**. A **vision
scan** (§5.6) does the same at scale: each `vision_confirmed` detection re-grounds an item's
on-hand + confidence, while non-detection only *softens* confidence (never auto-zeros) — so the
model confirms rather than assumes.

**Evolution to ML (seams, not built in v1):** the `StockLedger` is a clean training table —
later swap `inferredConsumption` for a per-item/category survival/regression model; schema unchanged.

---

## 7. Reorder engine + recipe engine

### 7.1 Reorder/prediction (nightly `predict-recompute`)
For each `ReorderPolicy.enabled` item: `predictedRunOutAt = today + onHand/rate`;
`recommendByDate = predictedRunOutAt − leadTimeDays`; trigger when
`onHand ≤ reorderPointQty` **or** `recommendByDate ≤ today + horizon`, gated by
`minIntervalDays`; `recommendQty = ceil((targetParQty − onHand) / packageQty)`. Defaults seeded
from observed purchase qty + cadence; user-overridable. → write `ReorderPrediction`.

**Shopping list + Instacart push:** the engine assembles/updates an `active` `ShoppingList`
(reason `predicted_runout`) → you review (one screen) → "Order on Instacart" maps items to lines
(mapping our `UnitOfMeasure` → Instacart's accepted units) and calls **`create_shopping_list_page`**
→ store `instacartPageUrl` → open Instacart's prefilled page via the **official "Shop with Instacart" CTA**.

**How agentic can ordering actually be? (reality check).** The official Instacart Developer Platform
API + MCP are **deep-link only** — exactly three tools: `create_shopping_list_page`,
`create_recipe_page`, `get_nearby_retailers`. **There is NO cart / order / checkout / payment /
order-status endpoint and no consumer-account OAuth.** So the agent automates *everything up to the
final tap* — infer pantry → predict run-outs → build + optimize the list → pick the store
(`get_nearby_retailers`) → generate the prefilled page → notify you — and **you tap once and complete
checkout + payment inside Instacart.** A one-tap human confirm before money moves is the right boundary
anyway. (Truly tap-free ordering is only possible *unofficially* by browser-automating your consumer
Instacart account — same Playwright posture as §9 — which violates Instacart's ToS, is brittle, and puts
your Instacart login + payment in our system; **kept out of the core product**, noted only as an
explicitly not-recommended experimental flag.)

- **Monetization (built in):** completed orders from our links are **affiliate-attributable via Impact**
  (formerly Tastemakers) → commission on conversions + new signups. A real revenue stream for the
  "monetize it" goal.
- **Pantry boundary:** Instacart can't tell us what you actually bought, so pushing does **not** mutate
  pantry — pantry increments when the resulting **Instacart confirmation email** returns through Gmail
  (loop closed via §5.1).

### 7.2 Recipe engine ("cook what I have")
**Provider abstraction** `RecipeProvider { search, findByIngredients, getById }`:
- **Spoonacular** (primary) — native *Search Recipes by Ingredients* / *complexSearch*
  (`includeIngredients`, diet/intolerance filters), ingredient substitutes, per-ingredient
  amounts + nutrition.
- **TheMealDB** (free fallback) — no ingredient ranking, so we rank locally.
- **Edamam** (optional) — nutrition analysis if needed.
- A `CachingRecipeProvider` persists fetched recipes into our `Recipe`/`RecipeIngredient`
  tables, normalizing ingredients to canonical items on ingest (reuse §5.4).

**Matching + ranking:** pull in-stock canonical items (confidence ≥ threshold) → query provider →
score: `w1·coverage + w2·sufficiency − w3·missingCount + w4·prefBoost(UserModel: cuisine/loved) +
w5·expiringSoonBoost + w6·effortFit`, where `sufficiency = Σ min(1, pantryQty/recipeQty)` and
**`effortFit` rewards low `effortScore`/`cleanupLoad` and is up-weighted on busy/low-energy days** (§7.4),
filtered by `UserModel` allergens/diets + **equipment owned** (no air-fryer recipes if they have none),
hard-excluding disliked items. Return top-N with
"have 8/10 ingredients, missing garlic + basil" + one-tap "add missing to list."

**Cooking decrements pantry:** logging a cook converts `qty·(servingsMade/recipeServings)` →
base unit (units service, conversion-tempered confidence) → `consume_recipe` ledger deltas →
re-project. Optional pre-confirm screen feeds corrections back.

### 7.3 Supporting data sources
USDA **FoodData Central** (canonical nutrition + `fdcId`), **Open Food Facts** (UPC→product +
package size for barcode scan), USDA **FoodKeeper** (shelf life). All free; behind adapters.

### 7.4 Effort & cleanup awareness (busy-day / low-energy mode)
Cook-time isn't the whole story — a "15-minute" meal that dirties three pans is still exhausting on a hard
day. Every recipe carries an **effort + cleanup** estimate (§4), and suggestions adapt to your energy:
- **The signal (designed, not a blunt toggle):** an evening prompt — *"How much do you feel like cooking
  tonight?"* — with a few one-tap levels (**Cook something nice · Keep it easy · Zero effort · Eating out**).
  You can also just say **"busy day"** / *"I'm wiped"* via natural-language capture.
- **Inference (agentic):** the agent infers a low-energy day from signals — late hour, your learned
  `busyDays`/schedule in the `UserModel`, a recent takeout/reorder spike (or, optional/deferred, Google
  Calendar density) — and **proactively offers** effortless options rather than waiting to be asked.
- **Effect:** on low-energy days ranking up-weights `effortFit` (one-pan / sheet-pan / no-cook /
  **leftovers** / ≤N-ingredient), and the weekly planner front-loads low-cleanup meals onto inferred busy
  days. Equipment in your `UserModel` tunes it (dishwasher → cleanup matters less; air-fryer / instant-pot
  → unlock those quick modes).

### 7.5 Second vertical — Household & Personal Care (Amazon replenishment)
"All my recurring needs," not just food: a separate section for **cleaning supplies, skincare, toiletries,
and household essentials** that reorders from **Amazon**. It **reuses the entire inventory spine** —
`CanonicalItem`(domain=household|personal_care) → `StockLedger` → depletion/cadence engine (§6) → reorder
predictions (§7.1). Consumables have clean usage rates (detergent, paper towels, shampoo, moisturizer), so
"running low → reorder" works exactly like groceries. Recipes don't apply; everything else does.

**Reality check (how agentic ordering can be):** like Instacart, **no third-party API places an Amazon
consumer order** (Amazon Business Ordering API is B2B-only; SP-API is seller-only). So it's deep-link — the
agent predicts, builds the cart, and you tap once to check out on Amazon. **It is fully agentic up to a
single confirm tap — identical to the Instacart flow (§7.1):** everything (cadence learning → run-out
prediction → product/ASIN match → prefilled cart or Subscribe & Save setup → notify you) is automated; the
one human step is the final checkout/payment tap on Amazon.
- **Product match + links:** the **Amazon Creators API** (successor to PA-API 5.0, which **retired May 15
  2026**) — search / get items by ASIN, live price (OffersV2), images, and the affiliate link. Requires an
  **Amazon Associates** account in good standing (stricter eligibility than old PA-API).
- **One-tap reorder:** the still-supported **Add-to-Cart URL** (`…/gp/aws/cart/add.html?AssociateTag=…&ASIN.1=…&Quantity.1=…`)
  pre-fills a cart from the due items → you check out on Amazon.
- **Recurring = Subscribe & Save:** for true staples we **recommend + deep-link** into Amazon's native
  Subscribe & Save (we can't enroll you — no consumer API); you set the frequency once. We badge S&S-eligible
  items and clearly separate **one-time reorder vs. starting a subscription** (no dark patterns).
- **Learning the cadence:** from **your own Amazon history** (scraper/manual; emails are sparse, §5.2), not
  Amazon's recommendations — Rufus / "Alexa for Shopping" personalization isn't third-party accessible.
  "Running low" nudges fire at ~80% of your observed interval.
- **Monetization:** **Amazon Associates** affiliate (~4.5% Household & Kitchen, ~3% Health & Personal Care)
  on the tagged links — a second affiliate stream alongside Instacart's Impact (requires the "As an Amazon
  Associate…" disclosure).
- **Ordering boundary** mirrors §7.1: the agent does everything up to the one-tap checkout; truly tap-free
  ordering would need the unofficial scraper driving checkout (ToS-violating, payment risk) — **not in core**.

---

## 8. AI layer — cost-first Gemini ladder + semantic layer, context/loop/harness engineering

Guiding principle (loop/harness engineering): **a small model in a great harness beats a big model
in a bad one.** We default to the cheapest Gemini tier and let the *harness* — a typed semantic
layer, curated context, verified loops, and evals — carry reliability, escalating only when a check
fails. This is both the cost lever and the reliability lever.

### 8.1 Model ladder (cheap-first, escalate on failure)
| Tier | Model | Default jobs | Escalate when |
|---|---|---|---|
| Cheap | **`gemini-2.5-flash-lite`** (~$0.05/$0.20 ·1M) | classify, receipt extraction, vision detection, normalization, unit gap-fill, **verifier** | — |
| Mid | **`gemini-2.5-flash`** (~$0.50/$2 ·1M) | retry of failed cheap calls; weekly-plan generation; dense vision | cheap output fails verification / low confidence |
| Reasoning | **`gemini-2.5-pro`** (~$1.25/$10 ·1M) | hard planning, gnarly normalization, plan-evaluator disputes | mid still fails the evaluator/verifier |

`thinkingBudget`: `0` on Flash for the cheapest deterministic calls, dynamic (`-1`) for planning
(Flash-Lite min 512; Pro can't disable). **Flash-Lite is public preview → pin `gemini-2.5-flash` as a
stable fallback behind a flag.** Cost levers: **Batch API** (50% off) for non-urgent extraction;
**explicit context caching** (25% input) for the catalog/system prefix.

### 8.2 Semantic layer (what lets small models succeed)
A typed, curated interface between messy inputs and the model: the **canonical ontology**
(`CanonicalFoodItem` catalog, `UnitOfMeasure`/dimensions, categories, retailers, a **closed set of
intents**) exposed as (a) constrained **`responseSchema`s** the model fills and (b) **typed tools**
the agent calls. The model never free-forms over raw data — it selects from disambiguated concepts;
deterministic resolvers (UPC/trigram/embedding) do the matching and the model only fills genuine
gaps. Offloading the hard reasoning to *structure* is exactly why Flash-Lite can do the work. The
semantic layer also holds the **personal `UserModel`** (§8.7) — a typed, evolving representation of *you*
that every recipe/plan/reorder decision reads — so personalization rides the same disciplined, auditable
structure rather than ad-hoc prompt text.

### 8.3 Context engineering (curate the window)
- **Retrieve, don't dump:** for each line item, put only the **top-k candidate canonical items**
  (pgvector + trigram pre-filter) in context — never the whole catalog.
- **Compact before the model:** `cheerio` strips receipt HTML to minimal text; tool outputs are
  summarized/offloaded (store blobs, pass references) to fight context rot.
- **Cache the stable prefix:** semantic-layer summary, few-shot exemplars, and system instructions via
  Gemini **explicit context caching** (25% input cost).
- **Progressive disclosure:** load detailed rules/"skills" (e.g., a retailer-specific receipt quirk)
  only when the task hits that case — keeps the base prompt small and cheap.

### 8.4 Loop engineering (verified loops, budgets, escalation)
Every AI task is a loop, not a one-shot: **act → validate (deterministic hooks) → verify (cheap
separate model) → on fail: retry-with-more-context → escalate a tier → human Review inbox.**
- **Separate cheap verifier** — "the call that wrote it doesn't grade it"; Flash-Lite or pure rules
  check outputs against the semantic layer (valid ids, qty ≥ 0, unit dimensions, totals reconcile).
- **Budgets + circuit breakers:** per-task token/cost cap, max retries, max escalations; a tripped
  breaker routes to the Review inbox instead of burning spend.
- **Planner/generator/evaluator split** for "plan my week" (§8.6).
- **Observability:** every loop logs the tier used, tokens/cost, and verification outcome (§8.5).

### 8.5 Harness & evals (the ratchet)
- **Ratchet principle:** every user correction (a misparse, a bad match, a wrong qty) becomes a
  permanent signal — an `IngredientMatchOverride` **and** a new **golden eval case** + (optionally) a
  few-shot exemplar / rule in a failure-traced **`AGENTS.md`-style rulebook**. The harness only tightens.
- **Hooks as enforcement:** deterministic guards run on every model output *before* it touches the
  pantry (schema valid, qty ≥ 0, unit dimension matches base unit, line totals reconcile).
- **Golden eval sets + CI regression gates** for extraction, normalization, vision, and planning;
  cheap **LLM-as-judge** (Flash-Lite) + exact-field checks. You can't improve a harness you don't measure.
- **Model router** centralizes tier selection, escalation, and the Flash-Lite→Flash fallback flag.

### 8.6 The "Plan my week" agent (generator/evaluator)
Typed in-process tools (over Postgres + clients): `get_pantry_state`, `get_pantry_confidence`,
`get_reorder_predictions`, `find_recipes(filters, useExpiringSoon)`, `get_diet_profile`,
`build_shopping_list(items[])` (draft only), `push_list_to_instacart(listId)`, `create_recipe_page`,
`request_pantry_scan(reason, location)` (ask, never mutate), `get_nearby_retailers(zip)`,
`get_due_replenishables(domain)` (household/personal-care run-outs, §7.5), `build_amazon_cart(items[])`
(Add-to-Cart URL — draft), `suggest_subscribe_and_save(item)`. The autopilot spans **both verticals** —
groceries via Instacart *and* household/personal-care via Amazon — in one weekly review.
**Flow:** the **generator** (Flash) drafts 5 dinners prioritizing soon-to-expire + on-hand coverage
within diet/budget → a **cheap separate evaluator** scores against a rubric (coverage, diet/allergen
compliance, budget, variety) → revise until the rubric passes or the budget trips → escalate to
**Pro** only if the evaluator keeps failing. Before planning, the agent checks `get_pantry_confidence`
and may `request_pantry_scan` if it can't trust the pantry (§5.6). Returns a short narrative ("Here's
your week. You're low on chicken and out of garlic; I added them. Tuesday's stir-fry uses the spinach
before it goes bad.") → you one-tap to order. **Guardrail:** tools are read+draft only; any external
side-effect (Instacart push) needs an explicit UI tap — never auto-fired; `request_pantry_scan` only prompts.

### 8.7 Personalization — agentic onboarding + an always-learning user model
A **living model of you**, maintained on the semantic layer and compounding forever — closer to a true
personal AI than a settings page. **What it learns and keeps current:**
  - **Taste** — loved/disliked ingredients, cuisines, flavors (spicy/sweet), go-to meals, adventurousness.
  - **Grocery preferences** — favorite brands, **quality tier (organic / grass-fed / store-brand)**,
    preferred package sizes, store preferences, price sensitivity per category.
  - **Temporal patterns** — **when you eat and at what times** (breakfast/lunch/dinner windows), which days
    you cook vs. order takeout, weekday-vs-weekend habits, and seasonality — from `MealLog` timestamps,
    receipt timing, and the odd question.
  - **Lifestyle** — household (kids, picky eaters), cooking skill, kitchen equipment, busy days, budget, health goals.
It accumulates *evidence* about you and acts on it everywhere — the most agentic part of the system.
- **Agentic onboarding interview:** a short, friendly conversation (not a 40-field form) where the agent
  asks high-signal questions — diets/allergies, loves/hates, cuisines, spice level, **household (kids,
  picky eaters)**, **cooking skill**, **kitchen equipment**, typical **busy days**, budget, health goals —
  asking follow-ups only where it's uncertain. Each answer is a `PreferenceSignal` that updates the typed `UserModel`.
- **Always-learning loop (the ratchet, applied to *you*):** every behavior is a signal — what you cook
  (`MealLog`), skip, rate, reorder, or waste → appended to the **preference ledger** and re-projected into
  the `UserModel` with confidence. It accumulates evidence; it doesn't assume.
- **Proactive, rate-limited questions:** on a detected pattern or low-confidence field, it asks one crisp
  question ("You've bought oat milk 3× — make it your default?"; "Skipped a few fish recipes — not a fan?";
  "New air-fryer in your orders — want quick air-fryer meals?"). Same information-gain discipline as the
  pantry-scan trigger (§5.6): only ask when the answer changes a decision.
- **Stored in the semantic layer, built on over time:** the `UserModel` is the personal half of the
  semantic layer (§8.2); recipe ranking (§7.2), the weekly plan (§8.6), reorder defaults (§7.1), and
  busy-day effort (§7.4) all read from it, so the app compounds what it learns. Versioned, exportable, and
  fully user-editable (view your profile, correct anything → writes a `PreferenceSignal`).

---

## 9. Amazon-orders MCP — from-scratch build spec (optional, isolated)

Built fresh (no third-party code shipped), in **TypeScript** to keep the monorepo single-language,
living in `services/amazon-mcp` behind the `OrderSource` interface. **Feature-flagged + opt-in.**

- **Mechanism:** two-phase. (1) **One-time cookie capture** — Playwright opens a real Chromium
  window; you sign in manually (handling 2FA/CAPTCHA); cookies are extracted and stored with
  envelope encryption (mode-0600 equivalent / KMS). (2) **Ongoing fetch** — load cookies into a
  request session with realistic headers; fetch order-history pages; parse with **cheerio**.
- **Why this shape:** Amazon's JS WAF blocks headless credential logins; capturing cookies from a
  real browser passes the challenge, then HTML scraping reads the data.
- **Extract per order/item:** `orderId, orderDate, grandTotal`, and per line `name, qty,
  unitPrice, asin` (+ pagination, `full_details` for line items).
- **Coverage:** online Amazon + **online** WFM orders. **In-store WFM is NOT here** — those come
  via Gmail digital receipts.
- **Contract to the app:** `fetchOrders(sinceDate) → OrderDTO[]`; feed OrderDTOs into the §5
  pipeline at the normalization step (reusing extraction/normalization/units).
- **Auth/robustness:** detect cookie expiry (401/403) → signal re-capture; fail-fast on CAPTCHA;
  async with per-call timeouts; periodic selector-drift smoke tests.
- **Risk posture (documented in-product):** against Amazon ToS, brittle to HTML changes, handles
  real credentials → strictly opt-in, isolated container, ephemeral cookies, kill-switch flag,
  removable. The official fallback is Amazon's slow "Request my data" export.

---

## 10. High-signal feature list + phased roadmap

Signal-only — and the additions below all extend engines we already have, using data we already parse.

### Additional high-signal features (curated)
- **Spend & price intelligence** (from parsed receipt prices — no bank link): weekly/monthly grocery
  spend, price history per `CanonicalFoodItem`, **cross-retailer "cheaper at X"**, unit-price
  normalization ($/100g, $/serving), budget-vs-actual → feeds budget-aware planning.
- **Waste-reduction hub:** an "**use it up**" view of soon-to-expire items with one-tap recipes;
  **waste tracking** ($ wasted/month from `spoilage` ledger events) that **auto-tunes par levels down**
  for items you repeatedly toss — the app learns to buy *less* of what you waste.
- **Staples autopilot:** learned-cadence recurring list for true staples (milk/eggs/coffee) that just
  appears each cycle — "set and forget," opt-in per item via `ReorderPolicy`.
- **Proactive digest + web push:** a weekly **"Sunday plan + list"** (one tap to order), run-out nudges,
  and expiring-soon alerts. (Needs a small `PushSubscription` store; iOS push requires the PWA on the home screen.)
- **Natural-language & voice quick-capture:** "we're out of olive oil and need taco stuff" → items
  (+ optional recipe) via Flash-Lite; plus photo-of-a-handwritten-list and barcode. Lowest-friction add.
- **Busy-night / low-energy mode (effort + *cleanup* aware):** an evening "how much do you feel like
  cooking?" selector (or an inferred busy day) up-weights low-**cleanup**, one-pan/sheet-pan/no-cook,
  ≤N-minute, ≤N-ingredient, and **leftover** meals — a 15-min meal that dirties 3 pans isn't "easy." Plus a
  **"make now — 0 shopping"** filter and **substitutions** ("no buttermilk → milk + lemon"). (§7.4)
- **Recipe import (URL or photo):** paste a link or snap a cookbook page → Gemini parses it to a
  structured recipe in your library, normalized + matched to your pantry.
- **Fast onboarding backfill:** on Gmail connect, backfill ~3–6 months of receipts to seed the pantry +
  learn cadence immediately (with the bootstrap vision scan) — instant value, no cold empty app.
- **Transparency everywhere:** every reorder/recipe/plan suggestion shows its **reason + confidence**;
  corrections feed the ratchet (§8.5).
- **Always-learning personalization (highly agentic):** an onboarding interview + continuous learning from
  what you cook/skip/reorder/waste build a typed, evolving **user model** in the semantic layer (diet,
  loves/hates, cuisines, equipment, household, busy days, budget); the agent asks the occasional
  high-signal question and every decision reads from it. (§8.7)
- **Hands-free Cook Mode:** step-by-step view, screen-stays-awake, built-in timers, auto-scaled to your servings.
- **Batch-cook / meal-prep mode:** "cook once, eat 3×" suggestions for busy weeks (pairs with leftovers + effort-awareness, §7.4).
- **One-cart staple top-up:** ordering a recipe's ingredients also tops up any due staples in the same Instacart order.
- **Guest mode:** "cooking for a vegan friend tonight" temporarily filters recipes + the list to fit a guest.
- **Works offline:** pantry + shopping list available offline (PWA cache) for in-store use.
- **Live shared household list/pantry** (Phase 3): a partner/roommate adds to the same list in real time.
- **Household & Personal Care vertical (Amazon):** a separate section that auto-replenishes cleaning supplies,
  skincare, and toiletries from **your** Amazon cadence — one-tap Add-to-Cart or **Subscribe & Save** — so
  *all* recurring needs are covered, not just food. (§7.5)

*Considered, deferred (opt-in/future):* Google Calendar awareness (busy day → 15-min meal), light
"low on veggies this week" nutrition nudges, deals/coupons. *Still excluded as noise:* social feed,
recipe-authoring CMS, full calorie/macro tracking, bank/Plaid sync.

### Growth & shareability (the cool factor — to share with friends & gain interest)
A genuine **viral loop**, not vanity gamification (still signal-only):
- **Shareable recipe & weekly-menu pages:** turn any recipe or your week's plan into a beautiful share
  link; a friend opens it and can **one-tap shop the ingredients** via Instacart (`create_recipe_page` /
  `create_shopping_list_page` — already in our stack). Real utility → natural spread.
- **"Grocery Wrapped" recap:** a tasteful, opt-in monthly/seasonal card built from *your* data —
  home-cooked meals, **$ saved vs. takeout**, food **waste avoided**, top recipes. Eminently shareable.
- **Invite a friend / household:** referral (both get a premium perk) + the **live shared household
  pantry/list** (Phase 3) spreads the app organically inside a home.
*(Deliberately light on badges/streaks — the share artifacts are useful on their own, so no noise.)*

**Phase 0 — Scaffold:** monorepo (pnpm+Turbo); Next.js PWA shell + Instacart-inspired theme; Postgres +
Drizzle schema (§4) + migrations; Auth.js Google login; BullMQ+Redis; **`@google/genai` client +
model router (cheap-first ladder + Flash-Lite→Flash fallback) + `responseSchema`/verifier helpers +
eval harness**; **semantic layer** (canonical ontology + typed tools) + **units service** + seed
`UnitOfMeasure` + FoodKeeper shelf-life + starter `CanonicalFoodItem` catalog; CI.

**Phase 1 — Flagship v1 (the product):** Gmail OAuth + watch/poll + receipt-parse pipeline (§5)
for Amazon/WFM/Instacart emails; **Pantry view** with confidence + **Review inbox** + one-tap
corrections; **depletion engine v1** (cadence + FoodKeeper) + confidence (§6); **manual quick-add +
barcode scan**; **reorder predictions + shopping list + Instacart `create_shopping_list_page` push**
(§7.1); **recipe engine v1** ("cook what I have" via Spoonacular + dietary filters + cook-to-decrement);
**bootstrap fridge/pantry vision scan + basic reconciliation** to solve cold-start (§5.6); plus
**history backfill** (~3–6 mo of receipts) on connect, **natural-language/voice quick-capture**, and a
**spend overview** — for instant value; plus the **agentic onboarding interview** that seeds your `UserModel` (§8.7).

**Phase 2 — Intelligence:** **"Plan my week"** Gemini generator/evaluator agent + "what should I order" narrative (§8);
**preference learning** into `DietProfile`; expiring-soon prioritization everywhere; TheMealDB
fallback + `create_recipe_page` sharing; smarter par-level auto-tuning; **agent-decided,
confidence-driven refresh scans + scan-review polish** (the §5.6 intelligent trigger); **waste-reduction
hub** + auto-tuned par levels; **staples autopilot**; **proactive weekly digest + web push**;
**busy-night / low-energy effort+cleanup mode** (§7.4); **substitutions**; **price/cross-retailer intelligence**; **recipe import (URL/photo)**; **always-learning personalization** — continuous preference learning + proactive questions into the `UserModel` (§8.7); **hands-free Cook Mode**; **shareable recipe/weekly-menu pages** (one-tap shop via Instacart); **batch-cook mode**; **one-cart staple top-up**; **guest mode** + **offline** pantry/list; the **Household & Personal Care (Amazon) replenishment vertical** — Creators-API product match + Add-to-Cart / Subscribe & Save + Associates affiliate (§7.5).

**Phase 3 — Power-user & SaaS:** optional `services/amazon-mcp` scraper (§9, opt-in); household/
shared pantry (`householdId`) with a **live shared list**, email/password auth, billing, multi-tenant hardening (RLS); ML
depletion model swap-in; **native Expo app reusing `packages/core`**. **Growth:** **"Grocery Wrapped" recap** + **referrals/invites**.

---

## 11. Privacy, security, risks

- **Least-privilege Gmail** (`gmail.readonly`); CASA assessment before SaaS launch.
- **Secrets** (Gmail refresh tokens, Amazon cookies) → **envelope encryption** (per-record data key
  wrapped by KMS), ciphertext only in `OAuthCredential`, decrypt only in the worker, never logged.
- **Amazon scraper = highest risk** → opt-in, isolated, ephemeral cookies, kill-switch, clear
  in-product disclosure, treat as removable.
- **Raw receipt blobs and pantry/fridge scan photos** (PII; photos may show your home) → private
  bucket, encryption, signed URLs, retention/TTL + user purge.
- **Multi-tenant isolation** → every user-owned table carries `userId`; tenant-scoped Drizzle helper
  injects it; add **Postgres RLS** as defense-in-depth; tests assert cross-tenant reads return nothing.
- **PII to the LLM (Google)** → use **Vertex AI** in production (no-training guarantee + enterprise
  controls / data residency / audit logging); the paid Gemini Developer API also doesn't train on data,
  but the **free tier does — never use it**. `@google/genai` targets both, so dev can use an AI Studio
  key and prod flips to Vertex with no code change. Redact name/shipping address before extraction; cap
  image `media_resolution`.
- **Webhook auth** → verify the Gmail Pub/Sub push OIDC token on `/api/webhooks/gmail`.
- **GDPR/CCPA** → export + delete-my-data (the ledger/projection split makes deletion clean).
- **Top risks (ranked):** receipt-format variability (→ structured outputs + per-line confidence +
  Review inbox + golden-fixture regression tests); bad pantry inferences eroding trust (→ conservative
  defaults, surfaced confidence, ask-before-mutate, easy corrections); Gmail push gaps (→ hourly
  fallback + daily renew); unit-conversion errors (→ confidence-tempered decrements, cache + correct);
  external API drift (→ adapter interfaces, pinned model IDs **+ Flash-Lite→Flash fallback flag, since
  Flash-Lite is public preview**); LLM cost at volume (→ Flash-Lite default, Batch API, context caching,
  cache embeddings + conversions, escalate to Flash/Pro only when verification fails).

---

## 12. Verification (how we'll prove it works, per phase)

- **Units service** (load-bearing): exhaustive unit tests over dimension + density + count + pack
  conversions, asserting `{qty, confidence}`.
- **Depletion math:** deterministic "time-travel" tests — given a `StockLedger`, assert on-hand +
  confidence at arbitrary *t*; assert run-out predictions.
- **Receipt extraction:** corpus of real (sanitized) Amazon/WFM/Instacart **EML golden fixtures** →
  snapshot-test the deterministic pre-clean; **eval suite** (field-exact + LLM-as-judge) for the LLM
  step rather than asserting raw model output.
- **Normalization matching:** labeled `rawText → canonicalId` dataset; track precision/recall of the
  cascade as a regression gate.
- **Vision pantry scan:** labeled shelf-photo set → detection precision/recall; reconciliation
  correctness (confirm vs new-item vs unconfirmed); and an **absence-≠-depletion** test (an item not
  visible in a photo is never auto-zeroed) + the scan-trigger heuristic firing only when confidence is low.
- **Loop/harness evals (the ratchet, §8.5):** golden eval sets gate extraction, normalization, vision,
  and planning in CI; track **verifier accuracy** and **escalation rate** per task (a rising Flash/Pro
  share flags a harness gap to ratchet down); cheap LLM-as-judge (Flash-Lite) + exact-field checks.
- **Personalization & effort:** preference-ledger→`UserModel` projection tests (signals update the right
  fields with correct confidence; corrections override); effort/cleanup estimation eval on a labeled recipe
  set; busy-day mode demonstrably re-ranks toward low-cleanup meals.
- **Integration (deterministic, free):** Postgres+Redis via docker-compose/Testcontainers; run the
  pipeline end-to-end with **mocked Gmail + mocked Gemini** (record/replay); **idempotency:** replay
  the same Gmail message twice → exactly one Purchase, no double-increment.
- **Contract tests** per adapter (Instacart client, recipe providers, OrderSource) against recorded
  fixtures; nightly live smoke against sandboxes to catch drift.
- **Multi-tenant isolation tests:** every tenant-scoped query refuses cross-user data.
- **E2E (Playwright on the PWA):** login → connect Gmail (mocked) → see pantry → review-correct →
  generate list → push (mocked Instacart) → cook a recipe → pantry decrements.
- **Manual end-to-end smoke (real accounts, dev):** connect your real Gmail → confirm a real
  Amazon/WFM/Instacart receipt lands in the pantry → trigger a reorder prediction → push a real
  `create_shopping_list_page` and open the returned Instacart URL → ask the "Plan my week" agent and
  verify the drafted list.

---

## 13. Critical files to create first (the load-bearing seams)

- `packages/db/schema.ts` — Drizzle schema for all §4 entities (Product↔CanonicalFoodItem split,
  base-unit + `ItemUnitConversion` + append-only `StockLedger`). Everything depends on this shape.
- `packages/core/units/index.ts` — the quantity/unit conversion service (the crux; retail↔cooking↔base
  with confidence).
- `packages/core/llm/client.ts` — **`@google/genai`** wrapper: cheap-first **model router** +
  escalation ladder (`gemini-2.5-flash-lite` → `flash` → `pro`) with the Flash-Lite→Flash fallback
  flag, `responseSchema` (Zod→JSON-Schema) helper, **separate-verifier** + budget/circuit-breaker
  helpers, Batch + context-cache helpers, pinned model IDs.
- `packages/core/llm/semantic-layer.ts` — the canonical ontology + typed tools + closed intent set the
  models operate over (§8.2), plus the deterministic resolvers they defer to.
- `packages/core/llm/evals/` — golden eval sets + CI regression gates + the failure-traced rulebook
  (the ratchet, §8.5).
- `packages/core/ingestion/receipt-parse.ts` — Gmail msg → `ReceiptExtraction` (Flash-Lite +
  `responseSchema`, verify-then-escalate) → normalization cascade → Purchase upsert → StockLedger.
- `packages/core/pantry/depletion.ts` — ledger projection + cadence/FoodKeeper inferred-consumption +
  confidence model.
- `packages/core/reorder/predict.ts` — run-out prediction + shopping-list builder + Instacart push.
- `packages/core/recipe/match.ts` — "cook what I have" matcher + ranking over `RecipeProvider`.
- `packages/core/recipe/effort.ts` — effort/cleanup estimation (Flash-Lite, cached) + the busy-day/energy
  signal + effort-aware ranking inputs (§7.4).
- `packages/core/personalization/user-model.ts` — `PreferenceSignal` ledger → typed `UserModel`
  projection + the agentic onboarding & continuous-learning flow + proactive questions (§8.7).
- `packages/core/agent/plan-week.ts` — Gemini generator/evaluator agent (typed in-process tools; Flash generate → cheap evaluate → Pro escalate).
- `packages/core/ingestion/vision-scan.ts` — fridge/pantry photo(s) → Gemini vision detections
  (`responseSchema`, `media_resolution` cost control) → normalization → reconciliation vs PantryStock → `vision_confirmed` ledger events.
- `packages/core/pantry/confidence.ts` — pantry-confidence score + the intelligent scan-suggestion
  trigger (§5.6); feeds the agent's `get_pantry_confidence` / `request_pantry_scan`.
- `services/workers/index.ts` — BullMQ processors + cron (gmail-poll, receipt-parse, predict-recompute,
  watch-renew) — the async backbone.
- `services/amazon-mcp/` — optional Playwright cookie-capture + cheerio scraper behind `OrderSource`.

---

## Open follow-ups (when implementation begins)
- Obtain access: **Google Cloud project** — Vertex AI (prod; no-training) + a Gemini API key (dev) for
  `@google/genai`; Gmail API + Pub/Sub topic; **Instacart Developer Platform** — dev key now, **~30–40 day
  production approval** (they verify ToS compliance, correct API formatting, and error handling), render the
  **official "Shop with Instacart" CTA + current logos** per their brand guidelines, and sign up for
  **affiliate payouts via Impact**; Spoonacular.
- **Amazon (household/personal-care vertical, §7.5):** join **Amazon Associates** + the **Creators API**
  (PA-API 5.0 retired May 2026; mind the stricter sales-eligibility rule), wire the **Add-to-Cart URL** +
  **Subscribe & Save** deep-links, and add the required affiliate disclosure.
- **`gemini-2.5-flash-lite` is public preview** — keep `gemini-2.5-flash` wired as the fallback and
  watch for its GA / any preview-deprecation date.
- Confirm Spoonacular vs. self-hosted recipe data for cost at scale (free tier is limited).
- Decide hosting specifics (Vercel + Railway/Fly + Neon/Supabase + Upstash) and KMS provider.
```
