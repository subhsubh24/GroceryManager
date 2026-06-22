import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import {
  createUserWithPassword,
  getAdminDb,
  getUserByEmail,
  getUserIdByReferralCode,
  recordReferral,
} from "@gm/db";
import { hashPassword } from "@gm/core/crypto";
import { isValidReferralCode } from "@gm/core/personalization";
import { signIn } from "@/auth";
import { Leaf } from "@/app/components/icons";

export const dynamic = "force-dynamic";

/**
 * Create an account: email + password only (username = email). The user's PROFILE (name, age, gender)
 * is now collected in the onboarding flow's first step — `/onboarding` — and written there as
 * profile:* preferenceSignals (PLAN §8.7). Signup just provisions the account and signs the user in;
 * the credentials redirect (`signIn`) sends new accounts straight into onboarding to gather it.
 */
async function registerAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ref = String(formData.get("ref") ?? "").trim();

  if (!email || !password) redirect("/signup?error=missing");
  if (password.length < 8) redirect("/signup?error=weak");

  const existing = await getUserByEmail(getAdminDb(), email);
  if (existing) redirect("/signup?error=exists");

  // Provision the user on the admin connection (a brand-new row can't satisfy its own RLS). Name is
  // captured later in onboarding (profile step), so the account row starts without one.
  const userId = await createUserWithPassword(getAdminDb(), {
    email,
    name: null,
    passwordHash: hashPassword(password),
  });

  // Referral attribution — STRICTLY best-effort. The user already exists and is about to be signed in;
  // crediting the referrer must NEVER block or break signup. So everything below is wrapped in a single
  // try/catch that swallows any error (bad/unknown code, DB hiccup) and falls through to the normal
  // sign-in. The write uses the admin connection (it credits the *referrer*, a different tenant) and is
  // idempotent inside recordReferral. Runs BEFORE signIn's redirect, but can't throw out of the action.
  if (ref && isValidReferralCode(ref)) {
    try {
      const referrerUserId = await getUserIdByReferralCode(getAdminDb(), ref);
      if (referrerUserId) await recordReferral(getAdminDb(), referrerUserId, userId);
    } catch {
      /* attribution is best-effort — never let it interfere with signup */
    }
  }

  try {
    // New accounts land in the guided onboarding flow first (returning users via /signin go to /).
    await signIn("credentials", { email, password, redirectTo: "/onboarding" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/signin?error=credentials");
    throw e; // re-throw NEXT_REDIRECT (success)
  }
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const { error, ref } = await searchParams;
  // Carry a valid `?ref=` invite code through the form (hidden field) without changing the visible UX.
  // Validated here so junk never reaches the action; the action re-validates + resolves it best-effort.
  const refCode = typeof ref === "string" && isValidReferralCode(ref) ? ref : null;
  const errorText: Record<string, string> = {
    missing: "Please enter an email and password.",
    weak: "Password must be at least 8 characters.",
    exists: "An account with that email already exists. Try signing in.",
  };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-fade-in-up">
        <a href="/" className="mx-auto flex w-fit items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <Leaf className="h-5 w-5" strokeWidth={2} />
          </span>
        </a>
        <div className="mt-6 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Just an email and password to start — we&apos;ll set up the rest in a minute.
          </p>
        </div>

        <div className="card-pad mt-7">
          {error && <p className="notice-warn mb-4">{errorText[error] ?? "Something went wrong. Try again."}</p>}

          <form action={registerAction} className="space-y-4">
            {refCode && <input type="hidden" name="ref" value={refCode} />}
            <label className="block">
              <span className="field-label">Email</span>
              <input name="email" type="email" autoComplete="email" required className="input" />
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="input"
              />
              <span className="field-hint">At least 8 characters.</span>
            </label>
            <button type="submit" className="btn-primary btn-block">
              Create account
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <a href="/signin" className="font-semibold text-brand-700 hover:text-brand-800">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
