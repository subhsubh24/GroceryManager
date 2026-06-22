"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@/app/components/icons";

/**
 * Floating light/dark toggle, available on every screen. The initial class is set by the no-flash
 * inline script in the layout (before paint); this just reflects + flips it and persists the choice.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* storage blocked — the toggle still works for this session */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? (dark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      aria-pressed={mounted ? dark : undefined}
      className="fixed bottom-20 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface shadow-lift transition-colors duration-150 hover:bg-ink-50 md:bottom-6"
    >
      {/* Render the opposite-of-current glyph; suppress hydration since the class is set pre-paint. */}
      <span suppressHydrationWarning>
        {mounted && dark ? (
          <Sun className="h-5 w-5" strokeWidth={2} />
        ) : (
          <Moon className="h-5 w-5" strokeWidth={2} />
        )}
      </span>
    </button>
  );
}
