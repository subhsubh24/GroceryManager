/**
 * App-wide icon set — a single, intentional mapping onto `lucide-react` (a real icon set, NOT emoji).
 * Centralizing it here keeps every screen's markup clean and guarantees each glyph is a crisp,
 * consistently-stroked SVG that inherits `currentColor` and sizing from its tile/context.
 *
 * Lucide icons are React components; we re-export the ones the app uses under semantic names so the
 * pages read by intent ("Pantry", "ShoppingCart") rather than by icon trivia. Mirrors the onboarding
 * flow's `onboarding/icons.tsx`. `LucideIcon` is re-exported for prop typing (e.g. `sections.ts`).
 */
export type { LucideIcon } from "lucide-react";

export {
  // ── Navigation / sections ────────────────────────────────────────────────
  Home,
  Package, // pantry
  ChefHat, // cook / recipes
  ShoppingCart, // shopping list
  CalendarDays, // plan
  Flame, // discover
  BookOpen, // cookbook
  ClipboardPaste, // import
  MessageCircle, // ask
  Recycle, // use it up
  PencilLine, // quick add / capture
  ScanBarcode, // barcode
  Camera, // scan
  Repeat, // staples
  SprayCan, // household care
  Pill, // supplements
  ReceiptText, // review
  Wallet, // spend
  PartyPopper, // wrapped
  Newspaper, // digest
  Sparkles, // (legacy) — avoid: the sparkle reads as "AI flourish"; prefer a concrete icon below
  Gift, // invite
  Users, // shared household
  Star, // upgrade / premium
  User, // profile
  LayoutGrid, // all tools
  Salad, // taste / food preferences (replaces the AI-sparkle on onboarding)
  CookingPot, // "what can I make" / meal ideas
  Shuffle, // remix a recipe
  Lightbulb, // generate ideas
  Wand2, // remix (alt)

  // ── Chrome / controls ────────────────────────────────────────────────────
  Sun, // theme toggle (dark → show sun)
  Moon, // theme toggle (light → show moon)
  X, // dismiss
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Check,
  Plus,
  Search,
  Trash2,
  Loader2, // inline spinner for pending actions
  Leaf,

  // ── Page-specific accents picked up during the sweep ──────────────────────
  Heart, // save / like
  Link2, // join via link
  Bell, // push reminders
  Mail, // connect Gmail / receipts
  UtensilsCrossed, // generic meal / dish
  Sprout, // fresh / nothing-expiring
} from "lucide-react";
