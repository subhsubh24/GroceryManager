# Google Play Store Metadata

Working app name: **GroceryManager** (update to final brand name once owner decision is made).

Google Play's search algorithm indexes the App Name, Short Description, and Full Description. Unlike
Apple, Play gives more weight to keyword repetition in the full description — use natural repetition
of core terms.

---

## Core fields

### App Name
`GroceryManager — Smart Pantry App`
(34 chars — max 50)

> When brand name is finalised, update to e.g. `Pantri — Smart Pantry & Meal Planner` (36 chars).

### Short Description
Max 80 chars. This is the most important copy on the Play Store listing — shown in search results.

`Auto-track your pantry, plan meals, and never run out of groceries again.`
(73 chars)

### Category
Food & drink

### Content Rating
Everyone

### Developer contact email
subh.mukherjee1996@gmail.com ← **Replace with a product email (e.g. hello@grocerymanager.app) before submission — this is visible to all Play Store users.**

### Website
https://grocerymanager.app

### Privacy Policy URL
https://grocerymanager.app/privacy

---

## Full Description
Max 4000 chars. Google indexes this — natural keyword repetition (not stuffing) improves ranking.
Write in plain text; Play renders line breaks and em-dashes but not markdown bold/headers.

```
GroceryManager is a grocery and cooking autopilot for people who cook at home.

Snap a receipt, scan your fridge, or connect Gmail and the app builds your pantry automatically — tracking what you have, how fast you go through it, and what you need to buy next. No manual entry. No guesswork.

━━━ PANTRY TRACKING ━━━

GroceryManager keeps a live pantry based on what you actually buy. It learns your consumption pace over time and tells you when you're running low — before you open an empty cupboard. Items are tracked with shelf-life awareness so you know what to use first.

Connect your Gmail and the app imports grocery receipts from supermarkets, delivery services, and click-and-collect orders automatically. Your pantry updates without you doing anything.

━━━ FRIDGE SCAN ━━━

Open the camera and scan your fridge or cupboard. GroceryManager reads what's there and adds it to your pantry in seconds. Useful after a big shop or when you inherit a fridge full of mystery items.

━━━ MEAL PLANNING & COOK TONIGHT ━━━

Each day the app looks at your pantry and suggests meals you can cook right now — recipes that use what you already have, not what you need to go and buy. Filter by time available, dietary preference, or what sounds good.

Plan your meals for the week in a few taps. GroceryManager checks your pantry, identifies gaps, and builds a shopping list of only what you're missing. Meal planning and grocery shopping become one step.

━━━ SHOPPING LIST ━━━

A smart shopping list that knows your pantry. Items appear automatically when you're running low. Add anything manually.

━━━ RECIPES & COOKBOOK ━━━

Save recipes from anywhere. GroceryManager checks them against your pantry, suggests ingredient swaps for what you have, and scales portions for your household size. The more you cook, the better the suggestions get.

The Discover feed shows personalised recipe ideas based on what's in your pantry today, your cooking history, and the season. Scroll when you're uninspired; cook when you're ready.

━━━ SPEND INSIGHTS & GROCERY WRAPPED ━━━

GroceryManager tracks your grocery spend automatically from receipt imports. See a breakdown by category, store, and week — without a spreadsheet. At the end of the year, Grocery Wrapped gives you a visual summary: your most-cooked meals, your most-bought items, how your habits changed.

━━━ NUTRITION ━━━

Log a cook and the app estimates macros from your ingredients automatically. No barcode scanning needed for home-cooked meals.

━━━ PRIVACY ━━━

GroceryManager does not sell your data or use it to serve ads. Gmail access is read-only and scoped only to receipt-related emails — personal messages are never accessed or stored. You can disconnect Gmail or delete all your data from Settings at any time.

━━━ SUBSCRIPTION ━━━

GroceryManager is free to download. The core pantry, cook, and shopping-list features are free forever. A subscription unlocks power features: automatic Gmail receipt import, AI weekly meal planning, unlimited recipe remix, an unlimited Discover feed, advanced spend insights, and Grocery Wrapped+.

Monthly plan: $4.99 per month
Annual plan: $39.99 per year (save 33%)

Your subscription is billed through Google Play. It renews automatically each period unless you cancel at least 24 hours before renewal. Manage or cancel anytime in your Google Play account settings.

━━━━━━━━━━━━━━━━━━━━━━━

Questions or feedback: https://grocerymanager.app/support
```

(Character count: ~3 310 — within 4 000 limit.)

---

## Graphics

### App Icon — 512 × 512 px
Source file: `/apps/web/public/icons/icon.svg`

The icon uses the garden-green accent colour on a near-white (or dark) background. At 512 px the
icon must be readable at 48 dp on a phone screen. Ensure:
- No text smaller than ~80 px in the 512 px canvas (unreadable at small sizes)
- 1 px transparent padding removed — Play requires a full-bleed square (no rounded corners; the
  Play Store applies rounding automatically)
- Export as PNG-32 with no alpha in the background layer

### Feature Graphic — 1024 × 500 px
This is the banner shown at the top of the Play Store listing on Android and on the web.

**Concept:** A split composition. Left two-thirds: a clean, dark-mode phone mockup showing the
"Cook Tonight" screen — three recipe cards visible, each with a thumbnail and a "You have all the
ingredients" green badge. Right third: the GroceryManager wordmark (or final brand name) in
Hanken Grotesk Medium, white on a deep forest-green background panel. Below the wordmark, the
tagline in small caps: "Your pantry on autopilot." No stock photography of food. The aesthetic
should read as a design-forward productivity tool, not a recipe blog.

**Do not include:** prices, promotional offers, or time-limited claims in the feature graphic (Play
policy violation if not updated).

---

## Additional Play Store fields

| Field | Value |
|---|---|
| Declared target API level | 34 (Android 14) |
| App type | App (not Game) |
| Free / Paid | Free (with in-app subscription) |
| In-app purchases | Yes — subscription |
| Ads | No |
| Sensitive permissions | Camera (fridge scan), Gmail OAuth (receipt import) |

### Permission rationale (shown to users on install)
- **Camera:** Used only to scan your fridge or cupboard. Photos are processed on-device or
  privately on our servers and are not stored.
- **Gmail (OAuth, read-only):** Used only to find and import grocery receipts. Personal emails are
  never accessed or stored.

---

## Localisation notes

Launch in `en-US`. Priority additions: `en-GB`, `en-AU`, `en-CA` (same base copy, minimal edits).
Consider `es-419` (Latin American Spanish) for Q2 based on Play Store geography data.

---

## Keyword strategy notes

Play's algorithm indexes the full description. Key terms to use naturally (already included above):
- grocery, groceries, grocery list, grocery tracker
- pantry, pantry tracker, pantry management
- meal planner, meal planning, meal ideas
- shopping list, smart shopping list
- fridge, fridge scanner
- recipe, recipes, cookbook
- food waste, food tracker
- receipt scanner, receipt import
- spend, budget, grocery budget

Avoid keyword stuffing (repetition without context) — Play's algorithm penalises it and it reads
poorly to users.
