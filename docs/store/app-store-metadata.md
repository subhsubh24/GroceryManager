# Apple App Store Metadata

Working app name: **GroceryManager** (update to final brand name once owner decision is made).

All character counts are noted. Fields marked [INDEXED] are used by Apple's search algorithm.

---

## Core fields

### App Name [INDEXED]
`GroceryManager — Smart Pantry`
(30 chars)

> Note: once brand name is finalised, replace with e.g. `Pantri — Smart Pantry` (21 chars) to gain
> 9 extra characters for a keyword in the title slot.

### Subtitle [INDEXED]
`Track fridge, plan meals, save`
(30 chars)

### Promotional Text (not indexed — can update without a new build)
`Snap a receipt. Scan your fridge. GroceryManager figures out what you have, what you're running low on, and what to cook tonight.`
(130 chars)

> Promotional text is shown at the top of the description in a blue callout box. Update it for
> seasonal campaigns (e.g. "New: Grocery Wrapped — your year in food" in December) without
> submitting a new build.

### Primary Category
Food & Drink

### Secondary Category
Lifestyle

### Age Rating
4+ (no user-generated content visible to others, no mature themes)

### Support URL
https://grocerymanager.app/support

### Marketing URL
https://grocerymanager.app

---

## Keywords [INDEXED]
Max 100 chars. No spaces after commas. No repetition of words already in App Name or Subtitle.

```
pantry,meal planner,shopping list,grocery tracker,fridge,recipe,cook,food waste,receipt scanner,budget
```

(99 chars — within limit)

**Rationale:**
- `pantry` — highest-volume term for this use case
- `meal planner` — broad intent, catches weekly planning searches
- `shopping list` — universal grocery entry point
- `grocery tracker` — mid-funnel, purchase-intent users
- `fridge` — differentiates from pure list apps; ties to scan feature
- `recipe` — catches cook-oriented searches
- `cook` — short tail, high volume
- `food waste` — conscious-consumer angle; low competition, rising trend
- `receipt scanner` — the auto-import differentiator
- `budget` — spend-insights angle

Do not include: "grocery" or "manager" (already in App Name) or "list" (in subtitle via "plan meals").

---

## Description
Max 4000 chars. First 255 chars are shown before the "more" fold — make them count.

```
GroceryManager turns the chaos of keeping a kitchen stocked into something that just works.

Snap a grocery receipt, scan your fridge, or let the app pull purchases straight from your Gmail — and watch your pantry build itself. No manual entry. No spreadsheets. Just a calm, accurate picture of what you actually have at home.

----- WHAT IT DOES -----

PANTRY ON AUTOPILOT
GroceryManager learns what you buy and how fast you use it. It tracks expiry, models your consumption pace, and quietly tells you when you're about to run out — before you're standing in an empty kitchen on a Thursday night.

FRIDGE SCAN
Open the camera. Point at your fridge or cupboard. The app reads what's there and updates your pantry in seconds.

GMAIL RECEIPT IMPORT
Connect your inbox and the app finds grocery receipts automatically — from supermarkets, delivery services, and click-and-collect orders. Your pantry grows without you lifting a finger.

COOK TONIGHT
Each evening the app looks at what you have and suggests meals you can actually make right now — not recipes that need a special trip to the shop. Filter by time, dietary preference, or mood.

MEAL PLANNING
Plan the week in a few taps. The app checks your pantry, fills gaps intelligently, and builds a shopping list of only what you need — nothing extra, nothing forgotten.

SHOPPING LIST
A living list that knows your pantry. Recurring items appear automatically when you're running low. Add anything manually.

COOKBOOK & RECIPE REMIX
Save recipes from anywhere. The app adapts them to what you have — swapping ingredients, scaling portions, and flagging what to buy. Your cookbook gets smarter the more you cook.

DISCOVER FEED
Personalised recipe ideas based on what's in your pantry today, your cooking history, and the time of year. Scroll when you're uninspired; cook when you're ready.

SPEND INSIGHTS & GROCERY WRAPPED
See where your food budget actually goes — by category, store, and week. At the end of the year, Grocery Wrapped gives you a visual summary of your kitchen life: what you cooked most, what you wasted least, how your habits shifted.

NUTRITION TRACKING
Log a cook and the app estimates macros automatically from your ingredients. No barcode scanning required for home-cooked meals.

----- DESIGNED FOR REAL KITCHENS -----

GroceryManager is built for people who cook at home — not professional chefs, not meal-kit subscribers, not people with unlimited time. It works quietly in the background, surfacing information when it's useful and staying out of the way when it isn't.

The app is fast, offline-capable, and designed to work on a phone you're holding with one hand while the other is stirring a pot.

----- PRIVACY -----

Your pantry data stays private. GroceryManager does not sell your data or use it for advertising. Gmail access is read-only and scoped to receipt emails only — the app never reads personal messages. You can disconnect Gmail or delete all your data at any time from Settings.

----- SUBSCRIPTION -----

GroceryManager is free to download. The core pantry, cook, and shopping-list features are free. A subscription unlocks power features: automatic Gmail receipt import, AI weekly meal planning, unlimited recipe remix, an unlimited Discover feed, advanced spend insights, and Grocery Wrapped+.

• Monthly: $4.99/month
• Annual: $39.99/year (save 33%)

Payment is charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. You can manage or cancel your subscription in your Apple ID account settings at any time. No partial refunds for unused portions of a subscription period.

----- ------- -----

Questions? Visit https://grocerymanager.app/support
```

(Character count: ~3 410 — within 4 000 limit. Room to add localisations or expand features.)

---

## Screenshots & App Preview

Apple requires 2–10 screenshots per device family. Required sizes for v1:

| Device | Canvas | Priority |
|---|---|---|
| iPhone 6.9" (15 Pro Max) | 1320 × 2868 px | **Required** |
| iPhone 6.7" (14 Plus) | 1284 × 2778 px | Required |
| iPad 13" (M4) | 2064 × 2752 px | Required if app supports iPad |

### Recommended screenshot sequence (5 screens):
1. **Home / Pantry** — "Your pantry, always current" — show the pantry list with depletion chips
2. **Cook Tonight** — "Cook what you have, tonight" — show 3 recipe suggestions from pantry
3. **Fridge Scan** — "Scan your fridge in seconds" — show the camera scan UI with items found
4. **Meal Planning** — "Plan the week, fill the gaps" — show the weekly plan + smart list
5. **Spend / Wrapped** — "See where your food budget goes" — show the spend insights chart

### App icon
Source: `/apps/web/public/icons/icon.svg` (512 × 512 SVG, garden-green on light background)
Export as PNG-32 at 1024 × 1024 px for App Store Connect upload (no alpha, full-bleed square —
Apple adds rounded corners automatically).

### App Preview video (optional for v1)
15–30 second screen recording of the core loop: snap a receipt → watch pantry update → cook tonight suggestion appears. Capture on an iPhone 15 Pro at 1290 × 2796 px. No voiceover required; add captions if used.

---

## Localisation notes

Priority locales for v1: `en-GB`, `en-AU` (same copy; adjust "fridge" → keep, "grocery" → keep;
"shop" is natural in both). Consider `fr-FR` and `de-DE` for Q2 if user acquisition data supports it.

For `en-GB` subtitle consider: `Track your fridge, plan meals`

---

## Version-specific fields (fill at submission time)

| Field | Value |
|---|---|
| Version number | 1.0.0 |
| What's new | (leave blank for first release) |
| Copyright | © 2026 GroceryManager |
| Rating | New App |
| Content rights | Does not contain third-party content |
