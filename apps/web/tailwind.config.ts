import type { Config } from "tailwindcss";

/**
 * GroceryManager design system — calm, refined, and quietly confident.
 * Polish bar: Airbnb / Linear / Stripe — one distinctive typeface (Hanken Grotesk), generous
 * whitespace, a restrained neutral palette, and a SINGLE accent (a garden-fresh green) used
 * sparingly and mostly solid.
 * The citrus / berry / grape / ocean ramps remain defined for back-compat, but the app no longer
 * renders them as themes or spotlights — the "gradient" tokens below resolve to the solid brand so
 * legacy usages stay calm. Motion is quiet: a subtle fade and a gentle card-hover shadow only.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand — a warm, garden-fresh green. Variable-backed so the ramp flips cleanly in dark mode
        // (700 is link text, 50 a chip tint, etc.); the literal-hex *gradients* below stay vivid on dark.
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)", // primary
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
          // Solid accent SURFACE (white text on it) — fixed deep green that holds contrast in both
          // themes; use for primary buttons / brand panels / active tabs, not for text/links.
          solid: "rgb(var(--brand-solid) / <alpha-value>)",
          "solid-hover": "rgb(var(--brand-solid-hover) / <alpha-value>)",
        },
        // Citrus — kept defined for back-compat only. No longer rendered as a theme/spotlight.
        citrus: {
          50: "#f7fee7",
          100: "#ecfccb",
          200: "#d9f99d",
          300: "#bef264",
          400: "#a3e635",
          500: "#84cc16",
          600: "#65a30d",
          700: "#4d7c0f",
          800: "#3f6212",
          900: "#365314",
        },
        // Berry — kept defined for back-compat only. No longer rendered as a theme/spotlight.
        berry: {
          50: "#fff1f4",
          100: "#ffe4ea",
          200: "#fecdd6",
          300: "#fda4b6",
          400: "#fb7193",
          500: "#f43f6e",
          600: "#e11d54",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },
        // Grape — kept defined for back-compat only. No longer rendered as a theme/spotlight.
        grape: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        // Ocean — kept defined for back-compat only. No longer rendered as a theme/spotlight.
        ocean: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
        // Ink — the neutral text/background scale (variable-backed; the ramp inverts in dark mode so
        // ink-900 stays "primary text" and ink-50 stays "subtlest surface" in both themes).
        ink: {
          DEFAULT: "rgb(var(--ink-800) / <alpha-value>)",
          50: "rgb(var(--ink-50) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
        },
        // Canvas + raised surfaces. "cream" is the page; "surface" is a card.
        cream: "rgb(var(--cream) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        // Hairline borders, tuned warm so they sit on cream without going grey-blue.
        line: "rgb(var(--line) / <alpha-value>)",
        // Semantic accents (variable-backed: brighter on dark, soft tints go dark).
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          soft: "rgb(var(--success-soft) / <alpha-value>)",
          ink: "rgb(var(--success-ink) / <alpha-value>)",
        },
        warn: {
          DEFAULT: "rgb(var(--warn) / <alpha-value>)",
          soft: "rgb(var(--warn-soft) / <alpha-value>)",
          ink: "rgb(var(--warn-ink) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          soft: "rgb(var(--danger-soft) / <alpha-value>)",
          ink: "rgb(var(--danger-ink) / <alpha-value>)",
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      fontFamily: {
        // One typeface for the whole app: Hanken Grotesk (wired to --font-sans AND --font-display in
        // the root layout). `display` resolves to the same stack as `sans` (no serif) — headings
        // differ from body by weight, tracking, and size, not by family.
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      fontSize: {
        // A tighter, more confident display rhythm for big, expressive headings.
        "display-sm": ["2rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display": ["2.75rem", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-lg": ["3.5rem", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        "display-xl": ["4.5rem", { lineHeight: "0.98", letterSpacing: "-0.035em" }],
      },
      boxShadow: {
        // Soft, gentle, low-opacity shadows — quiet depth, never a glow. One restrained scale.
        xs: "0 1px 2px rgba(29, 37, 48, 0.04)",
        sm: "0 1px 2px rgba(29, 37, 48, 0.04), 0 1px 3px rgba(29, 37, 48, 0.05)",
        card: "0 1px 2px rgba(29, 37, 48, 0.03), 0 2px 8px -4px rgba(29, 37, 48, 0.07)",
        lift: "0 2px 4px rgba(29, 37, 48, 0.04), 0 8px 20px -10px rgba(29, 37, 48, 0.12)",
        "lift-lg": "0 4px 8px rgba(29, 37, 48, 0.05), 0 16px 36px -16px rgba(29, 37, 48, 0.16)",
        // Brand + legacy accent glows are intentionally neutral now: the accent is solid, not glowy,
        // so these all map to the same quiet shadow (keeps any leftover usages calm).
        brand: "0 1px 2px rgba(29, 37, 48, 0.04), 0 2px 8px -4px rgba(29, 37, 48, 0.07)",
        "brand-lift": "0 2px 4px rgba(29, 37, 48, 0.04), 0 8px 20px -10px rgba(29, 37, 48, 0.12)",
        citrus: "0 1px 2px rgba(29, 37, 48, 0.04), 0 2px 8px -4px rgba(29, 37, 48, 0.07)",
        berry: "0 1px 2px rgba(29, 37, 48, 0.04), 0 2px 8px -4px rgba(29, 37, 48, 0.07)",
        grape: "0 1px 2px rgba(29, 37, 48, 0.04), 0 2px 8px -4px rgba(29, 37, 48, 0.07)",
        ocean: "0 1px 2px rgba(29, 37, 48, 0.04), 0 2px 8px -4px rgba(29, 37, 48, 0.07)",
      },
      backgroundImage: {
        // The single accent is SOLID brand green. To keep legacy `bg-*-gradient` usages calm and
        // on-brand without touching every page, all the old "gradient" tokens resolve to the same
        // flat `brand-solid` fill — a fixed deep green that holds white-text contrast in BOTH
        // themes (a single-stop linear-gradient is just a solid color). No rainbow renders anywhere.
        "brand-gradient": "linear-gradient(rgb(var(--brand-solid)), rgb(var(--brand-solid)))",
        "brand-sheen": "none",
        "ink-gradient": "linear-gradient(rgb(var(--ink-900)), rgb(var(--ink-900)))",
        "citrus-gradient": "linear-gradient(rgb(var(--brand-solid)), rgb(var(--brand-solid)))",
        "sunset-gradient": "linear-gradient(rgb(var(--brand-solid)), rgb(var(--brand-solid)))",
        "berry-gradient": "linear-gradient(rgb(var(--brand-solid)), rgb(var(--brand-solid)))",
        "grape-gradient": "linear-gradient(rgb(var(--brand-solid)), rgb(var(--brand-solid)))",
        "ocean-gradient": "linear-gradient(rgb(var(--brand-solid)), rgb(var(--brand-solid)))",
        // No animated gradient text and no aurora — neutralized to nothing.
        "text-brand": "none",
        "aurora": "none",
      },
      keyframes: {
        // Quiet entrances only — a short, subtle fade (with a tiny rise) on first paint.
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        // Fast, gentle, ease-out. No infinite/decorative loops anywhere.
        "fade-in-up": "fade-in-up 0.2s ease-out both",
        "fade-in": "fade-in 0.18s ease-out both",
      },
      transitionTimingFunction: {
        // Calm, near-linear ease-out. (Name kept as `spring` for back-compat; no bounce.)
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
