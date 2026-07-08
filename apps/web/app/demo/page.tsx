import type { Metadata } from "next";
import Link from "next/link";
import { DemoClient } from "./demo-client";
import { PlausiblePageview } from "@/app/components/PlausiblePageview";
import { ClipboardPaste, Leaf, ShieldCheck } from "@/app/components/icons";

export const dynamic = "force-dynamic";
// A single cheap extraction runs server-side via the API route; the page itself is light.

export const metadata: Metadata = {
  title: "Try it free — turn a grocery receipt into a pantry list | GroceryManager",
  description:
    "See the magic in 10 seconds: paste or snap a grocery receipt and watch GroceryManager auto-fill your pantry. No account, no signup.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Turn a grocery receipt into a pantry — in 10 seconds",
    description:
      "Paste or snap a receipt and watch it become a pantry list. No account needed. This is the first 10 seconds of GroceryManager.",
    url: "/demo",
    type: "website",
  },
};

export default function DemoPage() {
  return (
    <main className="min-h-dvh bg-cream">
      <PlausiblePageview event="demo_view" />
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Brand mark → home */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-700">
          <span className="tile-brand h-8 w-8">
            <Leaf className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          GroceryManager
        </Link>

        <header className="mt-8">
          <p className="eyebrow">Live demo · no account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-4xl">
            Turn a receipt into a pantry — in 10 seconds.
          </h1>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-ink-500">
            This is the core of GroceryManager. Paste the text of a grocery receipt, or snap a photo,
            and watch it become a clean, itemized pantry list. Nothing is saved — try it as many times
            as you like.
          </p>
        </header>

        <section className="mt-8" aria-label="Receipt demo">
          <DemoClient />
        </section>

        {/* How it works — concrete, no AI-flourish slop */}
        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="card card-pad">
            <span className="tile-brand h-9 w-9">
              <ClipboardPaste className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <h2 className="mt-3 text-base font-semibold text-ink-800">Paste or snap</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              Works with an emailed receipt&apos;s text or a photo of a paper one. We read the line
              items, quantities, and units.
            </p>
          </div>
          <div className="card card-pad">
            <span className="tile-brand h-9 w-9">
              <ShieldCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <h2 className="mt-3 text-base font-semibold text-ink-800">Nothing stored</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              This demo keeps no account and saves no data. In the full app your pantry stays private
              to you and updates itself as you shop and cook.
            </p>
          </div>
        </section>

        <footer className="mt-10 border-t border-line pt-6 text-center text-sm text-ink-400">
          <p>
            Like what you see?{" "}
            <a href="/#waitlist" className="font-semibold text-brand-700 underline underline-offset-2">
              Join the waitlist
            </a>{" "}
            for the full app.
          </p>
        </footer>
      </div>
    </main>
  );
}
