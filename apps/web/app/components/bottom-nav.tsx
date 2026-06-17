"use client";

import { usePathname } from "next/navigation";

/**
 * Mobile-first bottom tab bar — the "this is a real app" signal for phones. Frosted, fixed, and
 * shown only on the in-app screens (hidden on the marketing landing, auth, and public share pages).
 * Desktop keeps the landing's top nav + per-page back-links, so this is `md:hidden`.
 */
const ITEMS: { href: string; label: string; emoji: string }[] = [
  { href: "/", label: "Home", emoji: "🏠" },
  { href: "/pantry", label: "Pantry", emoji: "🧺" },
  { href: "/recipes", label: "Cook", emoji: "🍳" },
  { href: "/list", label: "List", emoji: "🛒" },
  { href: "/plan", label: "Plan", emoji: "🗓️" },
];

// `/cook/…` is focused cook-mode (full-screen, screen-awake) — hide the bar there, but NOT on
// `/cookbook` (a normal in-app screen). The trailing slash anchors to the `/cook/[id]` route only.
const HIDDEN_ON = [/^\/$/, /^\/signin/, /^\/signup/, /^\/share/, /^\/cook\//];

export function BottomNav() {
  const pathname = usePathname() || "/";
  if (HIDDEN_ON.some((re) => re.test(pathname))) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-cream/80 backdrop-blur-xl backdrop-saturate-150 md:hidden"
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
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1 text-[0.65rem] font-semibold transition ${
                  active ? "text-brand-700" : "text-ink-400 hover:text-ink-700"
                }`}
              >
                <span
                  className={`flex h-9 w-12 items-center justify-center rounded-2xl text-lg leading-none transition duration-300 ease-spring ${
                    active ? "scale-105 bg-brand-50" : ""
                  }`}
                >
                  {it.emoji}
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
