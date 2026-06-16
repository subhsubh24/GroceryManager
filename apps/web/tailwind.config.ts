import type { Config } from "tailwindcss";

/**
 * GroceryManager design system — warm, food-forward, and unapologetically alive.
 * Polish bar: Linear / Stripe / Things / Cal.com, but warmer and bolder — built to feel
 * fresh and delightful to a Gen-Z / millennial audience. Brand is a confident garden green;
 * a curated set of fruit-bright accents (citrus, berry, grape, ocean) powers vivid duotone
 * gradients, aurora glows, and a "Wrapped"-style energy across the app.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand — a warm, garden-fresh green. 500 is the primary; the ramp stays cohesive.
        brand: {
          50: "#ecfaf0",
          100: "#cdf2da",
          200: "#9fe6b8",
          300: "#62d390",
          400: "#2fbc67",
          500: "#13a14a", // primary
          600: "#0c8a3e",
          700: "#0a6e33",
          800: "#0a572b",
          900: "#093f21",
        },
        // Citrus — a zesty lime/chartreuse that pairs with brand for fresh, energetic duotones.
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
        // Berry — a punchy raspberry/coral for "use it up", waste, and playful Wrapped moments.
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
        // Grape — a friendly violet for cool, "smart"/AI-flavored surfaces (plan, scan).
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
        // Ocean — a clean cyan/teal for spend, household, and calm informational cards.
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
        // Ink — text + dark surfaces. A slightly warm, desaturated slate (not pure black).
        ink: {
          DEFAULT: "#1d2530",
          50: "#f4f5f6",
          100: "#e6e8ea",
          200: "#cbd0d5",
          300: "#a3acb5",
          400: "#737f8c",
          500: "#525d6a",
          600: "#3c4651",
          700: "#2b333d",
          800: "#1d2530",
          900: "#141a22",
        },
        // Canvas + raised surfaces. "cream" is the page; "surface" is a card.
        cream: "#faf8f3",
        surface: "#ffffff",
        // Hairline borders, tuned warm so they sit on cream without going grey-blue.
        line: "#ece7dd",
        // Semantic accents (kept muted + premium, with soft tints for backgrounds).
        success: { DEFAULT: "#0c8a3e", soft: "#ecfaf0", ink: "#0a572b" },
        warn: { DEFAULT: "#b6791a", soft: "#fdf4e3", ink: "#8a5a12" },
        danger: { DEFAULT: "#c0392b", soft: "#fdecea", ink: "#8e261b" },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-serif", "Georgia", "serif"],
      },
      fontSize: {
        // A tighter, more confident display rhythm for big, expressive headings.
        "display-sm": ["2rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display": ["2.75rem", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-lg": ["3.5rem", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        "display-xl": ["4.5rem", { lineHeight: "0.98", letterSpacing: "-0.035em" }],
      },
      boxShadow: {
        // Soft, layered, low-contrast shadows — the premium "floating on cream" feel.
        xs: "0 1px 2px rgba(29, 37, 48, 0.05)",
        sm: "0 1px 2px rgba(29, 37, 48, 0.04), 0 1px 3px rgba(29, 37, 48, 0.06)",
        card: "0 1px 2px rgba(29, 37, 48, 0.04), 0 4px 16px -6px rgba(29, 37, 48, 0.10)",
        lift: "0 2px 4px rgba(29, 37, 48, 0.05), 0 14px 32px -12px rgba(29, 37, 48, 0.18)",
        "lift-lg": "0 4px 8px rgba(29, 37, 48, 0.06), 0 28px 60px -18px rgba(29, 37, 48, 0.28)",
        brand: "0 6px 18px -6px rgba(19, 161, 74, 0.45)",
        "brand-lift": "0 10px 28px -8px rgba(19, 161, 74, 0.50)",
        // Tinted glows for the colorful accent surfaces (bento spotlights).
        citrus: "0 10px 28px -8px rgba(132, 204, 22, 0.45)",
        berry: "0 10px 28px -8px rgba(244, 63, 110, 0.45)",
        grape: "0 10px 28px -8px rgba(124, 58, 237, 0.45)",
        ocean: "0 10px 28px -8px rgba(8, 145, 178, 0.45)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #16ad51 0%, #0c8a3e 55%, #0a6e33 100%)",
        "brand-sheen": "linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 60%)",
        "ink-gradient": "linear-gradient(135deg, #2b333d 0%, #141a22 100%)",
        // Bright duotone accents — used for emoji tiles + soft glows (no text over them).
        "citrus-gradient": "linear-gradient(135deg, #bef264 0%, #16ad51 100%)",
        "sunset-gradient": "linear-gradient(135deg, #fb7185 0%, #f59e0b 60%, #84cc16 120%)",
        // Deeper duotones — full-bleed "spotlight" cards where white text must stay legible.
        "berry-gradient": "linear-gradient(135deg, #f43f6e 0%, #9f1239 100%)",
        "grape-gradient": "linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%)",
        "ocean-gradient": "linear-gradient(135deg, #0891b2 0%, #155e75 100%)",
        // A wide, multi-stop brand gradient for the animated headline text.
        "text-brand":
          "linear-gradient(100deg, #0a6e33 0%, #13a14a 22%, #84cc16 45%, #13a14a 68%, #0a6e33 100%)",
        // Aurora mesh — layered radial glows for the hero backdrop.
        "aurora":
          "radial-gradient(40% 60% at 12% 18%, rgba(19,161,74,0.30), transparent 60%), radial-gradient(45% 55% at 88% 12%, rgba(132,204,22,0.28), transparent 60%), radial-gradient(50% 60% at 70% 88%, rgba(34,211,238,0.20), transparent 60%), radial-gradient(40% 50% at 20% 90%, rgba(244,113,147,0.16), transparent 60%)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        // Slow drift + scale for the aurora blobs behind the hero.
        aurora: {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)", opacity: "0.9" },
          "33%": { transform: "translate3d(2%, -2.5%, 0) scale(1.08)", opacity: "1" },
          "66%": { transform: "translate3d(-2%, 2%, 0) scale(0.96)", opacity: "0.85" },
        },
        // Pan a wide background gradient (animated headline / borders).
        "gradient-pan": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        // Light sweep across buttons / cards.
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "60%, 100%": { transform: "translateX(220%)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Gentle pulse for "live"/status dots.
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(19,161,74,0.45)" },
          "70%, 100%": { boxShadow: "0 0 0 8px rgba(19,161,74,0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        float: "float 6s ease-in-out infinite",
        aurora: "aurora 20s ease-in-out infinite",
        "gradient-pan": "gradient-pan 6s linear infinite",
        shimmer: "shimmer 3s ease-in-out infinite",
        pop: "pop 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
