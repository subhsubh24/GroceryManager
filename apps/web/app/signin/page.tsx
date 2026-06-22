import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { normalizeUsername } from "@gm/core/personalization";
import { signIn } from "@/auth";
import { Leaf } from "@/app/components/icons";

export const dynamic = "force-dynamic";

/**
 * Username + password sign-in (PLAN §8.7). The server action calls signIn("credentials", …); on bad
 * credentials NextAuth throws an AuthError, which we map to a friendly ?error= banner. On success
 * signIn throws a NEXT_REDIRECT (to redirectTo) that must propagate — so we only swallow AuthError.
 */
async function signInAction(formData: FormData) {
  "use server";
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!username || !password) redirect("/signin?error=missing");
  try {
    await signIn("credentials", { username, password, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/signin?error=credentials");
    throw e; // re-throw NEXT_REDIRECT (success) and anything unexpected
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm animate-fade-in-up">
        <a href="/" className="mx-auto flex w-fit items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <Leaf className="h-5 w-5" strokeWidth={2} />
          </span>
        </a>
        <div className="mt-6 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-ink-500">Sign in with your username and password.</p>
        </div>

        <div className="card-pad mt-7">
          {error && (
            <p className="notice-warn mb-4">
              {error === "missing"
                ? "Please enter your username and password."
                : "That username and password don't match. Try again."}
            </p>
          )}

          <form action={signInAction} className="space-y-4">
            <label className="block">
              <span className="field-label">Username</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                className="input"
              />
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
              />
            </label>
            <button type="submit" className="btn-primary btn-block">
              Sign in
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          No account?{" "}
          <a href="/signup" className="font-semibold text-brand-700 hover:text-brand-800">
            Create one
          </a>
        </p>
      </div>
    </main>
  );
}
