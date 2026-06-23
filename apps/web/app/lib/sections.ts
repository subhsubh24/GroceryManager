import {
  BookOpen,
  CalendarDays,
  Camera,
  ChefHat,
  ClipboardPaste,
  Flame,
  Gift,
  MessageCircle,
  Newspaper,
  Package,
  PartyPopper,
  PencilLine,
  Pill,
  ReceiptText,
  Recycle,
  Repeat,
  ScanBarcode,
  ShoppingCart,
  CookingPot,
  Salad,
  SprayCan,
  Star,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "../components/icons";

/**
 * The full feature catalog ("all tools"). Lives here — not in `page.tsx` — so the focused home and
 * the `/tools` index can share one source of truth. Each entry keeps its original `key`, `href`,
 * `title`, `blurb`, and `icon` (a real Lucide component, not emoji); the only addition is `group`,
 * used to organize the `/tools` page.
 *
 * Presentation/IA data only — no server logic. Order within a group is the display order on `/tools`.
 */
export type SectionGroup = "Cook" | "Shop" | "Track" | "You";

export type Section = {
  key: string;
  href: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  group: SectionGroup;
};

/**
 * Group order on the /tools page: actionable kitchen flows first, then tracking, then account.
 * The values double as the heading text shown on /tools (no separate label map needed).
 */
export const GROUP_ORDER: SectionGroup[] = ["Cook", "Shop", "Track", "You"];

export const SECTIONS: Section[] = [
  // ── Cook ──────────────────────────────────────────────────────────────────
  {
    key: "recipes",
    href: "/recipes",
    title: "Cook what you have tonight",
    blurb: "Real meals you can make right now — tuned to your taste, your diet, and how much energy you've actually got.",
    icon: ChefHat,
    group: "Cook",
  },
  {
    key: "make",
    href: "/make",
    title: "What can I make?",
    blurb: "Meal ideas from what's in your kitchen — tuned to how much energy you've got.",
    icon: CookingPot,
    group: "Cook",
  },
  {
    key: "discover",
    href: "/discover",
    title: "Discover",
    blurb: "Swipe through meal ideas picked for you — it learns your taste as you go.",
    icon: Flame,
    group: "Cook",
  },
  {
    key: "cookbook",
    href: "/cookbook",
    title: "My Cookbook",
    blurb: "Save the recipes you love and cook them again in a tap.",
    icon: BookOpen,
    group: "Cook",
  },
  {
    key: "import",
    href: "/import",
    title: "Import a recipe",
    blurb: "Paste any link or text — it's structured, matched to your pantry, and ready to cook.",
    icon: ClipboardPaste,
    group: "Cook",
  },
  {
    key: "ask",
    href: "/ask",
    title: "Ask your kitchen",
    blurb: "Chat with an AI that knows your habits — spending, cooking, what to make next.",
    icon: MessageCircle,
    group: "Cook",
  },
  {
    key: "use-it-up",
    href: "/use-it-up",
    title: "Use it up",
    blurb: "What's about to spoil, with one-tap recipes to rescue it before it's wasted.",
    icon: Recycle,
    group: "Cook",
  },
  {
    key: "plan",
    href: "/plan",
    title: "Plan my week",
    blurb: "A week of meals drafted from what you have and what's running low — review, then order in a tap.",
    icon: CalendarDays,
    group: "Cook",
  },

  // ── Shop ──────────────────────────────────────────────────────────────────
  {
    key: "list",
    href: "/list",
    title: "Shopping list",
    blurb: "Smart reorders before you run out. One tap to checkout on Instacart.",
    icon: ShoppingCart,
    group: "Shop",
  },
  {
    key: "capture",
    href: "/capture",
    title: "Quick add",
    blurb: "Type it like you'd say it — “out of milk, need taco stuff” — and it lands on your list.",
    icon: PencilLine,
    group: "Shop",
  },
  {
    key: "barcode",
    href: "/barcode",
    title: "Scan a barcode",
    blurb: "Scan or type a UPC — we look it up and add it to your list.",
    icon: ScanBarcode,
    group: "Shop",
  },
  {
    key: "scan",
    href: "/scan",
    title: "Scan my fridge",
    blurb: "Snap a shelf — it reconciles what's actually there against what it thinks you have.",
    icon: Camera,
    group: "Shop",
  },
  {
    key: "pantry",
    href: "/pantry",
    title: "A pantry that fills itself",
    blurb: "Your receipts become your inventory — automatically. It knows what you have and what's about to expire.",
    icon: Package,
    group: "Shop",
  },
  {
    key: "add-receipt",
    href: "/add-receipt",
    title: "Snap a receipt",
    blurb: "Shopped somewhere else? Photograph a paper or email receipt and it's added to your pantry.",
    icon: ReceiptText,
    group: "Shop",
  },
  {
    key: "staples",
    href: "/staples",
    title: "Staples autopilot",
    blurb: "Set and forget your always-on items — they appear on the list the moment they're due.",
    icon: Repeat,
    group: "Shop",
  },
  {
    key: "household",
    href: "/staples",
    title: "Household & personal care",
    blurb: "Cleaning, skincare & toiletries on autopilot — reordered from Amazon when you're low.",
    icon: SprayCan,
    group: "Shop",
  },
  {
    key: "supplements",
    href: "/staples",
    title: "Supplements",
    blurb: "Set your daily dose — it predicts run-out (even the first bottle) and reorders in time.",
    icon: Pill,
    group: "Shop",
  },
  {
    key: "review",
    href: "/review",
    title: "Review purchases",
    blurb: "Confirm the items we couldn't match with confidence — a quick tidy keeps your pantry accurate.",
    icon: ReceiptText,
    group: "Shop",
  },

  // ── Track ─────────────────────────────────────────────────────────────────
  {
    key: "cooked",
    href: "/cooked",
    title: "Meals & macros",
    blurb: "Everything you've cooked — with the calories and macros, tracked over time.",
    icon: UtensilsCrossed,
    group: "Track",
  },
  {
    key: "spend",
    href: "/spend",
    title: "Spending",
    blurb: "What you spend, where it goes, and where the same item is cheaper.",
    icon: Wallet,
    group: "Track",
  },
  {
    key: "wrapped",
    href: "/wrapped",
    title: "Grocery Wrapped",
    blurb: "Your recap: meals cooked, money saved vs takeout, top recipes — made to share.",
    icon: PartyPopper,
    group: "Track",
  },
  {
    key: "digest",
    href: "/digest",
    title: "This week",
    blurb: "Your Sunday briefing — what's expiring, what's due to reorder, at a glance.",
    icon: Newspaper,
    group: "Track",
  },

  // ── You ───────────────────────────────────────────────────────────────────
  {
    key: "onboarding",
    href: "/onboarding",
    title: "Tell me your taste",
    blurb: "Diets, loves, hates — in a minute. Every plan and recipe gets tuned to you.",
    icon: Salad,
    group: "You",
  },
  {
    key: "invite",
    href: "/invite",
    title: "Invite friends",
    blurb: "Share GroceryManager — you both get a perk when they join.",
    icon: Gift,
    group: "You",
  },
  {
    key: "shared-household",
    href: "/household",
    title: "Shared household",
    blurb: "Share one shopping list with the people you shop for — add it once, it's there for all.",
    icon: Users,
    group: "You",
  },
  {
    key: "upgrade",
    href: "/upgrade",
    title: "Go Premium",
    blurb: "Unlock the AI planner, unlimited Discover, and recipe remix — and support the app.",
    icon: Star,
    group: "You",
  },
];

/** The catalog grouped + ordered for the /tools page. Empty groups are dropped by the caller. */
export function sectionsByGroup(): { group: SectionGroup; items: Section[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    items: SECTIONS.filter((s) => s.group === group),
  })).filter((g) => g.items.length > 0);
}
