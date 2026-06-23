"use client";

/**
 * App-Router global error boundary (500). It REPLACES the root layout when a root render throws, so it
 * must render its own <html>/<body>. Providing it (with not-found.tsx) keeps the production build from
 * falling back to the pages-router `_document`, which intermittently breaks `next build` with
 * "Html should not be imported outside of pages/_document".
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-cream text-ink antialiased">
        <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Something went wrong</h1>
          <p className="mt-2 max-w-sm text-sm text-ink-500">
            A hiccup on our end. Try again, or head back home.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={() => reset()} className="btn-primary px-5 py-3 text-base">
              Try again
            </button>
            <a href="/" className="btn-secondary px-5 py-3 text-base">
              Back home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
