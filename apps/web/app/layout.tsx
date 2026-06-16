import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "./register-sw";

// Body: Inter — clean, modern, highly legible at small sizes.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

// Display: Fraunces — a warm, characterful serif for big headings (food-forward, premium).
// Variable font: omit `weight` (so the full weight axis is available) and opt into the soft + optical
// size axes for a gentler, display-tuned letterform.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "GroceryManager — never stress about groceries or cooking",
  description:
    "A personal grocery + recipe autopilot. It learns what you have, predicts run-outs, builds the order, and suggests meals you can cook right now.",
  applicationName: "GroceryManager",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GroceryManager", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#13a14a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
