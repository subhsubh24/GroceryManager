import type { Metadata } from "next";
import { getAdminDb, getUserIdByCookbookToken, loadSavedRecipes } from "@gm/db";
import { dedupeSaved, isValidShareToken, type SavedRecipe } from "@gm/core/recipe";
import { BookOpen, Leaf } from "@/app/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "A GroceryManager cookbook",
    description: "A shared collection of recipes — tap any one to see the ingredients and shop them in a tap.",
  };
}

/** Friendly terminal state for a bad/expired/unknown token — no PII, just a path back to signup. */
function NotFound() {
  return (
    <main className="page-narrow">
      <BrandMark />
      <div className="empty-state mt-8">
        <div className="empty-emoji">
          <BookOpen className="h-6 w-6" strokeWidth={2} />
        </div>
        <p className="text-sm font-medium text-ink-700">Cookbook not found</p>
        <p className="mt-1 max-w-xs text-sm text-ink-400">
          This share link is invalid or no longer available.
        </p>
      </div>
      <SignupCta />
    </main>
  );
}

/** The GroceryManager wordmark + a "shared cookbook" pill — same identity language as share/recipe. */
function BrandMark() {
  return (
    <div className="flex items-center justify-between">
      <a href="/" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-brand">
          <Leaf className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-sm font-semibold text-ink-800">GroceryManager</span>
      </a>
      <span className="pill-brand">Shared cookbook</span>
    </div>
  );
}

/** Conversion CTA — the share page is the growth surface, mirroring share/recipe/[id]/page.tsx. */
function SignupCta() {
  return (
    <section className="panel-brand mt-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-sm">
          <h2 className="font-display text-xl font-semibold">Build your own cookbook</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/90">
            Save recipes, plan your week, and shop the ingredients in a tap — GroceryManager keeps it
            all in one place.
          </p>
        </div>
        {/* `brand-solid-hover` (deep green) — brand-solid fails WCAG AA as text on white; the
            hover-shade token clears 4.5:1. */}
        <a
          href="/signup"
          className="btn inline-flex shrink-0 bg-white px-5 py-3 text-base text-brand-solid-hover shadow-lift hover:bg-white/95"
        >
          Try it free →
        </a>
      </div>
    </section>
  );
}

export default async function ShareCookbookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // 1. Cheap shape gate BEFORE any DB work — rejects junk/injection-flavored input.
  if (!isValidShareToken(token)) return <NotFound />;

  // 2. Resolve token → the single owning userId. The public page has no session, so this read (and
  //    the saved-recipes read below) use the admin connection — the same RLS-bypass posture as the
  //    existing public share/recipe page and the workers. The token is the ONLY user input, and it
  //    flows through a parameterized `eq`; every downstream query is scoped to this one userId.
  let saved: SavedRecipe[] = [];
  try {
    const userId = await getUserIdByCookbookToken(getAdminDb(), token);
    if (!userId) return <NotFound />;
    saved = dedupeSaved(await loadSavedRecipes(getAdminDb(), userId));
  } catch {
    return <NotFound />;
  }

  return (
    <main className="page-narrow">
      <div className="animate-fade-in-up">
        <BrandMark />
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          A shared cookbook
        </h1>
        <p className="page-subtitle">
          {saved.length > 0
            ? "A hand-picked collection of recipes. Tap any one to see the ingredients and shop them in a tap."
            : "This collection is still being filled."}
        </p>
      </div>

      {saved.length === 0 ? (
        <div className="empty-state mt-8">
          <div className="empty-emoji">
            <BookOpen className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">No recipes yet</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            There&apos;s nothing saved here yet — check back soon.
          </p>
        </div>
      ) : (
        // Read-only, magazine-style grid. Title + image ONLY (no owner name/email or any other data).
        <ul className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {saved.map((r) => (
            <li key={r.id}>
              {/* Each card links to the EXISTING PUBLIC recipe page — never the auth-gated /cook/[id]. */}
              <a href={`/share/recipe/${r.id}`} className="card card-hover group block overflow-hidden">
                {r.imageUrl ? (
                  <div className="relative h-40 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-ink-900/10 to-transparent" />
                    <h2 className="absolute inset-x-0 bottom-0 p-4 font-display text-lg font-semibold leading-snug text-white">
                      {r.title}
                    </h2>
                  </div>
                ) : (
                  <div className="p-4">
                    <h2 className="font-display text-lg font-semibold leading-snug text-ink-900">
                      {r.title}
                    </h2>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3">
                  {r.cuisine ? <span className="text-xs text-ink-400">{r.cuisine}</span> : <span />}
                  <span className="text-xs font-medium text-brand-700 group-hover:underline">
                    View &amp; shop →
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      <SignupCta />
    </main>
  );
}
