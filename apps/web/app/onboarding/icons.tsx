/**
 * Onboarding icon set — a tiny, intentional mapping onto `lucide-react` (a real icon set, NOT emoji).
 * Centralizing it here keeps the flow's markup clean and guarantees every glyph in onboarding is a
 * crisp, consistently-stroked SVG that inherits `currentColor` and sizing from its tile.
 *
 * Lucide icons are React components; we re-export the handful the flow uses under semantic names so
 * the step screens read by intent ("Profile", "Items") rather than by icon trivia.
 */
export {
  User as ProfileIcon,
  Salad as TasteIcon,
  PackagePlus as ItemsIcon,
  PartyPopper as DoneIcon,
  Camera as ScanIcon,
  PencilLine as QuickAddIcon,
  ReceiptText as ReceiptsIcon,
  ArrowLeft as BackIcon,
  ArrowRight as NextIcon,
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  Loader2 as SpinnerIcon,
} from "lucide-react";
