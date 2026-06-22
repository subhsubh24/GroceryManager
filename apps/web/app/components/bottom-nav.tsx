"use client";

import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChefHat,
  Home,
  Package,
  ShoppingCart,
  type LucideIcon,
} from "@/app/components/icons";

/**
 * Mobile-first bottom tab bar — the "this is a real app" signal for phones. Solid, fixed, and shown
 * only on the in-app screens (hidden on the marketing landing, auth, and public share pages).
 * Desktop keeps the landing's top nav + per-page back-links, so this is `md:hidden`.
 */
const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/pantry", label: "Pantry", icon: Package },
  { href: "/recipes", label: "Cook", icon: ChefHat },
  { href: "/list", label: "List", icon: ShoppingCart },
  { href: "/plan", label: "Plan", icon: CalendarDays },
];

// `/cook/…` is focused cook-mode (full-screen, screen-awake) — hide the bar there, but NOT on
// `/cookbook` (a normal in-app screen). The trailing slash anchors to the `/cook/[id]` route only.
// `/onboarding` is its own full-screen step-flow with its own footer controls — hide the bar so it
// doesn't overlap the flow's bottom buttons.
const HIDDEN_ON = [/^\/$/, /^\/signin/, /^\/signup/, /^\/onboarding/, /^\/share/, /^\/cook\//];

export function BottomNav() {
  const pathname = usePathname() || "/";
  if (HIDDEN_ON.some((re) => re.test(pathname))) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <a
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1 text-[0.65rem] font-semibold transition-colors duration-150 ${
                  active ? "text-brand-700" : "text-ink-400 hover:text-ink-700"
                }`}
              >
                <span
                  className={`flex h-9 w-12 items-center justify-center rounded-2xl leading-none transition-colors duration-150 ${
                    active ? "bg-brand-50" : ""
                  }`}
                >
                  <it.icon className="h-5 w-5" strokeWidth={2} />
                </span>
                {it.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
