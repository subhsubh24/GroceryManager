"use client";

import { useEffect, useState } from "react";

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
      className="glass fixed bottom-20 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full text-lg shadow-lift transition duration-300 ease-spring hover:scale-105 active:scale-95 md:bottom-6"
    >
      {/* Render the opposite-of-current glyph; suppress hydration since the class is set pre-paint. */}
      <span suppressHydrationWarning>{mounted && dark ? "☀️" : "🌙"}</span>
    </button>
  );
}
