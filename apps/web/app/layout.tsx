import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "./register-sw";
import { BottomNav } from "./components/bottom-nav";
import { ThemeToggle } from "./components/theme-toggle";
import { InstallPrompt } from "./components/install-prompt";

// Runs before paint to set the theme class — prevents a flash of the wrong theme on load.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

// One typeface for the whole app: Hanken Grotesk — a distinctive, professional grotesque with real
// character (a warmer, less default-feeling alternative to Inter). It backs BOTH the body
// (`--font-sans`) and display headings (`--font-display`); hierarchy comes from weight, size, and
// tracking, not a second family. Intentional weight range only — no serif anywhere.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "GroceryManager — know what to cook and what to buy",
  description:
    "A personal grocery + recipe autopilot. It learns what you have, predicts run-outs, builds the order, and suggests meals you can cook right now.",
  applicationName: "GroceryManager",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GroceryManager", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#13a14a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1216" },
  ],
  width: "device-width",
  initialScale: 1,
  // Extend under the notch / home-indicator so `env(safe-area-inset-*)` resolves to real insets
  // (otherwise it's 0). The onboarding chat pads its bottom input bar against the inset.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={hankenGrotesk.variable}
      style={{ "--font-display": "var(--font-sans)" } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <RegisterSW />
        {children}
        <BottomNav />
        <ThemeToggle />
        <InstallPrompt />
      </body>
    </html>
  );
}
