import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
