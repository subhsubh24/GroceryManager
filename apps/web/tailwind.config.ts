import type { Config } from "tailwindcss";

/**
 * GroceryManager design system — warm, food-forward, premium (polish bar: Linear / Stripe /
 * Things / Cal.com, but warmer). Brand is a confident green on a warm off-white "cream" canvas,
 * with a cohesive ink scale, soft layered shadows, generous radii, and tasteful motion.
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
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-serif", "Georgia", "serif"],
      },
      fontSize: {
        // A tighter, more confident display rhythm for big headings.
        "display-sm": ["2rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display": ["2.75rem", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-lg": ["3.5rem", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
      },
      boxShadow: {
        // Soft, layered, low-contrast shadows — the premium "floating on cream" feel.
        xs: "0 1px 2px rgba(29, 37, 48, 0.05)",
        sm: "0 1px 2px rgba(29, 37, 48, 0.04), 0 1px 3px rgba(29, 37, 48, 0.06)",
        card: "0 1px 2px rgba(29, 37, 48, 0.04), 0 4px 16px -6px rgba(29, 37, 48, 0.10)",
        lift: "0 2px 4px rgba(29, 37, 48, 0.05), 0 14px 32px -12px rgba(29, 37, 48, 0.18)",
        brand: "0 6px 18px -6px rgba(19, 161, 74, 0.45)",
        "brand-lift": "0 10px 28px -8px rgba(19, 161, 74, 0.50)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #16ad51 0%, #0c8a3e 55%, #0a6e33 100%)",
        "brand-sheen": "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
        "ink-gradient": "linear-gradient(135deg, #2b333d 0%, #141a22 100%)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
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
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        float: "float 6s ease-in-out infinite",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
