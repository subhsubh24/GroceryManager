import type { Config } from "tailwindcss";

/**
 * Instacart-*inspired* theme (original, not copied): clean, green, card-based,
 * generous whitespace, big tap targets, mobile-first. (PLAN — Design.)
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eafaf0",
          100: "#cdf2da",
          200: "#9ee6b6",
          300: "#66d48d",
          400: "#34bd66",
          500: "#13a14a", // primary
          600: "#0c8a3e",
          700: "#0a6e33",
          800: "#0a572b",
          900: "#084724",
        },
        cream: "#faf8f3",
        ink: "#1d2530",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
