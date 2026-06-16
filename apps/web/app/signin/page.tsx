import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * Email + password sign-in (PLAN §8.7). The server action calls signIn("credentials", …); on bad
 * credentials NextAuth throws an AuthError, which we map to a friendly ?error= banner. On success
 * signIn throws a NEXT_REDIRECT (to redirectTo) that must propagate — so we only swallow AuthError.
 */
async function signInAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/signin?error=missing");
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-sm font-medium text-brand-600">GroceryManager</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-ink/60">Sign in with your email and password.</p>

      {error && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {error === "missing"
            ? "Please enter your email and password."
            : "That email and password don't match. Try again."}
        </p>
      )}

      <form action={signInAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        No account?{" "}
        <a href="/signup" className="font-medium text-brand-600">
          Create one
        </a>
      </p>
    </main>
  );
}
