/**
 * Mobile icon set — a single, intentional mapping onto `@expo/vector-icons`' Ionicons (crisp,
 * consistently-stroked outline SVGs designed for iOS/Android). This mirrors the web PWA's
 * `apps/web/app/components/icons.tsx` registry: centralizing every glyph here keeps each screen's
 * markup clean and guarantees each affordance is a real vector icon — never a raw Unicode glyph
 * (`←` `→` `›` `✓`) or emoji standing in for an icon.
 *
 * Each export is a thin wrapper exposing `{ size?, color? }` so screens read by intent
 * (`<ChevronRight />`, `<Check />`) rather than by icon-name trivia, and so the underlying icon
 * set can be swapped in exactly one place. Colors default to the app's ink; pass `color`/`size`
 * to theme per context (a white check on a green mark, a muted chevron on a list row, …).
 */
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type IconProps = {
  /** Square icon size in points. Defaults to 20 — a comfortable inline/control size. */
  size?: number;
  /** Stroke/fill color. Defaults to the app ink; override per surface. */
  color?: string;
};

/** App ink — matches the `#1d2530` used across the native screens' primary text. */
const INK = "#1d2530";

function makeIcon(name: IoniconName, defaultColor: string = INK) {
  function Icon({ size = 20, color = defaultColor }: IconProps) {
    return <Ionicons name={name} size={size} color={color} />;
  }
  return Icon;
}

// ── Chrome / controls ────────────────────────────────────────────────────────
export const ChevronLeft = makeIcon("chevron-back");
export const ChevronRight = makeIcon("chevron-forward");
export const ArrowLeft = makeIcon("arrow-back");
export const ArrowRight = makeIcon("arrow-forward");
export const Check = makeIcon("checkmark");
// Premium mark on the paywall header. A filled star reads as "premium / featured" with none of the
// AI connotation the sparkle carries (see Wrapped below) — replacing a raw `★` glyph so the flagship
// monetization surface uses a real vector icon like every other affordance.
export const Star = makeIcon("star");

// ── Home / section navigation (one per home-grid destination) ────────────────
export const Pantry = makeIcon("cube-outline");
export const ShoppingList = makeIcon("cart-outline");
export const Cookbook = makeIcon("book-outline");
export const CookTonight = makeIcon("restaurant-outline");
export const PlanWeek = makeIcon("calendar-outline");
export const UseItUp = makeIcon("leaf-outline");
export const Discover = makeIcon("compass-outline");
export const Spend = makeIcon("wallet-outline");
export const Meals = makeIcon("nutrition-outline");
export const Stats = makeIcon("stats-chart-outline");
// Grocery Wrapped = a celebratory year-in-review. Deliberately NOT `sparkles` — the web registry
// reserves the sparkle for AI-generated content ("Planned by AI") and flags it as an "AI flourish"
// to avoid; a trophy reads as "your year's highlights" without that connotation.
export const Wrapped = makeIcon("trophy-outline");
export const QuickAdd = makeIcon("add-circle-outline");
export const Profile = makeIcon("person-circle-outline");
// AI recipe remix (the "healthier / cheaper / faster / vegan" swap generator). A magic wand mirrors
// the web registry's Wand2 for the same perk — it reads as "transform this recipe" and, unlike the
// sparkle reserved for generic "planned by AI" flourishes, carries a concrete make-it-your-way intent.
export const Remix = makeIcon("color-wand-outline");
