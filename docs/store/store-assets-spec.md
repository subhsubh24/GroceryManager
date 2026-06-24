# GroceryManager — Store Assets Spec

> **Status: STAGED.** Icon SVG is committed. PNG export + screenshots require the owner to run
> the export step (see PENDING_OPS.md). Placeholders below are production specs; fill them before
> submission.

---

## App icon

### Source
`apps/web/public/icons/icon.svg` — 512 × 512, `border-radius: ~22% (rx=112)`, `brand-solid` fill
(`#0c8a3e`), lucide `Leaf` path in white at 2px stroke, centered.

### Required exports (Human Core — see PENDING_OPS.md)

| Platform | Size | Format | Notes |
|---|---|---|---|
| iOS App Store | 1024 × 1024 px | PNG, no alpha | No rounded corners — Apple applies the mask |
| Google Play | 512 × 512 px | PNG or JPEG, ≤ 1 MB | No alpha required |
| PWA / favicon | 192 × 192 px | PNG | Already listed in `manifest.webmanifest` (SVG fallback) |
| PWA / large | 512 × 512 px | PNG | Already listed in `manifest.webmanifest` (SVG fallback) |
| Expo / EAS | 1024 × 1024 px | PNG, no alpha | Referenced in `apps/mobile/app.json` as `./assets/icon.png` |

**Export method:** open `icon.svg` in Figma (import SVG → frame to 1024×1024 → export PNG), or use
`sharp`/`svgexport` in a one-off script. Never use the SVG directly for store submission — stores
require PNG.

---

## Screenshots

Apple requires at least 3 screenshots per device class. Google Play requires at least 2.

### Required device sizes

| Platform | Size | Count |
|---|---|---|
| iPhone 6.9" (primary) | 1320 × 2868 px | 6–10 |
| iPhone 6.5" (required) | 1242 × 2688 px | 6–10 |
| iPad Pro 12.9" (required if universal) | 2048 × 2732 px | 3+ |
| Google Play phone | 1080 × 1920 px (min) | 2–8 |
| Google Play 7" tablet | 1080 × 1920 px | optional |

### Recommended screenshot sequence (all platforms)

1. **Home / pantry** — show items with quantities, depletion bars, and "running low" signals.
   Caption: *"Always know what's in your kitchen."*

2. **Scan / receipt capture** — camera or receipt upload in progress.
   Caption: *"Snap a receipt. Your pantry fills itself."*

3. **Cook tonight** — the "What can I make?" or cook mode screen with a recipe loaded.
   Caption: *"Cook what you already have."*

4. **Shopping list** — list built from reorder signals, ready to send.
   Caption: *"Your list builds itself before you run out."*

5. **Plan my week** — 5-dinner weekly plan with pantry context.
   Caption: *"Five dinners planned around what you have."*

6. **Premium upgrade** — the `/upgrade` paywall.
   Caption: *"Unlock the full autopilot. Free trial included."*

### Caption / frame styling

- Background: `surface` (`#ffffff`) or brand-green (`#0c8a3e`) full-bleed frames.
- Typeface: Hanken Grotesk — match app's own typeface.
- No fake content — use real data from a seeded demo account.

### Production workflow (Human Core)

1. Seed a demo account with realistic pantry data (see `PENDING_OPS.md`).
2. Run the app on a physical device or simulator at each required screen size.
3. Capture screenshots via Xcode Simulator / Android Emulator (or Expo EAS screenshot service).
4. Optionally add device frames + caption text using Figma or Sketch.
5. Upload to App Store Connect / Google Play Console.

---

## Feature graphic (Google Play only)

Required: **1024 × 500 px** JPEG or PNG.

Design direction: `brand-solid` (#0c8a3e) full-bleed background, centered Leaf icon (white, ~200px),
wordmark "GroceryManager" in Hanken Grotesk Semibold below it in white.

---

## App preview / promo video (optional)

Apple allows a 15–30 sec App Preview (MP4, device resolution). Google Play allows a YouTube link.
Not required for initial submission. Recommended as a follow-up once the app has real user flows to
showcase.
