# GroceryManager — Press Kit

> **Status: STAGED — do NOT submit.** All materials below are ready for the owner to send.
> Personalise `[OWNER_NAME]`, `[CONTACT_EMAIL]`, `[OWNER_TITLE]`, and `[APP_URL]` before sending.
> Replace `[APP_STORE_URL]` / `[PLAY_STORE_URL]` once both apps are live.

---

## Short description (one sentence)

GroceryManager is a grocery and cooking autopilot that tracks what's in your kitchen from
receipts and fridge scans, predicts when you'll run out, and tells you what to cook tonight.

## Medium description (one paragraph)

GroceryManager is a personal grocery and cooking autopilot for people who cook at home.
It ingests grocery receipts from Gmail or a photo, builds a live pantry from them, watches
depletion rates, and surfaces "cook what you have tonight" suggestions alongside a smart
shopping list — all without manual entry. Available as a progressive web app and as a native
iOS and Android app. Free to start; premium unlocks AI weekly meal planning, unlimited recipe
remix, and Grocery Wrapped (a shareable year-in-food recap).

## Long description (background + features)

### The problem

Knowing what to cook and what to buy should be effortless. Instead, most people open the
fridge, see a mix of half-used ingredients, and either order takeaway or make a trip to the
shop to buy things they already have. Food waste costs the average household £600–£800 a year
in the UK ($1,500 in the US), and most of it comes from not tracking what's already there.

### What GroceryManager does

GroceryManager starts with a receipt. Snap one with the camera, scan items with a barcode,
or connect Gmail — the app reads what you bought and builds a pantry automatically. From there:

- **Run-out prediction:** the app learns your consumption pace and tells you when to reorder,
  before you run out.
- **Cook tonight:** ranked recipes based on what's actually in your pantry. Not aspirational
  recipes — ones you can cook right now.
- **Smart shopping list:** items appear automatically when they're running low. Add anything
  manually. One tap sends the list to Instacart or your grocery app of choice.
- **Meal planning:** plan the week, check against the pantry, get a gap-filling shopping list.
- **Discover feed:** a swipeable "for you" deck of recipe ideas, personalised by cooking
  history and taste preferences.
- **Grocery Wrapped:** an end-of-year summary of your kitchen habits — most-cooked meals,
  food waste avoided, budget saved — shareable as a card.

### Who it's for

Busy millennials and Gen-Z households who cook at home but don't want to think about groceries.
The app is personal-first, with a multi-tenant architecture that keeps every user's data private.

### Technical summary (for tech press)

GroceryManager is a Next.js 15 (App Router) PWA with a native Expo (React Native) app sharing
the same business logic layer (`@gm/core` — framework-agnostic TypeScript). The backend is
PostgreSQL 16 + pgvector on Supabase with full row-level security. LLM tasks (receipt parsing,
meal generation, recipe remix) use Google Gemini's cheap-first cascade (flash-lite → flash → pro)
with a verify-then-escalate pattern. Subscription billing via Stripe (web) and RevenueCat
(mobile). The entire product is a single developer's part-time project built with an autonomous
AI coding loop (Claude Code) running on a daily schedule.

---

## Press release

**FOR IMMEDIATE RELEASE**

---

**GroceryManager Launches: A Personal Grocery and Cooking Autopilot for Busy Home Cooks**

*New app tracks pantry from receipts, predicts run-outs, and tells you what to cook tonight —
no spreadsheets, no manual entry*

**[CITY], [DATE]** — [OWNER_NAME] today announced the launch of GroceryManager, a personal
grocery and cooking autopilot available on iOS, Android, and the web.

GroceryManager solves a problem that every home cook faces: knowing what's in the fridge,
what's about to run out, and what to cook with what's already there. The app ingests grocery
receipts from photos or Gmail, builds a live pantry automatically, and surfaces meal
suggestions ranked by what you already have — eliminating the Sunday evening "what's for
dinner?" spiral.

"The pantry is the core," says [OWNER_NAME], the app's developer. "Everything else — the
shopping list, the recipe suggestions, the meal plan — reads from it. Get the pantry right
and the whole kitchen runs itself."

**Key features:**
- Pantry tracking from receipts (photo or Gmail) and fridge scans
- Cook-tonight suggestions ranked by pantry coverage
- AI weekly meal planner that accounts for what you have and what's running low
- Smart shopping list with automatic run-out alerts
- Recipe remix: adapt any recipe to what's in your pantry
- Grocery Wrapped: a shareable annual recap of your kitchen habits

GroceryManager is free to download. A Premium subscription ($4.99/month or $39.99/year)
unlocks automatic Gmail receipt import, unlimited AI meal planning and recipe remix, the full
Discover feed, advanced spend insights, and Grocery Wrapped+. A 7-day free trial is available.

The app is available now on the App Store, Google Play, and at [APP_URL].

---

**About GroceryManager**

GroceryManager is an independent app by [OWNER_NAME], built to make home cooking effortless
through intelligent pantry automation. The company is based in [CITY].

**Media Contact:**
[OWNER_NAME]
[OWNER_TITLE]
[CONTACT_EMAIL]
[APP_URL]

---

**App Store:** [APP_STORE_URL]
**Google Play:** [PLAY_STORE_URL]
**Web:** [APP_URL]

*High-resolution screenshots and the app icon are available on request.*

---

## Product one-pager

### GroceryManager at a glance

| | |
|---|---|
| **Category** | Food & Drink / Productivity |
| **Platforms** | iOS, Android, Web (PWA) |
| **Price** | Free (core) / $4.99/mo or $39.99/yr (Premium) |
| **Trial** | 7-day free trial |
| **Target user** | Home cooks, millennials + Gen-Z |
| **One-liner** | Know what to cook. Know what to buy. Automatically. |

### What makes it different

| Competitor | What they do | What GroceryManager adds |
|---|---|---|
| Mealime | Recipe suggestions + meal planning | + Auto-tracking from receipts (no manual entry) |
| Paprika | Recipe storage + grocery list | + Pantry depletion model + run-out prediction |
| AnyList | Shared shopping list | + Pantry tracking + meal suggestions from pantry |
| Notes app | Manual lists | + Everything: auto-update, depletion, recipes |

### Traction (at launch)

*[Owner fills in once app is live: waitlist subscribers, early downloads, user feedback quotes.]*

---

## Founder story

[OWNER_NAME] built GroceryManager after spending too many evenings staring at a full fridge
and ordering pizza anyway. The problem isn't knowing how to cook — it's knowing what you can
cook with what's actually there.

"I'd buy groceries Sunday, forget what I bought by Thursday, and end up throwing half of it
out," [OWNER_NAME] says. "The insight was: if I could make the pantry maintain itself — from
receipts, from scans — then everything else (the recipe suggestions, the shopping list) could
be automatic too."

The app was built entirely in spare time over [X months], using an AI-assisted development
workflow (Claude Code) to handle the autonomous parts — receipt parsing, ingredient matching,
depletion modelling — while keeping the product decisions firmly human.

"The AI is doing real work in the background: reading receipts, modelling consumption rates,
ranking recipes. But the product decisions — what to build, what to charge, what to say to
users — those are mine."

---

## App review and coverage request

If you're writing about meal planning, food tech, grocery apps, or personal productivity and
would like to cover GroceryManager, [OWNER_NAME] is available for:

- A product walk-through (30 minutes via video call)
- A free Premium account for hands-on testing
- Technical background on the AI/LLM architecture
- Data on the subscription model + pricing rationale

**Contact:** [CONTACT_EMAIL]
**App:** [APP_URL]

---

## Directory and launch list targets

File submissions manually (owner action). Suggested order:

| Platform | URL | Priority | Notes |
|---|---|---|---|
| Product Hunt | https://producthunt.com/posts/new | ★★★ High | Schedule for 12:01 AM PST Tuesday |
| Hacker News "Show HN" | https://news.ycombinator.com/submit | ★★★ High | Authentic, technical angle |
| BetaList | https://betalist.com | ★★ Medium | Good for early adopter audience |
| AlternativeTo | https://alternativeto.net | ★★ Medium | Comparison / SEO value |
| Appadvice | https://appadvice.com | ★ Low | iPhone-focused review site |
| GetApp | https://getapp.com | ★ Low | Software directory; good for SEO |
| Capterra | https://capterra.com | ★ Low | Software review site |
| SaaSworthy | https://saasworthy.com | ★ Low | SaaS directory |
| Lifehacker | editor@lifehacker.com | ★★★ High | Pitch "Stop wasting food" angle |
| The Wirecutter | — | ★★ Medium | "Best grocery apps" coverage |
| r/mealplanning | https://reddit.com/r/mealplanning | ★★ Medium | Read rules; be a genuine participant |
| r/zerowaste | https://reddit.com/r/zerowaste | ★★ Medium | Food waste angle |
| r/mealprep | https://reddit.com/r/mealprep | ★★ Medium | Meal prep angle |

---

## Media assets (checklist)

- [ ] App icon: 1024×1024 PNG (export from `apps/web/public/icons/icon.svg`)
- [ ] Feature graphic: 1024×500 PNG (see `docs/store/store-assets-spec.md` for concept)
- [ ] Screenshots: 5 screens at iPhone 15 Pro size (1320×2868 px) — see `store-assets-spec.md`
- [ ] Short demo video: 30-second screen recording — receipt scan → pantry update → cook suggestion

All media assets are Human Core (require running the real app on device/simulator).
See `docs/store/store-assets-spec.md` for the complete visual spec.
