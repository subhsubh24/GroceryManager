# GroceryManager — Brand Kit

> **Working title:** GroceryManager. Ships under this name until the owner picks from the three
> candidates in `NAMING_CANDIDATES.md` (Pantri / Mise / Larder). All design decisions below apply
> regardless of the final name.

---

## Identity mark (working)

The working logo is a **Leaf icon** (lucide-react `Leaf`, 20 × 20 at 2px stroke) centred in a
**40 × 40 rounded square** (`border-radius: 12px`) filled with `brand-solid` (`#0c8a3e`).
Text lockup: "GroceryManager" in Hanken Grotesk Semibold (600), `text-ink-900`, at 16px / 1em
tracking `−0.01em`, sitting 10px to the right of the tile.

The tile alone serves as the favicon (32 × 32 PWA icon, exported as PNG — see PENDING_OPS.md)
and the App Store / Play Store icon (1024 × 512, centered on white, with a 10% white gutter).

### Per-candidate mark direction (activate once owner picks a name)

| Name | Mark concept | Accent variant |
|---|---|---|
| **Pantri** | Rounded shelf-bracket arch, filled white, on garden-green tile. Wordmark: Pantri in Hanken Grotesk Medium | Same green; single-tone |
| **Mise** | Horizontal rule bisecting a circle (counter / chopping board). Wordmark: mise in Hanken Grotesk Light | Deep forest green on linen |
| **Larder** | Rounded arch + single shelf line. Wordmark: Larder, l–a ligature detail | Warm terracotta accent |

Until a name is chosen, every surface uses the Leaf tile + "GroceryManager" wordmark.

---

## Color palette

Sourced directly from `apps/web/tailwind.config.ts` (`brand` + `ink` + `surface` scales).
**Never use raw Tailwind palette classes** — always use the token aliases below.

### Primary (brand green)

| Token | CSS variable | Hex | Use |
|---|---|---|---|
| `brand-solid` | `--brand-solid` | `#0c8a3e` | Primary CTA backgrounds, icon tiles |
| `brand-600` | `--brand-600` | `#0c8a3e` | Hover on primary CTAs (equals brand-solid in light mode) |
| `brand-500` | `--brand-500` | `#13a14a` | Accent text, status-bar meta-theme |
| `brand-200` | `--brand-200` | `#9fe6b8` | Borders on premium cards |
| `brand-50` | `--brand-50` | `#ecfaf0` | Premium card fill tint |

### Neutral (ink + surface)

| Token | Use |
|---|---|
| `ink-900` | Headings, primary text |
| `ink-700` | Body text |
| `ink-500` | Secondary text, metadata |
| `ink-400` | Tertiary, timestamps |
| `ink-200` / `ink-100` | Borders, skeleton fills |
| `cream` | Page / body background (light `#faf8f3`, dark `#0f1216`) |
| `surface` | Card / raised surface (light `#ffffff`, dark `#181c22`) |

### Accent (used sparingly)

| Token | Notes |
|---|---|
| `berry-*` | Legacy/back-compat ramp — not actively assigned to a feature area |
| `grape-*` | Legacy/back-compat ramp — not actively assigned to a feature area |
| `success` / `success-soft` / `success-ink` | Success states (confirmed green) |
| `danger-*` | Destructive actions (always via `btn-danger`, `notice-danger`) |

### Rules

- **Never use `red-*`** for destructive UX — use `danger-soft`, `danger-ink`, `btn-danger`.
- **Never invent accent colours** — only the defined ramps in `tailwind.config.ts`.
- Dark mode adapts automatically via CSS variable swap; no manual `dark:` overrides needed for
  on-brand elements.

---

## Typography

**One typeface for the whole product: Hanken Grotesk.**
Loaded via `next/font/google` in `apps/web/app/layout.tsx` (`--font-sans`).
`--font-display` is aliased to `--font-sans` — hierarchy comes from weight + size + tracking,
not a second family.

| Role | Class / CSS | Weight | Size |
|---|---|---|---|
| Page title | `.page-title` | 600 | 1.85rem base / 2.25rem sm+, tight tracking (`-0.02em`) |
| Section title | `.section-title` | 600 | 1rem (16px), tight tracking (`-0.01em`), no uppercase |
| Body | default | 400 | 0.9375rem (15px) |
| Eyebrow | `.eyebrow` | 700 | 0.6875rem (11px), 0.14em letter-spacing |
| Display heading | `font-display` | 700 | varies |
| Code / monospace | `<code>` | — | 0.75rem, `bg-ink-100` |

**Never use a second typeface.** No serifs, no display scripts, no icon fonts.

---

## Icon system

All icons come from **lucide-react pinned to `0.460.0`** — never emoji, never SVG inline in JSX
unless it's the brand Leaf.

Icons are added via `apps/web/app/components/icons.tsx`. Every icon used must be registered there.

| Usage | Size | Stroke width |
|---|---|---|
| Navigation / action | 20 × 20 (`h-5 w-5`) | 2 |
| Tile (inside rounded square) | 20 × 20 | 2 |
| Small inline | 16 × 16 (`h-4 w-4`) | 2–2.5 |
| Large hero / feature card | 24 × 24 (`h-6 w-6`) | 2 |

Icon colour always inherits from the parent text context or an explicit token class (`text-brand-600`,
`text-ink-500`, `text-ok`). Never hardcode hex in `color` props.

---

## Component classes (design system summary)

Defined in `apps/web/app/globals.css`. These are the canonical building blocks:

| Class | Description |
|---|---|
| `.btn-primary` | Solid green CTA button |
| `.btn-secondary` | Bordered ghost button |
| `.btn-ghost` | Minimal text-level button |
| `.btn-danger` | Destructive action (red system) |
| `.btn-sm` | Small variant for nav-level actions |
| `.card-pad` | Rounded card with border + padding |
| `.card-link` | Tappable card with hover state |
| `.panel-brand` | Solid green panel (inverted, white text) |
| `.pill-brand` | Small green badge / tag |
| `.input` / `.input-lg` | Text input fields |
| `.link` | Anchor (brand-colour, dark-mode-safe) |
| `.page` | Full-width page wrapper |
| `.page-narrow` | Narrow (max-w-2xl) page wrapper |
| `.notice-info` / `.notice-danger` | In-page alert banners |
| `.eyebrow` | Uppercase small label above a heading |
| `.page-title` | H1 typography |
| `.section-title` | Section heading |

---

## Voice and tone

**Calm, confident, knowledgeable, friendly.** The app is a competent kitchen co-pilot — not a
chatbot, not a cheerleader. It knows your pantry better than you do, and it shows without boasting.

### Principles

1. **Active and specific.** "6 items running low" not "some items may be running low". Real numbers,
   real names, real dates.
2. **Short sentences.** UI microcopy should be one sentence or fewer. Marketing copy may run longer,
   but still no padding.
3. **No false urgency.** Never manufacture panic ("Act now!"). The app earns trust by being accurate,
   not alarming.
4. **Honest about limits.** When the AI can't parse a receipt, say "Couldn't read this one — add
   manually?" not "An error occurred". Own the gap.
5. **No jargon in consumer surfaces.** "Pantry" not "inventory". "Expiring soon" not "TTL approaching".
   "Order" not "fulfil".
6. **Minimal exclamation marks.** One per marketing page maximum. Zero in the app itself.

### Voice in different contexts

| Context | Voice example |
|---|---|
| Empty state | "Your pantry is empty. Snap a receipt or add items to get started." |
| Success | "Receipt scanned — 7 items added." |
| Error | "Couldn't parse this receipt. Added what we could find — review below." |
| Premium nudge | "This is a Premium feature. Start your 7-day free trial to unlock it." |
| Waitlist CTA | "Be first in line — drop your email and we'll reach out the moment the apps go live." |

---

## Usage rules

- **Never show raw slugs or enum values** in the UI. Use `titleCase()` for item names and
  `humanize()` for enum display values (diet types, domains, etc.).
- **Never use emoji in the product UI.** The icon system (lucide-react) handles all iconography.
- **No inline styles** in production JSX — use design system classes or Tailwind tokens only.
- **Dark mode is automatic** for all on-brand elements via CSS variables. If a new element needs a
  manual `dark:` override, that's a signal that it should use a design-system class instead.
