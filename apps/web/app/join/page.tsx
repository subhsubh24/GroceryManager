import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JoinClient } from "./join-client";
import { PlausiblePageview } from "@/app/components/PlausiblePageview";
import { Gift, Leaf, ShieldCheck } from "@/app/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Redeem your invite | GroceryManager",
  description: "Enter the invite code from your email to join the GroceryManager private beta.",
  alternates: { canonical: "/join" },
  // Pre-launch, invite-only surface — keep it out of search results.
  robots: { index: false, follow: false },
};

export default function JoinPage() {
  return (
    <main className="min-h-dvh bg-cream">
      <PlausiblePageview event="join_view" />
      <div className="mx-auto max-w-md px-5 py-12 sm:px-8 sm:py-16">
        {/* Brand mark → home */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-700">
          <span className="tile-brand h-8 w-8">
            <Leaf className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          GroceryManager
        </Link>

        <header className="mt-8">
          <span className="tile-brand h-11 w-11">
            <Gift className="h-6 w-6" strokeWidth={2} aria-hidden />
          </span>
          <p className="eyebrow mt-4">Private beta · invite only</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-ink-900">
            Redeem your invite
          </h1>
          <p className="mt-3 text-[1.02rem] leading-relaxed text-ink-500">
            Enter the code from your invite email to unlock the full app and create your account.
          </p>
        </header>

        <section className="mt-8" aria-label="Redeem invite code">
          {/* JoinClient reads useSearchParams (for the ?code= deep link), which must be inside a
              Suspense boundary in the App Router. The fallback is the static card shell — it must NOT
              itself read search params. */}
          <Suspense fallback={<div className="card card-pad h-40" aria-hidden />}>
            <JoinClient />
          </Suspense>
        </section>

        <div className="notice-info mt-8 flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" strokeWidth={2} aria-hidden />
          <p className="text-sm leading-relaxed">
            Your invite is personal to you. Once redeemed, you can sign in from any device — no need to
            re-enter the code.
          </p>
        </div>

        <footer className="mt-10 border-t border-line pt-6 text-sm text-ink-400">
          <p>
            Don&apos;t have a code yet?{" "}
            <a href="/#waitlist" className="font-semibold text-brand-700 underline underline-offset-2">
              Join the waitlist
            </a>{" "}
            and we&apos;ll email you one.
          </p>
        </footer>
      </div>
    </main>
  );
}
