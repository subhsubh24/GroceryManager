import { Leaf } from "@/app/components/icons";

/**
 * App-Router 404. Providing this (and global-error.tsx) keeps Next from falling back to the
 * pages-router `/_error` + `_document` during the production build — which intermittently triggers
 * "Html should not be imported outside of pages/_document" and fails `next build`. Also just nicer
 * than the default 404.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <span className="tile-brand h-12 w-12">
        <Leaf className="h-6 w-6" strokeWidth={2} aria-hidden />
      </span>
      <h1 className="page-title mt-5">Page not found</h1>
      <p className="page-subtitle mx-auto">That page doesn&apos;t exist or has moved.</p>
      <a href="/" className="btn-primary mt-6 px-5 py-3 text-base">
        Back to your kitchen
      </a>
    </main>
  );
}
